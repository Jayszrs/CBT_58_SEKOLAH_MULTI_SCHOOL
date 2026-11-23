// Local authentication helper. It never serves OAuth tokens or passwords.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {googleOwnerApi} from './google-owner-api.mjs';
const schools=JSON.parse(fs.readFileSync(new URL('../config/schools.json',import.meta.url)));
const emails=[...new Set(schools.map(s=>s.account_email))].reverse();
const statuses=new Map();let pending=null,checking=false;
async function refresh(){
 if(checking)return;checking=true;
 try{await Promise.all(emails.map(async email=>{try{await googleOwnerApi(email);statuses.set(email,true);}catch{statuses.set(email,false);}}));}
 finally{checking=false;}
}
await refresh();
const html=`<!doctype html><html lang="id"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Login pemilik CBT</title><style>body{font:16px system-ui;margin:32px auto;max-width:1000px;padding:0 18px;background:#f2f5fa;color:#172c47}p{line-height:1.6}table{border-collapse:collapse;background:white;width:100%}td,th{padding:14px;border-bottom:1px solid #d5deeb;text-align:left}button,a.button{font:inherit;padding:10px 14px;border:1px solid #244faa;border-radius:8px;color:#244faa;background:white;cursor:pointer;text-decoration:none;display:inline-block}button:disabled{opacity:.5;cursor:wait}.ok{color:#08733e;font-weight:650}#pending{background:#fff2cf;padding:20px;margin:24px 0;border-radius:10px}#pending:empty{display:none}.table{overflow:auto}small{display:block;margin-top:5px;color:#5d6d81}</style><h1>Login akun pemilik sekolah</h1><p>Setiap akun mengelola sekolah yang berbeda. Pilih <strong>Siapkan login</strong>, lalu buka tombol Google yang muncul. Setelah selesai, kembali ke halaman ini. Login hanya disimpan jika email Google cocok dengan akun yang dipilih.</p><p>Super admin pusat tetap <strong>dimazunj14@gmail.com</strong>. Akun dimazunj2 dapat dilewati sementara karena kendala 2FA.</p><div id="pending" role="status"></div><div class="table"><table><thead><tr><th>Akun pemilik</th><th>Sekolah</th><th>Status</th><th>Login</th></tr></thead><tbody id="rows"></tbody></table></div><p id="message" role="alert"></p><script>
const $=id=>document.getElementById(id);let busy=false;
async function load(){try{const r=await fetch('/state');const data=await r.json();$('rows').replaceChildren();for(const a of data.accounts){const tr=document.createElement('tr');for(const value of [a.email,a.schools.join(', '),a.loggedIn?'Login sesuai':'Menunggu login']){const td=document.createElement('td');td.textContent=value;if(value==='Login sesuai')td.className='ok';tr.append(td);}const td=document.createElement('td');const button=document.createElement('button');button.textContent=a.loggedIn?'Sudah login':'Siapkan login';button.disabled=a.loggedIn||!!data.pending;button.onclick=async()=>{button.disabled=true;try{const r=await fetch('/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:a.email})});const d=await r.json();if(!r.ok)throw Error(d.error);await load();}catch(e){$('message').textContent=e.message;}};td.append(button);tr.append(td);$('rows').append(tr);}
$('pending').replaceChildren();if(data.pending){const p=document.createElement('p');p.textContent='Sedang login: '+data.pending.email;$('pending').append(p);if(data.pending.url){const a=document.createElement('a');a.className='button';a.textContent='Buka Google untuk '+data.pending.email;a.href=data.pending.url;a.target='_blank';a.rel='noopener noreferrer';$('pending').append(a);}else{const p=document.createElement('p');p.textContent='Menyiapkan tautan Google…';$('pending').append(p);}}if(data.message)$('message').textContent=data.message;
}catch(e){$('message').textContent='Halaman login lokal belum terhubung.';}}
load();setInterval(load,3000);
</script></html>`;
let message='';
const server=http.createServer(async(req,res)=>{
 if(!['127.0.0.1:8768','localhost:8768'].includes(req.headers.host)){res.writeHead(403).end();return;}
 res.setHeader('Cache-Control','no-store');res.setHeader('X-Frame-Options','DENY');
 if(req.method==='GET'&&req.url==='/'){res.setHeader('Content-Type','text/html; charset=utf-8');res.end(html);return;}
 if(req.method==='GET'&&req.url==='/state'){
  res.setHeader('Content-Type','application/json');res.end(JSON.stringify({accounts:emails.map(email=>({email,loggedIn:statuses.get(email)===true,schools:schools.filter(s=>s.account_email===email).map(s=>s.school_code)})),pending:pending?{email:pending.email,url:pending.url}:null,message}));return;
 }
 if(req.method!=='POST'||req.url!=='/login'||!['http://127.0.0.1:8768','http://localhost:8768'].includes(req.headers.origin)||!String(req.headers['content-type']).startsWith('application/json')){res.writeHead(403).end();return;}
 try{
  let raw='';for await(const chunk of req){raw+=chunk;if(raw.length>1000)throw Error('Permintaan terlalu besar.');}
  const {email}=JSON.parse(raw);if(!emails.includes(email))throw Error('Akun tidak terdaftar.');if(pending)throw Error('Selesaikan login yang sedang berjalan.');
  pending={email,url:null};message='';
  const child=spawn(process.execPath,[path.resolve(import.meta.dirname,'login-school-owner.mjs'),email],{cwd:path.resolve(import.meta.dirname,'..'),windowsHide:true,stdio:['ignore','pipe','pipe']});
  let output='',errors='';
  child.stdout.on('data',chunk=>{output+=String(chunk);const url=output.match(/^LOGIN_URL=(.+)$/m)?.[1];if(url&&pending?.email===email)pending.url=url;});
  child.stderr.on('data',chunk=>{errors+=String(chunk);if(errors.length>3000)errors=errors.slice(-3000);});
  child.on('error',()=>{message='Login gagal dimulai.';pending=null;});
  child.on('exit',async code=>{message=code===0?'Login '+email+' berhasil diverifikasi.':errors.trim()||'Login belum selesai.';pending=null;await refresh();console.log(email+': '+(code===0?'LOGIN_VERIFIED':'AUTH_REQUIRED'));});
  res.setHeader('Content-Type','application/json');res.end('{"started":true}');
 }catch(error){res.writeHead(400,{'Content-Type':'application/json'}).end(JSON.stringify({error:error.message}));}
});
server.listen(8768,'127.0.0.1',()=>console.log('Login pemilik: http://127.0.0.1:8768'));
