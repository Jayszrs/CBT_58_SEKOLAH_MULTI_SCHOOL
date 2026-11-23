import fs from 'node:fs';
import path from 'node:path';
const root = path.resolve(import.meta.dirname, '..');
const schools = JSON.parse(fs.readFileSync(path.join(root,'config','schools.json'),'utf8'));
const central = JSON.parse(fs.readFileSync(path.join(root,'config','central-admin.json'),'utf8'));
const centralApi = JSON.parse(fs.readFileSync(path.join(root,'config','central-admin-recovery.json'),'utf8'));
const backend = path.join(root,'backend'), frontend=path.join(root,'frontend'), dist=path.join(root,'dist');
for (const school of schools) {
  if (!/^SCH\d{3,}$/.test(school.school_id)) throw Error('Bad school ID');
  for (const k of ['theme_primary','theme_hover']) {
    if (!/^#[0-9A-Fa-f]{6}$/.test(school[k])) throw Error(`Bad ${k} in ${school.school_id}`);
  }
  const dest=path.join(dist,school.school_id);
  fs.mkdirSync(dest,{recursive:true});
  for (const dir of [backend,frontend]) {
    for(const file of fs.readdirSync(dir)){
      if(!/\.(js|html)$/.test(file)) continue;
      fs.copyFileSync(path.join(dir,file),path.join(dest,file));
    }
  }
  fs.copyFileSync(path.join(root,'appsscript.json'),path.join(dest,'appsscript.json'));
  const metadata={ schoolId:school.school_id, schoolName:school.school_name, accountId:school.account_id,
    schoolCode:school.school_code, firebaseGroup:school.firebase_group, themePrimary:school.theme_primary,
    themeHover:school.theme_hover, themeAccent:school.theme_accent, themeBackground:school.theme_background,
    themeOnPrimary:school.theme_on_primary, ownerEmail:school.account_email, firebaseDatabaseUrl:school.firebase_database_url,
    spreadsheetId:school.spreadsheet_id, driveFolderId:school.drive_folder_id, centralAdminUrl:central.public_panel_url || central.webapp_url,
    centralApiUrl:centralApi.webapp_url };
  fs.writeFileSync(path.join(dest,'SchoolDeploymentConfig.js'),
    '// Generated public identity; contains NO secrets.\n'+
    'function getSchoolMetadata_() { return '+JSON.stringify(metadata)+'; }\n');
}
console.log(`Built ${schools.length} school Apps Script packages under dist/`);
const registryFile=path.join(root,'admin-central','AdminRegistry.js');
const registry=fs.readFileSync(registryFile,'utf8');
const seed=schools.map(s=>[s.school_code,s.school_name,s.account_id,s.account_email,s.spreadsheet_group,s.theme_primary,s.spreadsheet_url,s.webapp_url,s.drive_folder_url,s.status]);
fs.writeFileSync(registryFile,registry.replace(/^const SEED_58_SEKOLAH = .*;$/m,'const SEED_58_SEKOLAH = '+JSON.stringify(seed)+';'));
const centralDist=path.join(dist,'ADMIN_PUSAT');
fs.mkdirSync(centralDist,{recursive:true});
for(const name of fs.readdirSync(path.dirname(registryFile)).filter(name=>/\.(js|html|json)$/.test(name))){
  fs.copyFileSync(path.join(path.dirname(registryFile),name),path.join(centralDist,name));
}
