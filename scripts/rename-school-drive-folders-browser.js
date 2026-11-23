async(page)=>{
  const results=[],browser=page.context().browser();
  const ids=Array.from({length:57},(_,i)=>'SCH'+String(i+2).padStart(3,'0'));
  async function one(id){
    const ctx=await browser.newContext();let prepared=false,error;
    try{
      const prep=await ctx.request.post('http://127.0.0.1:8770/prepare',{data:{school:id},timeout:90000});
      const d=await prep.json();if(!prep.ok())throw Error(d.error);prepared=true;
      await ctx.route('https://script.google.com/macros/s/**',async route=>{
        const r=route.request();const wire=await ctx.request.post('http://127.0.0.1:8770/forward',{data:{school:id,url:r.url(),method:r.method(),body:r.postData(),headers:await r.allHeaders()},timeout:90000});
        const data=await wire.json();await route.fulfill({status:data.status||502,headers:{'content-type':data.contentType||'text/plain',...(data.cookies?.length?{'set-cookie':data.cookies.join('\n')}:{})},body:data.body||data.error});
      });
      const p=await ctx.newPage();await p.goto(d.url+'?admin=1',{waitUntil:'domcontentloaded',timeout:60000});
      let frame;for(let i=0;i<60;i++){frame=p.frames().find(f=>f.url().endsWith('/blank'));if(frame&&await frame.evaluate(()=>typeof google!=='undefined'&&!!google.script?.run).catch(()=>false))break;await p.waitForTimeout(300);}
      if(!frame)throw Error('Frame aplikasi tidak terbuka.');
      const out=await frame.evaluate(()=>new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Rename timeout')),60000);google.script.run.withSuccessHandler(r=>{clearTimeout(timer);resolve(r);}).withFailureHandler(e=>{clearTimeout(timer);reject(Error(e.message));}).renameSchoolDriveFolderForOwner();}));
      if(out.school!==id)throw Error('Identitas respons tidak cocok.');
    }catch(e){error=e.message;}
    finally{
      if(prepared){try{const r=await ctx.request.post('http://127.0.0.1:8770/finish',{data:{school:id,error},timeout:90000});const d=await r.json();if(!r.ok())throw Error(d.error);results.push(d);}catch(e){results.push({school:id,error:e.message,passed:false});}}
      else results.push({school:id,error,passed:false});
      await ctx.close();
    }
  }
  let next=0;async function worker(){while(next<ids.length)await one(ids[next++]);}
  await Promise.all([worker(),worker(),worker()]);
  return {checked:results.length,passed:results.filter(r=>r.passed&&r.editor_head_restored).length,errors:results.filter(r=>!r.passed||!r.editor_head_restored)};
}
