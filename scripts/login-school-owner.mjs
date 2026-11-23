// Use clasp's OAuth client and PKCE flow, with explicit account selection.
// The user opens Google's URL. Only the verified account is saved.
import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
const email=process.argv[2];
const schools=JSON.parse(fs.readFileSync(new URL('../config/schools.json',import.meta.url)));
if(!schools.some(s=>s.account_email===email))throw Error('Email harus salah satu pemilik sekolah.');
const dir=path.join(process.env.APPDATA,'npm/node_modules/@google/clasp/build/src/auth');
const auth=await import(pathToFileURL(path.join(dir,'auth.js')));
const {LocalServerAuthorizationCodeFlow}=await import(pathToFileURL(path.join(dir,'localhost_auth_code_flow.js')));
const {parseAuthResponseUrl}=await import(pathToFileURL(path.join(dir,'auth_code_flow.js')));
const {credentialStore}=await auth.initAuth({userKey:email});
const client=auth.getUnauthorizedOuth2Client();
class AccountFlow extends LocalServerAuthorizationCodeFlow{
  async promptAndReturnCode(url,expectedState){
    const target=new URL(url);target.searchParams.set('prompt','select_account consent');target.searchParams.set('login_hint',email);
    const pendingDirectory=path.join(process.env.LOCALAPPDATA,'CBT58-Private');fs.mkdirSync(pendingDirectory,{recursive:true});
    fs.writeFileSync(path.join(pendingDirectory,'pending-login.json'),JSON.stringify({email,url:target.href},null,2));
    return new Promise((resolve,reject)=>{
      this.server.on('request',(req,res)=>{
        const {code,state,error}=parseAuthResponseUrl(req.url||'');
        if(state!==expectedState){res.writeHead(400,{'Content-Type':'text/plain'}).end('Permintaan login tidak valid.');return;}
        if(error){res.end('Login belum selesai.');reject(Error('Google menolak otorisasi: '+error));return;}
        if(!code){res.writeHead(400).end('Kode login tidak tersedia.');return;}
        res.end('Login diterima. Identitas akun sedang diperiksa. Kembali ke percakapan.');resolve(code);
      });
      console.log('LOGIN_EMAIL='+email);console.log('LOGIN_URL='+target.href);
    }).finally(()=>this.server.destroy());
  }
}
try{
  const flow=new AccountFlow(client,0);
  await flow.authorize(['script.deployments','script.projects','script.webapp.deploy','drive.metadata.readonly','drive.file','userinfo.email','userinfo.profile','cloud-platform'].map(s=>'https://www.googleapis.com/auth/'+s));
  const user=await auth.getUserInfo(client);
  if(user?.email?.toLowerCase()!==email.toLowerCase())throw Error('Akun yang dipilih '+(user?.email||'(tidak diketahui)')+'; harus '+email+'. Login tidak disimpan.');
  await credentialStore.save(email,{client_id:client._clientId,client_secret:client._clientSecret,type:'authorized_user',
    refresh_token:client.credentials.refresh_token,access_token:client.credentials.access_token,expiry_date:client.credentials.expiry_date});
  console.log('LOGIN_VERIFIED='+user.email);
}catch(error){console.error(error.message);process.exitCode=1;}
