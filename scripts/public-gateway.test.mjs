import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
execFileSync(process.execPath,[fileURLToPath(new URL('./build-public-admin.mjs',import.meta.url))]);
const {handleRequest}=await import('../public-admin/worker/index.js');

test('public panel serves the login page without exposing authentication material',async()=>{
 const r=await handleRequest(new Request('https://panel.test/'));
 assert.equal(r.status,200);assert.match(await r.text(),/Masuk super admin/);assert.equal(r.headers.get('cache-control'),'no-store');
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
