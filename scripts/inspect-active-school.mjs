import fs from 'node:fs';
const id=process.argv[2],s=JSON.parse(fs.readFileSync('config/schools.json','utf8')).find(s=>s.school_id===id);if(!s)throw Error('Sekolah tidak ditemukan.');
async function post(url,body){const r=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(90000)}),d=await r.json();if(d.error||d.ok===false)throw Error(d.error);return d.ok===true?d.result:d;}
const opened=await post('http://127.0.0.1:8767/central-request',{method:'centralOpenSchool',code:s.school_code});
const b=await post(s.webapp_url,{method:'bootstrap',args:[{central_ticket:new URL(opened.url).searchParams.get('central_ticket')}]});const token=b.centralLogin?.data?.token;if(!token)throw Error('Login pusat gagal');
const admin=(action,args={})=>post(s.webapp_url,{method:'executeAdminAction',args:[token,action,args]});
const students=await admin('getSiswa',{bypassCache:true}),config=await admin('getConfig'),grades=await admin('getRekapNilai');
console.log(JSON.stringify({school:s.school_code,active:config.aktif,students:students.length,active_students:students.filter(s=>s.status==='Aktif').length,results:grades.length,subject:config.mapel_ujian,package:config.paket_ujian}));
