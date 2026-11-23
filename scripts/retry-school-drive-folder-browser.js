async(page)=>{
  const ids=['SCH010','SCH015','SCH026','SCH032'],out=[];
  for(let i=0;i<ids.length;i+=2)await Promise.all(ids.slice(i,i+2).map(async id=>{
    const ctx=await page.context().browser().newContext();let prepared=false,error;
    try{
      const prep=await ctx.request.post('http://127.0.0.1:8770/prepare',{data:{school:id},timeout:90000});const d=await prep.json();if(!prep.ok())throw Error(d.error);prepared=true;
      await new Promise(resolve=>setTimeout(resolve,4500));
      await ctx.route('https://script.google.com/macros/s/**',async route=>{const r=route.request();const wire=await ctx.request.post('http://127.0.0.1:8770/forward',{data:{school:id,url:r.url(),method:r.method(),body:r.postData(),headers:await r.allHeaders()},timeout:90000});const data=await wire.json();await route.fulfill({status:data.status||502,headers:{'content-type':data.contentType||'text/plain',...(data.cookies?.length?{'set-cookie':data.cookies.join('\n')}:{})},body:data.body||data.error});});
      const p=await ctx.newPage();await p.goto(d.url+'?admin=1&maintenance='+Date.now(),{waitUntil:'domcontentloaded',timeout:60000});let f;
      for(let j=0;j<60;j++){f=p.frames().find(f=>f.url().endsWith('/blank'));if(f&&await f.evaluate(()=>typeof google!=='undefined'&&typeof google.script?.run?.renameSchoolDriveFolderForOwner==='function').catch(()=>false))break;await p.waitForTimeout(300);}
      if(!f)throw Error('Frame tidak tersedia.');
      const data=await f.evaluate(()=>new Promise((resolve,reject)=>google.script.run.withSuccessHandler(resolve).withFailureHandler(e=>reject(Error(e.message))).renameSchoolDriveFolderForOwner()));if(data.school!==id)throw Error('Identitas respons salah.');
    }catch(e){error=e.message;}
    finally{if(prepared){const r=await ctx.request.post('http://127.0.0.1:8770/finish',{data:{school:id,error},timeout:90000});out.push(await r.json());}else out.push({school:id,error});await ctx.close();}
  }));
  return out;
}
