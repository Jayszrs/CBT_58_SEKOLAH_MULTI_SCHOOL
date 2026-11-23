import fs from 'node:fs';
import assert from 'node:assert/strict';
const read=p=>JSON.parse(fs.readFileSync(new URL('../'+p,import.meta.url)));
const before=read('reports/monitoring-links-before.json'),after=read('reports/monitoring-links-after.json');
const links=read('config/public-school-links.json');
function block(snapshot,id,col){return snapshot.sheets.find(s=>s.properties.sheetId===id).data.find(d=>(d.startColumn||0)===col).rowData;}
const old=block(before,0,8),master=block(after,0,8),deploy=block(after,100003,3),directory=block(after,100008,2);
let checked=0;
for(let i=0;i<58;i++){
 assert.equal(master[i].values[0].userEnteredValue.stringValue,old[i].values[0].userEnteredValue.stringValue);
 assert.equal(master[i].values[2].userEnteredValue.stringValue,old[i].values[2].userEnteredValue.stringValue);
 const expected=[[master[i].values[1],links[i].dataUrl,links[i].name],[master[i].values[3],links[i].publicUrl,links[i].name],[master[i].values[4],links[i].publicUrl,links[i].name],[master[i].values[5],links[i].backend,'API - '+links[i].name],
  [deploy[i].values[0],links[i].dataUrl,links[i].name],[deploy[i].values[2],links[i].publicUrl,links[i].name],[deploy[i].values[3],links[i].publicUrl,links[i].name],[deploy[i].values[4],links[i].backend,'API - '+links[i].name],
  [directory[i].values[0],links[i].dataUrl,links[i].name],[directory[i].values[1],links[i].publicUrl,links[i].name]];
 for(const [cell,url,label] of expected){assert.equal(cell.formattedValue,label);assert.ok(cell.userEnteredValue.formulaValue.includes('"'+url+'"'));checked++;}
 assert.equal(deploy[i].values[1].formattedValue,links[i].name);checked++;
}
const result={checked_at:new Date().toISOString(),passed:true,schools:58,named_links:checked,resource_id_columns_preserved:true,tabs:['MASTER SEKOLAH','DEPLOY & URL','LINK SEKOLAH']};
fs.writeFileSync(new URL('../reports/monitoring-shortcuts-verified.json',import.meta.url),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));
