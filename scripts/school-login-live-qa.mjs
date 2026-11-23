import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
const {chromium}=await import(pathToFileURL(path.join(process.env.LOCALAPPDATA,'CBT58-Tools/browser-qa/node_modules/playwright-core/index.mjs')));
const local=process.argv.includes('--local');
const site=JSON.parse(fs.readFileSync(new URL('../config/public-admin-site.json',import.meta.url)));
const schools=JSON.parse(fs.readFileSync(new URL('../config/public-school-links.json',import.meta.url))).filter(s=>s.enabled);
const secret=fs.readFileSync(path.join(process.env.LOCALAPPDATA,'CBT58-Private/AKSES-SUPER-ADMIN.txt'),'utf8');
const password=secret.match(/^Password awal: (.+)$/m)?.[1];
assert.ok(password);
const origin=local?'http://127.0.0.1:8770':site.public_url;
const result={checked_at:new Date().toISOString(),mode:local?'LOCAL_PUBLIC_SCHOOL':'LIVE_PUBLIC_SCHOOL',passed:false,schools:[]};
const browser=await chromium.launch({executablePath:path.join(process.env.LOCALAPPDATA,'Google/Chrome/Application/chrome.exe'),headless:true});
try{
 for(const school of schools){
  const ctx=await browser.newContext({locale:'id-ID',viewport:{width:1366,height:900}});const page=await ctx.newPage();
  const response=await page.goto(origin+'/sekolah/'+school.slug+'?admin=1',{waitUntil:'domcontentloaded',timeout:90000});assert.equal(response.status(),200);
  await page.locator('#admin-username').waitFor({state:'visible',timeout:60000});
  await page.locator('#admin-username').fill('superadmin');await page.locator('#admin-password').fill(password);await page.locator('#btn-admin-login').click();
  await page.waitForFunction(()=>typeof AppStore!=='undefined'&&AppStore.user?.role==='admin'&&AppStore.activeComponent==='admin-dashboard',null,{timeout:90000});
  const ping=await page.evaluate(()=>api.call('executeAdminAction',AppStore.user.data.token,'ping',{}));assert.equal(ping.success,true);
  assert.equal(new URL(page.url()).origin,origin);
  assert.equal(await page.evaluate(()=>Object.keys(localStorage).some(k=>k.startsWith('CBT_'))),false);
  result.schools.push({school:school.code,name:school.name,public_url:origin+'/sekolah/'+school.slug,direct_superadmin_login:true,guarded_admin_ping:true});
  if(school.id==='SCH056')await page.screenshot({path:path.resolve('reports/school-public-superadmin.png')});
  await ctx.close();console.log(school.code+': public school superadmin OK');
 }
 result.passed=true;
}catch(error){result.error=error.message;process.exitCode=1;}
finally{await browser.close();fs.writeFileSync(new URL(local?'../reports/school-public-local-qa.json':'../reports/school-public-live-qa.json',import.meta.url),JSON.stringify(result,null,2)+'\n');}
console.log(JSON.stringify(result));
