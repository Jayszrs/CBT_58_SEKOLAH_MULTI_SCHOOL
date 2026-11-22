import fs from 'node:fs';
import path from 'node:path';
const root=path.resolve(import.meta.dirname,'..');
const file=path.join(root,'config','schools.json');
const schools=JSON.parse(fs.readFileSync(file,'utf8'));
const id=process.argv[2];
const school=schools.find(s=>s.school_id===id);
if(!school){console.error('ID tidak dikenal. Contoh SCH001');process.exit(1);}
const args=process.argv.slice(3);
const updates={ '--spreadsheet':['spreadsheet_url',/^https:\/\/docs\.google\.com\/spreadsheets\/d\/([\w-]+)/],
 '--drive':['drive_folder_url',/^https:\/\/drive\.google\.com\/drive\/folders\/([\w-]+)/],
 '--webapp':['webapp_url',/^https:\/\/script\.google\.com\/macros\/s\/([\w-]+)\/exec/],
 '--firebase':['firebase_database_url',/^https:\/\/[\w-]+\.firebasedatabase\.app\/?$/] };
if(args.length===0 || args.length%2!==0){console.error('Gunakan --spreadsheet URL --drive URL --webapp URL --firebase URL');process.exit(1);}
for(let i=0;i<args.length;i+=2){
  const [key,pattern]=updates[args[i]]||[];
  const url=args[i+1];
  if(!key||!pattern.test(url)){console.error('URL tidak valid: '+args[i]+' '+url);process.exit(1);}
  school[key]=url;
  if(key==='spreadsheet_url')school.spreadsheet_id=url.match(pattern)[1];
  if(key==='drive_folder_url')school.drive_folder_id=url.match(pattern)[1];
}
school.status=school.spreadsheet_url?'SPREADSHEET_READY':school.status;
fs.writeFileSync(file,JSON.stringify(schools,null,2)+'\n');
const keys=Object.keys(schools[0]);
function cell(s){const v=String(s??'');return /[",\n]/.test(v)?'"'+v.replaceAll('"','""')+'"':v;}
fs.writeFileSync(path.join(root,'config','schools.csv'),'\uFEFF'+keys.join(',')+'\n'+schools.map(s=>keys.map(k=>cell(s[k])).join(',')).join('\n')+'\n');
console.log(`${id}: tercatat; Spreadsheet: ${school.spreadsheet_url||'(belum dibuat)'}`);
