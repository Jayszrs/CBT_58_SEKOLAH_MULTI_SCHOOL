import fs from 'node:fs';
import {googleOwnerApi} from './google-owner-api.mjs';

const schools = JSON.parse(fs.readFileSync(new URL('../config/schools.json', import.meta.url)));
const execute = process.argv.includes('--execute');
const targets = process.argv.filter(a => /^SCH-\d{3}$/.test(a));
if (schools.length !== 58 || new Set(schools.map(s => s.drive_folder_id)).size !== 58) {
  throw Error('Diperlukan 58 folder sekolah yang berbeda.');
}
const results = [];
for (const email of [...new Set(schools.map(s => s.account_email))]) {
  const group = schools.filter(s => s.account_email === email && (!targets.length || targets.includes(s.school_code)));
  if (!group.length) continue;
  let request;
  try { request = await googleOwnerApi(email); }
  catch (error) {
    for (const s of group) results.push({school:s.school_code, passed:false, error:error.message});
    continue;
  }
  for (const s of group) {
    try {
      const url = 'https://www.googleapis.com/drive/v3/files/' + encodeURIComponent(s.drive_folder_id);
      const fields = '?fields=id,name,mimeType,trashed,owners(emailAddress),permissions(type,role)&supportsAllDrives=true';
      const before = await request(url + fields);
      if (before.mimeType !== 'application/vnd.google-apps.folder' || before.trashed || !before.owners?.some(o => o.emailAddress?.toLowerCase() === email.toLowerCase())) {
        throw Error('Identitas, tipe, atau pemilik folder tidak cocok.');
      }
      if (execute && before.name !== s.school_name) await request(url + '?supportsAllDrives=true', 'PATCH', {name:s.school_name});
      const after = execute ? await request(url + fields) : before;
      results.push({school:s.school_code, folder_id:after.id, school_name:s.school_name, previous_name:before.name, name:after.name, renamed:execute && before.name !== after.name, public_role:after.permissions?.find(p => p.type === 'anyone')?.role || 'private', passed:after.name === s.school_name, checked_at:new Date().toISOString()});
    } catch (error) { results.push({school:s.school_code, passed:false, error:error.message}); }
    fs.writeFileSync(new URL('../reports/school-drive-folders.json',import.meta.url), JSON.stringify({executed:execute,results},null,2)+'\n');
    console.log(JSON.stringify(results.at(-1)));
  }
}
if (execute && results.some(r => !r.passed)) process.exitCode = 1;
