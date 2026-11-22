import fs from 'node:fs';
import path from 'node:path';
import { googleOwnerApi } from './google-owner-api.mjs';
import { inspectWebAppHtml } from './webapp-authorization.mjs';
const root = path.resolve(import.meta.dirname,'..');
const accountId = process.argv[2];
const selected = process.argv[3];
const schools = JSON.parse(fs.readFileSync(path.join(root,'config','schools.json'),'utf8')).filter(s=>s.account_id===accountId && (!selected || selected===s.school_id || selected===s.school_code));
if (!schools.length) throw Error('Sekolah/akun tidak ditemukan.');
const request = await googleOwnerApi(schools[0].account_email);
const scopes = JSON.parse(fs.readFileSync(path.join(root,'appsscript.json'),'utf8')).oauthScopes;
const results=[];
for (const school of schools) {
  const result = {school:school.school_code,owner:school.account_email,webapp:school.webapp_url};
  try { Object.assign(result, school.webapp_url ? inspectWebAppHtml(await request(school.webapp_url),school,scopes) : {status:'NOT_DEPLOYED'}); }
  catch(error){result.status='CHECK_FAILED';result.error=error.message;}
  results.push(result);
}
const report = {account_id:accountId,checked_at:new Date().toISOString(),results:results.map(({authorization_url,...rest})=>rest)};
fs.mkdirSync(path.join(root,'reports'),{recursive:true});
fs.writeFileSync(path.join(root,'reports',accountId+'-webapp-check.json'),JSON.stringify(report,null,2)+'\n');
// Authorization links are temporary handoff URLs. Keep them out of progress sheets/files.
console.log(JSON.stringify({account_id:accountId,results},null,2));
