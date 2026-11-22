import fs from 'node:fs';
import path from 'node:path';
const root = path.resolve(import.meta.dirname, '..');
const schools = JSON.parse(fs.readFileSync(path.join(root,'config','schools.json'),'utf8'));
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
    firebaseGroup:school.firebase_group, themePrimary:school.theme_primary, themeHover:school.theme_hover };
  fs.writeFileSync(path.join(dest,'SchoolDeploymentConfig.js'),
    '// Generated public identity; contains NO secrets.\n'+
    'function getSchoolMetadata_() { return '+JSON.stringify(metadata)+'; }\n');
}
console.log(`Built ${schools.length} school Apps Script packages under dist/`);
