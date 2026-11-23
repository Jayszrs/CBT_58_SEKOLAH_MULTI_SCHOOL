import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
const {chromium}=await import(pathToFileURL(path.join(process.env.LOCALAPPDATA,'CBT58-Tools/browser-qa/node_modules/playwright-core/index.mjs')));
const directory=path.resolve('docs/contoh-soal');fs.mkdirSync(directory,{recursive:true});
const questions=JSON.parse(fs.readFileSync(path.join(directory,'kelas-6.json'),'utf8'));
assert.equal(questions.length,20);for(const subject of ['Matematika','Bahasa Indonesia'])assert.equal(questions.filter(q=>q.mapel===subject).length,10);
const links=JSON.parse(fs.readFileSync('config/public-school-links.json','utf8'));
const txt=fs.readFileSync(path.join(process.env.LOCALAPPDATA,'CBT58-Private/AKUN-ADMIN-58-SEKOLAH.txt'),'utf8');
const entries=txt.split(/\r?\n\r?\n/).slice(1).map(b=>({code:b.match(/SCH-\d{3}/)?.[0],password:b.match(/^Password: (.+)$/m)?.[1]}));
const result={checked_at:new Date().toISOString(),grade:6,questions_per_school:20,schools:[],files:[],passed:false};
const browser=await chromium.launch({executablePath:path.join(process.env.LOCALAPPDATA,'Google/Chrome/Application/chrome.exe'),headless:true});
try{
 for(const id of ['SCH058','SCH057']){
  const school=links.find(s=>s.id===id),password=entries.find(e=>e.code===school.code)?.password;assert.ok(password);
  const ctx=await browser.newContext({locale:'id-ID',acceptDownloads:true,viewport:{width:1440,height:1000}});const page=await ctx.newPage();
  await page.goto(school.publicUrl+'?admin=1',{waitUntil:'domcontentloaded',timeout:90000});await page.locator('#admin-username').waitFor({state:'visible',timeout:60000});
  await page.locator('#admin-username').fill('admin');await page.locator('#admin-password').fill(password);await page.locator('#btn-admin-login').click();
  await page.waitForFunction(()=>typeof AppStore!=='undefined'&&AppStore.user?.role==='admin'&&AppStore.activeComponent==='admin-dashboard',null,{timeout:90000});
  await page.evaluate(async()=>{
   const call=(action,args={})=>api.call('executeAdminAction',AppStore.user.data.token,action,args);
   const registered=await call('getMapel');for(const [id,nama]of [['MTK6','Matematika'],['BIN6','Bahasa Indonesia']])if(!registered.some(r=>r.nama===nama)){const r=await call('saveMapel',{idLama:'',data:{id,nama}});if(!r.success)throw Error(r.message);}
   const classes=await call('getKelas');if(!classes.some(r=>/^(?:kelas\s*)?6$/i.test(r.nama)||String(r.id)==='6')){const r=await call('saveKelas',{idLama:'',data:{id:'6',nama:'Kelas 6'}});if(!r.success)throw Error(r.message);}
  });
  await page.evaluate(()=>navigateTo('admin-soal'));await page.locator('#import-file-input').waitFor({state:'attached',timeout:60000});
  if(id==='SCH058'){
   for(const [file,list]of [['CONTOH-KELAS-6-SEMUA-MAPEL.xlsx',questions],['CONTOH-KELAS-6-MATEMATIKA.xlsx',questions.filter(q=>q.mapel==='Matematika')],['CONTOH-KELAS-6-BAHASA-INDONESIA.xlsx',questions.filter(q=>q.mapel==='Bahasa Indonesia')]]){
    const bytes=await page.evaluate(list=>{
     const rows=[QUESTION_EXCEL_HEADERS,...list.map(q=>[q.tipe,q.petunjuk||'',q.teks_pendukung||'',q.pertanyaan,'',(q.opsi||[]).join('|'),'',Array.isArray(q.kunci_jawaban)?q.kunci_jawaban.join('|'):typeof q.kunci_jawaban==='object'?Object.entries(q.kunci_jawaban).map(([a,b])=>a+':::'+b).join('|'):q.kunci_jawaban,q.bobot,q.mapel])];
     const workbook=XLSX.utils.book_new();XLSX.utils.book_append_sheet(workbook,questionWorkbookSheet(rows,'Template_Soal'),'Template_Soal');
     XLSX.utils.book_append_sheet(workbook,XLSX.utils.aoa_to_sheet([['CONTOH SOAL KELAS 6'],['Soal latihan orisinal; dapat diedit oleh guru sebelum digunakan.'],['Daftarkan mata pelajaran dengan nama persis Matematika dan Bahasa Indonesia.'],['Buka Bank Soal > Import Excel > pilih file > periksa preview > Import.'],['Enam tipe: PG, PG Kompleks, Isian Singkat, Menjodohkan, Benar Salah, Sesuai Tidak Sesuai.'],['Bank soal dimuat dari sheet Template_Soal. Jangan mengubah header.']]),'Panduan');
     return Array.from(new Uint8Array(XLSX.write(workbook,{bookType:'xlsx',type:'array'})));
    },list);fs.writeFileSync(path.join(directory,file),Buffer.from(bytes));result.files.push('docs/contoh-soal/'+file);
   }
   const [download]=await Promise.all([page.waitForEvent('download'),page.evaluate(()=>downloadImportTemplate())]);await download.saveAs(path.join(directory,'Template-Import-Kosong.xlsx'));result.files.push('docs/contoh-soal/Template-Import-Kosong.xlsx');
  }
  const existing=await page.evaluate(()=>api.call('executeAdminAction',AppStore.user.data.token,'exportSoal',{}));assert.ok(Array.isArray(existing));
  const present=questions.filter(q=>existing.some(r=>r.pertanyaan===q.pertanyaan&&r.mapel===q.mapel));
  if(present.length!==0&&present.length!==20)throw Error('Sebagian contoh sudah ada; dihentikan untuk menghindari duplikasi.');
  let imported=0;
  if(!present.length){
   await page.evaluate(()=>openImportSoalModal());await page.locator('#import-file-input').setInputFiles(path.join(directory,'CONTOH-KELAS-6-SEMUA-MAPEL.xlsx'));
   await page.waitForFunction(()=>typeof parsedImportData!=='undefined'&&parsedImportData.length===20&&!questionImportHasErrors,null,{timeout:60000});
   await page.locator('#btn-import-soal').click();
   await page.waitForFunction(()=>document.querySelector('#modal-import-soal')?.classList.contains('hidden'),null,{timeout:120000});imported=20;
  }
  const verified=await page.evaluate(async expected=>{
   const call=(action,args={})=>api.call('executeAdminAction',AppStore.user.data.token,action,args);
   const all=await call('exportSoal');const found=expected.map(q=>all.find(r=>r.pertanyaan===q.pertanyaan&&r.mapel===q.mapel));if(found.some(q=>!q))throw Error('Contoh belum lengkap.');
   for(let i=0;i<expected.length;i++)if(JSON.stringify(found[i].kunci_jawaban)!==JSON.stringify(expected[i].kunci_jawaban))throw Error('Kunci jawaban berubah.');
   const packages=await call('getAllPaketSoal',{bypassCache:true});
   for(const subject of ['Matematika','Bahasa Indonesia']){
    const nama_paket='CONTOH Kelas 6 - '+subject,soal_ids=found.filter(q=>q.mapel===subject).map(q=>q.id);
    if(soal_ids.length!==10||soal_ids.some(id=>!id))throw Error('ID paket tidak lengkap.');
    const current=packages.find(p=>p.nama_paket===nama_paket);
    if(!current){const r=await call('createPaketSoal',{data:{nama_paket,deskripsi:'Contoh latihan kelas 6; 10 soal dengan enam tipe pertanyaan.',soal_ids}});if(!r.success)throw Error(r.message);}
    else if(JSON.stringify([...current.soal_ids].sort())!==JSON.stringify([...soal_ids].sort()))throw Error('Paket contoh sebelumnya memiliki isi berbeda.');
   }
   return {questions:found.length,subjects:[...new Set(found.map(q=>q.mapel))],types:[...new Set(found.map(q=>q.tipe))],total_bank:all.length};
  },questions);
  await page.evaluate(()=>loadBankSoal());await page.waitForFunction(()=>AppStore.soalList.length>=20,null,{timeout:60000});await page.screenshot({path:path.resolve('reports/demo-bank-'+id+'.png')});
  result.schools.push({school:school.code,name:school.name,url:school.publicUrl,imported,...verified,excel_import_ui:true,answer_keys_verified:true});console.log(school.code+': 20 soal dan 2 paket contoh terpasang.');await ctx.close();
 }
 result.passed=true;
}catch(error){result.error=String(error.message);for(const e of entries)if(e.password)result.error=result.error.replaceAll(e.password,'[redacted]');process.exitCode=1;}
finally{await browser.close();fs.writeFileSync('reports/demo-school-questions.json',JSON.stringify(result,null,2)+'\n');}
console.log(JSON.stringify(result));
