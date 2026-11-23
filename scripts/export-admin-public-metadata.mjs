import fs from 'node:fs';import {readAdminManifest}from './school-admin-manifest.mjs';
const report=JSON.parse(fs.readFileSync('reports/school-admin-login-qa.json','utf8'));
const records=readAdminManifest().map(({password,backend,...record})=>({...record,password_length:password.length,qa:report.results.find(r=>r.school===record.school_code)}));
console.log(JSON.stringify(records));
