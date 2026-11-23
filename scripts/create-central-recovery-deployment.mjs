import fs from 'node:fs';
import {googleOwnerApi} from './google-owner-api.mjs';
const config=JSON.parse(fs.readFileSync(new URL('../config/central-admin.json',import.meta.url)));
const request=await googleOwnerApi(config.owner_email);
const base='https://script.googleapis.com/v1/projects/'+config.script_id;
const description='CBT58 Super Admin Pusat - akses pemulihan';
const listed=await request(base+'/deployments');
let deployment=listed.deployments?.find(d=>d.deploymentConfig?.description===description);
if(!deployment)deployment=await request(base+'/deployments','POST',{versionNumber:config.version,manifestFileName:'appsscript',description});
const verified=await request(base+'/deployments/'+deployment.deploymentId);
const entry=verified.entryPoints?.find(e=>e.entryPointType==='WEB_APP')?.webApp;
if(entry?.entryPointConfig?.access!=='ANYONE_ANONYMOUS'||entry.entryPointConfig.executeAs!=='USER_DEPLOYING'||!entry.url)throw Error('Deployment belum terverifikasi sebagai publik.');
const recovery={owner_email:config.owner_email,script_id:config.script_id,deployment_id:verified.deploymentId,webapp_url:entry.url,
 version:verified.deploymentConfig.versionNumber,status:'AWAITING_USER_ACCESS_VERIFICATION'};
fs.writeFileSync(new URL('../config/central-admin-recovery.json',import.meta.url),JSON.stringify(recovery,null,2)+'\n');
const response=await fetch(entry.url,{signal:AbortSignal.timeout(30000)});const html=await response.text();
const report={checked_at:new Date().toISOString(),...recovery,http_status:response.status,title:html.match(/<title>(.*?)<\/title>/i)?.[1]||'',panel_rendered:html.includes('Semua sekolah, satu akses.')};
fs.writeFileSync(new URL('../reports/central-recovery-deployment.json',import.meta.url),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
