import fs from 'node:fs';
import path from 'node:path';
import { googleOwnerApi } from './google-owner-api.mjs';
const root = path.resolve(import.meta.dirname, '..');
const accountId = process.argv[2] || 'AKUN-01';
const schools = JSON.parse(fs.readFileSync(path.join(root, 'config', 'schools.json'), 'utf8')).filter(s=>s.account_id===accountId);
if (!schools.length) throw Error('Akun operasional tidak ditemukan.');
const request = await googleOwnerApi(schools[0].account_email);
const results = await Promise.all(schools.map(async school => {
  const base = `https://script.googleapis.com/v1/projects/${school.script_id}`;
  const [content, deployment, spreadsheet, folder] = await Promise.all([
    request(base+'/content?versionNumber='+school.deployed_version), request(base+'/deployments/'+school.deployment_id),
    request(`https://www.googleapis.com/drive/v3/files/${school.spreadsheet_id}?fields=id,mimeType,owners(emailAddress)`),
    request(`https://www.googleapis.com/drive/v3/files/${school.drive_folder_id}?fields=id,mimeType,owners(emailAddress)`),
  ]);
  const metadata = JSON.parse(content.files.find(f=>f.name==='SchoolDeploymentConfig').source.match(/return (\{[^\n]+\});/)[1]);
  const manifest = JSON.parse(content.files.find(f=>f.name==='appsscript').source);
  for(const folderName of ['backend','frontend']){
    for(const name of fs.readdirSync(path.join(root,folderName)).filter(n=>/\.(js|html)$/.test(n))){
      const remote=content.files.find(f=>f.name===name.replace(/\.(js|html)$/,''));
      const normalize=text=>text.replace(/\r\n/g,'\n').trimEnd();
      if(!remote||normalize(remote.source)!==normalize(fs.readFileSync(path.join(root,folderName,name),'utf8')))throw Error(`${school.school_code}: source ${name} berbeda dari perbaikan lokal.`);
    }
  }
  const expected = { schoolId:school.school_id,schoolName:school.school_name,ownerEmail:school.account_email,spreadsheetId:school.spreadsheet_id,driveFolderId:school.drive_folder_id,firebaseDatabaseUrl:school.firebase_database_url,themePrimary:school.theme_primary,themeAccent:school.theme_accent,themeBackground:school.theme_background };
  for(const [key,value] of Object.entries(expected))if(metadata[key]!==value)throw Error(`${school.school_code}: remote ${key} tidak sesuai.`);
  if(!['MYSELF','ANYONE_ANONYMOUS'].includes(manifest.webapp.access) || manifest.webapp.access!==school.deployment_access)throw Error('Akses deployment tidak sesuai konfigurasi sekolah.');
  if(!manifest.oauthScopes.includes('https://www.googleapis.com/auth/firebase.database'))throw Error('Scope database tidak tersedia.');
  const webApp = deployment.entryPoints.find(e=>e.entryPointType==='WEB_APP')?.webApp;
  if(webApp?.entryPointConfig?.access!==school.deployment_access || webApp.entryPointConfig.executeAs!=='USER_DEPLOYING')throw Error('Kebijakan akses entry point tidak sesuai.');
  if(webApp?.url!==school.webapp_url || deployment.deploymentConfig.versionNumber!==school.deployed_version)throw Error('Deployment tidak sesuai.');
  for(const file of [spreadsheet,folder])if(!file.owners.some(owner=>owner.emailAddress===school.account_email))throw Error('Pemilik resource tidak sesuai.');
  return {school:school.school_code,remote_identity:'VERIFIED',application_source:'VERIFIED',palette:'VERIFIED',resource_owner:school.account_email,access:manifest.webapp.access,version:school.deployed_version,webapp:school.webapp_url};
}));
fs.mkdirSync(path.join(root,'reports'),{recursive:true});
const report = JSON.stringify({account_id:accountId,verified_at:new Date().toISOString(),results},null,2)+'\n';
fs.writeFileSync(path.join(root,'reports',accountId+'-verification.json'),report);
if(accountId==='AKUN-01')fs.writeFileSync(path.join(root,'reports','pilot-verification.json'),report);
const checkpointFile=path.join(root,'reports',accountId+'-provisioning.json');
if(fs.existsSync(checkpointFile)){
  const checkpoint=JSON.parse(fs.readFileSync(checkpointFile,'utf8'));
  checkpoint.phase='CLOUD_VERIFIED';checkpoint.updated_at=new Date().toISOString();delete checkpoint.error;
  fs.writeFileSync(checkpointFile,JSON.stringify(checkpoint,null,2)+'\n');
}
console.log(JSON.stringify(results,null,2));
