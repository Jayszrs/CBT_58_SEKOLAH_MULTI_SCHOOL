import fs from 'node:fs';import path from 'node:path';import {googleOwnerApi}from './google-owner-api.mjs';
const id=process.argv[2];if(!/^SCH\d{3}$/.test(id))throw Error('Pilih sekolah QA.');
const s=JSON.parse(fs.readFileSync('config/schools.json','utf8')).find(s=>s.school_id===id),state=JSON.parse(fs.readFileSync(path.join(process.env.LOCALAPPDATA,'CBT58-QA','20261122',id+'.json'),'utf8'));
const api=await googleOwnerApi(s.account_email,s.firebase_project_id);const out={school:s.school_code,tag:state.tag,cleaned:state.cleaned};
for(const kind of['sesi_siswa','rekapan_hasil_ujian','autosave_jawaban_berjalan']){
  const r=await api(s.firebase_database_url+'/schools/'+s.school_id+'/'+kind+'/'+state.nisn+'.json');
  out[kind]=r?{status:r.status,school_id:r.school_id,correct_name:r.nama_siswa===state.name,expiry_remaining:Number(r.auth_expiry)-Date.now(),final_score:r.nilai_akhir,subject_matches:r.mata_pelajaran===state.tag,has_answers:!!r.jawaban_terakhir}:null;
}
console.log(JSON.stringify(out));
