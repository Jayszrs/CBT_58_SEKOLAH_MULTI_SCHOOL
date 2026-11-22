import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import readline from 'node:readline/promises';
const root=path.resolve(import.meta.dirname,'..');
const accounts=JSON.parse(fs.readFileSync(path.join(root,'config','accounts.json')));
const schools=JSON.parse(fs.readFileSync(path.join(root,'config','schools.json')));
const accountId=process.argv[2];
const execute=process.argv.includes('--execute');
const account=accounts.find(a=>a.account_id===accountId && a.role==='OPERASIONAL');
if(!account) { console.error('Pakai AKUN-01 sampai AKUN-15'); process.exit(1); }
const batch=schools.filter(s=>s.account_id===accountId);
console.log(`\n${accountId}: ${batch.map(s=>s.school_id).join(', ')}`);
console.log(`Akun yang harus login: ${account.email}`);
if(!execute){console.log('DRY RUN. Tambahkan --execute setelah memastikan clasp login akun yang benar.');process.exit(0);}
if(account.email.startsWith('ISI_')){ console.error('Isi email aktual pada config/accounts.json dulu.');process.exit(1); }
const rl=readline.createInterface({input:process.stdin,output:process.stdout});
const confirm=await rl.question(`Pastikan login clasp ke ${account.email}. Ketik ${accountId} untuk lanjut: `);
rl.close();
if(confirm!==accountId){console.error('Dibatalkan.');process.exit(1);}
for(const school of batch){
  const dest=path.join(root,'dist',school.school_id);
  if(!fs.existsSync(path.join(dest,'SchoolDeploymentConfig.js'))) throw Error(`Belum build ${school.school_id}`);
  console.log(`\n==> ${school.school_id}`);
  const claspfile=path.join(dest,'.clasp.json');
  if(!fs.existsSync(claspfile)) {
    const created=spawnSync('clasp',['create-script','--title',`CBT-${school.school_id}`,'--type','standalone'],{cwd:dest,stdio:'inherit',shell:process.platform==='win32'});
    if(created.status!==0){ console.error('Gagal create-script, hentikan untuk cek akun/kuota.');process.exit(1); }
  }
  const pushed=spawnSync('clasp',['push'],{cwd:dest,stdio:'inherit',shell:process.platform==='win32'});
  if(pushed.status!==0){ console.error('Gagal push, hentikan untuk dicek.');process.exit(1); }
  const project=JSON.parse(fs.readFileSync(claspfile,'utf8'));
  school.script_id=project.scriptId || school.script_id;
  school.status='UPLOADED_NOT_DEPLOYED';
  console.log('Script ID: '+school.script_id);
}
fs.writeFileSync(path.join(root,'config','schools.json'),JSON.stringify(schools,null,2)+'\n');
console.log('Selesai upload source. Sekarang isi Script Properties + setupSchoolResources masing-masing, belum otomatis deploy publik.');
