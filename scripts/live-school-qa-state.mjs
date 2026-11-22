import fs from 'node:fs';
import path from 'node:path';
import {randomBytes} from 'node:crypto';
import {googleOwnerApi} from './google-owner-api.mjs';
const root=path.join(process.env.LOCALAPPDATA,'CBT58-QA','20261122');
fs.mkdirSync(root,{recursive:true});
const clients=new Map();
async function api(s){if(!clients.has(s.account_email))clients.set(s.account_email,await googleOwnerApi(s.account_email,s.firebase_project_id));return clients.get(s.account_email);}
const file=s=>path.join(root,s.school_id+'.json');
const read=s=>JSON.parse(fs.readFileSync(file(s),'utf8'));
const save=(s,state)=>fs.writeFileSync(file(s),JSON.stringify(state,null,2));
export function parseCsv(text){
  const rows=[];let row=[],cell='',quoted=false;
  for(let i=0;i<text.length;i++){const c=text[i];if(c==='"'){if(quoted&&text[i+1]==='"'){cell+='"';i++;}else quoted=!quoted;}else if(c===','&&!quoted){row.push(cell);cell='';}else if((c==='\n'||c==='\r')&&!quoted){if(c==='\r'&&text[i+1]==='\n')i++;row.push(cell);if(row.some(v=>v!==''))rows.push(row);row=[];cell='';}else cell+=c;}
  if(cell!==''||row.length){row.push(cell);rows.push(row);}return rows;
}
async function values(s,range){
  const match=range.match(/^'([^']+)'!(.+)$/);if(!match)throw Error('Rentang QA tidak valid.');
  const tabFile=new URL('../config/spreadsheet-tab-ids.json',import.meta.url);
  const saved=fs.existsSync(tabFile)?JSON.parse(fs.readFileSync(tabFile,'utf8')):{};
  const gids=saved[s.school_id]||{Bank_Soal:0,Data_Siswa:1,Respon_Jawaban:2,Arsip_Respon_Jawaban:3,Daftar_Kelas:4,Daftar_Mapel:5,Paket_Soal:6,Config:7};
  if(gids[match[1]]===undefined)throw Error('Tab QA tidak valid.');
  const url='https://docs.google.com/spreadsheets/d/'+s.spreadsheet_id+'/export?format=csv&gid='+gids[match[1]]+'&qa='+Date.now();
  const response=await fetch(url,{signal:AbortSignal.timeout(45000)});const text=await response.text();
  if(!response.ok||/^\s*</.test(text))throw Error('Snapshot spreadsheet publik belum tersedia: '+response.status);
  const rows=parseCsv(text);
  const expected={Config:'Key',Data_Siswa:'NISN',Bank_Soal:'ID Soal',Respon_Jawaban:'Timestamp',Daftar_Kelas:'ID Kelas',Daftar_Mapel:'ID Mapel'};
  if(expected[match[1]]&&rows[0]?.[0]!==expected[match[1]])throw Error('Header tab tidak cocok: '+match[1]);
  return rows;
}
const norm=v=>String(v??'').toLowerCase();
export async function qaOperation(s,operation,input={}){
  const request=await api(s);
  if(operation==='snapshot'){
    if(fs.existsSync(file(s))&&!read(s).cleaned)throw Error('Masih ada checkpoint QA yang perlu dibersihkan.');
    const rawConfig=await values(s,"'Config'!A1:B100");
    const cfg=Object.fromEntries(rawConfig.slice(1));
    if(norm(cfg.ujian_aktif)==='true')throw Error('Ujian sekolah sedang aktif; QA tidak mengubah pengaturannya.');
    const nisns=(await values(s,"'Data_Siswa'!A1:A1000")).slice(1).map(r=>String(r[0]));
    const index=s.school_id.slice(3).padStart(6,'0');
    const nisn='0098'+index,tokenNisn='0097'+index;
    if(nisns.includes(nisn)||nisns.includes(tokenNisn))throw Error('NISN QA sudah digunakan; tidak menimpa data.');
    const tag='QA58_'+s.school_id+'_'+Date.now();
    const original={aktif:false,durasi:Number(cfg.durasi_menit)||60,token:String(cfg.token_harian||''),kelas_diizinkan:String(cfg.kelas_diizinkan||''),acak_soal:norm(cfg.acak_soal)==='true',waktu_mulai:String(cfg.waktu_mulai||''),waktu_selesai:String(cfg.waktu_selesai||''),nama_ujian:String(cfg.nama_ujian||''),mapel_ujian:String(cfg.mapel_ujian||''),paket_ujian:String(cfg.paket_ujian||''),logo_url:String(cfg.logo_url||'')};
    const state={school:s.school_code,tag,nisn,tokenNisn,name:'QA OTOMATIS '+tag,tokenName:'QA TOKEN '+tag,password:'Qa-'+randomBytes(12).toString('hex'),dailyToken:'QAT-'+randomBytes(5).toString('hex').toUpperCase(),rawConfig,original,created_at:new Date().toISOString(),cleaned:false};
    save(s,state);return {tag,nisn,tokenNisn,name:state.name,tokenName:state.tokenName,password:state.password,dailyToken:state.dailyToken,original};
  }
  if(operation==='record'){
    const target=new URL('../reports/per-school-functional-qa.json',import.meta.url);
    const report=fs.existsSync(target)?JSON.parse(fs.readFileSync(target,'utf8')):{results:[]};
    const result={...input.result,school:s.school_code,checked_at:new Date().toISOString()};
    report.results=report.results.filter(r=>r.school!==s.school_code).concat(result).sort((a,b)=>a.school.localeCompare(b.school));
    report.checked_at=new Date().toISOString();fs.writeFileSync(target,JSON.stringify(report,null,2)+'\n');return {saved:true};
  }
  const state=read(s);
  const responseRows=await values(s,"'Respon_Jawaban'!A1:J1000");
  const response=responseRows.slice(1).find(r=>String(r[1])===state.nisn);
  const final=await request(s.firebase_database_url+'/schools/'+s.school_id+'/rekapan_hasil_ujian/'+state.nisn+'.json');
  if(operation==='verify'){
    const out={sheet_score:response?Number(response[5]):null,firebase_score:final?Number(final.nilai_akhir):null,answers:final?.jawaban_lengkap?Object.keys(JSON.parse(final.jawaban_lengkap)).length:0,firebase_subject_matches:final?.mata_pelajaran===state.tag};
    if(out.sheet_score!==100||out.firebase_score!==100||out.answers!==2||!out.firebase_subject_matches)throw Error('Nilai/2 jawaban tidak cocok antara Sheets dan Firebase: '+JSON.stringify(out));
    state.verified=out;save(s,state);return out;
  }
  if(operation!=='cleanup')throw Error('Operasi QA tidak valid.');
  const rawConfig=await values(s,"'Config'!A1:B100");const current=Object.fromEntries(rawConfig.slice(1));
  for(const [key,val]of state.rawConfig.slice(1))if(norm(current[key])!==norm(val))throw Error('Konfigurasi awal belum dipulihkan: '+key);
  const tabs=['Data_Siswa','Bank_Soal','Daftar_Kelas','Daftar_Mapel','Respon_Jawaban'];
  const grids=await Promise.all(tabs.map(t=>values(s,"'"+t+"'!A1:"+(t==='Bank_Soal'?'H':t==='Data_Siswa'?'C':t==='Respon_Jawaban'?'J':'B')+'1000')));
  for(let tab=0;tab<tabs.length;tab++){
    const title=tabs[tab],rows=grids[tab];
    for(let i=rows.length-1;i>=1;i--){const r=rows[i];let remove=false;
      if(title==='Data_Siswa')remove=(String(r[0])===state.nisn&&r[1]===state.name)||(String(r[0])===state.tokenNisn&&r[1]===state.tokenName);
      if(title==='Bank_Soal')remove=r[7]===state.tag&&String(r[2]).includes(state.tag);
      if(title==='Daftar_Kelas'||title==='Daftar_Mapel')remove=r[0]===state.tag&&r[1]===state.tag;
      if(title==='Respon_Jawaban')remove=String(r[1])===state.nisn&&String(r[9])===state.tag;
      if(remove)throw Error('Data QA aktif belum dibersihkan di '+title);
    }
  }
  for(const nisn of[state.nisn,state.tokenNisn]){
    const session=await request(s.firebase_database_url+'/schools/'+s.school_id+'/sesi_siswa/'+nisn+'.json');
    if(session&&![state.name,state.tokenName].includes(session.nama_siswa))throw Error('Marker sesi QA tidak cocok; pembersihan ditolak.');
    if(nisn===state.nisn&&final&&(final.mata_pelajaran!==state.tag||final.nisn_siswa!==nisn))throw Error('Marker hasil QA tidak cocok.');
  }
  for(const nisn of[state.nisn,state.tokenNisn])for(const kind of['sesi_siswa','rekapan_hasil_ujian','autosave_jawaban_berjalan'])await request(s.firebase_database_url+'/schools/'+s.school_id+'/'+kind+'/'+nisn+'.json','DELETE');
  state.cleaned=true;state.cleaned_at=new Date().toISOString();save(s,state);
  return {cleaned:true,config_restored:true,qa_result_archived:!!state.verified};
}
