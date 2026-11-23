import fs from 'node:fs';
export const attachment='C:/Users/jaela/.codex/attachments/eff98f7b-0ad6-43f4-8f19-cd8b8d24fa2d/Pasted text.txt';
export function readAdminManifest(){
  const text=fs.readFileSync(attachment,'utf8').replace(/\r\n/g,'\n');
  const matches=[...text.matchAll(/^\d+\.\s+(SCH-\d{3})\s+-\s+(.+)$/gm)];
  if(matches.length!==58)throw Error('Lampiran harus memuat tepat 58 sekolah.');
  const schools=JSON.parse(fs.readFileSync(new URL('../config/schools.json',import.meta.url),'utf8'));
  const routes=JSON.parse(fs.readFileSync(new URL('../config/public-school-routes.json',import.meta.url),'utf8'));
  const entries=matches.map((m,i)=>{
    const part=text.slice(m.index,i+1<matches.length?matches[i+1].index:text.length);
    const field=label=>part.match(new RegExp('^'+label+':\\s*(.+)$','mi'))?.[1]?.trim();
    const record={school_code:m[1],school_name:m[2].trim(),username:field('Username'),password:field('Password'),webapp:field('Web app'),spreadsheet:field('Spreadsheet')};
    const school=schools.find(s=>s.school_code===record.school_code),route=routes.find(s=>s.school_code===record.school_code);
    if(!school||record.school_name!==school.school_name||record.username!=='admin'||!record.password||record.password.length<8||record.password.length>256)throw Error('Data akun lampiran tidak cocok: '+record.school_code);
    if(record.webapp!==route.url+'?admin=1')throw Error('URL admin lampiran berbeda: '+record.school_code);
    return {...record,school_id:school.school_id,backend:school.webapp_url,account_email:school.account_email};
  });
  if(new Set(entries.map(e=>e.school_code)).size!==58)throw Error('Kode sekolah lampiran duplikat.');
  return entries;
}
