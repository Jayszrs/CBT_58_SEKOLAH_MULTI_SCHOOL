import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
const {chromium}=await import(pathToFileURL(path.join(process.env.LOCALAPPDATA,'CBT58-Tools/browser-qa/node_modules/playwright-core/index.mjs')));
const central=JSON.parse(fs.readFileSync(new URL('../config/central-admin.json',import.meta.url)));
const school=JSON.parse(fs.readFileSync(new URL('../config/schools.json',import.meta.url))).find(s=>s.school_id==='SCH051');
const result={checked_at:new Date().toISOString(),school:school.school_code,mode:'LIVE_ANONYMOUS_BROWSER',passed:false};
const browser=await chromium.launch({executablePath:path.join(process.env.LOCALAPPDATA,'Google/Chrome/Application/chrome.exe'),headless:true});
try{
 const ctx=await browser.newContext();const page=await ctx.newPage();
 await page.goto(school.webapp_url+'?admin=1',{waitUntil:'domcontentloaded',timeout:60000});
 let frame;
 for(let i=0;i<60&&!frame;i++){for(const f of page.frames())if(await f.locator('#admin-username').count()){frame=f;break;}if(!frame)await page.waitForTimeout(300);}
 assert.ok(frame,'Form admin sekolah belum terbuka.');
 const link=frame.locator('#central-admin-link');await link.waitFor({state:'visible',timeout:30000});
 assert.equal(await link.getAttribute('href'),central.webapp_url);
 await frame.evaluate(()=>{window.schoolLoginRpcCalls=[];const original=api.call;api.call=function(name,...args){window.schoolLoginRpcCalls.push(name);return original.call(this,name,...args);};});
 await frame.locator('#admin-username').fill('superadmin');await frame.locator('#admin-password').fill('Routing-Only-Test-Password');await frame.locator('#btn-admin-login').click();
 assert.equal(await frame.locator('#admin-password').inputValue(),'');
 assert.equal(await frame.evaluate(()=>window.schoolLoginRpcCalls.includes('loginAdmin')),false);
 assert.equal(await frame.evaluate(()=>document.activeElement?.id),'central-admin-link');
 result.central_link=central.webapp_url;result.central_password_not_sent=true;result.password_cleared=true;result.passed=true;
}catch(error){result.error=error.message;process.exitCode=1;}
finally{await browser.close();fs.writeFileSync(new URL('../reports/school-login-guidance-live.json',import.meta.url),JSON.stringify(result,null,2)+'\n');}
console.log(JSON.stringify(result));
