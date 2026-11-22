import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';
import {randomUUID} from 'node:crypto';

function fixture(){
  const sheets=new Map();
  function makeSheet(name,headers){
    const rows=[headers];
    const sheet={rows,getLastRow:()=>rows.length,getDataRange:()=>({getValues:()=>rows.map(r=>[...r])}),
      getRange:(row,col,height=1,width=1)=>({setNumberFormat:()=>sheet.getRange(row,col,height,width),
        setValues:values=>{values.forEach((r,i)=>{rows[row-1+i]??=[];r.forEach((v,j)=>rows[row-1+i][col-1+j]=v);});},
        getValues:()=>rows.slice(row-1,row-1+height).map(r=>r.slice(col-1,col-1+width)),
        setValue:value=>{rows[row-1][col-1]=value;}}),appendRow:row=>rows.push(row),deleteRow:i=>rows.splice(i-1,1)};
    sheets.set(name,sheet);return sheet;
  }
  makeSheet('Data_Siswa',['NISN','Nama','Kelas','Password','Status']);
  makeSheet('Daftar_Kelas',['ID Kelas','Nama Kelas']);
  makeSheet('Respon_Jawaban',['Timestamp','NISN']);
  const ss={getSheetByName:name=>sheets.get(name)};
  const context=vm.createContext({console,Utilities:{getUuid:randomUUID},getOrCreateSpreadsheet_:()=>ss,
    SpreadsheetApp:{flush(){}},FirebaseDatabaseService:class{patchData(){return {success:true};}},
    getOrCreateSheet_:(_,name,headers)=>sheets.get(name)||makeSheet(name,headers),
    CacheService:{getScriptCache:()=>({remove(){}})},LockService:{getScriptLock:()=>({waitLock(){},releaseLock(){}})}});
  for(const file of ['SecurityService.js','SessionSecurity.js','AdminService.js'])vm.runInContext(fs.readFileSync(new URL('../backend/'+file,import.meta.url),'utf8'),context);
  return {context,sheets};
}

test('manual student CRUD preserves leading zeros, rejects duplicate IDs and survives a fresh read',()=>{
  const {context:c}=fixture(), student={nisn:'0012345678',nama:'Siswa QA',kelas:'Kelas 6',password:'QA-only'};
  assert.equal(c.createSiswa_(student).success,true);
  assert.equal(c.createSiswa_(student).success,false);
  assert.equal(c.getAllSiswaForExport_()[0].nisn,'0012345678');
  assert.equal(c.updateSiswa_('0012345678',{...student,nama:'Nama baru'}).success,true);
  assert.equal(c.getAllSiswaForExport_()[0].nama,'Nama baru');
  assert.equal(c.deleteSiswa_('0012345678').success,true);
  assert.equal(c.getAllSiswaForExport_().length,0);
});

test('student import registers new classes, preserves IDs, skips duplicates, and rejects invalid files before writing',()=>{
  const {context:c,sheets}=fixture();
  const students=[{nisn:'0012345678',nama:'Siswa QA',kelas:'Kelas Impor',password:'QA-only'}];
  assert.equal(c.importSiswa_(students).success,true);
  assert.equal(c.getAllSiswaForExport_()[0].nisn,'0012345678');
  assert.equal(sheets.get('Daftar_Kelas').rows[1][1],'Kelas Impor');
  assert.equal(c.importSiswa_(students).success,true);
  assert.equal(sheets.get('Data_Siswa').rows.length,2);
  assert.equal(c.importSiswa_([...students,{nisn:'invalid/path',nama:'Nama',kelas:'Kelas',password:'pw'}]).success,false);
  assert.equal(sheets.get('Data_Siswa').rows.length,2);
});

test('class Excel import skips duplicates and validates the whole file before changing rows',()=>{
  const {context:c,sheets}=fixture();
  assert.equal(c.importKelas_([{nama:'Kelas 1'},{nama:'Kelas 1'},{id:'KLS-2',nama:'Kelas 2'}]).count,2);
  assert.equal(c.importKelas_([{nama:'Kelas 3'},{nama:''}]).success,false);
  assert.equal(sheets.get('Daftar_Kelas').rows.length,3);
  assert.equal(c.importKelas_([{id:'KLS-2',nama:'Nama duplikat'}]).skipped,1);
});

test('correction responses exclude server ordering metadata rejected by Apps Script RPC',()=>{
  const {context:c,sheets}=fixture();
  sheets.get('Respon_Jawaban').rows.push(['date','0012345678','{"Q1":"5"}',0,0,0,'Belum Dikoreksi','',JSON.stringify({Q1:{skor:0},__urutan_soal__:['Q1']})]);
  const response=c.getJawabanSiswa_('0012345678');
  assert.equal(response.jawaban.Q1,'5');
  assert.equal(response.detailSkor.Q1.skor,'0');
  assert.equal(response.detailSkor.__urutan_soal__,undefined);
});

test('manual correction preserves ordering metadata while calculating weights only from questions',()=>{
  const {context:c,sheets}=fixture();
  const detail={Q1:{tipe:'PG',bobot:1,skor:1},Q2:{tipe:'Isian Singkat',bobot:1,skor:0},__urutan_soal__:['Q1','Q2']};
  sheets.get('Respon_Jawaban').rows.push(['date','0012345678','{}',1,0,50,'Belum Dikoreksi','',JSON.stringify(detail)]);
  vm.runInContext(fs.readFileSync(new URL('../backend/GradingService.js',import.meta.url),'utf8'),c);
  const result=c.saveEssayScore_('0012345678',1,{Q2:1});
  assert.equal(result.success,true,result.message);
  assert.equal(result.nilaiAkhir,100);
  assert.equal(result.firebaseSynced,true);
  assert.equal(sheets.get('Respon_Jawaban').rows[1][6],'Selesai');
  assert.deepEqual(JSON.parse(sheets.get('Respon_Jawaban').rows[1][8]).__urutan_soal__,['Q1','Q2']);
});

test('logo saves to Script Properties and Config, and rejects invalid or oversized images',()=>{
  const {context:c,sheets}=fixture();
  const props=new Map();
  c.PropertiesService={getScriptProperties:()=>({getProperty:key=>props.get(key),setProperty:(key,value)=>props.set(key,value)})};
  vm.runInContext(fs.readFileSync(new URL('../backend/Code.js',import.meta.url),'utf8'),c);
  const logo='data:image/png;base64,iVBORw0KGgo=';
  assert.equal(c.uploadLogoApp_({fileData:logo}).success,true);
  assert.equal(props.get('APPLICATION_LOGO_BASE64'),logo);
  assert.equal(sheets.get('Config').rows[1][1],logo);
  assert.equal(c.uploadLogoApp_({fileData:'data:text/html;base64,AAAA'}).success,false);
  assert.equal(c.uploadLogoApp_({fileData:'data:image/png;base64,'+'A'.repeat(9000)}).success,false);
  assert.equal(props.get('APPLICATION_LOGO_BASE64'),logo);
});

test('large question banks and packages remain readable above the Apps Script cache limit',()=>{
  const {context:c,sheets}=fixture();
  let cacheAttempts=0;
  c.CacheService={getScriptCache:()=>({get:()=>null,put:(_,value)=>{cacheAttempts++;assert.ok(Buffer.byteLength(value)>100*1024);throw Error('Argument too large: value');}})};
  const bankRows=[['ID','Tipe','Pertanyaan','Opsi','Kunci','Bobot','Gambar','Mapel','Petunjuk','Teks','Opsi Gambar'],...Array.from({length:250},(_,i)=>['SOAL_'+i,'PG','x'.repeat(700),'["A","B"]','"A"',1,'','Matematika','','','[]'])];
  c.ensureBankSoalExtraColumns_=()=>({getDataRange:()=>({getValues:()=>bankRows})});
  vm.runInContext(fs.readFileSync(new URL('../backend/SoalService.js',import.meta.url),'utf8'),c);
  c.ensureBankSoalExtraColumns_=()=>({getDataRange:()=>({getValues:()=>bankRows})});
  const questions=c.getAllSoal_();assert.equal(questions.length,250);
  assert.equal(questions[249].id,'SOAL_249');
  const packageSheet=c.getOrCreateSheet_(c.getOrCreateSpreadsheet_(),'Paket_Soal',['ID','Nama','Deskripsi','Soal','Tanggal']);
  packageSheet.rows.push(...Array.from({length:250},(_,i)=>['PKT_'+i,'Paket '+i,'x'.repeat(700),'["SOAL_1"]','2026-11-22']));
  vm.runInContext(fs.readFileSync(new URL('../backend/PaketSoalService.js',import.meta.url),'utf8'),c);
  assert.equal(c.getAllPaketSoal_().length,250);
  assert.equal(cacheAttempts,2);
});
