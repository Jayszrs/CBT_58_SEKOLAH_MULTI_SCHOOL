import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {googleOwnerApi} from './google-owner-api.mjs';
const config=JSON.parse(fs.readFileSync(new URL('../config/central-admin.json',import.meta.url)));
const request=await googleOwnerApi(config.owner_email);
const base='https://script.googleapis.com/v1/projects/'+config.script_id;
const [project,deployments,content]=await Promise.all([request(base),request(base+'/deployments'),request(base+'/content')]);
const report={checked_at:new Date().toISOString(),project:{scriptId:project.scriptId,title:project.title,creator:project.creator?.email,last_modified_user:project.lastModifyUser?.email},
 deployments:deployments.deployments?.map(d=>({id:d.deploymentId,version:d.deploymentConfig?.versionNumber,description:d.deploymentConfig?.description,entrypoints:d.entryPoints})),
 files:content.files?.map(f=>({name:f.name,type:f.type,size:f.source.length,sha256:createHash('sha256').update(f.source).digest('hex')}))};
fs.writeFileSync(new URL('../reports/central-deployment-inspection.json',import.meta.url),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
