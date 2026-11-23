import fs from 'node:fs';
import {googleOwnerApi} from './google-owner-api.mjs';
import {extractAuthorizationUrl} from './webapp-authorization.mjs';
const config=JSON.parse(fs.readFileSync(new URL('../config/central-admin.json',import.meta.url)));
const scopes=JSON.parse(fs.readFileSync(new URL('../admin-central/appsscript.json',import.meta.url))).oauthScopes;
try{
 const request=await googleOwnerApi(config.owner_email);
 const owner=await request(config.webapp_url);
 const anonymous=await fetch(config.webapp_url,{signal:AbortSignal.timeout(30000)});const html=await anonymous.text();
 const title=String(owner).match(/<title>(.*?)<\/title>/i)?.[1]||'';
 const report={checked_at:new Date().toISOString(),webapp_url:config.webapp_url,owner_title:title,anonymous_title:html.match(/<title>(.*?)<\/title>/i)?.[1]||'',anonymous_status:anonymous.status,
  owner_authorization_required:title==='Authorization needed',public_panel_rendered:html.includes('Semua sekolah, satu akses.')};
 if(report.owner_authorization_required)report.authorization_url=extractAuthorizationUrl(owner,config.owner_email,scopes);
 fs.writeFileSync(new URL('../reports/central-admin-live-inspection.json',import.meta.url),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
}catch(error){console.error(error.message);process.exitCode=1;}
