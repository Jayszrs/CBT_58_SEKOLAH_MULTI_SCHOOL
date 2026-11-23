import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {createHash} from 'node:crypto';

const read=name=>JSON.parse(fs.readFileSync(new URL('../'+name,import.meta.url),'utf8'));
const schools=read('config/schools.json'),links=read('config/public-school-links.json');
const central=read('config/central-admin.json');
const privateDirectory=path.join(process.env.LOCALAPPDATA||os.homedir(),'CBT58-Private');
fs.mkdirSync(privateDirectory,{recursive:true});
const checkpointPath=path.join(privateDirectory,'school-admin-accounts-private.json');
const txtPath=path.join(privateDirectory,'AKUN-ADMIN-58-SEKOLAH.txt');
const checkpoint=fs.existsSync(checkpointPath)?JSON.parse(fs.readFileSync(checkpointPath,'utf8')):{schools:{}};
const hash=value=>createHash('sha256').update(value).digest('hex');
function passwordFor(school){
 const value=school.school_name.normalize('NFKD').toLowerCase().replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]/g,'')+'123';
 if(value.length<8||value.length>256)throw Error('Pola password tidak memenuhi panjang untuk '+school.school_code);
 return value;
}
const passwords=schools.map(passwordFor);
if(new Set(passwords).size!==schools.length)throw Error('Nama sekolah menghasilkan password duplikat.');
function saveTxt(){
 const rows=['AKUN ADMIN CBT 58 SEKOLAH','Username setiap sekolah: admin','Pola password: nama sekolah huruf kecil tanpa spasi/tanda baca, diikuti 123.',
  'Status AKTIF berarti password sudah dipasang dan login telah diuji.', 'Status BELUM DIPASANG berarti masih membutuhkan akses pemilik.',
  'Diperbarui: '+new Date().toLocaleString('id-ID',{timeZone:'Asia/Jakarta'})+' WIB',''];
 for(let i=0;i<schools.length;i++){
  const s=schools[i],link=links.find(l=>l.id===s.school_id),saved=checkpoint.schools[s.school_id];
  const active=saved?.verified_at&&saved.password_hash===hash(passwords[i]);
  rows.push(String(i+1).padStart(2,'0')+'. '+s.school_code+' - '+s.school_name,'Username: admin','Password: '+passwords[i],
   'Status: '+(active?'AKTIF - login berhasil diuji':'BELUM DIPASANG - menunggu akses pemilik'),
   'Web app: '+link.publicUrl+'?admin=1','Spreadsheet: '+link.dataUrl,'');
 }
 fs.writeFileSync(txtPath,'\ufeff'+rows.join('\r\n'),{mode:0o600});
 fs.writeFileSync(checkpointPath,JSON.stringify(checkpoint,null,2)+'\n',{mode:0o600});
}
saveTxt();
if(!process.argv.includes('--execute')){
 console.log('TXT daftar 58 akun disiapkan: '+txtPath);console.log('Gunakan --execute untuk memasang akun pada sekolah yang sudah terhubung.');process.exit(0);
}
const report={checked_at:new Date().toISOString(),username:'admin',password_pattern:'lowercase school name without spaces/punctuation + 123',results:[],active:0,pending:0,failed:0};
const reportPath=new URL('../reports/school-admin-accounts.json',import.meta.url);
function saveReport(){
 report.active=report.results.filter(r=>r.status==='ACTIVE_VERIFIED').length;
 report.pending=report.results.filter(r=>r.status==='OWNER_AUTH_REQUIRED').length;
 report.failed=report.results.filter(r=>r.status==='FAILED').length;
 fs.writeFileSync(reportPath,JSON.stringify(report,null,2)+'\n');saveTxt();
}
async function rpc(endpoint,method,args){
 let response;try{response=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({method,args}),signal:AbortSignal.timeout(60000)});}catch{throw Error('Koneksi server gagal.');}
 if(!response.ok)throw Error('Server belum dapat dihubungkan (HTTP '+response.status+').');
 let wire;try{wire=await response.json();}catch{throw Error('Respons server bukan JSON.');}
 if(!wire.ok)throw Error(wire.error||'Operasi server gagal.');return wire.result;
}
const credentialText=fs.readFileSync(path.join(privateDirectory,'AKSES-SUPER-ADMIN.txt'),'utf8');
const centralPassword=credentialText.match(/^Password aktif: (.+)$/m)?.[1]||credentialText.match(/^Password awal: (.+)$/m)?.[1];
if(!centralPassword)throw Error('Password superadmin belum tersedia dalam file privat.');
let centralToken;
try{
 const login=await rpc(central.public_panel_url+'/api/central','centralLogin',['superadmin',centralPassword]);
 if(!login.success)throw Error('Login superadmin belum berhasil.');centralToken=login.token;
 for(let i=0;i<schools.length;i++){
  const school=schools[i],link=links.find(l=>l.id===school.school_id);
  if(!link?.enabled){report.results.push({school:school.school_code,name:school.school_name,status:'OWNER_AUTH_REQUIRED',url:link?.publicUrl});saveReport();continue;}
  const record={school:school.school_code,name:school.school_name,status:'STARTED',url:link.publicUrl};report.results.push(record);saveReport();
  try{
   const opened=await rpc(central.public_panel_url+'/api/central','centralOpenSchool',[centralToken,school.school_code]);
   const ticket=new URL(opened.url).searchParams.get('central_ticket');if(!ticket)throw Error('Tiket superadmin tidak tersedia.');
   const boot=await rpc(school.webapp_url,'bootstrap',[{central_ticket:ticket}]);
   const actorToken=boot.centralLogin?.data?.token;if(!actorToken)throw Error('Tiket superadmin belum diterima sekolah.');
   const setup=await rpc(link.publicUrl.replace('/sekolah/','/api/school/'),'executeAdminAction',[actorToken,'setSchoolAdminPassword',{newPassword:passwords[i]}]);
   if(!setup.success)throw Error(setup.message||'Pemasangan password belum berhasil.');
   checkpoint.schools[school.school_id]={password_hash:hash(passwords[i]),configured_at:new Date().toISOString()};saveTxt();
   const schoolLogin=await rpc(link.publicUrl.replace('/sekolah/','/api/school/'),'loginAdmin',[passwords[i],'admin']);
   if(!schoolLogin.success||!/^ADMIN:/.test(schoolLogin.sessionToken||''))throw Error('Login admin sekolah belum berhasil.');
   const ping=await rpc(link.publicUrl.replace('/sekolah/','/api/school/'),'executeAdminAction',[schoolLogin.sessionToken,'ping',{}]);
   if(!ping.success)throw Error('Sesi admin sekolah belum valid.');
   checkpoint.schools[school.school_id].verified_at=new Date().toISOString();record.status='ACTIVE_VERIFIED';record.login_verified=true;console.log(school.school_code+': akun admin aktif; login dan sesi berhasil diuji.');
  }catch(error){record.status='FAILED';record.error=error.message;console.log(school.school_code+': pemasangan belum selesai.');}
  saveReport();
 }
}finally{if(centralToken)try{await rpc(central.public_panel_url+'/api/central','centralLogout',[centralToken]);}catch{}saveReport();}
console.log(JSON.stringify({active:report.active,pending:report.pending,failed:report.failed,txt:txtPath}));
if(report.failed)process.exitCode=1;
