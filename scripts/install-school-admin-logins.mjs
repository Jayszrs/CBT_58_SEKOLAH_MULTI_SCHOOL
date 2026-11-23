import fs from 'node:fs';import path from 'node:path';import {readAdminManifest}from './school-admin-manifest.mjs';
const records=readAdminManifest(),args=process.argv.slice(2),selected=args.filter(a=>/^SCH-\d{3}$/.test(a)),targets=selected.length?records.filter(r=>selected.includes(r.school_code)):records;
const privateDir=path.join(process.env.LOCALAPPDATA,'CBT58-QA','admin-credentials');fs.mkdirSync(privateDir,{recursive:true});
fs.writeFileSync(path.join(privateDir,'manifest.json'),JSON.stringify(records));
const file='reports/school-admin-login-qa.json';const report=fs.existsSync(file)?JSON.parse(fs.readFileSync(file,'utf8')):{results:[]};
async function post(url,body){const response=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(90000)});const wire=await response.json();if(!response.ok||wire.ok===false||wire.error)throw Error('Transport admin gagal ('+response.status+').');return wire.ok===true?wire.result:wire;}
async function one(s){const result={school:s.school_code,username:'admin',installed:false,login:false,admin_action:false,wrong_password_rejected:false,ordinary_admin_cannot_reset:false,checked_at:new Date().toISOString()};
  const api=(method,...args)=>post(s.backend,{method,args});
  try{
    let login=await api('loginAdmin',s.password,'admin');
    if(!login.success){
      const opened=await post('http://127.0.0.1:8767/central-request',{method:'centralOpenSchool',code:s.school_code});
      const boot=await api('bootstrap',{central_ticket:new URL(opened.url).searchParams.get('central_ticket')});const central=boot.centralLogin?.data?.token;if(!central)throw Error('Sesi superadmin tidak tersedia.');
      const change=await api('executeAdminAction',central,'setSchoolAdminPassword',{newPassword:s.password});
      if(!change.success)throw Error('Pemasangan admin belum tersedia pada versi sekolah: '+(change.message||'gagal'));
      result.password_set=true;login=await api('loginAdmin',s.password,'admin');
    }else result.already_matched=true;
    if(!login.success||!login.sessionToken?.startsWith('ADMIN:'))throw Error('Login admin lampiran belum berhasil.');
    result.installed=true;result.login=true;
    const ping=await api('executeAdminAction',login.sessionToken,'ping',{});if(!ping.success)throw Error('Sesi admin tidak dapat menjalankan aksi.');result.admin_action=true;
    const denied=await api('executeAdminAction',login.sessionToken,'setSchoolAdminPassword',{newPassword:'Unauthorized-QA-Password-2026'});if(denied.success)throw Error('Admin biasa dapat memakai reset khusus pusat.');result.ordinary_admin_cannot_reset=true;
    const wrong=await api('loginAdmin',s.password+'-wrong','admin');if(wrong.success)throw Error('Password admin salah diterima.');result.wrong_password_rejected=true;
    const final=await api('loginAdmin',s.password,'admin');if(!final.success)throw Error('Login ulang admin gagal setelah uji penolakan.');
    result.passed=true;
  }catch(e){result.error=e.message;result.passed=false;}
  report.results=report.results.filter(r=>r.school!==s.school_code).concat(result).sort((a,b)=>a.school.localeCompare(b.school));report.checked_at=new Date().toISOString();fs.writeFileSync(file,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({school:result.school,passed:result.passed,already_matched:result.already_matched,error:result.error}));
}
console.log(JSON.stringify({manifest:records.length,targets:targets.length,unique_passwords:new Set(records.map(r=>r.password)).size,min_password_length:Math.min(...records.map(r=>r.password.length))}));
let next=0;await Promise.all(Array.from({length:Math.min(4,targets.length)},async()=>{while(next<targets.length)await one(targets[next++]);}));
