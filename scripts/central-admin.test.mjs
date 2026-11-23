import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {createHash, createHmac, randomUUID} from 'node:crypto';
const read = name => fs.readFileSync(new URL('../' + name, import.meta.url), 'utf8');
const digest = value => createHash('sha256').update(String(value)).digest('hex');

function environment() {
  let now = Date.now();
  class Clock extends Date { static now() { return now; } }
  const cache = new Map(), props = new Map();
  const store = {get: key => {const v=cache.get(key);return v&&v.until>now?v.value:null;},
    put: (key,value,ttl) => cache.set(key,{value,until:now+ttl*1000}), remove:key=>cache.delete(key)};
  const context = vm.createContext({Date:Clock, console,
    Utilities:{getUuid:randomUUID, DigestAlgorithm:{SHA_256:'sha256'}, Charset:{UTF_8:'utf-8'},
      computeDigest:(_,v)=>[...createHash('sha256').update(String(v)).digest()],
      computeHmacSha256Signature:(v,k)=>[...createHmac('sha256',k).update(v).digest()],
      base64EncodeWebSafe:v=>Buffer.from(v).toString('base64url'),base64DecodeWebSafe:v=>[...Buffer.from(v,'base64url')],
      newBlob:v=>({getDataAsString:()=>Buffer.from(v).toString('utf8')})},
    CacheService:{getScriptCache:()=>store},
    PropertiesService:{getScriptProperties:()=>({getProperty:k=>props.get(k),setProperty:(k,v)=>props.set(k,v),getProperties:()=>Object.fromEntries(props),deleteProperty:k=>props.delete(k)})},
    LockService:{getScriptLock:()=>({waitLock:()=>{},releaseLock:()=>{}})},
    Session:{getActiveUser:()=>({getEmail:()=>context.activeEmail||''})},
    school:'SCH001', schoolKey:'key-for-SCH001',
    getSchoolMetadata_:()=>({schoolId:context.school}),getSchoolCentralKey_:()=>context.schoolKey,
    getCentralPrivateConfig_:()=>({ownerEmail:'dimazunj14@gmail.com',username:'superadmin',salt:'random-salt',
      passwordHash:digest('random-salt:Initial-Admin-Password-2026'),schoolKeys:{SCH001:'key-for-SCH001'}}),
    getCentralSeed_:()=>[['SCH-001','SDN KEMAYORAN 01','AKUN-01','owner@example.com','GRUP-01','#123456','https://docs.google.com/spreadsheets/d/id/edit','https://script.google.com/macros/s/id/exec','https://drive.google.com/drive/folders/id','DEPLOYED_PUBLIC']],
  });
  context.ContentService={MimeType:{JSON:'json'},createTextOutput:text=>({setMimeType:()=>JSON.parse(text)})};
  for(const name of ['backend/SessionSecurity.js','backend/CentralAccess.js','admin-central/CentralAdmin.js','admin-central/CentralApi.js'])vm.runInContext(read(name),context);
  const login=()=>context.centralLogin('superadmin','Initial-Admin-Password-2026');
  const ticket=()=>new URL(context.centralOpenSchool(login().token,'SCH-001').url).searchParams.get('central_ticket');
  return {context,cache,props,login,ticket,advance:ms=>{now+=ms;}};
}

test('anonymous users cannot list schools or mint school login tickets',()=>{
  const {context:c}=environment();assert.throws(()=>c.centralSchools(''));assert.throws(()=>c.centralOpenSchool('','SCH-001'));
  assert.equal(c.centralOwnerLogin().success,false);c.activeEmail='other@example.com';assert.equal(c.centralOwnerLogin().success,false);
  c.activeEmail='dimazunj14@gmail.com';assert.equal(c.centralOwnerLogin().success,true);
});
test('password login rejects wrong credentials and enforces cooldown then allows recovery',()=>{
  const e=environment();for(let i=0;i<5;i++)assert.equal(e.context.centralLogin('superadmin','Incorrect-Password-2026').success,false);
  assert.equal(e.login().success,false);e.advance(180001);assert.equal(e.login().success,true);
});
test('school handoff grants actual admin authorization and can only be consumed once',()=>{
  const e=environment();const ticket=e.ticket();const user=e.context.consumeCentralTicket_(ticket);
  assert.equal(user.role,'admin');assert.equal(e.context.verifyAdminCredential_(user.data.token),true);
  assert.equal(e.context.consumeCentralTicket_(ticket),null);
  e.context.school='SCH002';assert.equal(e.context.verifyAdminCredential_(user.data.token),false);
});
test('tampered, wrong-school, expired and excessively long-lived tickets are rejected',()=>{
  const e=environment(),ticket=e.ticket();const parts=ticket.split('.');
  assert.equal(e.context.consumeCentralTicket_(parts[0]+'.'+(parts[1][0]==='a'?'b':'a')+parts[1].slice(1)),null);
  e.context.school='SCH002';assert.equal(e.context.consumeCentralTicket_(ticket),null);e.context.school='SCH001';
  e.advance(60001);assert.equal(e.context.consumeCentralTicket_(ticket),null);
  const payload=Buffer.from(JSON.stringify({school:'SCH001',nonce:randomUUID(),expires:Date.now()+86400000})).toString('base64url');
  assert.equal(e.context.consumeCentralTicket_(payload+'.'+createHmac('sha256','key-for-SCH001').update(payload).digest('base64url')),null);
});
test('central and school sessions expire; key rotation revokes school sessions',()=>{
  const e=environment(),session=e.login();const user=e.context.consumeCentralTicket_(e.ticket());
  e.context.schoolKey='rotated-key';assert.equal(e.context.verifyAdminCredential_(user.data.token),false);e.context.schoolKey='key-for-SCH001';
  e.advance(1800001);assert.throws(()=>e.context.centralSchools(session.token));assert.equal(e.context.verifyAdminCredential_(user.data.token),false);
});
test('password change revokes all old central sessions and does not reveal private keys',()=>{
  const e=environment(),a=e.login(),b=e.login();
  const list=e.context.centralSchools(a.token);assert.equal(JSON.stringify(list).includes('key-for-SCH001'),false);
  assert.equal(e.context.centralChangePassword(a.token,'wrong','New-Super-Admin-Password-2026').success,false);
  const changed=e.context.centralChangePassword(a.token,'Initial-Admin-Password-2026','New-Super-Admin-Password-2026');assert.equal(changed.success,true);
  assert.throws(()=>e.context.centralSchools(b.token));assert.equal(e.login().success,false);
  assert.equal(e.context.centralLogin('superadmin','New-Super-Admin-Password-2026').success,true);
});
test('central logout removes the server session',()=>{
  const e=environment(),session=e.login();e.context.centralLogout(session.token);assert.throws(()=>e.context.centralSchools(session.token));
});
test('central panel server and client scripts parse',()=>{
  new vm.Script(read('admin-central/CentralAdmin.js'));
  for(const script of read('admin-central/CentralPage.html').matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g))new vm.Script(script[1]);
});

test('public API refuses private functions and requires a session to list schools',()=>{
  const {context:c}=environment();const post=(method,args)=>c.doPost({postData:{contents:JSON.stringify({method,args})}});
  assert.equal(post('getCentralPrivateConfig_',[]).ok,false);
  assert.equal(post('constructor',[]).ok,false);
  assert.equal(post('centralSchools',['']).ok,false);
  assert.equal(post('health',[]).result.application,'cbt58-central');
  const login=post('centralLogin',['superadmin','Initial-Admin-Password-2026']);
  assert.equal(login.result.success,true);
  const schools=post('centralSchools',[login.result.token]);assert.equal(schools.ok,true);assert.equal(schools.result.schools.length,1);
  assert.equal(JSON.stringify(schools).includes('key-for-SCH001'),false);
});
