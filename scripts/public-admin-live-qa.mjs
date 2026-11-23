import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
const {chromium}=await import(pathToFileURL(path.join(process.env.LOCALAPPDATA,'CBT58-Tools/browser-qa/node_modules/playwright-core/index.mjs')));
const local=process.argv.includes('--local');
const site=JSON.parse(fs.readFileSync(new URL('../config/public-admin-site.json',import.meta.url)));
const target=local?'http://127.0.0.1:8770':site.public_url;
if(!target)throw Error('URL publik belum tersedia.');
const text=fs.readFileSync(path.join(process.env.LOCALAPPDATA,'CBT58-Private/AKSES-SUPER-ADMIN.txt'),'utf8');
const password=text.match(/^Password awal: (.+)$/m)?.[1];
const result={checked_at:new Date().toISOString(),url:target,mode:local?'LOCAL_FRONTEND_REAL_GOOGLE_API':'PUBLIC_HOSTED_REAL_GOOGLE_API',passed:false};
const browser=await chromium.launch({executablePath:path.join(process.env.LOCALAPPDATA,'Google/Chrome/Application/chrome.exe'),headless:true});
try{
 const ctx=await browser.newContext({locale:'id-ID',viewport:{width:1366,height:900}});const page=await ctx.newPage();
 const response=await page.goto(target,{waitUntil:'domcontentloaded',timeout:60000});assert.equal(response.status(),200);
 await page.locator('#login-form').waitFor();assert.equal(await page.locator('#owner-login').isVisible(),false);result.public_login_visible=true;
 await page.locator('#password').fill('Incorrect-Password-For-Live-Test');await page.locator('#login-submit').click();await page.getByText('Username atau password salah.',{exact:true}).waitFor({timeout:60000});result.wrong_password_rejected=true;
 await page.locator('#password').fill(password);await page.locator('#login-submit').click();await page.locator('#dashboard').waitFor({state:'visible',timeout:60000});
 assert.equal(await page.locator('#schools tr').count(),58);result.school_rows=58;result.enabled_schools=Number(await page.locator('#enabled').textContent());
 await page.locator('#search').fill('SCH-051');
 const [tab]=await Promise.all([ctx.waitForEvent('page'),page.locator('#schools button').click()]);let frame;
 for(let i=0;i<90&&!frame;i++){for(const f of tab.frames())if(await f.locator('#app').count()){frame=f;break;}if(!frame)await tab.waitForTimeout(300);}
 assert.ok(frame,'Dashboard sekolah belum terbuka.');assert.equal(new URL(tab.url()).origin,new URL(target).origin);assert.match(new URL(tab.url()).pathname,/^\/sekolah\//);await frame.waitForFunction(()=>typeof AppStore!=='undefined'&&AppStore.user?.role==='admin'&&AppStore.activeComponent==='admin-dashboard',{},{timeout:90000});
 const ping=await frame.evaluate(()=>api.call('executeAdminAction',AppStore.user.data.token,'ping',{}));assert.equal(ping.success,true);result.school_admin_handoff=true;result.school_stays_on_public_host=true;await tab.close();
 await page.locator('#search').fill('');await page.screenshot({path:new URL(local?'../reports/public-admin-local.png':'../reports/public-admin-live.png',import.meta.url).pathname.replace(/^\/([A-Za-z]:)/,'$1')});
 await page.locator('#logout').click();await page.locator('#login').waitFor({state:'visible'});result.logout=true;result.passed=true;
}catch(error){result.error=error.message;process.exitCode=1;}
finally{await browser.close();fs.writeFileSync(new URL(local?'../reports/public-admin-local-qa.json':'../reports/public-admin-live-qa.json',import.meta.url),JSON.stringify(result,null,2)+'\n');}
console.log(JSON.stringify(result));
