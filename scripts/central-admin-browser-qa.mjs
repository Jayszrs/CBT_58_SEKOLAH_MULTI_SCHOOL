// Local UI checks with a simulated RPC. This does not verify a deployed web app.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
const {chromium}=await import(pathToFileURL(path.join(process.env.LOCALAPPDATA,'CBT58-Tools/browser-qa/node_modules/playwright-core/index.mjs')));
const schools=JSON.parse(fs.readFileSync(new URL('../config/schools.json',import.meta.url))).map(s=>({code:s.school_code,name:s.school_name,account:s.account_id,owner:s.account_email,color:s.theme_primary,spreadsheet:s.spreadsheet_url,webapp:s.webapp_url,drive:s.drive_folder_url,centralAccess:true}));
const html=fs.readFileSync(new URL('../admin-central/CentralPage.html',import.meta.url),'utf8');
const browser=await chromium.launch({executablePath:path.join(process.env.LOCALAPPDATA,'Google/Chrome/Application/chrome.exe'),headless:true});
const result={checked_at:new Date().toISOString(),mode:'LOCAL_SIMULATED_RPC',live_deployment_verified:false};
try{
  for(const [label,viewport] of [['desktop',{width:1440,height:1050}],['mobile',{width:390,height:844}]]){
    const ctx=await browser.newContext({viewport,acceptDownloads:true});const page=await ctx.newPage();
    const errors=[];page.on('pageerror',e=>errors.push(e.message));
    await ctx.route('https://cbt58.test/**',route=>route.fulfill({contentType:'text/html',body:html}));
    await page.addInitScript(({schools})=>{
      window.google={script:{run:new Proxy({},{get(_,name){
        if(name==='withSuccessHandler')return success=>new Proxy({},{get(_,next){
          if(next==='withFailureHandler')return failure=>new Proxy({},{get(_,method){return(...args)=>{
            setTimeout(()=>{try{
              if(method==='centralLogin')success(args[0]==='superadmin'&&args[1]==='Test-Super-Admin-2026'?{success:true,token:'test-session'}:{success:false,message:'Username atau password salah.'});
              else if(method==='centralSchools')success({success:true,ownerEmail:'dimazunj14@gmail.com',schools});
              else if(method==='centralChangePassword')success({success:true,token:'changed-session'});
              else if(method==='centralLogout')success({success:true});
              else if(method==='centralOpenSchool')success({success:true,url:'https://cbt58.test/school'});
              else failure(Error('RPC tidak dikenal'));
            }catch(e){failure(e);}},1);
          };}});
        }});
      }})}};
    },{schools});
    await page.goto('https://cbt58.test/');
    await page.locator('#password').fill('Incorrect-Password-2026');await page.locator('#login-submit').click();await page.getByText('Username atau password salah.',{exact:true}).waitFor();
    await page.locator('#password').fill('Test-Super-Admin-2026');await page.locator('#login-submit').click();await page.locator('#dashboard').waitFor({state:'visible'});
    assert.equal(await page.locator('#schools tr').count(),58);assert.equal(await page.locator('#total').textContent(),'58');
    await page.locator('#search').fill('UNIVERSAL');assert.equal(await page.locator('#schools tr').count(),1);assert.match(await page.locator('#schools').innerText(),/SEKOLAH DASAR UNIVERSAL/);
    await page.locator('#search').fill('');await page.locator('#group').selectOption('AKUN-12');assert.equal(await page.locator('#schools tr').count(),3);
    await page.locator('#group').selectOption('');await page.locator('#search').fill('No such school');assert.match(await page.locator('#schools').innerText(),/tidak ditemukan/);await page.locator('#search').fill('');
    const [download]=await Promise.all([page.waitForEvent('download'),page.locator('#export').click()]);assert.equal(download.suggestedFilename(),'LINK-58-SEKOLAH.csv');
    await page.locator('#change-password').click();await page.locator('#old-password').fill('Test-Super-Admin-2026');await page.locator('#new-password').fill('Changed-Super-Admin-2026');await page.locator('#save-password').click();await page.getByText('Password berhasil diganti.',{exact:true}).waitFor();
    const [tab]=await Promise.all([ctx.waitForEvent('page'),page.locator('#schools button').first().click()]);await tab.waitForURL('https://cbt58.test/school');await tab.close();
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),true);
    await page.evaluate(()=>{const note=document.createElement('div');note.textContent='Pratinjau lokal · data uji · belum deploy';note.style.cssText='padding:8px 20px;background:#fff0ca;color:#5f4300;font:14px system-ui';document.body.prepend(note);window.scrollTo(0,0);});
    await page.screenshot({path:new URL('../reports/central-admin-'+label+'.png',import.meta.url).pathname.replace(/^\/([A-Za-z]:)/,'$1'),fullPage:false});
    await page.locator('#logout').click();await page.locator('#login').waitFor({state:'visible'});assert.equal(errors.length,0,errors.join('\n'));
    result[label]={passed:true,rows:58,filter_and_search:true,csv_download:true,password_form:true,school_handoff:true,logout:true,no_page_overflow:true};
    await ctx.close();
  }
}finally{await browser.close();fs.writeFileSync(new URL('../reports/central-admin-browser-qa.json',import.meta.url),JSON.stringify(result,null,2)+'\n');}
console.log(JSON.stringify(result));
