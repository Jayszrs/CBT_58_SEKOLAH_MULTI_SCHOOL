import fs from 'node:fs';import path from 'node:path';
const read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const central=read('config/central-admin-recovery.json'),schools=read('config/schools.json');
const secret=read(path.join(process.env.LOCALAPPDATA,'CBT58-Private/central-admin.json'));
const text=fs.readFileSync(path.join(process.env.LOCALAPPDATA,'CBT58-Private/AKSES-SUPER-ADMIN.txt'),'utf8');
const password=text.match(/^Password aktif: (.+)$/m)?.[1]||text.match(/^Password awal: (.+)$/m)?.[1];
async function rpc(url,method,args){let r;try{r=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({method,args}),signal:AbortSignal.timeout(60000)});}catch{throw Error('Koneksi API gagal.');}const wire=await r.json();if(!r.ok||!wire.ok)throw Error('API belum siap: '+method);return wire.result;}
const report={checked_at:new Date().toISOString(),mode:'LIVE_ANONYMOUS_SCHOOL_BACKEND',passed:false,schools:[]};let token;
try{
 const login=await rpc(central.webapp_url,'centralLogin',['superadmin',password]);if(!login.success)throw Error('Login pusat gagal.');token=login.token;
 const installed=schools.filter(s=>secret.deployed[s.school_id]);
 async function verifySchool(school){
  const opened=await rpc(central.webapp_url,'centralOpenSchool',[token,school.school_code]);
  const ticket=new URL(opened.url).searchParams.get('central_ticket');if(!ticket)throw Error('Tiket tidak tersedia.');
  const boot=await rpc(school.webapp_url,'bootstrap',[{central_ticket:ticket}]);if(!boot.config||boot.centralLogin?.data?.schoolId!==school.school_id)throw Error(school.school_code+': bootstrap belum siap.');
  const ping=await rpc(school.webapp_url,'executeAdminAction',[boot.centralLogin.data.token,'ping',{}]);if(!ping.success)throw Error(school.school_code+': sesi belum valid.');
  report.schools.push({school:school.school_code,school_id:school.school_id,bootstrap:true,admin_handoff:true,admin_ping:true});console.log(school.school_code+': backend publik dan akses pusat terverifikasi.');
 }
 for(let i=0;i<installed.length;i+=3){const results=await Promise.allSettled(installed.slice(i,i+3).map(verifySchool));const failure=results.find(r=>r.status==='rejected');if(failure)throw failure.reason;}
 report.schools.sort((a,b)=>a.school.localeCompare(b.school));
 report.passed=true;
}catch(error){report.error=String(error.message).replaceAll(password,'[redacted]');process.exitCode=1;}
finally{if(token)try{await rpc(central.webapp_url,'centralLogout',[token]);}catch{}fs.writeFileSync('reports/school-public-backends.json',JSON.stringify(report,null,2)+'\n');}
console.log(JSON.stringify({passed:report.passed,schools:report.schools.length,error:report.error}));
