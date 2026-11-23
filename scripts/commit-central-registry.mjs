import fs from 'node:fs';import path from 'node:path';import {googleOwnerApi} from './google-owner-api.mjs';
const cfg=JSON.parse(fs.readFileSync('config/central-admin.json','utf8'));
const privateDir=path.join(process.env.LOCALAPPDATA,'CBT58-QA','remote-baseline-20261123');
const prepared=JSON.parse(fs.readFileSync(path.join(privateDir,'central-config-next.json'),'utf8'));
const request=await googleOwnerApi(cfg.owner_email),base='https://script.googleapis.com/v1/projects/'+cfg.script_id;
const content=await request(base+'/content'),privateFile=content.files.find(f=>f.name==='CentralPrivateConfig');
const current=JSON.parse(privateFile.source.match(/return\s+(\{[\s\S]*\});?\s*\}/)[1]);
for(const [id,key]of Object.entries(current.schoolKeys))if(prepared.schoolKeys[id]!==key)throw Error('Kunci pusat berubah sejak snapshot: '+id);
current.schoolKeys={...prepared.schoolKeys};
privateFile.source='function getCentralPrivateConfig_() { return '+JSON.stringify(current)+'; }\n';
await request(base+'/content','PUT',content);
const version=await request(base+'/versions','POST',{description:'Akses pusat untuk 58 sekolah - 2026-11-23'});
const deployments=await request(base+'/deployments');const changed=[];
for(const d of deployments.deployments.filter(d=>d.deploymentConfig.versionNumber)){
  await request(base+'/deployments/'+d.deploymentId,'PUT',{deploymentConfig:{versionNumber:version.versionNumber,manifestFileName:'appsscript',description:d.deploymentConfig.description||'CBT Admin Pusat'}});
  const actual=await request(base+'/deployments/'+d.deploymentId);if(actual.deploymentConfig.versionNumber!==version.versionNumber)throw Error('Versi pusat belum sesuai.');
  changed.push(d.deploymentId);
}
const report={updated_at:new Date().toISOString(),enabled_schools:Object.keys(current.schoolKeys).length,version:version.versionNumber,deployments:changed,portal_url:cfg.public_portal_url};
fs.writeFileSync('reports/central-rollout.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
