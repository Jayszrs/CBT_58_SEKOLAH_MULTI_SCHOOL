import fs from 'node:fs';
export function schoolPublicRecords(schools, origin, enabled = new Set()) {
  const used=new Set();
  return schools.map(s=>{
    let slug=s.school_name.normalize('NFKD').toLowerCase().replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
    if(used.has(slug))slug+='-'+s.school_code.toLowerCase();used.add(slug);
    return {id:s.school_id,code:s.school_code,name:s.school_name,slug,backend:s.webapp_url,spreadsheet:s.spreadsheet_url,
      enabled:enabled.has(s.school_id),publicUrl:origin+'/sekolah/'+slug,dataUrl:origin+'/data/'+slug,
      theme:{primary:s.theme_primary,hover:s.theme_hover,accent:s.theme_accent,background:s.theme_background,onPrimary:s.theme_on_primary}};
  });
}
if(process.argv[1]?.endsWith('school-public-links.mjs')){
  const schools=JSON.parse(fs.readFileSync(new URL('../config/schools.json',import.meta.url)));
  const site=JSON.parse(fs.readFileSync(new URL('../config/public-admin-site.json',import.meta.url)));
  const enabled=new Set(JSON.parse(fs.readFileSync(new URL('../reports/central-admin-live-qa.json',import.meta.url))).schools.map(s=>s.school.replace('-','')));
  const records=schoolPublicRecords(schools,site.public_url,enabled);
  fs.writeFileSync(new URL('../config/public-school-links.json',import.meta.url),JSON.stringify(records,null,2)+'\n');
  console.log('Tautan sekolah bernama dibuat: '+records.length);
}
