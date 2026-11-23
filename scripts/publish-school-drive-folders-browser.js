async(page)=>{
  // One owner-authorized execution publishes all folders of that account.
  const ids=Array.from({length:12},(_,i)=>'SCH'+String(i*5+1).padStart(3,'0'));
  const results=[];let next=0;
  async function one(id){
    const ctx=await page.context().browser().newContext();let prepared=false,error;
    try{
      const prep=await ctx.request.post('http://127.0.0.1:8772/prepare',{data:{school:id},timeout:90000});const d=await prep.json();if(!prep.ok())throw Error(d.error);prepared=true;
      if(d.already_done){prepared=false;results.push(d.result);return;}
      await new Promise(resolve=>setTimeout(resolve,4500));
      await ctx.route('https://script.google.com/macros/s/**',async route=>{try{const r=route.request();const wire=await ctx.request.post('http://127.0.0.1:8772/forward',{data:{school:id,url:r.url(),method:r.method(),body:r.postData(),headers:await r.allHeaders()},timeout:40000});const data=await wire.json();await route.fulfill({status:data.status||502,headers:{'content-type':data.contentType||'text/plain',...(data.cookies?.length?{'set-cookie':data.cookies.join('\n')}:{})},body:data.body||data.error});}catch(e){await route.abort('failed').catch(()=>{});}});
      const p=await ctx.newPage();await p.goto(d.url+'?admin=1&maintenance='+Date.now(),{waitUntil:'domcontentloaded',timeout:60000});let f;
      for(let j=0;j<60;j++){f=p.frames().find(f=>f.url().endsWith('/blank'));if(f&&await f.evaluate(()=>typeof google!=='undefined'&&typeof google.script?.run?.getSchoolResourceLinks==='function').catch(()=>false))break;await p.waitForTimeout(300);}
      if(!f)throw Error('Frame tidak tersedia.');
      const data=await f.evaluate(()=>new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Sharing timeout')),45000);google.script.run.withSuccessHandler(r=>{clearTimeout(timer);resolve(r);}).withFailureHandler(e=>{clearTimeout(timer);reject(Error(e.message));}).getSchoolResourceLinks();}));
      if(data.school!==id||!data.public_editor)throw Error('Akses editor belum terkonfirmasi dari Apps Script.');
    }catch(e){error=e.message;}
    finally{if(prepared){try{const r=await ctx.request.post('http://127.0.0.1:8772/finish',{data:{school:id,error},timeout:90000});results.push(await r.json());}catch(e){results.push({school:id,error:e.message,passed:false});}}else if(error)results.push({school:id,error,passed:false});await Promise.race([ctx.close(),new Promise(resolve=>setTimeout(resolve,3000))]);}
  }
  async function worker(){while(next<ids.length)await one(ids[next++]);}
  await Promise.all([worker(),worker()]);
  return {checked:results.length,passed:results.filter(r=>r.passed&&r.editor_head_restored).length,errors:results.filter(r=>!r.passed||!r.editor_head_restored)};
}
