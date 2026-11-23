import fs from 'node:fs';
import assert from 'node:assert/strict';
const snapshot=JSON.parse(fs.readFileSync(new URL('../reports/monitoring-links-before.json',import.meta.url)));
const links=JSON.parse(fs.readFileSync(new URL('../config/public-school-links.json',import.meta.url)));
const schools=JSON.parse(fs.readFileSync(new URL('../config/schools.json',import.meta.url)));
const master=snapshot.sheets.find(s=>s.properties.sheetId===0),identities=master.data.find(d=>d.startColumn===1).rowData,resources=master.data.find(d=>d.startColumn===8).rowData;
assert.equal(identities.length,58);assert.equal(resources.length,58);
const value=c=>c?.userEnteredValue?.stringValue;
for(let i=0;i<58;i++){
 assert.equal(value(identities[i].values[0]),schools[i].school_code);assert.equal(value(identities[i].values[1]),schools[i].school_name);
 assert.equal(value(resources[i].values[0]),schools[i].spreadsheet_id);assert.equal(value(resources[i].values[2]),schools[i].script_id);
 assert.equal(links[i].code,schools[i].school_code);
}
const formula=formulaValue=>({userEnteredValue:{formulaValue}});
const text=stringValue=>({userEnteredValue:{stringValue}});
const hyper=(url,label)=>formula('=HYPERLINK("'+url.replaceAll('"','""')+'";'+label+')');
const column=(sheetId,col,cells)=>({updateCells:{start:{sheetId,rowIndex:1,columnIndex:col},rows:cells.map(c=>({values:[c]})),fields:'userEnteredValue'}});
const requests=[
 column(0,9,links.map((s,i)=>hyper(s.dataUrl,'C'+(i+2)))),
 column(0,11,links.map((s,i)=>hyper(s.publicUrl,'C'+(i+2)))),
 column(0,12,links.map((s,i)=>hyper(s.publicUrl,'C'+(i+2)))),
 // Keep the original backend endpoint available to API consumers, with a readable label.
 column(0,13,links.map((s,i)=>hyper(s.backend,'"API - "&C'+(i+2)))),
 column(100003,3,links.map((s,i)=>hyper(s.dataUrl,"'MASTER SEKOLAH'!C"+(i+2)))),
 column(100003,4,schools.map((s,i)=>hyper('https://script.google.com/home/projects/'+s.script_id+'/edit',"'MASTER SEKOLAH'!C"+(i+2)))),
 column(100003,5,links.map((s,i)=>hyper(s.publicUrl,"'MASTER SEKOLAH'!C"+(i+2)))),
 column(100003,6,links.map((s,i)=>hyper(s.publicUrl,"'MASTER SEKOLAH'!C"+(i+2)))),
 column(100003,7,links.map((s,i)=>hyper(s.backend,'"API - "&\'MASTER SEKOLAH\'!C'+(i+2)))),
 column(100008,2,links.map((s,i)=>hyper(s.dataUrl,'B'+(i+2)))),
 column(100008,3,links.map((s,i)=>hyper(s.publicUrl,'B'+(i+2)))),
 column(100008,6,links.map(s=>text(s.enabled?'Publik; superadmin aktif':'Shortcut publik; aktivasi pemilik diperlukan'))),
];
for(const [sheetId,startColumnIndex,endColumnIndex] of [[0,9,10],[0,11,14],[100003,3,8],[100008,2,4]])requests.push({repeatCell:{range:{sheetId,startRowIndex:1,endRowIndex:59,startColumnIndex,endColumnIndex},cell:{userEnteredFormat:{verticalAlignment:'MIDDLE',wrapStrategy:'WRAP'}},fields:'userEnteredFormat.verticalAlignment,userEnteredFormat.wrapStrategy'}});
fs.writeFileSync(new URL('../reports/monitoring-shortcut-requests.json',import.meta.url),JSON.stringify(requests,null,2)+'\n');
console.log('58 identitas dan ID resource cocok; 12 kolom shortcut siap diperbarui.');
