import fs from 'node:fs';
const file='portal-source/.sites-checkout/worker/index.js';let source=fs.readFileSync(file,'utf8');
const match=source.match(/^const SCHOOLS = (\[[^\n]+\]);$/m);if(!match)throw Error('Daftar sekolah portal tidak ditemukan.');
const remote=JSON.parse(match[1]),local=JSON.parse(fs.readFileSync('config/schools.json','utf8'));
for(const school of remote){const actual=local.find(s=>s.school_id===school.id);if(!actual)throw Error('Sekolah portal tidak dikenal.');school.backend=actual.webapp_url;school.enabled=true;school.spreadsheet=actual.spreadsheet_url;}
source=source.replace(match[0],'const SCHOOLS = '+JSON.stringify(remote)+';');fs.writeFileSync(file,source);
fs.writeFileSync('config/public-school-routes.json',JSON.stringify(remote.map(s=>({school_id:s.id,school_code:s.code,slug:s.slug,url:'https://cbt58-admin-pusat-publik.closedmyna32.chatgpt.site/sekolah/'+s.slug})),null,2)+'\n');
console.log(JSON.stringify({portal_schools:remote.length,enabled:remote.filter(s=>s.enabled).length}));
