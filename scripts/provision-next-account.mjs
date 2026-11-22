import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { googleOwnerApi } from './google-owner-api.mjs';
import { resolveFirebaseTools, loadFirebaseApi } from './firebase-group-resources.mjs';

const root = path.resolve(import.meta.dirname, '..');
const args = process.argv.slice(2);
const accountId = args[0];
const accounts = JSON.parse(fs.readFileSync(path.join(root,'config','accounts.json'),'utf8'));
const account = accounts.find(item=>item.account_id===accountId && item.role==='OPERASIONAL');
if (!account) throw Error('Pilih akun operasional yang valid, misalnya AKUN-02.');
const schools = JSON.parse(fs.readFileSync(path.join(root,'config','schools.json'),'utf8')).filter(s=>s.account_id===accountId);
console.log(`${accountId}: ${account.email || '(email belum tersedia)'}; ${schools.map(s=>s.school_code).join(', ')}`);
if (!args.includes('--execute')) { console.log('DRY RUN. Tambahkan --execute untuk melanjutkan dengan akun pemilik yang sudah login.'); process.exit(0); }
if (!account.email) throw Error('Email belum tersedia di LIST AKUN.');
const reportDirectory = path.join(root,'reports');
fs.mkdirSync(reportDirectory,{recursive:true});
const report = {account_id:accountId,email:account.email,schools:schools.map(s=>s.school_code),updated_at:new Date().toISOString(),phase:'PREFLIGHT'};
const checkpoint = phase => { report.phase=phase; report.updated_at=new Date().toISOString(); fs.writeFileSync(path.join(reportDirectory,accountId+'-provisioning.json'),JSON.stringify(report,null,2)+'\n'); };
const run = (name, params=[]) => {
  const result = spawnSync(process.execPath,[path.join(root,'scripts',name),...params],{cwd:root,stdio:'inherit'});
  if(result.error)throw result.error;
  if(result.status!==0)throw Error(`Langkah ${name} belum selesai; jalankan ulang untuk melanjutkan.`);
};
try {
  // Verify both identities before creating any cloud resources.
  await googleOwnerApi(account.email);
  const firebase = loadFirebaseApi(resolveFirebaseTools(),account.email);
  checkpoint('IDENTITIES_VERIFIED');
  const firebaseArgs=[accountId,'--email',account.email,'--execute','--yes'];
  const projectFlag=args.indexOf('--project-id');
  if(projectFlag>=0){
    if(!args[projectFlag+1] || args[projectFlag+1].startsWith('--'))throw Error('--project-id memerlukan nilai.');
    firebaseArgs.push('--project-id',args[projectFlag+1]);
  } else if(schools[0].firebase_project_id)firebaseArgs.push('--project-id',schools[0].firebase_project_id);
  run('provision-firebase-group.mjs',firebaseArgs);
  checkpoint('FIREBASE_VERIFIED');
  run('sync-school-config.mjs');
  const current=JSON.parse(fs.readFileSync(path.join(root,'config','schools.json'),'utf8')).find(s=>s.account_id===accountId);
  await firebase.ensureSheetsApi(current.firebase_project_id);
  checkpoint('SHEETS_API_READY');
  run('provision-school-pilot.mjs',[accountId,'--execute']);
  checkpoint('DEPLOYED_OWNER_PREVIEW');
  run('verify-school-pilot.mjs',[accountId]);
  checkpoint('CLOUD_VERIFIED');
  console.log('Resource cloud terverifikasi. Catat URL aktual di spreadsheet monitoring; UAT aplikasi tetap perlu dilakukan.');
} catch(error) {
  report.error=error.message;
  checkpoint(report.phase==='PREFLIGHT'?'LOGIN_REQUIRED':report.phase);
  console.error(error.message);
  process.exitCode=1;
}
