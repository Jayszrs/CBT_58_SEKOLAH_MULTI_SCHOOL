import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import fs from 'node:fs';
execFileSync(process.execPath,[fileURLToPath(new URL('./build-public-admin.mjs',import.meta.url))]);
const {handleRequest}=await import('../public-admin/worker/index.js');
const records=JSON.parse(fs.readFileSync(new URL('../config/public-school-links.json',import.meta.url)));

test('public panel serves the login page without exposing authentication material',async()=>{
 const r=await handleRequest(new Request('https://panel.test/'));
 assert.equal(r.status,200);assert.match(await r.text(),/Masuk super admin/);assert.equal(r.headers.get('cache-control'),'no-store');
});

test('school pages stay on the public host and isolate browser storage by school',async()=>{
 const school=records.find(s=>s.id==='SCH051');
 const r=await handleRequest(new Request('https://panel.test/sekolah/'+school.slug+'?admin=1'),{upstreamFetch:async endpoint=>{
  assert.equal(endpoint,school.backend);return Response.json({ok:true,result:{config:{schoolName:'</script><script>injected</script>',schoolId:school.id},centralLogin:null}});
 }});
 const html=await r.text();assert.equal(r.status,200);assert.match(html,/schoolRpcRunner/);assert.match(html,/SCH051_CBT_SESSION/);
 assert.equal(html.includes('</script><script>injected</script>'),false);assert.match(html,/\\u003c\/script/);
});

test('Kelola returns a named public school URL instead of a Google page',async()=>{
 const school=records.find(s=>s.id==='SCH051');
 const r=await handleRequest(new Request('https://panel.test/api/central',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({method:'centralOpenSchool',args:['session',school.code]})}),{
  upstreamFetch:async()=>Response.json({ok:true,result:{success:true,url:school.backend+'?admin=1&central_ticket=test-ticket'}})
 });
 const wire=await r.json();assert.equal(new URL(wire.result.url).pathname,'/sekolah/'+school.slug);assert.equal(new URL(wire.result.url).searchParams.get('central_ticket'),'test-ticket');
});

test('spreadsheet shortcuts preserve the correct destination and inactive schools do not pretend to be activated',async()=>{
 const school=records[0];const shortcut=await handleRequest(new Request('https://panel.test/data/'+school.slug));assert.equal(shortcut.status,302);assert.equal(shortcut.headers.get('location'),school.spreadsheet);
 if(!school.enabled){const page=await handleRequest(new Request('https://panel.test/sekolah/'+school.slug));assert.match(await page.text(),/menunggu aktivasi/);}
 const active=records.find(s=>s.enabled);const result=await handleRequest(new Request('https://panel.test/api/school/'+active.slug,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({method:'resetAdminPasswordOnce',args:[]})}),{upstreamFetch:()=>assert.fail('Private functions must not be forwarded.')});assert.equal(result.status,400);
});
test('gateway rejects unlisted methods and cross-origin requests before contacting Google',async()=>{
 const upstreamFetch=()=>{assert.fail('Rejected requests must not reach the upstream.');};
 const make=(method,origin='https://panel.test')=>new Request('https://panel.test/api/central',{method:'POST',headers:{'Content-Type':'application/json',origin},body:JSON.stringify({method,args:[]})});
 assert.equal((await handleRequest(make('getCentralPrivateConfig_'),{upstreamFetch})).status,400);
 assert.equal((await handleRequest(make('centralSchools','https://foreign.test'),{upstreamFetch})).status,403);
 assert.equal((await handleRequest(new Request('https://panel.test/api/central'),{upstreamFetch})).status,405);
});
test('gateway uses the fixed Google endpoint and preserves server-side authentication results',async()=>{
 let called=false;
 const r=await handleRequest(new Request('https://panel.test/api/central',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({method:'centralSchools',args:['invalid-session']})}),{
  upstreamFetch:async(url,options)=>{called=true;assert.match(url,/^https:\/\/script\.google\.com\/macros\/s\/[\w-]+\/exec$/);assert.equal(options.method,'POST');assert.equal(JSON.parse(options.body).args[0],'invalid-session');return Response.json({ok:false,error:'Silakan masuk sebagai super admin.'});}
 });
 assert.equal(called,true);assert.equal((await r.json()).ok,false);assert.equal(r.headers.get('cache-control'),'no-store');
});
