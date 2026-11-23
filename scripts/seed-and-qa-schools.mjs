import fs from 'node:fs';
import {qaOperation} from './live-school-qa-state.mjs';
const schools=JSON.parse(fs.readFileSync('config/schools.json','utf8'));
const examples=JSON.parse(fs.readFileSync('config/sample-questions.json','utf8'));
if(examples.length!==20||examples.some(q=>q.opsi.length!==4||!q.opsi.includes(q.kunci_jawaban)))throw Error('Contoh soal tidak valid.');
const args=process.argv.slice(2),ids=args.filter(a=>/^SCH\d{3}$/.test(a));
const excluded=args.filter(a=>a.startsWith('--except=')).map(a=>a.slice(9));
const targets=(ids.length?schools.filter(s=>ids.includes(s.school_id)):schools).filter(s=>!excluded.includes(s.school_id));
const sampleFile='reports/sample-question-seeding.json';
let sampleReport=fs.existsSync(sampleFile)?JSON.parse(fs.readFileSync(sampleFile,'utf8')):{results:[]};
async function wire(url,body){const r=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(90000)});const data=await r.json();if(!r.ok||data.ok===false||data.error)throw Error(data.error||'Permintaan gagal: '+r.status);return data.ok===true?data.result:data;}
const central=(method,code)=>wire('http://127.0.0.1:8767/central-request',{method,code});
const ok=(r,label)=>{if(!r?.success)throw Error(label+': '+(r?.message||'gagal'));return r;};
const plain=s=>String(s).replace(/<[^>]*>/g,'').trim();
async function one(s){
  const report={school:s.school_code,central_superadmin_login:false,student_password_login:false,student_token_login:false,exam:false,grade:false,cleanup:false,method:'API HTTPS publik'};
  let state,token,qids=[],studentMade=false,tokenMade=false,kelasMade=false,mapelMade=false;
  const api=(method,...args)=>wire(s.webapp_url,{method,args});
  const admin=(action,args={})=>api('executeAdminAction',token,action,args);
  try{
    report.stage='central access';const opened=await central('centralOpenSchool',s.school_code);const ticket=new URL(opened.url).searchParams.get('central_ticket');
    const boot=await api('bootstrap',{central_ticket:ticket});token=boot.centralLogin?.data?.token;
    if(!token?.startsWith('CENTRAL:'))throw Error('Tiket pusat ditolak sekolah.');ok(await admin('ping'),'sesi pusat');report.central_superadmin_login=true;
    const denied=await api('executeAdminAction','','ping',{});if(denied.success)throw Error('Akses admin tanpa sesi diterima.');report.unauthenticated_admin_rejected=true;
    report.stage='sample questions';const subject='Contoh Latihan SD';let subjects=await admin('getMapel');
    if(!subjects.some(m=>m.nama===subject))ok(await admin('saveMapel',{idLama:'',data:{id:'CBT58_CONTOH_SD',nama:subject}}),'mapel contoh');
    let bank=await admin('getAllSoal',{bypassCache:true});
    const missing=examples.filter(q=>!bank.some(b=>b.mapel===subject&&plain(b.pertanyaan)===q.pertanyaan));
    if(missing.length)ok(await admin('importSoal',{dataArray:missing.map(q=>({...q,tipe:'PG',bobot:1,mapel:subject}))}),'impor contoh');
    bank=await admin('getAllSoal',{bypassCache:true});const exampleIds=examples.map(q=>bank.find(b=>b.mapel===subject&&plain(b.pertanyaan)===q.pertanyaan)?.id);
    if(exampleIds.some(id=>!id)||new Set(exampleIds).size!==20)throw Error('20 soal contoh belum lengkap.');
    const packageName='Contoh 20 Soal SD — Latihan';let packages=await admin('getAllPaketSoal',{bypassCache:true});let pkg=packages.find(p=>p.nama_paket===packageName);
    if(!pkg){const created=ok(await admin('createPaketSoal',{data:{nama_paket:packageName,deskripsi:'Contoh latihan campuran Matematika, Bahasa Indonesia, dan IPA untuk SD. Soal dapat disunting oleh admin sekolah.',soal_ids:exampleIds}}),'paket contoh');pkg={id_paket:created.id_paket};}
    packages=await admin('getAllPaketSoal',{bypassCache:true});pkg=packages.find(p=>p.id_paket===pkg.id_paket);
    if(pkg?.soal_ids?.length!==20||!exampleIds.every(id=>pkg.soal_ids.includes(id)))throw Error('Paket contoh tidak berisi 20 soal yang sesuai.');
    const sample={school:s.school_code,success:true,count:20,package_id:pkg.id_paket,package_name:packageName,checked_at:new Date().toISOString()};
    sampleReport.results=sampleReport.results.filter(r=>r.school!==s.school_code).concat(sample).sort((a,b)=>a.school.localeCompare(b.school));fs.writeFileSync(sampleFile,JSON.stringify(sampleReport,null,2)+'\n');
    report.sample_questions=20;
    if(args.includes('--seed-only')){report.seed_only=true;return;}
    report.stage='prepare QA';state=await qaOperation(s,'snapshot',{allowActiveWithoutSessions:args.includes('--allow-active-id='+s.school_id)});
    ok(await admin('saveKelas',{idLama:'',data:{id:state.tag,nama:state.tag}}),'kelas');kelasMade=true;
    ok(await admin('saveMapel',{idLama:'',data:{id:state.tag,nama:state.tag}}),'mapel');mapelMade=true;
    for(const [nisn,nama,isToken]of[[state.nisn,state.name,false],[state.tokenNisn,state.tokenName,true]]){ok(await admin('createSiswa',{data:{nisn,nama,kelas:state.tag,password:state.password}}),'siswa');if(isToken)tokenMade=true;else studentMade=true;}
    const pg=ok(await admin('createSoal',{data:{tipe:'PG',pertanyaan:state.tag+' 2 + 2 = ?',opsi:['4','5'],kunci_jawaban:'4',bobot:1,mapel:state.tag}}),'PG');qids.push(pg.id);
    const essay=ok(await admin('createSoal',{data:{tipe:'Isian Singkat',pertanyaan:state.tag+' Ketik 4',opsi:[],kunci_jawaban:'4',bobot:1,mapel:state.tag}}),'isian');qids.push(essay.id);
    ok(await admin('setConfig',{config:{...state.original,aktif:true,durasi:10,token:state.dailyToken,kelas_diizinkan:state.tag,acak_soal:false,waktu_mulai:'',waktu_selesai:'',nama_ujian:state.tag,mapel_ujian:state.tag,paket_ujian:''}}),'konfigurasi QA');
    report.stage='student login';const wrong=await api('loginSiswa',state.nisn,'QA-WRONG-PASSWORD');if(wrong.success)throw Error('Password siswa salah diterima.');report.student_wrong_password_rejected=true;
    const login=ok(await api('loginSiswa',state.nisn,state.password),'login siswa');report.student_password_login=true;
    const session=login.data.sessionToken;
    const exam=ok(await api('startUjian',state.nisn,session),'mulai ujian');if(exam.data.soal.length!==2)throw Error('Paket QA tidak tepat 2 soal.');
    const answers=JSON.stringify({[pg.id]:'4',[essay.id]:'4'});ok(await api('pingSimpanJawaban',state.nisn,answers,session),'autosave');
    const submitted=ok(await api('submitUjian',state.nisn,answers,'QA sintetis otomatis',JSON.stringify(qids),session),'submit');if(submitted.nilaiAkhir!==50)throw Error('Nilai awal bukan 50.');report.exam=true;report.initial_score=50;
    ok(await admin('saveEssayScore',{nisn:state.nisn,skor:1,detailSkor:{[essay.id]:1}}),'koreksi');const scores=await qaOperation(s,'verify');report.grade=true;report.sheet_score=scores.sheet_score;report.firebase_score=scores.firebase_score;report.answers=scores.answers;
    ok(await api('loginSiswa',state.tokenNisn,state.dailyToken),'login token');report.student_token_login=true;ok(await admin('logoutSiswa',{nisn:state.tokenNisn}),'logout siswa');
  }catch(e){report.error=report.stage+': '+e.message;}
  finally{
    if(state){try{
      ok(await admin('setConfig',{config:state.original}),'pulihkan konfigurasi');
      ok(await admin('archiveJawaban',{mapelFilter:state.tag}),'arsip QA');
      if(qids.length)ok(await admin('deleteMultipleSoal',{ids:qids}),'hapus soal QA');
      if(studentMade)ok(await admin('deleteSiswa',{nisn:state.nisn}),'hapus siswa QA');if(tokenMade)ok(await admin('deleteSiswa',{nisn:state.tokenNisn}),'hapus siswa token QA');
      if(kelasMade)ok(await admin('deleteKelas',{id:state.tag}),'hapus kelas QA');if(mapelMade)ok(await admin('deleteMapel',{id:state.tag}),'hapus mapel QA');
      report.cleanup=(await qaOperation(s,'cleanup')).cleaned;
    }catch(e){report.cleanup_error=e.message;}}
    report.login=report.central_superadmin_login&&report.student_password_login&&report.student_token_login&&report.student_wrong_password_rejected&&report.unauthenticated_admin_rejected;
    if(!args.includes('--seed-only'))report.passed=report.login&&report.exam&&report.grade&&report.cleanup;
    if(!report.seed_only)await qaOperation(s,'record',{result:report});console.log(JSON.stringify({school:s.school_code,passed:report.passed,samples:report.sample_questions,error:report.error,cleanup_error:report.cleanup_error}));
  }
}
let next=0;async function worker(){while(next<targets.length)await one(targets[next++]);}
await Promise.all(Array.from({length:Math.min(4,targets.length)},worker));
