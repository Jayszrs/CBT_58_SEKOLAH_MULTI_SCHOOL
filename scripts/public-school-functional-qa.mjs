import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
const {chromium}=await import(pathToFileURL(path.join(process.env.LOCALAPPDATA,'CBT58-Tools/browser-qa/node_modules/playwright-core/index.mjs')));
const links=JSON.parse(fs.readFileSync(new URL('../config/public-school-links.json',import.meta.url)));
const password=fs.readFileSync(path.join(process.env.LOCALAPPDATA,'CBT58-Private/AKSES-SUPER-ADMIN.txt'),'utf8').match(/^Password awal: (.+)$/m)?.[1];
const result={checked_at:new Date().toISOString(),passed:false,schools:[]};
const browser=await chromium.launch({executablePath:path.join(process.env.LOCALAPPDATA,'Google/Chrome/Application/chrome.exe'),headless:true});
try{
 const ctx=await browser.newContext({viewport:{width:1366,height:900},locale:'id-ID'});
 for(const id of ['SCH051','SCH056']){
  const school=links.find(s=>s.id===id),page=await ctx.newPage();
  await page.goto(school.publicUrl+'?admin=1',{waitUntil:'domcontentloaded',timeout:90000});await page.locator('#admin-username').waitFor({state:'visible',timeout:60000});
  const rejected=await page.evaluate(async slug=>{const response=await fetch('/api/school/'+slug,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({method:'executeAdminAction',args:['invalid-session','getKelas',{}]})});const wire=await response.json();return wire.ok&&wire.result?.success===false&&wire.result?.sessionExpired===true;},school.slug);assert.equal(rejected,true);
  await page.locator('#admin-username').fill('superadmin');await page.locator('#admin-password').fill(password);await page.locator('#btn-admin-login').click();
  await page.waitForFunction(()=>typeof AppStore!=='undefined'&&AppStore.activeComponent==='admin-dashboard',null,{timeout:90000});
  await page.waitForFunction(()=>/^\d+$/.test(document.querySelector('#stat-siswa')?.textContent||''),null,{timeout:60000});
  const data=await page.evaluate(async()=>{const token=AppStore.user.data.token;const [stats,kelas]=await Promise.all([api.call('executeAdminAction',token,'getStatistik',{}),api.call('executeAdminAction',token,'getKelas',{})]);return {statsValid:typeof stats.totalSiswa==='number',classesValid:Array.isArray(kelas)};});assert.equal(data.statsValid,true);assert.equal(data.classesValid,true);
  await page.evaluate(()=>navigateTo('admin-kelas'));await page.locator('#tbl-kelas').waitFor({state:'visible'});await page.waitForFunction(()=>!document.querySelector('#tbl-kelas')?.textContent.includes('Memuat data kelas'),null,{timeout:60000});assert.equal(await page.getByText('Gagal memuat data kelas.').count(),0);
  await page.evaluate(()=>navigateTo('admin-dashboard'));await page.waitForFunction(()=>/^\d+$/.test(document.querySelector('#stat-siswa')?.textContent||''),null,{timeout:60000});
  if(id==='SCH056')await page.screenshot({path:path.resolve('reports/school-public-superadmin.png')});
  await page.reload({waitUntil:'domcontentloaded'});await page.waitForFunction(()=>typeof AppStore!=='undefined'&&AppStore.user?.role==='admin'&&AppStore.activeComponent==='admin-dashboard',null,{timeout:60000});
  await page.evaluate(()=>doAdminLogout());await page.locator('#admin-username').waitFor({state:'visible'});
  result.schools.push({school:school.code,anonymous_admin_denied:true,stats_loaded:true,classes_loaded:true,session_survives_reload:true,logout:true});await page.close();
 }
 const other=await ctx.newPage();await other.goto(links[0].publicUrl,{waitUntil:'domcontentloaded'});await other.getByText('Aplikasi sekolah ini menunggu aktivasi oleh pemiliknya.',{exact:false}).waitFor();result.pending_school_notice=true;await other.close();
 result.passed=true;
}catch(error){result.error=error.message;process.exitCode=1;}
finally{await browser.close();fs.writeFileSync(new URL('../reports/public-school-functional-qa.json',import.meta.url),JSON.stringify(result,null,2)+'\n');}
console.log(JSON.stringify(result));
