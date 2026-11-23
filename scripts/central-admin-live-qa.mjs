import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import assert from 'node:assert/strict';
import {findGoogleOwnerCredentials} from './google-owner-api.mjs';
const {chromium}=await import(pathToFileURL(path.join(process.env.LOCALAPPDATA,'CBT58-Tools/browser-qa/node_modules/playwright-core/index.mjs')));
const recovery=process.argv.includes('--recovery');
const config=JSON.parse(fs.readFileSync(new URL('../config/central-admin.json',import.meta.url)));
if(recovery)Object.assign(config,JSON.parse(fs.readFileSync(new URL('../config/central-admin-recovery.json',import.meta.url))));
const schools=JSON.parse(fs.readFileSync(new URL('../config/schools.json',import.meta.url)));
const privateConfig=JSON.parse(fs.readFileSync(path.join(process.env.LOCALAPPDATA,'CBT58-Private/central-admin.json')));
const text=fs.readFileSync(path.join(process.env.LOCALAPPDATA,'CBT58-Private/AKSES-SUPER-ADMIN.txt'),'utf8');
const password=text.match(/^Password awal: (.+)$/m)?.[1];
const auth=await import(pathToFileURL(path.join(process.env.APPDATA,'npm/node_modules/@google/clasp/build/src/auth/auth.js')));
const credentials=new Map();
const endpoints=[{deployment_id:config.deployment_id,account_email:config.owner_email},...schools.filter(s=>privateConfig.deployed[s.school_id])];
const ownerTransport=process.argv.includes('--owner-transport');
if(ownerTransport)for(const email of new Set(endpoints.map(s=>s.account_email)))credentials.set(email,await findGoogleOwnerCredentials(email,auth));
const browser=await chromium.launch({executablePath:path.join(process.env.LOCALAPPDATA,'Google/Chrome/Application/chrome.exe'),headless:true});
const result={checked_at:new Date().toISOString(),webapp_url:config.webapp_url,mode:ownerTransport?'LIVE_GOOGLE_RPC_OWNER_TRANSPORT':'LIVE_GOOGLE_RPC_ANONYMOUS_BROWSER',schools:[],passed:false};
async function frame(page,selector){for(let i=0;i<60;i++){for(const f of page.frames())if(await f.locator(selector).count())return f;await page.waitForTimeout(300);}throw Error('Antarmuka aplikasi belum terbuka; periksa izin pemilik.');}
try{
 const ctx=await browser.newContext({viewport:{width:1440,height:1000}});
 if(ownerTransport)await ctx.route('https://script.google.com/macros/s/**',async route=>{
  const r=route.request(),u=new URL(r.url());
  const target=endpoints.find(s=>['/exec','/callback'].includes(u.pathname.replace('/macros/s/'+s.deployment_id,'')));
  if(!target){await route.continue();return;}
  try{
   const headers=Object.fromEntries(Object.entries(await r.allHeaders()).filter(([k])=>!['host','content-length','authorization','connection','accept-encoding'].includes(k.toLowerCase())));
   const response=await credentials.get(target.account_email).request({url:r.url(),method:r.method(),data:r.postData()||undefined,headers,responseType:'text',validateStatus:()=>true});
   await route.fulfill({status:response.status,contentType:response.headers.get('content-type')||'text/html',body:response.data});
  }catch(error){await route.fulfill({status:502,body:'Gagal menghubungi Google.'});}
 });
 const page=await ctx.newPage();await page.goto(config.webapp_url,{waitUntil:'domcontentloaded',timeout:60000});const f=await frame(page,'#login-form');
 await f.locator('#password').fill('Incorrect-Password-For-Live-Test');await f.locator('#login-submit').click();await f.getByText('Username atau password salah.',{exact:true}).waitFor({timeout:60000});result.wrong_password_rejected=true;
 await f.locator('#password').fill(password);await f.locator('#login-submit').click();await f.locator('#dashboard').waitFor({state:'visible',timeout:60000});assert.equal(await f.locator('#schools tr').count(),58);result.school_rows=58;
 const enabled=await f.locator('#enabled').textContent();result.enabled_schools=Number(enabled);
 for(const s of schools.filter(s=>privateConfig.deployed[s.school_id])){
  await f.locator('#search').fill(s.school_code);
  const [tab]=await Promise.all([ctx.waitForEvent('page',{timeout:60000}),f.locator('#schools button').click()]);
  const sf=await frame(tab,'#app');await sf.waitForFunction(()=>typeof AppStore!=='undefined'&&AppStore.user?.role==='admin'&&AppStore.activeComponent==='admin-dashboard',{},{timeout:90000});
  const ping=await sf.evaluate(()=>api.call('executeAdminAction',AppStore.user.data.token,'ping',{}));assert.equal(ping.success,true);
  result.schools.push({school:s.school_code,admin_handoff:true,admin_ping:true});await tab.close();
 }
 await f.locator('#search').fill('');await f.locator('#logout').click();await f.locator('#login').waitFor({state:'visible'});result.logout=true;
 result.passed=true;
}catch(error){result.error=error.message;process.exitCode=1;}
finally{
 await browser.close();
 fs.writeFileSync(new URL(recovery?'../reports/central-admin-recovery-live-qa.json':'../reports/central-admin-live-qa.json',import.meta.url),JSON.stringify(result,null,2)+'\n');
 if(result.passed&&!recovery){
  config.status=result.enabled_schools===schools.length?'ACTIVE':'PARTIALLY_ACTIVE_AUTH_REQUIRED';
  config.live_verified_schools=result.schools.length;config.live_verified_at=result.checked_at;
  fs.writeFileSync(new URL('../config/central-admin.json',import.meta.url),JSON.stringify(config,null,2)+'\n');
  const reportPath=new URL('../reports/central-admin-provisioning.json',import.meta.url);
  const report=JSON.parse(fs.readFileSync(reportPath));
  report.live_acceptance_for_installed=true;report.live_verified_schools=result.schools.length;
  report.complete=result.enabled_schools===schools.length&&result.schools.length===schools.length;
  fs.writeFileSync(reportPath,JSON.stringify(report,null,2)+'\n');
 }
}
console.log(JSON.stringify(result));
