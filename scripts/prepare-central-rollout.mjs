import fs from 'node:fs';
import path from 'node:path';
import {randomBytes} from 'node:crypto';
const privateDir=path.join(process.env.LOCALAPPDATA,'CBT58-QA','remote-baseline-20261123');
const school=JSON.parse(fs.readFileSync(path.join(privateDir,'SCH058.json'),'utf8')).content;
const central=JSON.parse(fs.readFileSync(path.join(privateDir,'central-project.json'),'utf8'));
const cfgFile=central.content.files.find(f=>f.name==='CentralPrivateConfig');
const match=cfgFile.source.match(/return\s+(\{[\s\S]*\});?\s*\}/);
if(!match)throw Error('Format konfigurasi privat pusat tidak dikenal.');
const config=JSON.parse(match[1]);
const metadata=JSON.parse(school.files.find(f=>f.name==='SchoolDeploymentConfig').source.match(/return (\{[^\n]+\});/)[1]);
for(const s of JSON.parse(fs.readFileSync('config/schools.json','utf8')))if(!config.schoolKeys[s.school_id])config.schoolKeys[s.school_id]=randomBytes(32).toString('hex');
fs.writeFileSync(path.join(privateDir,'central-config-next.json'),JSON.stringify(config));
const changed=[];
for(const f of school.files){
  if(['SchoolDeploymentConfig','CentralAccessPrivate','appsscript'].includes(f.name))continue;
  const file=path.join(f.type==='HTML'?'frontend':'backend',f.name+(f.type==='HTML'?'.html':'.js'));
  const before=fs.existsSync(file)?fs.readFileSync(file,'utf8'):'';
  if(before.replace(/\r\n/g,'\n').trimEnd()!==f.source.replace(/\r\n/g,'\n').trimEnd()){fs.writeFileSync(file,f.source);changed.push(file);}
}
const deployment=central.deployments.deployments.find(d=>d.entryPoints?.some(e=>e.webApp?.url===metadata.centralApiUrl));
if(!deployment)throw Error('URL pusat pada sekolah tidak cocok deployment.');
const publicConfig={script_id:central.id,deployment_id:deployment.deploymentId,webapp_url:metadata.centralApiUrl,owner_email:config.ownerEmail,public_portal_url:'https://cbt58-admin-pusat-publik.closedmyna32.chatgpt.site'};
fs.writeFileSync('config/central-admin.json',JSON.stringify(publicConfig,null,2)+'\n');
console.log(JSON.stringify({changed_files:changed,keys_prepared:Object.keys(config.schoolKeys).length,central:publicConfig}));
