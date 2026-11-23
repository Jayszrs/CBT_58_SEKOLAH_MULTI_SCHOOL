// Record an already completed live test; never promote local simulated QA.
import fs from 'node:fs';
const read=name=>JSON.parse(fs.readFileSync(new URL('../'+name,import.meta.url)));
const result=read('reports/central-admin-live-qa.json');
if(!result.passed||result.mode!=='LIVE_GOOGLE_RPC_ANONYMOUS_BROWSER')throw Error('Uji anonim langsung belum lulus.');
const config=read('config/central-admin.json');
if(result.webapp_url!==config.webapp_url||result.enabled_schools!==config.installed_schools)throw Error('Hasil uji berbeda dari deployment sekarang.');
config.status=result.enabled_schools===58?'ACTIVE':'PARTIALLY_ACTIVE_AUTH_REQUIRED';config.live_verified_schools=result.schools.length;config.live_verified_at=result.checked_at;
fs.writeFileSync(new URL('../config/central-admin.json',import.meta.url),JSON.stringify(config,null,2)+'\n');
const report=read('reports/central-admin-provisioning.json');report.live_acceptance_for_installed=true;report.live_verified_schools=result.schools.length;report.complete=result.enabled_schools===58&&result.schools.length===58;
fs.writeFileSync(new URL('../reports/central-admin-provisioning.json',import.meta.url),JSON.stringify(report,null,2)+'\n');
console.log('Uji langsung tercatat: '+result.schools.length+'/58 sekolah.');
