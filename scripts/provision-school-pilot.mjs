import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { googleOwnerApi } from './google-owner-api.mjs';
const root = path.resolve(import.meta.dirname, '..');
const schoolsFile = path.join(root, 'config', 'schools.json');
const schools = JSON.parse(fs.readFileSync(schoolsFile, 'utf8'));
const accountId = process.argv[2] || 'AKUN-01';
const schoolFlag = process.argv.indexOf('--school');
const selectedSchool = schoolFlag >= 0 ? process.argv[schoolFlag+1] : undefined;
if (schoolFlag >= 0 && (!selectedSchool || selectedSchool.startsWith('--'))) throw Error('--school memerlukan kode sekolah.');
const members = schools.filter(item => item.account_id === accountId && (!selectedSchool || selectedSchool === item.school_id || selectedSchool === item.school_code));
if (!members.length || members.length > 5) throw Error('Grup sekolah tidak valid.');
if (!process.argv.includes('--execute')) { console.log(members.map(s => `${s.school_code}: ${s.school_name}`).join('\n')); process.exit(0); }
if (!members[0].firebase_project_id) throw Error('Provisioning Firebase untuk akun ini belum selesai.');
const request = await googleOwnerApi(members[0].account_email, members[0].firebase_project_id);
const api = 'https://script.googleapis.com/v1/projects';
const headers = {
  Bank_Soal: ['ID Soal', 'Tipe', 'Pertanyaan', 'Opsi', 'Kunci Jawaban', 'Bobot', 'URL Gambar', 'Mata Pelajaran', 'Petunjuk', 'Teks Pendukung', 'Opsi Gambar'],
  Data_Siswa: ['NISN', 'Nama', 'Kelas', 'Password', 'Status Login'],
  Respon_Jawaban: ['Timestamp', 'ID Siswa', 'Jawaban Mentah', 'Skor Objektif', 'Skor Esai', 'Nilai Akhir', 'Status', 'Log Pelanggaran'],
  Arsip_Respon_Jawaban: ['Timestamp', 'ID Siswa', 'Jawaban Mentah', 'Skor Objektif', 'Skor Esai', 'Nilai Akhir', 'Status', 'Log Pelanggaran'],
  Daftar_Kelas: ['ID Kelas', 'Nama Kelas'], Daftar_Mapel: ['ID Mapel', 'Nama Mapel'],
  Paket_Soal: ['id_paket', 'nama_paket', 'deskripsi', 'soal_ids', 'dibuat_pada'], Config: ['Key', 'Value'],
};
const save = () => {
  fs.writeFileSync(schoolsFile, JSON.stringify(schools, null, 2) + '\n');
  const keys = [...new Set(schools.flatMap(school => Object.keys(school)))];
  const cell = value => /[",\n]/.test(String(value ?? '')) ? '"' + String(value ?? '').replaceAll('"','""') + '"' : String(value ?? '');
  fs.writeFileSync(path.join(root,'config','schools.csv'), '\uFEFF' + keys.join(',') + '\n' + schools.map(school=>keys.map(key=>cell(school[key])).join(',')).join('\n') + '\n');
};
const build = () => {
  const result = spawnSync(process.execPath, [path.join(root, 'scripts', 'build.mjs')], { cwd: root, encoding: 'utf8' });
  if (result.status !== 0) throw Error(result.stderr || result.stdout);
};
try {
  for (const school of members) {
    console.log(`\n${school.school_code}: ${school.school_name}`);
    const createdSpreadsheet = !school.spreadsheet_id;
    if (createdSpreadsheet) {
      const sheet = await request('https://sheets.googleapis.com/v4/spreadsheets', 'POST', {
        properties: { title: `CBT ${school.school_code} - ${school.school_name}`, locale: 'in_ID', timeZone: 'Asia/Jakarta' },
        sheets: Object.keys(headers).map((title, index) => ({ properties: { sheetId: index, title, gridProperties: { rowCount: 1000, columnCount: 16, frozenRowCount: 1 } }, data: [{ startRow: 0, startColumn: 0, rowData: [
          { values: headers[title].map(stringValue => ({ userEnteredValue: { stringValue }, userEnteredFormat: { textFormat: { bold: true } } })) },
          ...(title === 'Config' ? [['ujian_aktif','false'],['durasi_menit','60'],['token_harian',''],['acak_soal','false'],['logo_url',''],['allow_password_change','true'],['nama_ujian',school.school_name]].map(row=>({values:row.map(stringValue=>({userEnteredValue:{stringValue}}))})) : []),
        ] }] })),
      });
      school.spreadsheet_id = sheet.spreadsheetId; school.spreadsheet_url = sheet.spreadsheetUrl; save();
    }
    const file = await request(`https://www.googleapis.com/drive/v3/files/${school.spreadsheet_id}?fields=id,name,mimeType,owners(emailAddress)`);
    if (file.mimeType !== 'application/vnd.google-apps.spreadsheet' || !file.owners.some(owner => owner.emailAddress === school.account_email)) throw Error('Pemilik spreadsheet tidak sesuai akun sekolah.');
    if (!school.drive_folder_id) {
      const folder = await request('https://www.googleapis.com/drive/v3/files?fields=id,webViewLink', 'POST', { name: `CBT ${school.school_code} - ${school.school_name} Media`, mimeType: 'application/vnd.google-apps.folder' });
      school.drive_folder_id = folder.id; school.drive_folder_url = folder.webViewLink || `https://drive.google.com/drive/folders/${folder.id}`; save();
    }
    if (!school.script_id) {
      const script = await request(api, 'POST', { title: `CBT ${school.school_code} - ${school.school_name}` });
      school.script_id = script.scriptId; save();
    } else if (!school.before_sync_version) {
      const version = await request(`${api}/${school.script_id}/versions`, 'POST', { description: 'Backup sebelum sinkronisasi spreadsheet dan palet' });
      school.before_sync_version = version.versionNumber; save();
    }
    build();
    const directory = path.join(root, 'dist', school.school_id);
    fs.writeFileSync(path.join(directory, '.clasp.json'), JSON.stringify({ scriptId: school.script_id, rootDir: '' }, null, 2) + '\n');
    const files = fs.readdirSync(directory).filter(name => /\.(js|html)$/.test(name) || name === 'appsscript.json').map(name => ({
      name: name.replace(/\.(js|html|json)$/, ''),
      type: name.endsWith('.html') ? 'HTML' : name.endsWith('.json') ? 'JSON' : 'SERVER_JS',
      source: fs.readFileSync(path.join(directory, name), 'utf8'),
    }));
    await request(`${api}/${school.script_id}/content`, 'PUT', { files });
    school.status = 'UPLOADED_NOT_DEPLOYED'; save();
    const access = JSON.parse(files.find(file=>file.name==='appsscript').source).webapp.access;
    const label = access === 'ANYONE_ANONYMOUS' ? 'akses siswa dengan sesi' : 'preview pemilik';
    const previousVersion = school.deployed_version;
    const version = await request(`${api}/${school.script_id}/versions`, 'POST', { description: `${school.school_code} ${label} - palet spreadsheet` });
    const deploymentConfig = { versionNumber: version.versionNumber, manifestFileName: 'appsscript', description: `${school.school_code} ${label}` };
    const deployment = school.deployment_id
      ? await request(`${api}/${school.script_id}/deployments/${school.deployment_id}`, 'PUT', { deploymentConfig })
      : await request(`${api}/${school.script_id}/deployments`, 'POST', deploymentConfig);
    school.deployment_id = deployment.deploymentId;
    school.webapp_url = deployment.entryPoints?.find(entry => entry.entryPointType === 'WEB_APP')?.webApp?.url || '';
    if (!school.webapp_url) throw Error('Deployment tidak mengembalikan URL Web App.');
    if (school.deployment_access && school.deployment_access !== access) school.previous_deployed_version = previousVersion;
    school.deployed_version = version.versionNumber;
    school.deployment_access = access;
    school.status = access === 'ANYONE_ANONYMOUS' ? 'DEPLOYED_PUBLIC' : 'DEPLOYED_OWNER_PREVIEW';
    save();
    console.log(JSON.stringify({ school: school.school_code, spreadsheet: school.spreadsheet_url, webapp: school.webapp_url, status: school.status }));
  }
} catch (error) { console.error(error.message); process.exitCode = 1; }
