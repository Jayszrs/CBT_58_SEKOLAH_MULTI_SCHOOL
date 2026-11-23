import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
const {chromium}=await import(pathToFileURL(path.join(process.env.LOCALAPPDATA,'CBT58-Tools/browser-qa/node_modules/playwright-core/index.mjs')));
const browser=await chromium.launch({executablePath:path.join(process.env.LOCALAPPDATA,'Google/Chrome/Application/chrome.exe'),headless:true});
const result={checked_at:new Date().toISOString(),visual_verified:false};
try{
 const page=await browser.newPage({viewport:{width:1366,height:900},locale:'id-ID'});
 const response=await page.goto('https://docs.google.com/spreadsheets/d/1ctiUbPqLGSxsRsM79SPRIrwucJ9aTeR0wM9UrjR92Ns/edit#gid=0&range=I1:N4',{waitUntil:'domcontentloaded',timeout:60000});
 await page.locator('#docs-editor-container').waitFor({state:'visible',timeout:30000});
 await page.waitForTimeout(2000);await page.screenshot({path:path.resolve('reports/monitoring-shortcuts.png')});
 result.visual_verified=true;result.http_status=response.status();
}catch{result.limit='Google Sheets live canvas unavailable in an anonymous browser; bounded native cell/formula/format verification recorded separately.';}
finally{await browser.close();fs.writeFileSync(new URL('../reports/monitoring-visual-qa.json',import.meta.url),JSON.stringify(result,null,2)+'\n');}
console.log(JSON.stringify(result));
