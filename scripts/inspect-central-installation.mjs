import fs from 'node:fs';
import path from 'node:path';
import {googleOwnerApi} from './google-owner-api.mjs';
const schools=JSON.parse(fs.readFileSync(new URL('../config/schools.json',import.meta.url)));
const dir=path.join(process.env.LOCALAPPDATA,'CBT58-QA','remote-baseline-20261123');fs.mkdirSync(dir,{recursive:true});
for(const id of['SCH001','SCH018','SCH019','SCH058']){
  const s=schools.find(s=>s.school_id===id);const request=await googleOwnerApi(s.account_email);
  try{
    const base='https://script.googleapis.com/v1/projects/'+s.script_id;
    const deployment=await request(base+'/deployments/'+s.deployment_id);
    const version=deployment.deploymentConfig.versionNumber;
    const content=await request(base+'/content?versionNumber='+version);
    fs.writeFileSync(path.join(dir,id+'.json'),JSON.stringify({deployment,content},null,2));
    const functions=content.files.flatMap(f=>Array.from(f.source.matchAll(/function\s+([\w$]+)\s*\(/g),m=>m[1])).filter(n=>/central|super|bridge|install|bootstrap|seed/i.test(n));
    const changed=content.files.filter(f=>{const ext=f.type==='HTML'?'.html':'.js';const p=path.join('backend',f.name+ext);return fs.existsSync(p)&&fs.readFileSync(p,'utf8').replace(/\r\n/g,'\n').trim()!==f.source.replace(/\r\n/g,'\n').trim();}).map(f=>f.name);
    console.log(JSON.stringify({school:s.school_code,version,extraFiles:content.files.map(f=>f.name).filter(n=>/central|super|bridge/i.test(n)),functions,changed}));
  }catch(e){console.log(JSON.stringify({school:s.school_code,error:e.message}));}
}
