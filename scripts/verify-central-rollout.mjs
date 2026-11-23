import fs from 'node:fs';import path from 'node:path';import {googleOwnerApi}from './google-owner-api.mjs';
const schools=JSON.parse(fs.readFileSync('config/schools.json','utf8'));
const keys=JSON.parse(fs.readFileSync(path.join(process.env.LOCALAPPDATA,'CBT58-QA','remote-baseline-20261123','central-config-next.json'),'utf8')).schoolKeys;
const results=[];
for(const email of[...new Set(schools.map(s=>s.account_email))]){
  const api=await googleOwnerApi(email);
  const batch=await Promise.all(schools.filter(s=>s.account_email===email).map(async s=>{
    const base='https://script.googleapis.com/v1/projects/'+s.script_id;
    try{
      const deployment=await api(base+'/deployments/'+s.deployment_id),version=deployment.deploymentConfig.versionNumber;
      const content=await api(base+'/content?versionNumber='+version);
      const keyFile=content.files.find(f=>f.name==='CentralAccessPrivate');if(!keyFile?.source.includes(JSON.stringify(keys[s.school_id])))throw Error('Kunci sekolah tidak cocok pusat.');
      for(const folder of['backend','frontend'])for(const file of fs.readdirSync(folder).filter(n=>/\.(js|html)$/.test(n))){const remote=content.files.find(f=>f.name===file.replace(/\.(js|html)$/,''));if(!remote||remote.source.replace(/\r\n/g,'\n').trimEnd()!==fs.readFileSync(path.join(folder,file),'utf8').replace(/\r\n/g,'\n').trimEnd())throw Error('Sumber versi publik berbeda: '+file);}
      const point=deployment.entryPoints.find(e=>e.entryPointType==='WEB_APP');if(point?.webApp?.entryPointConfig?.access!=='ANYONE_ANONYMOUS')throw Error('Akses deployment tidak publik.');
      s.deployed_version=version;s.central_access_installed=true;
      return {school:s.school_code,version,source_verified:true,central_key_verified:true,public_access:true};
    }catch(e){return {school:s.school_code,error:e.message};}
  }));results.push(...batch);console.log(JSON.stringify({account:schools.find(s=>s.account_email===email).account_id,verified:batch.filter(r=>r.source_verified).length,errors:batch.filter(r=>r.error)}));
}
fs.writeFileSync('reports/central-source-verification.json',JSON.stringify({checked_at:new Date().toISOString(),results},null,2)+'\n');
if(results.some(r=>r.error))process.exitCode=1;
else fs.writeFileSync('config/schools.json',JSON.stringify(schools,null,2)+'\n');
