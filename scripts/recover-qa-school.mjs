import fs from 'node:fs';import path from 'node:path';import {qaOperation}from './live-school-qa-state.mjs';
const id=process.argv[2];if(!/^SCH\d{3}$/.test(id))throw Error('Pilih sekolah QA.');
const s=JSON.parse(fs.readFileSync('config/schools.json','utf8')).find(s=>s.school_id===id),state=JSON.parse(fs.readFileSync(path.join(process.env.LOCALAPPDATA,'CBT58-QA','20261122',id+'.json'),'utf8'));
if(state.cleaned)throw Error('Data QA sudah bersih.');
async function post(url,body){const r=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(90000)}),d=await r.json();if(d.error||d.ok===false)throw Error(d.error);return d.ok===true?d.result:d;}
const opened=await post('http://127.0.0.1:8767/central-request',{method:'centralOpenSchool',code:s.school_code});
const boot=await post(s.webapp_url,{method:'bootstrap',args:[{central_ticket:new URL(opened.url).searchParams.get('central_ticket')}]});
const token=boot.centralLogin?.data?.token;if(!token)throw Error('Tiket pusat ditolak.');
const admin=async(action,args={})=>{const r=await post(s.webapp_url,{method:'executeAdminAction',args:[token,action,args]});if(r?.success===false)throw Error(action+': '+r.message);return r;};
for(const [nisn,name]of[[state.nisn,state.name],[state.tokenNisn,state.tokenName]]){const row=(await admin('getSiswa',{bypassCache:true})).find(r=>r.nisn===nisn);if(row&&row.nama!==name)throw Error('Marker siswa tidak cocok.');}
await admin('setConfig',{config:state.original});
const rekap=await admin('getRekapNilai');if(rekap.some(r=>r.nisn===state.nisn))await admin('archiveJawaban',{mapelFilter:state.tag});
const qids=(await admin('getAllSoal',{bypassCache:true})).filter(q=>q.mapel===state.tag&&q.pertanyaan.includes(state.tag)).map(q=>q.id);if(qids.length)await admin('deleteMultipleSoal',{ids:qids});
for(const [nisn,name]of[[state.nisn,state.name],[state.tokenNisn,state.tokenName]]){const row=(await admin('getSiswa',{bypassCache:true})).find(r=>r.nisn===nisn);if(row){if(row.nama!==name)throw Error('Marker siswa tidak cocok.');await admin('deleteSiswa',{nisn});}}
for(const [get,del]of[['getKelas','deleteKelas'],['getMapel','deleteMapel']])if((await admin(get)).some(r=>r.id===state.tag&&r.nama===state.tag))await admin(del,{id:state.tag});
console.log(JSON.stringify({school:s.school_code,...await qaOperation(s,'cleanup')}));
