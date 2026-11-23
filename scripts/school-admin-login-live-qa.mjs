import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
const {chromium}=await import(pathToFileURL(path.join(process.env.LOCALAPPDATA,'CBT58-Tools/browser-qa/node_modules/playwright-core/index.mjs')));
const report=JSON.parse(fs.readFileSync(new URL('../reports/school-admin-accounts.json',import.meta.url)));
const links=JSON.parse(fs.readFileSync(new URL('../config/public-school-links.json',import.meta.url)));
const privatePath=path.join(process.env.LOCALAPPDATA,'CBT58-Private/AKUN-ADMIN-58-SEKOLAH.txt');
const txt=fs.readFileSync(privatePath,'utf8');
const entries=txt.split(/\r?\n\r?\n/).slice(1).map(block=>({code:block.match(/SCH-\d{3}/)?.[0],password:block.match(/^Password: (.+)$/m)?.[1]}));
const result={checked_at:new Date().toISOString(),mode:'ANONYMOUS_BROWSER_SCHOOL_ADMIN',passed:false,schools:[]};
const browser=await chromium.launch({executablePath:path.join(process.env.LOCALAPPDATA,'Google/Chrome/Application/chrome.exe'),headless:true});
try{
 for(const row of report.results.filter(r=>r.status==='ACTIVE_VERIFIED')){
  const school=links.find(s=>s.code===row.school),password=entries.find(e=>e.code===row.school)?.password;assert.ok(password);
  const ctx=await browser.newContext({locale:'id-ID'});const page=await ctx.newPage();
  const response=await page.goto(school.publicUrl+'?admin=1',{waitUntil:'domcontentloaded',timeout:90000});assert.equal(response.status(),200);
  await page.locator('#admin-username').waitFor({state:'visible',timeout:60000});
  await page.locator('#admin-username').fill('admin');await page.locator('#admin-password').fill(password);await page.locator('#btn-admin-login').click();
  await page.waitForFunction(()=>typeof AppStore!=='undefined'&&AppStore.user?.role==='admin'&&AppStore.activeComponent==='admin-dashboard',null,{timeout:90000});
  await page.waitForFunction(()=>/^\d+$/.test(document.querySelector('#stat-siswa')?.textContent||''),null,{timeout:60000});
  const ping=await page.evaluate(()=>api.call('executeAdminAction',AppStore.user.data.token,'ping',{}));assert.equal(ping.success,true);
  await page.evaluate(()=>doAdminLogout());await page.locator('#admin-username').waitFor({state:'visible'});
  result.schools.push({school:school.code,login:true,stats_loaded:true,admin_session:true,logout:true});console.log(school.code+': login admin lewat browser publik berhasil.');await ctx.close();
 }
 assert.ok(result.schools.length>0);result.passed=true;
}catch(error){result.error=String(error.message);for(const entry of entries)if(entry.password)result.error=result.error.replaceAll(entry.password,'[redacted]');process.exitCode=1;}
finally{await browser.close();fs.writeFileSync(new URL('../reports/school-admin-login-live-qa.json',import.meta.url),JSON.stringify(result,null,2)+'\n');}
console.log(JSON.stringify({passed:result.passed,schools:result.schools.length,error:result.error}));
