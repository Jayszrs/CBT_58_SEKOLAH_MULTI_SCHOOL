// Local QA transport: forwards Google Apps Script requests with the existing
// owner's OAuth identity. No tokens leave this process; no application auth is mocked.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {findGoogleOwnerCredentials} from './google-owner-api.mjs';
import {inspectWebAppHtml} from './webapp-authorization.mjs';
let schools=JSON.parse(fs.readFileSync(new URL('../config/schools.json',import.meta.url)));
const school=schools.find(s=>s.school_id===(process.argv[2]||'SCH001'));
if(!school?.deployment_id) throw Error('Deployment sekolah tidak tersedia.');
const authDirectory=path.join(process.env.APPDATA,'npm','node_modules','@google','clasp','build','src','auth','auth.js');
const auth=await import(pathToFileURL(authDirectory));
const credentialCache=new Map([[school.account_email,await findGoogleOwnerCredentials(school.account_email,auth)]]);
async function ownerCredentials(email){if(!credentialCache.has(email))credentialCache.set(email,await findGoogleOwnerCredentials(email,auth));return credentialCache.get(email);}
const handoffs=new Map();
const scopes=JSON.parse(fs.readFileSync(new URL('../appsscript.json',import.meta.url))).oauthScopes;
const escape=value=>String(value).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;');
const server=http.createServer(async(req,res)=>{
  if(!['127.0.0.1:8767','localhost:8767'].includes(req.headers.host)){res.writeHead(403).end();return;}
  try { schools=JSON.parse(fs.readFileSync(new URL('../config/schools.json',import.meta.url))); } catch(ignore) { /* Keep the last valid checkpoint while a writer replaces it. */ }
  if(req.method==='GET'&&req.url==='/'){
    res.setHeader('Content-Type','text/html; charset=utf-8');res.setHeader('Cache-Control','no-store');
    res.end('<!doctype html><html lang="id"><meta name="viewport" content="width=device-width"><title>Izin aplikasi CBT</title><style>body{font:16px system-ui;max-width:1100px;margin:32px auto;padding:0 16px;color:#142032}table{border-collapse:collapse;width:100%}td,th{padding:12px;border-bottom:1px solid #ccd5df;text-align:left}a{color:#08612f}small{display:block;margin-top:5px}</style><h1>Lengkapi izin aplikasi CBT</h1><p>Buka izin setiap sekolah memakai akun pemilik pada tabel. Pilih semua izin Google yang diminta, termasuk Firebase. Siswa memakai tautan aplikasi biasa dan tidak perlu memberikan izin Google.</p><p>SCH-001 sudah diuji sampai nilai 100. Selesaikan sekolah lain agar pemeriksaan database dapat dilanjutkan.</p><table><thead><tr><th>Sekolah</th><th>Akun pemilik</th><th>Izin</th><th>Aplikasi</th></tr></thead><tbody>'+schools.filter(s=>s.deployment_id).map(s=>'<tr><td>'+escape(s.school_code)+'<small>'+escape(s.school_name)+'</small></td><td>'+escape(s.account_email)+'</td><td><a target="_blank" rel="noopener" href="/authorize/'+s.school_id+'">Lengkapi izin</a></td><td><a target="_blank" rel="noopener" href="'+escape(s.webapp_url)+'">Buka CBT</a></td></tr>').join('')+'</tbody></table></html>');return;
  }
  if(req.method==='GET'&&req.url.startsWith('/authorize/')){
    try{
      const s=schools.find(s=>s.school_id===req.url.split('/').pop());if(!s?.webapp_url)throw Error('Sekolah tidak tersedia.');
      let handoff=handoffs.get(s.school_id);
      if(!handoff){const c=await ownerCredentials(s.account_email);const page=(await c.request({url:s.webapp_url,responseType:'text'})).data;const inspection=inspectWebAppHtml(page,s,scopes);handoff=inspection.authorization_url;}
      if(!handoff){res.writeHead(302,{Location:s.webapp_url+'?admin=1&authuser='+encodeURIComponent(s.account_email)}).end();return;}
      const target=new URL(handoff);if(!['https://accounts.google.com','https://script.google.com'].includes(target.origin))throw Error('Tujuan izin tidak valid.');
      if(target.origin==='https://accounts.google.com'){target.searchParams.set('scope',scopes.join(' '));target.searchParams.set('login_hint',s.account_email);}
      if(target.origin==='https://script.google.com')target.searchParams.set('authuser',s.account_email);
      res.writeHead(302,{Location:target.href,'Cache-Control':'no-store'}).end();
    }catch(error){res.writeHead(502,{'Content-Type':'text/plain; charset=utf-8'}).end(error.message);}return;
  }
  if(req.method!=='POST'||!['/forward','/handoff'].includes(req.url)||req.headers.origin||!String(req.headers['content-type']).startsWith('application/json')) {res.writeHead(403).end();return;}
  try {
    let body='';for await(const chunk of req){body+=chunk;if(body.length>5000000)throw Error('Payload terlalu besar');}
    const input=JSON.parse(body), url=new URL(input.url);
    if(req.url==='/handoff'){
      if(!schools.some(s=>s.school_id===input.school)||!['https://script.google.com','https://accounts.google.com'].includes(url.origin))throw Error('Handoff tidak valid.');
      handoffs.set(input.school,url.href);res.writeHead(200).end('{}');return;
    }
    const targetSchool=schools.find(s=>s.deployment_id&&['/exec','/callback'].some(suffix=>url.origin+url.pathname===`https://script.google.com/macros/s/${s.deployment_id}`+suffix));
    if(!targetSchool||!['GET','POST'].includes(input.method)) throw Error('Tujuan QA tidak diizinkan.');
    const credentials=await ownerCredentials(targetSchool.account_email);
    const headers=Object.fromEntries(Object.entries(input.headers||{}).filter(([key])=>!['host','content-length','authorization','connection','accept-encoding'].includes(key.toLowerCase())));
    if(input.contentType)headers['Content-Type']=input.contentType;
    const response=await credentials.request({url:input.url,method:input.method,data:input.body||undefined,headers,responseType:'text',validateStatus:()=>true});
    res.setHeader('Content-Type','application/json');
    res.end(JSON.stringify({status:response.status,contentType:response.headers.get('content-type'),cookies:response.headers.getSetCookie?.()||[],body:response.data}));
  }catch(error){res.writeHead(502,{'Content-Type':'application/json'}).end(JSON.stringify({error:error.message}));}
});
server.listen(8767,'127.0.0.1',()=>console.log(`QA owner transport ${school.school_id} ready at 127.0.0.1:8767`));
