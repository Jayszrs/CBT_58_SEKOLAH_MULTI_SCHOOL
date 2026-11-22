import fs from 'node:fs';import path from 'node:path';
const root=path.resolve(import.meta.dirname,'..');
const schools=JSON.parse(fs.readFileSync(path.join(root,'config','schools.json')));
const acc=JSON.parse(fs.readFileSync(path.join(root,'config','accounts.json')));
if(schools.length!==58 || acc.filter(a=>a.role==='OPERASIONAL').length!==12)throw Error('Incorrect counts');
const ids=new Set(),colors=new Set();
for(const s of schools){
if(ids.has(s.school_id)||colors.has(s.theme_primary))throw Error('Duplicate school ID/color');
ids.add(s.school_id);colors.add(s.theme_primary);
if(s.account_id!==`AKUN-${String(Math.floor((Number(s.school_id.slice(3))-1)/5)+1).padStart(2,'0')}`)throw Error('Bad account mapping');
if(!s.school_name || !/^#[0-9a-f]{6}$/i.test(s.theme_accent) || !/^#[0-9a-f]{6}$/i.test(s.theme_background))throw Error('Missing school identity/palette');
}
for(const a of acc.filter(a=>a.role==='OPERASIONAL'))if(a.count>5 || a.count!==schools.filter(s=>s.account_id===a.account_id).length)throw Error('Bad account capacity');
console.log('OK: 58 schools, 12 operational accounts, 5 schools/account (last group 3), unique palettes and valid mapping.');
