import fs from 'node:fs';
import path from 'node:path';
import {googleOwnerApi} from './google-owner-api.mjs';
const mainPath=new URL('../config/central-admin.json',import.meta.url),recoveryPath=new URL('../config/central-admin-recovery.json',import.meta.url);
const main=JSON.parse(fs.readFileSync(mainPath)),recovery=JSON.parse(fs.readFileSync(recoveryPath));
const verifyOnly=process.argv.includes('--verify-only');
if(main.script_id!==recovery.script_id)throw Error('Proyek pemulihan berbeda.');
const request=await googleOwnerApi(main.owner_email);const base='https://script.googleapis.com/v1/projects/'+main.script_id;
let version={versionNumber:main.version};
if(!verifyOnly){
const content=await request(base+'/content');
const backup=path.join(process.env.LOCALAPPDATA,'CBT58-Private/central-before-public-api.json');
if(!fs.existsSync(backup))fs.writeFileSync(backup,JSON.stringify(content),{mode:0o600});
const files=content.files;
const file={name:'CentralApi',type:'SERVER_JS',source:fs.readFileSync(new URL('../admin-central/CentralApi.js',import.meta.url),'utf8')};
const existing=files.findIndex(f=>f.name===file.name);if(existing<0)files.push(file);else files[existing]=file;
const manifestFile=files.find(f=>f.name==='appsscript');const manifest=JSON.parse(manifestFile.source);
manifest.webapp={access:'ANYONE_ANONYMOUS',executeAs:'USER_DEPLOYING'};manifestFile.source=JSON.stringify(manifest,null,2);
await request(base+'/content','PUT',{files});
version=await request(base+'/versions','POST',{description:'CBT58 endpoint panel publik dengan autentikasi sesi'});
}
const results=[];
for(const config of [main,recovery]){
 const old=await request(base+'/deployments/'+config.deployment_id);
 const updated=verifyOnly?old:await request(base+'/deployments/'+config.deployment_id,'PUT',{deploymentConfig:{...old.deploymentConfig,versionNumber:version.versionNumber,manifestFileName:'appsscript'}});
 const entry=updated.entryPoints?.find(e=>e.entryPointType==='WEB_APP')?.webApp;
 if(entry?.entryPointConfig?.access!=='ANYONE_ANONYMOUS')throw Error('Akses deployment belum publik.');
 config.version=version.versionNumber;results.push({deployment_id:config.deployment_id,url:entry.url,access:entry.entryPointConfig.access,version:config.version});
}
fs.writeFileSync(mainPath,JSON.stringify(main,null,2)+'\n');fs.writeFileSync(recoveryPath,JSON.stringify(recovery,null,2)+'\n');
let health;
for(let attempt=0;attempt<4;attempt++){
 try{
  const response=await fetch(recovery.webapp_url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({method:'health',args:[]}),signal:AbortSignal.timeout(10000)});
  const candidate=await response.json();if(response.ok&&candidate.ok&&candidate.result?.application==='cbt58-central'){health=candidate;break;}
 }catch{ /* Newly updated deployments can briefly serve the previous entry point. */ }
 if(attempt<3)await new Promise(resolve=>setTimeout(resolve,2000));
}
if(!health)throw Error('Deployment sudah diperbarui tetapi endpoint belum siap. Jalankan kembali dengan --verify-only.');
const report={checked_at:new Date().toISOString(),deployments:results,health};
fs.writeFileSync(new URL('../reports/central-public-api.json',import.meta.url),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
