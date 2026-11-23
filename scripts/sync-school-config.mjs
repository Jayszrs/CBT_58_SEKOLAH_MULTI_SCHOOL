import fs from 'node:fs';
import path from 'node:path';
const root = path.resolve(import.meta.dirname, '..');
const read = name => JSON.parse(fs.readFileSync(path.join(root, name), 'utf8'));
const source = read('config/spreadsheet-source.json');
const previous = read('config/schools.json');
const provisions = new Map();
for (const group of new Set(previous.map(school => school.firebase_group))) {
  const resultFile = path.join(root, 'firebase-groups', group, 'provision-result.json');
  if (fs.existsSync(resultFile)) {
    const result = JSON.parse(fs.readFileSync(resultFile, 'utf8'));
    if (result.database_status === 'VERIFIED' && result.group === group) provisions.set(group, result);
  }
}
const size = source.schools_per_account;
const groupCount = Math.ceil(source.schools.length / size);
const pad = number => String(number).padStart(2, '0');
const luminance = hex => {
  const rgb = hex.slice(1).match(/../g).map(value => parseInt(value, 16) / 255).map(value => value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4);
  return .2126 * rgb[0] + .7152 * rgb[1] + .0722 * rgb[2];
};
const schools = source.schools.map((item, index) => {
  const schoolId = item.school_code.replace('-', '');
  const old = previous.find(row => row.school_id === schoolId) || {};
  const group = Math.floor(index / size) + 1;
  const expectedEmail = source.account_emails[group - 1] || '';
  const candidate = provisions.get(`FB-${pad(group)}`);
  const provision = candidate?.account_email?.toLowerCase() === expectedEmail.toLowerCase() ? candidate : undefined;
  if (candidate && !provision) throw Error(`Pemilik hasil provisioning FB-${pad(group)} tidak sesuai daftar akun.`);
  const hex = item.theme_primary;
  const hover = '#' + hex.slice(1).match(/../g).map(value => Math.round(parseInt(value, 16) * .8).toString(16).padStart(2, '0')).join('').toUpperCase();
  return {
    ...old, school_id: schoolId, school_code: item.school_code, school_name: item.school_name,
    account_id: `AKUN-${pad(group)}`, account_email: source.account_emails[group - 1] || '',
    firebase_group: `FB-${pad(group)}`, spreadsheet_group: `GRUP-${pad(group)}`,
    firebase_project_id: provision?.project_id || '',
    firebase_database_url: provision?.database_url || '',
    theme_primary: hex, theme_hover: hover, theme_accent: item.theme_accent,
    theme_background: item.theme_background,
    theme_on_primary: luminance(hex) > .179 ? '#000000' : '#FFFFFF',
    script_id: item.script_id || old.script_id || '',
    spreadsheet_id: item.spreadsheet_id || old.spreadsheet_id || '',
    spreadsheet_url: item.spreadsheet_url || old.spreadsheet_url || '',
    drive_folder_id: item.drive_folder_id || old.drive_folder_id || '',
    drive_folder_url: item.drive_folder_url || old.drive_folder_url || '',
    webapp_url: item.webapp_url || old.webapp_url || '',
    source_row: item.source_row,
    status: old.status === 'BELUM_SETUP' && item.script_id ? 'UPLOADED_NOT_DEPLOYED' : old.status || 'BELUM_SETUP',
  };
});
const accounts = Array.from({ length: groupCount }, (_, index) => {
  const members = schools.filter(school => school.account_id === `AKUN-${pad(index + 1)}`);
  return { account_id: `AKUN-${pad(index + 1)}`, role: 'OPERASIONAL', email: source.account_emails[index] || '', schools: members.map(school => school.school_code).join(', '), count: members.length };
});
const central = read('config/central-admin.json');
accounts.push({ account_id: 'ADMIN-01', role: 'ADMIN_PUSAT', email: central.owner_email, schools: '', count: 0 });
const cell = value => /[",\n]/.test(String(value ?? '')) ? '"' + String(value ?? '').replaceAll('"', '""') + '"' : String(value ?? '');
for (const [name, values] of [['schools', schools], ['accounts', accounts]]) {
  fs.writeFileSync(path.join(root, `config/${name}.json`), JSON.stringify(values, null, 2) + '\n');
  const keys = [...new Set(values.flatMap(row => Object.keys(row)))];
  fs.writeFileSync(path.join(root, `config/${name}.csv`), '\uFEFF' + keys.join(',') + '\n' + values.map(row => keys.map(key => cell(row[key])).join(',')).join('\n') + '\n');
}
console.log(`Synced ${schools.length} schools, ${groupCount} operational accounts, ${source.account_emails.length} available emails; ${size} schools/account.`);
