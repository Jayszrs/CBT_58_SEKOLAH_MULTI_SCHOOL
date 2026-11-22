import fs from 'node:fs';
import {googleOwnerApi} from './google-owner-api.mjs';
const school=JSON.parse(fs.readFileSync(new URL('../config/schools.json',import.meta.url))).find(s=>s.school_id==='SCH001');
const request=await googleOwnerApi(school.account_email,school.firebase_project_id);
const results=[];
const cleanupPaths=[];
for(const nisn of ['0099000001','0099000002']){
  const session=await request(`${school.firebase_database_url}/schools/SCH001/sesi_siswa/${nisn}.json`);
  const final=await request(`${school.firebase_database_url}/schools/SCH001/rekapan_hasil_ujian/${nisn}.json`);
  const autosave=await request(`${school.firebase_database_url}/schools/SCH001/autosave_jawaban_berjalan/${nisn}.json`);
  if(process.argv.includes('--cleanup-fixtures')){
    if(!String(session?.nama_siswa||'').startsWith('QA SISWA ')||final?.mata_pelajaran!=='QA MATEMATIKA'||final?.nisn_siswa!==nisn)throw Error('Fixture QA tidak cocok; pembersihan dibatalkan.');
    for(const kind of ['sesi_siswa','rekapan_hasil_ujian','autosave_jawaban_berjalan'])cleanupPaths.push(`schools/SCH001/${kind}/${nisn}.json`);
  }
  results.push({nisn,firebase_session:session?.status,final_saved:!!final,final_answers:final?.jawaban_lengkap?Object.keys(JSON.parse(final.jawaban_lengkap)).length:0,autosave_saved:!!autosave,final_score:final?.nilai_akhir,correction_status:final?.status_koreksi});
}
console.log(JSON.stringify(results,null,2));
fs.writeFileSync(new URL('../reports/SCH001-firebase-live-qa.json',import.meta.url),JSON.stringify({checked_at:new Date().toISOString(),results},null,2)+'\n');
for(const p of cleanupPaths)await request(school.firebase_database_url+'/'+p,'DELETE');
if(cleanupPaths.length)console.log(JSON.stringify({fixture_paths_removed:cleanupPaths.length}));
