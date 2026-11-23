import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
const {chromium}=await import(pathToFileURL(path.join(process.env.LOCALAPPDATA,'CBT58-Tools/browser-qa/node_modules/playwright-core/index.mjs')));
const recovery=JSON.parse(fs.readFileSync(new URL('../config/central-admin-recovery.json',import.meta.url)));
const browser=await chromium.launch({executablePath:path.join(process.env.LOCALAPPDATA,'Google/Chrome/Application/chrome.exe'),headless:true});
const report={checked_at:new Date().toISOString(),mode:'FRESH_BROWSER_INDONESIAN_DESKTOP_UA',url:recovery.webapp_url};
try{
 const probe=await browser.newContext();const p=await probe.newPage();const userAgent=(await p.evaluate(()=>navigator.userAgent)).replace('HeadlessChrome/','Chrome/');await probe.close();
 const context=await browser.newContext({locale:'id-ID',timezoneId:'Asia/Jakarta',userAgent,viewport:{width:1366,height:768}});
 const page=await context.newPage();const response=await page.goto(recovery.webapp_url,{waitUntil:'domcontentloaded',timeout:60000});report.http_status=response.status();report.title=await page.title();
 let panel;
 for(let i=0;i<60&&!panel;i++){for(const f of page.frames())if(await f.locator('#login-form').count()){panel=f;break;}if(!panel)await page.waitForTimeout(300);}
 report.login_form_visible=!!panel;
 if(panel){
  const owner=await panel.evaluate(()=>new Promise((resolve,reject)=>google.script.run.withSuccessHandler(r=>resolve({success:r.success,message:r.message})).withFailureHandler(e=>reject(Error(e.message))).centralOwnerLogin()));
  report.anonymous_owner_login_rejected=owner.success===false;
  await page.screenshot({path:new URL('../reports/central-recovery-login-id.png',import.meta.url).pathname.replace(/^\/([A-Za-z]:)/,'$1')});
 }
}catch(error){report.error=error.message;process.exitCode=1;}
finally{await browser.close();fs.writeFileSync(new URL('../reports/central-recovery-browser-access.json',import.meta.url),JSON.stringify(report,null,2)+'\n');}
console.log(JSON.stringify(report));
