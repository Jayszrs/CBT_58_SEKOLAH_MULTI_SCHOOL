// Owner-only maintenance of existing folders through each authorized Apps Script.
// Only the editor HEAD is touched; public deployment versions are preserved.
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import {pathToFileURL} from 'node:url';
import {findGoogleOwnerCredentials} from './google-owner-api.mjs';
const publish=process.argv.includes('--publish-folders');
const existingFunction=publish||process.argv.includes('--existing-function');
const port=publish?8772:existingFunction?8771:8770;
const root=path.join(process.env.LOCALAPPDATA,'CBT58-QA',publish?'folder-publish-20261124':existingFunction?'folder-maintenance-retry-20261124':'folder-maintenance-20261124');
fs.mkdirSync(root,{recursive:true});
const schools=JSON.parse(fs.readFileSync(path.join(process.env.LOCALAPPDATA,'CBT58-QA','folder-maintenance-20261124','schools.json')));
const publishReport=new URL('../reports/public-drive-folder-editing.json',import.meta.url);
const clients=new Map(),pending=new Map(),results=publish&&fs.existsSync(publishReport)?JSON.parse(fs.readFileSync(publishReport)).results:[];
const auth=await import(pathToFileURL(path.join(process.env.APPDATA,'npm','node_modules','@google','clasp','build','src','auth','auth.js')));
const credentials=new Map();
async function api(s){
  if(!clients.has(s.account_email)){
    const c=await findGoogleOwnerCredentials(s.account_email,auth);
    clients.set(s.account_email,async(url,method='GET',data)=>{
      for(let attempt=0;attempt<3;attempt++){
        try{return (await c.request({url,method,data,timeout:30000})).data;}
        catch(e){if(method==='GET'&&attempt<2&&[429,500,502,503,504].includes(e.response?.status)){await new Promise(r=>setTimeout(r,1000*(attempt+1)));continue;}throw Error('Google API '+(e.response?.status||'timeout')+': '+(e.response?.data?.error?.message||'Permintaan tidak selesai.'));}
      }
    });
  }
  return clients.get(s.account_email);
}
const helper=`function renameSchoolDriveFolderForOwner() {
  requireSchoolOwner_();
  const school=getSchoolMetadata_();
  ${publish?`const results=getSchoolFolderMaintenanceTargets_().map(function(target){const f=DriveApp.getFolderById(target.drive_folder_id);if(f.getName()!==target.school_name||f.getOwner().getEmail()!==school.ownerEmail)throw Error('Identitas folder grup tidak cocok.');f.setSharing(DriveApp.Access.ANYONE_WITH_LINK,DriveApp.Permission.EDIT);return {id:f.getId(),name:f.getName(),public_editor:f.getSharingAccess()===DriveApp.Access.ANYONE_WITH_LINK&&f.getSharingPermission()===DriveApp.Permission.EDIT};});return {school:school.schoolId,public_editor:results.every(function(r){return r.public_editor;}),results:results};`:''}
  if(!school.driveFolderId||!school.schoolName) throw Error('Konfigurasi folder tidak lengkap.');
  const folder=DriveApp.getFolderById(school.driveFolderId);
  ${publish?"if(folder.getName()!==school.schoolName) throw Error('Nama folder tidak cocok.'); folder.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.EDIT);":"folder.setName(school.schoolName);"}
  return {school:school.schoolId,id:folder.getId(),name:folder.getName()${publish?",public_editor:folder.getSharingAccess()===DriveApp.Access.ANYONE_WITH_LINK&&folder.getSharingPermission()===DriveApp.Permission.EDIT":""}};
}`;
async function finish(s,input={}){
  const task=pending.get(s.school_id);if(!task)throw Error('Tidak ada operasi tertunda.');
  const request=await api(s);let out={school:s.school_code,folder_id:s.drive_folder_id,school_name:s.school_name,previous_name:task.before.name,passed:false};
  let groupResults=[];
  try {
    if(publish){
      for(const member of schools.filter(t=>t.account_email===s.account_email)){
        const f=await request('https://www.googleapis.com/drive/v3/files/'+member.drive_folder_id+'?fields=id,name,permissions(type,role)');
        const role=f.permissions?.find(p=>p.type==='anyone')?.role||'private';
        groupResults.push({school:member.school_code,folder_id:f.id,school_name:member.school_name,name:f.name,public_role:role,passed:f.name===member.school_name&&role==='writer',checked_at:new Date().toISOString()});
      }
    }
    const after=await request(task.fileUrl);
    const publicRole=after.permissions?.find(p=>p.type==='anyone')?.role||'private';
    out={...out,name:after.name,renamed:after.name!==task.before.name,public_role:publicRole,passed:after.name===s.school_name&&(!publish||publicRole==='writer'),checked_at:new Date().toISOString()};
    if(input.error)out.error=input.error;
  } finally {
    await request(task.base+'/content','PUT',{files:task.original.files.map(({name,type,source})=>({name,type,source}))});
    const restored=await request(task.base+'/content');
    out.editor_head_restored=task.original.files.every(f=>restored.files.some(g=>g.name===f.name&&g.type===f.type&&g.source===f.source))&&restored.files.length===task.original.files.length;
    if(!out.editor_head_restored)throw Error('Pemulihan HEAD tidak cocok.');
    pending.delete(s.school_id);
    const completed=publish?groupResults.map(r=>({...r,editor_head_restored:true})): [out];
    for(const row of completed){const oldIndex=results.findIndex(r=>r.school===row.school);if(oldIndex>=0)results.splice(oldIndex,1);results.push(row);}
    fs.writeFileSync(new URL(publish?'../reports/public-drive-folder-editing.json':existingFunction?'../reports/school-drive-folder-retries.json':'../reports/school-drive-folders.json',import.meta.url),JSON.stringify({executed:true,results},null,2)+'\n');
  }
  if(publish)out={school:s.school_id,passed:groupResults.every(r=>r.passed),results:groupResults};
  console.log(JSON.stringify(out));return out;
}
const server=http.createServer(async(req,res)=>{
  if(!['127.0.0.1:'+port,'localhost:'+port].includes(req.headers.host)||req.method!=='POST'||req.headers.origin||!String(req.headers['content-type']).startsWith('application/json')){res.writeHead(403).end();return;}
  try {
    let raw='';for await(const chunk of req){raw+=chunk;if(raw.length>5000000)throw Error('Payload terlalu besar.');}
    const input=JSON.parse(raw),s=schools.find(s=>s.school_id===input.school);if(!s)throw Error('Sekolah tidak cocok.');
    const request=await api(s);let output;
    if(req.url==='/prepare'){
      const done=publish&&schools.filter(t=>t.account_email===s.account_email).every(t=>results.some(r=>r.school===t.school_code&&r.passed&&r.editor_head_restored));
      if(done){res.writeHead(200,{'Content-Type':'application/json','Cache-Control':'no-store'}).end(JSON.stringify({already_done:true,result:{school:s.school_id,passed:true}}));return;}
      if(pending.has(s.school_id))throw Error('Operasi sudah disiapkan.');
      const base='https://script.googleapis.com/v1/projects/'+s.script_id;
      const fileUrl='https://www.googleapis.com/drive/v3/files/'+s.drive_folder_id+'?fields=id,name,mimeType,trashed,owners(emailAddress),permissions(type,role)';
      const [original,deployments,before]=await Promise.all([request(base+'/content'),request(base+'/deployments'),request(fileUrl)]);
      if(before.mimeType!=='application/vnd.google-apps.folder'||before.trashed||!before.owners.some(o=>o.emailAddress===s.account_email))throw Error('Identitas folder tidak cocok.');
      const head=deployments.deployments.find(d=>!d.deploymentConfig?.versionNumber),url=head?.entryPoints?.find(e=>e.webApp)?.webApp?.url;if(!url)throw Error('Preview editor tidak tersedia.');
      fs.writeFileSync(path.join(root,s.school_id+'.json'),JSON.stringify(original));
      pending.set(s.school_id,{base,fileUrl,original,before,url});
      let patched=false;
      const files=original.files.map(({name,type,source})=>{
        if(existingFunction&&/function getSchoolResourceLinks\(\)\s*\{/.test(source)){source=source.replace(/function getSchoolResourceLinks\(\)\s*\{/,'function getSchoolResourceLinks() { return renameSchoolDriveFolderForOwner();');patched=true;}
        return {name,type,source};
      });
      if(existingFunction&&!patched)throw Error('Fungsi pemilik yang diperlukan tidak ditemukan.');
      const targets=publish?'\nfunction getSchoolFolderMaintenanceTargets_(){return '+JSON.stringify(schools.filter(t=>t.account_email===s.account_email).map(t=>({drive_folder_id:t.drive_folder_id,school_name:t.school_name})))+';}':'';
      await request(base+'/content','PUT',{files:files.concat([{name:'FolderMaintenance',type:'SERVER_JS',source:helper+targets}])});
      output={school:s.school_id,url};
    } else if(req.url==='/finish')output=await finish(s,input);
    else if(req.url==='/forward'){
      const task=pending.get(s.school_id),u=new URL(input.url);
      if(!task||u.origin!=='https://script.google.com'||!u.pathname.startsWith(new URL(task.url).pathname.replace(/\/exec$/,''))||!['GET','POST'].includes(input.method))throw Error('Tujuan tidak diizinkan.');
      const headers=Object.fromEntries(Object.entries(input.headers||{}).filter(([k])=>!['host','content-length','authorization','connection','accept-encoding'].includes(k.toLowerCase())));
      if(!credentials.has(s.account_email))credentials.set(s.account_email,await findGoogleOwnerCredentials(s.account_email,auth));
      const wire=await credentials.get(s.account_email).request({url:input.url,method:input.method,data:input.body||undefined,headers,responseType:'text',validateStatus:()=>true,timeout:30000});
      output={status:wire.status,contentType:wire.headers.get('content-type'),cookies:wire.headers.getSetCookie?.()||[],body:wire.data};
    } else throw Error('Operasi tidak tersedia.');
    res.writeHead(200,{'Content-Type':'application/json','Cache-Control':'no-store'}).end(JSON.stringify(output));
  }catch(error){res.writeHead(500,{'Content-Type':'application/json','Cache-Control':'no-store'}).end(JSON.stringify({error:error.message}));}
});
server.listen(port,'127.0.0.1',()=>console.log('Folder maintenance ready at 127.0.0.1:'+port));
async function shutdown(){for(const id of [...pending.keys()]){try{await finish(schools.find(s=>s.school_id===id),{error:'Operasi dihentikan.'});}catch(e){console.error(e.message);}}server.close(()=>process.exit(0));}
process.on('SIGINT',shutdown);process.on('SIGTERM',shutdown);
