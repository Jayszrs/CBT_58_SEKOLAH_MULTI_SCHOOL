import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import assert from 'node:assert/strict';
const source=fs.readFileSync(new URL('../backend/SchoolPublicApi.js',import.meta.url),'utf8');
function fixture(){
 const state={calls:[]};const ctx={ContentService:{MimeType:{JSON:'json'},createTextOutput:text=>({setMimeType:()=>JSON.parse(text)})},getAppConfig_:()=>({schoolId:'SCH051',ownerGoogleLoginAvailable:true}),consumeCentralTicket_:ticket=>ticket==='valid'?{role:'admin'}:null};
 for(const method of ['loginAdmin','checkAdminLoginStatus','loginSiswa','executeAdminAction','startUjian','pingSimpanJawaban','submitUjian','getImageBase64','getMultipleImageBase64'])ctx[method]=(...args)=>{state.calls.push({method,args});return {success:method!=='executeAdminAction'||args[0]==='valid-session'};};
 vm.createContext(ctx);vm.runInContext(source,ctx);
 return {state,call:(method,args)=>ctx.schoolPublicApi_({postData:{contents:JSON.stringify({method,args})}})};
}
test('school REST refuses arbitrary and private server functions',()=>{const f=fixture();for(const m of ['eval','constructor','getCentralSchoolKey_','setAdminPassword','toString'])assert.equal(f.call(m,[]).ok,false);assert.equal(f.state.calls.length,0);});
test('school REST calls existing session guard with original arguments',()=>{const f=fixture();assert.equal(f.call('executeAdminAction',['invalid','ping',{}]).result.success,false);assert.equal(f.call('executeAdminAction',['valid-session','ping',{}]).result.success,true);assert.equal(f.state.calls[1].args[0],'valid-session');});
test('school bootstrap disables unavailable owner login and validates ticket',()=>{const f=fixture();const result=f.call('bootstrap',[{central_ticket:'valid'}]).result;assert.equal(result.config.ownerGoogleLoginAvailable,false);assert.equal(result.centralLogin.role,'admin');assert.equal(f.call('bootstrap',[{central_ticket:'forged'}]).result.centralLogin,null);});
