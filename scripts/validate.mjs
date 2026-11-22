import fs from 'node:fs';import path from 'node:path';
const root=path.resolve(import.meta.dirname,'..');
const schools=JSON.parse(fs.readFileSync(path.join(root,'config','schools.json')));
const acc=JSON.parse(fs.readFileSync(path.join(root,'config','accounts.json')));
if(schools.length!==58 || acc.length!==16)throw Error('Incorrect counts');
const ids=new Set(),colors=new Set();
for(const s of schools){
if(ids.has(s.school_id)||colors.has(s.theme_primary))throw Error('Duplicate school ID/color');
ids.add(s.school_id);colors.add(s.theme_primary);
if(s.account_id!==`AKUN-${String(Math.floor((Number(s.school_id.slice(3))-1)/4)+1).padStart(2,'0')}`)throw Error('Bad account mapping');
}
console.log('OK: 58 schools, 16 accounts, unique colors, group mapping valid.');
