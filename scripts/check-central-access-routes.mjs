import fs from 'node:fs';
import {googleOwnerApi} from './google-owner-api.mjs';
const config=JSON.parse(fs.readFileSync(new URL('../config/central-admin.json',import.meta.url)));
const request=await googleOwnerApi(config.owner_email);
const deployment=await request('https://script.googleapis.com/v1/projects/'+config.script_id+'/deployments/'+config.deployment_id);
const webapp=deployment.entryPoints?.find(e=>e.entryPointType==='WEB_APP')?.webApp;
const routes=[['canonical',config.webapp_url],['account_index_3',config.webapp_url.replace('/macros/s/','/macros/u/3/s/')]];
const results=await Promise.all(routes.map(async([route,url])=>{
 const response=await fetch(url,{signal:AbortSignal.timeout(30000)});const html=await response.text();
 return{route,url,http_status:response.status,title:html.match(/<title>(.*?)<\/title>/i)?.[1]||'',panel_rendered:html.includes('Semua sekolah, satu akses.'),
  google_drive_error:html.includes('Sorry, unable to open the file at this time.')};
}));
const report={checked_at:new Date().toISOString(),mode:'NO_GOOGLE_COOKIES',deployment:{version:deployment.deploymentConfig?.versionNumber,access:webapp?.entryPointConfig?.access,execute_as:webapp?.entryPointConfig?.executeAs},results,
 note:'These checks do not reproduce the user’s signed-in browser cookies. Use Incognito to isolate account routing.',
 reference:'https://developers.google.com/apps-script/guides/support/troubleshooting#issues_with_multiple_google_accounts'};
fs.writeFileSync(new URL('../reports/central-access-routes.json',import.meta.url),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
