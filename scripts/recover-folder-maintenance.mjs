import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {findGoogleOwnerCredentials} from './google-owner-api.mjs';
const root=path.join(process.env.LOCALAPPDATA,'CBT58-QA','folder-publish-20261124');
const schools=JSON.parse(fs.readFileSync(new URL('../config/schools.json',import.meta.url)));
const reportFile=new URL('../reports/public-drive-folder-editing.json',import.meta.url);
const report=fs.existsSync(reportFile)?JSON.parse(fs.readFileSync(reportFile)):{executed:true,results:[]};
const auth=await import(pathToFileURL(path.join(process.env.APPDATA,'npm','node_modules','@google','clasp','build','src','auth','auth.js')));
const targets=schools.filter(s=>fs.existsSync(path.join(root,s.school_id+'.json'))&&!report.results.some(r=>r.school===s.school_code&&r.passed&&r.editor_head_restored));
for(const email of [...new Set(targets.map(s=>s.account_email))]){
  const c=await findGoogleOwnerCredentials(email,auth);
  const request=async(url,method='GET',data)=>{try{return(await c.request({url,method,data,timeout:30000})).data;}catch(e){throw Error('Google API '+(e.response?.status||'timeout')+': '+(e.response?.data?.error?.message||'Permintaan tidak selesai.'));}};
  for(const s of targets.filter(s=>s.account_email===email)){
    const base='https://script.googleapis.com/v1/projects/'+s.script_id;
    const original=JSON.parse(fs.readFileSync(path.join(root,s.school_id+'.json')));
    const same=head=>original.files.length===head.files.length&&original.files.every(f=>head.files.some(g=>g.name===f.name&&g.type===f.type&&g.source===f.source));
    let head=await request(base+'/content');
    if(!same(head)){await request(base+'/content','PUT',{files:original.files.map(({name,type,source})=>({name,type,source}))});head=await request(base+'/content');}
    if(!same(head))throw Error('Pemulihan sumber gagal: '+s.school_code);
    const folder=await request('https://www.googleapis.com/drive/v3/files/'+s.drive_folder_id+'?fields=id,name,permissions(type,role)');
    const publicRole=folder.permissions?.find(p=>p.type==='anyone')?.role||'private';
    const out={school:s.school_code,folder_id:folder.id,school_name:s.school_name,name:folder.name,public_role:publicRole,passed:folder.name===s.school_name&&publicRole==='writer',editor_head_restored:true,recovered:true,checked_at:new Date().toISOString()};
    report.results=report.results.filter(r=>r.school!==s.school_code).concat(out);fs.writeFileSync(reportFile,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(out));
  }
}
