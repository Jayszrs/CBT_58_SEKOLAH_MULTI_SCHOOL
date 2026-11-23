import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {createHash,randomUUID} from 'node:crypto';
const root=path.resolve(import.meta.dirname,'..');
const read=name=>fs.readFileSync(path.join(root,'backend',name),'utf8');

function fixture() {
  const cache=new Map(),props=new Map(),records=new Map(),writes=[];
  const studentRows=[['student-a','student-b','Kelas 1','student-password-123','Offline']];
  const config=[['ujian_aktif','true'],['token_harian','EXAM-TOKEN'],['durasi_menit','60']];
  const dataSheet={getLastRow:()=>2,getRange:(row,column,count,width)=>({
    createTextFinder:value=>({matchEntireCell:()=>({findNext:()=>studentRows.some(r=>r[0]===value)?{getRow:()=>2}:null})}),
    getValues:()=>[studentRows[row-2].slice(column-1,column-1+(width||1))],
    setValue:value=>{studentRows[row-2][column-1]=value;},
  })};
  const context=vm.createContext({
    console,Date,activeEmail:'',schoolId:'SCH001',
    getSchoolMetadata_:()=>({schoolId:context.schoolId,ownerEmail:'owner@example.com'}),
    getOrCreateSpreadsheet_:()=>({getSheetByName:name=>name==='Data_Siswa'?dataSheet:{getDataRange:()=>({getValues:()=>config})}}),
    PropertiesService:{getScriptProperties:()=>({getProperty:key=>props.get(key),setProperty:(key,value)=>props.set(key,value)})},
    CacheService:{getScriptCache:()=>({get:key=>cache.get(key),put:(key,value)=>cache.set(key,value),remove:key=>cache.delete(key)})},
    Session:{getActiveUser:()=>({getEmail:()=>context.activeEmail})},
    Utilities:{DigestAlgorithm:{SHA_256:'sha256'},getUuid:randomUUID,computeDigest:(_,value)=>[...createHash('sha256').update(String(value)).digest()]},
    FirebaseDatabaseService:class{
      readData(key){return {success:true,data:records.get(key)||null};}
      patchData(key,value){writes.push(key);records.set(key,{...(records.get(key)||{}),...value});return {success:true};}
      writeData(key,value){writes.push(key);records.set(key,value);return {success:true};}
    },
    getAllSoal_:()=>[{id:'Q1',tipe:'Pilihan Ganda',pertanyaan:'Soal uji',opsi:['a','b'],kunci:'SECRET',bobot:1}],
  });
  for(const file of ['SecurityService.js','SessionSecurity.js','AuthService.js','UjianService.js','AdminService.js'])vm.runInContext(read(file),context);
  return {context,cache,props,records,writes,studentRows};
}

test('only the verified Google owner can initialize the first administrator password',()=>{
  const f=fixture();
  const change=()=>vm.runInContext('new AdminAuthenticationService().executePasswordChange("", "test-admin-password-2026")',f.context);
  assert.equal(change().success,false);
  f.context.activeEmail='owner@example.com';
  assert.equal(change().success,true);
  assert.equal(f.context.loginAdmin('test-admin-password-2026','admin').success,true);
  assert.equal(change().success,false);
});

test('a central password submitted to a school cannot authenticate or reset its administrator',()=>{
  const f=fixture();f.props.set('ADMIN_PASSWORD','unchanged-school-password-hash');
  const result=f.context.loginAdmin('central-password-for-routing-test','superadmin');
  assert.equal(result.success,false);
  assert.equal(result.centralLoginRequired,true);
  assert.match(result.message,/Panel Super Admin/);
  assert.equal(f.props.get('ADMIN_PASSWORD'),'unchanged-school-password-hash');
});

test('student login returns an opaque credential and stores only its hash',()=>{
  const f=fixture();const result=f.context.loginSiswa('student-a','student-password-123');
  assert.equal(result.success,true);assert.match(result.data.sessionToken,/^[0-9a-f-]{72}$/i);
  const session=f.records.get('sesi_siswa/student-a');
  assert.notEqual(session.credential_hash,result.data.sessionToken);
  assert.equal(f.context.verifyStudentCredential_('student-a',result.data.sessionToken),true);
  const started=f.context.startUjian('student-a',result.data.sessionToken);
  assert.equal(started.success,true);assert.equal(started.data.soal[0].kunci,undefined);
});

test('subject filtering preserves slashes and ampersands instead of dropping every question',()=>{
  const f=fixture();
  f.context.getAllSoal_=()=>[{id:'Q1',mapel:'IPA&#x2F;IPS &amp; Sains',opsi:['a','b']}];
  const questions=f.context.getSoalForStudent_('IPA/IPS & Sains','');
  assert.equal(questions.length,1);
});

test('knowing a NISN alone cannot start, autosave or submit an exam',()=>{
  const f=fixture();f.context.loginSiswa('student-a','student-password-123');const before=f.writes.length;
  assert.equal(f.context.startUjian('student-a').success,false);
  assert.equal(f.context.pingSimpanJawaban('student-a','{}').success,false);
  assert.equal(f.context.submitUjian('student-a','{}','','[]').success,false);
  assert.equal(f.writes.length,before);
});

test('student credentials reject another student, another school, expiry and path traversal',()=>{
  const f=fixture();const token=f.context.loginSiswa('student-a','EXAM-TOKEN').data.sessionToken;
  assert.equal(f.context.verifyStudentCredential_('student-c',token),false);
  assert.equal(f.context.verifyStudentCredential_('../student-a',token),false);
  f.context.schoolId='SCH002';assert.equal(f.context.verifyStudentCredential_('student-a',token),false);
  f.context.schoolId='SCH001';f.records.get('sesi_siswa/student-a').auth_expiry=0;
  assert.equal(f.context.verifyStudentCredential_('student-a',token),false);
});

test('student lookup cannot use a name as the NISN with a shared exam token',()=>{
  const f=fixture();assert.equal(f.context.loginSiswa('student-b','EXAM-TOKEN').success,false);
});

test('invalid media requests cannot retrieve question images',()=>{
  const f=fixture();assert.equal(f.context.authorizeMediaRead_({role:'student',nisn:'student-a'}),false);
  assert.equal(f.context.authorizeMediaRead_({role:'admin',token:'guess'}),false);
  assert.equal(f.context.authorizeMediaRead_(null),false);
});

test('admin actions require an issued session and password changes revoke sessions',()=>{
  const f=fixture();const password='strong-admin-password-123';f.props.set('ADMIN_PASSWORD',f.context.credentialHash_(password));
  const login=f.context.loginAdmin(password,'admin');assert.equal(login.success,true);assert.match(login.sessionToken,/^ADMIN:/);
  assert.notEqual(login.sessionToken,password);
  assert.equal(f.context.executeAdminAction(password,'ping',{}).success,false);
  assert.equal(f.context.executeAdminAction(login.sessionToken,'ping',{}).success,true);
  f.props.set('ADMIN_PASSWORD',f.context.credentialHash_('different-admin-password'));
  assert.equal(f.context.executeAdminAction(login.sessionToken,'ping',{}).success,false);
});

test('anonymous callers cannot run owner setup functions',()=>{
  const f=fixture();vm.runInContext(read('SetupService.js'),f.context);
  assert.throws(()=>f.context.setupSchoolResources(),/hanya.*pemilik/);
  assert.throws(()=>f.context.getSchoolResourceLinks(),/hanya.*pemilik/);
});

test('untrusted spreadsheet values are written as literals',()=>{
  const f=fixture();assert.equal(f.context.safeSheetLiteral_('=IMPORTDATA("https://example.test")'),'\'=IMPORTDATA("https://example.test")');
  assert.equal(f.context.safeSheetLiteral_('Normal log'),'Normal log');
});

test('public POST routes use the same student session checks',()=>{
  const f=fixture();f.context.ContentService={MimeType:{JSON:'json'},createTextOutput:value=>({value,setMimeType(){return this;}})};
  vm.runInContext(read('Code.js'),f.context);
  const result=f.context.doPost({postData:{contents:JSON.stringify({action:'submitUjian',nisn:'student-a',jawaban_mentah:'{}'})}});
  assert.equal(JSON.parse(result.value).sessionExpired,true);assert.equal(f.writes.length,0);
});
