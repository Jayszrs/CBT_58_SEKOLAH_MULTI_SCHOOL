async(page)=>{
  const browser=page.context().browser();
  async function bridge(ctx,s,operation,extra={}){
    const r=await ctx.request.post('http://127.0.0.1:8767/qa-operation',{data:{school:s.school_id,operation,...extra},timeout:90000});
    const data=await r.json();if(!r.ok())throw Error(data.error||'QA bridge gagal');return data;
  }
  async function frame(p){
    for(let i=0;i<40;i++){const f=p.frames().find(f=>f.url().endsWith('/blank'));if(f){await f.locator('#app').waitFor({timeout:20000});return f;}await p.waitForTimeout(250);}throw Error('Frame aplikasi tidak terbuka');
  }
  async function rpc(f,name,args=[]){return f.evaluate(({name,args})=>new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('RPC timeout: '+name)),90000);api.call(name,...args).then(r=>{clearTimeout(timer);resolve(r);},e=>{clearTimeout(timer);reject(Error(e.message));});}),{name,args});}
  async function admin(f,action,args={}){return f.evaluate(({action,args})=>new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Admin RPC timeout: '+action)),90000);api.call('executeAdminAction',AppStore.user.data.token,action,args).then(r=>{clearTimeout(timer);resolve(r);},e=>{clearTimeout(timer);reject(Error(e.message));});}),{action,args});}
  const ok=(r,label)=>{if(!r?.success)throw Error(label+': '+(r?.message||'gagal'));return r;};
  async function one(s){
    const out={school:s.school_code,admin_google_login:false,admin_wrong_password_rejected:false,student_wrong_password_rejected:false,student_password_login:false,student_token_login:false,exam:false,grade:false,cleanup:false,public_editor:false};
    const owner=await browser.newContext({viewport:{width:1280,height:900}});
    const anon=await browser.newContext({viewport:{width:390,height:844}});
    let f,state,studentMade=false,tokenMade=false,kelasMade=false,mapelMade=false,qids=[],restored=false;
    await owner.route('https://script.google.com/macros/s/**',async route=>{
      const r=route.request();const res=await owner.request.post('http://127.0.0.1:8767/forward',{data:{url:r.url(),method:r.method(),body:r.postData(),headers:await r.allHeaders(),contentType:r.headers()['content-type']},timeout:90000});
      const d=await res.json();await route.fulfill({status:d.status||502,headers:{'content-type':d.contentType||'text/plain',...(d.cookies?.length?{'set-cookie':d.cookies.join('\n')}:{})},body:d.body||d.error});
    });
    try{
      out.stage='admin login';const p=await owner.newPage();await p.goto(s.webapp_url+'?admin=1',{waitUntil:'domcontentloaded',timeout:60000});f=await frame(p);
      await f.locator('#btn-google-owner').click({timeout:20000});await f.waitForFunction(()=>AppStore.user?.role==='admin'&&AppStore.activeComponent==='admin-dashboard',{},{timeout:90000});out.admin_google_login=true;
      const invalid=await rpc(f,'loginAdmin',['QA-invalid-admin-password-20261122','admin']);if(invalid.success)throw Error('Password admin salah diterima');out.admin_wrong_password_rejected=true;
      out.stage='sharing';const sharing=await rpc(f,'publishSchoolSpreadsheetForOwner');if(!sharing.public_editor)throw Error('Sharing editor publik gagal');out.public_editor=true;
      state=await bridge(owner,s,'snapshot');out.stage='prepare fixtures';
      ok(await admin(f,'saveKelas',{idLama:'',data:{id:state.tag,nama:state.tag}}),'kelas');kelasMade=true;
      ok(await admin(f,'saveMapel',{idLama:'',data:{id:state.tag,nama:state.tag}}),'mapel');mapelMade=true;
      ok(await admin(f,'createSiswa',{data:{nisn:state.nisn,nama:state.name,kelas:state.tag,password:state.password}}),'siswa');studentMade=true;
      ok(await admin(f,'createSiswa',{data:{nisn:state.tokenNisn,nama:state.tokenName,kelas:state.tag,password:state.password}}),'siswa token');tokenMade=true;
      const pg=ok(await admin(f,'createSoal',{data:{tipe:'PG',pertanyaan:state.tag+' — 2 + 2 = ?',opsi:['4','5'],kunci_jawaban:'4',bobot:1,mapel:state.tag}}),'soal PG');qids.push(pg.id);
      const essay=ok(await admin(f,'createSoal',{data:{tipe:'Isian Singkat',pertanyaan:state.tag+' — Ketik angka 4',opsi:[],kunci_jawaban:'4',bobot:1,mapel:state.tag}}),'soal isian');qids.push(essay.id);
      ok(await admin(f,'setConfig',{config:{...state.original,aktif:true,durasi:10,token:state.dailyToken,kelas_diizinkan:state.tag,acak_soal:false,waktu_mulai:'',waktu_selesai:'',nama_ujian:state.tag,mapel_ujian:state.tag,paket_ujian:''}}),'konfigurasi QA');
      out.stage='student login';const sp=await anon.newPage();await sp.goto(s.webapp_url,{waitUntil:'domcontentloaded',timeout:60000});const sf=await frame(sp);
      await sf.locator('#nisn').fill(state.nisn);await sf.locator('#token').fill('QA-WRONG-PASSWORD');await sf.locator('#btn-student-login').click();
      await sf.waitForFunction(()=>!document.getElementById('btn-student-login')?.disabled&&!AppStore.user&&/Password akun atau token ujian tidak valid/.test(document.body.innerText),{},{timeout:90000});out.student_wrong_password_rejected=true;
      await sf.locator('#token').fill(state.password);await sf.locator('#btn-student-login').click();await sf.waitForFunction(()=>AppStore.user?.role==='student'&&AppStore.activeComponent==='student-exam',{},{timeout:90000});out.student_password_login=true;
      out.student_without_google=!(await anon.cookies()).some(c=>['SID','HSID','SSID','APISID','SAPISID'].includes(c.name));if(!out.student_without_google)throw Error('Konteks siswa bukan anonim');
      out.stage='exam';await sf.locator('#fs-overlay button').click();await sf.waitForFunction(()=>examState.soalList.length===2&&!!examState.timerInterval,{},{timeout:90000});
      await sf.locator('#options-container input[type=radio][value="4"]').check();await sf.locator('#btn-next').click();await sf.locator('#options-container input[type=text]').fill('4');await sf.locator('#options-container input[type=text]').blur();
      const answers=await sf.evaluate(()=>Object.keys(examState.jawaban).length);if(answers!==2)throw Error('Jawaban UI tidak tersimpan');
      ok(await sf.evaluate(()=>api.call('pingSimpanJawaban',AppStore.user.data.nisn,JSON.stringify(examState.jawaban),{silent:true})),'autosave');
      await sf.locator('button[onclick="toggleExamPalette()"]').first().click();
      await sf.locator('#btn-submit-exam').click();await sf.locator('#custom-confirm-modal button[onclick="executeSubmit()"]').click();await sf.locator('#cbt-result-screen').waitFor({timeout:90000});
      const visibleResult=await sf.locator('#cbt-result-screen').innerText();if(!visibleResult.includes('50.00'))throw Error('Nilai awal bukan 50: '+visibleResult);out.initial_score=50;out.exam=true;
      out.stage='manual grading';ok(await admin(f,'saveEssayScore',{nisn:state.nisn,skor:1,detailSkor:{[essay.id]:1}}),'koreksi isian');
      const verified=await bridge(owner,s,'verify');out.sheet_score=verified.sheet_score;out.firebase_score=verified.firebase_score;out.answers=verified.answers;out.grade=true;
      await f.evaluate(()=>navigateTo('admin-nilai'));await f.waitForFunction(n=>Array.from(document.querySelectorAll('tr')).some(r=>r.innerText.includes(n)&&r.innerText.includes('100')),state.nisn,{timeout:90000});out.grade_table=true;
      out.stage='daily token login';await sf.locator('#cbt-result-screen button').click();await sf.locator('#nisn').fill(state.tokenNisn);await sf.locator('#token').fill(state.dailyToken);await sf.locator('#btn-student-login').click();await sf.waitForFunction(()=>AppStore.user?.role==='student'&&AppStore.activeComponent==='student-exam',{},{timeout:90000});out.student_token_login=true;
      ok(await admin(f,'logoutSiswa',{nisn:state.tokenNisn}),'logout siswa token');
    }catch(e){out.error=out.stage+': '+e.message;}
    finally{
      if(state&&f){
        try{
          ok(await admin(f,'setConfig',{config:state.original}),'pulihkan konfigurasi');restored=true;
          if(out.grade)ok(await admin(f,'archiveJawaban',{mapelFilter:state.tag}),'arsip hasil QA');
          if(qids.length)ok(await admin(f,'deleteMultipleSoal',{ids:qids}),'bersihkan soal');
          if(studentMade)ok(await admin(f,'deleteSiswa',{nisn:state.nisn}),'bersihkan siswa');
          if(tokenMade)ok(await admin(f,'deleteSiswa',{nisn:state.tokenNisn}),'bersihkan siswa token');
          if(kelasMade)ok(await admin(f,'deleteKelas',{id:state.tag}),'bersihkan kelas');
          if(mapelMade)ok(await admin(f,'deleteMapel',{id:state.tag}),'bersihkan mapel');
          const clean=await bridge(owner,s,'cleanup');out.cleanup=clean.cleaned&&restored;
        }catch(e){out.cleanup_error=e.message;}
      }
      if(f&&out.cleanup){try{
        await f.locator('[onclick="confirmAdminLogout()"]').click();await f.locator('#btn-confirm-action').click();await f.waitForFunction(()=>!AppStore.user&&AppStore.activeComponent==='admin-login',{},{timeout:15000});out.admin_logout=true;
      }catch(e){out.logout_error=e.message;}}
      out.login=out.admin_google_login&&out.admin_wrong_password_rejected&&out.student_wrong_password_rejected&&out.student_password_login&&out.student_token_login&&out.admin_logout===true;
      out.passed=out.login&&out.exam&&out.grade&&out.grade_table&&out.cleanup&&out.public_editor;
      await bridge(page.context(),s,'record',{result:out});await owner.unrouteAll({behavior:'wait'});await owner.close();await anon.close();
    }
    return out;
  }
  return await Promise.all(MEMBERS.map(s=>one(s)));
}
