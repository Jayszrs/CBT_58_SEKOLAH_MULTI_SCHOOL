async(page)=>{
  const results=[];
  for(const id of['SCH001','SCH029','SCH058']){
    const ctx=await page.context().browser().newContext();
    try{
      const response=await ctx.request.post('http://127.0.0.1:8767/admin-login-fixture',{data:{school:id}});
      const credentials=await response.json();if(!response.ok())throw Error('Data uji admin tidak tersedia.');
      const p=await ctx.newPage();await p.goto(credentials.webapp,{waitUntil:'domcontentloaded',timeout:60000});
      await p.locator('#admin-username').fill(credentials.username);await p.locator('#admin-password').fill(credentials.password);await p.locator('#btn-admin-login').click();
      await p.waitForFunction(()=>typeof AppStore!=='undefined'&&AppStore.user?.role==='admin'&&AppStore.activeComponent==='admin-dashboard',{},{timeout:60000});
      const state=await p.evaluate(password=>({school:APP_GLOBAL_CONFIG.schoolId,role:AppStore.user.role,ordinary_admin_session:AppStore.user.data.token.startsWith('ADMIN:'),password_not_stored:!(localStorage.getItem('CBT_SESSION')||'').includes(password)}),credentials.password);
      if(state.school!==id||!state.ordinary_admin_session)throw Error('Dashboard bukan sesi admin sekolah yang benar.');
      await p.locator('[onclick="confirmAdminLogout()"]').click();await p.locator('#btn-confirm-action').click();await p.waitForFunction(()=>!AppStore.user&&AppStore.activeComponent==='admin-login',{},{timeout:15000});
      results.push({...state,logout:true,anonymous_google_cookies:!(await ctx.cookies()).some(c=>['SID','HSID','SSID','APISID','SAPISID'].includes(c.name))});
    }catch(e){results.push({school:id,error:e.message});}
    finally{await ctx.close();}
  }
  return results;
}
