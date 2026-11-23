import fs from 'node:fs';
export function writeConfigCsv(name, rows) {
  const keys=[...new Set(rows.flatMap(r=>Object.keys(r)))];
  const cell=value=>{const s=String(value??'');return /[",\r\n]/.test(s)?'"'+s.replaceAll('"','""')+'"':s;};
  fs.writeFileSync(new URL('../config/'+name+'.csv',import.meta.url),'\ufeff'+keys.join(',')+'\n'+rows.map(r=>keys.map(k=>cell(r[k])).join(',')).join('\n')+'\n');
}
if(process.argv[1]?.endsWith('sync-config-csv.mjs'))for(const name of ['schools','accounts']){
 const file=new URL('../config/'+name+'.json',import.meta.url);const rows=JSON.parse(fs.readFileSync(file));
 fs.writeFileSync(file,JSON.stringify(rows,null,2)+'\n');writeConfigCsv(name,rows);
}
