import fs from 'node:fs';
import path from 'node:path';
import {schoolPublicRecords} from './school-public-links.mjs';
const root=path.resolve(import.meta.dirname,'..');
const site=JSON.parse(fs.readFileSync(path.join(root,'config/public-admin-site.json')));
const recovery=JSON.parse(fs.readFileSync(path.join(root,'config/central-admin-recovery.json')));
const directory=path.join(root,'public-admin');
fs.mkdirSync(path.join(directory,'.openai'),{recursive:true});
const hostingPath=path.join(directory,'.openai/hosting.json');
const hosting=fs.existsSync(hostingPath)?JSON.parse(fs.readFileSync(hostingPath)):{};
if(hosting.project_id&&hosting.project_id!==site.project_id)throw Error('Identitas Site berbeda dari checkout.');
fs.writeFileSync(hostingPath,JSON.stringify({...hosting,project_id:site.project_id},null,2)+'\n');
let html=fs.readFileSync(path.join(root,'admin-central/CentralPage.html'),'utf8');
const old="const call = (name, ...args) => new Promise((resolve,reject) => google.script.run.withSuccessHandler(resolve).withFailureHandler(reject)[name](...args));";
if(!html.includes(old))throw Error('Template panggilan panel berubah.');
html=html.replace(old,`const call = async (method,...args) => {
  const response = await fetch('/api/central',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({method,args})});
  const data = await response.json();
  if(!response.ok || !data.ok) throw Error(data.error || 'Permintaan gagal.');
  return data.result;
};`).replace('id="owner-login"','id="owner-login" style="display:none!important"');
if(html.includes('google.script.run'))throw Error('Antarmuka masih memakai koneksi browser langsung ke Google.');
const schools=JSON.parse(fs.readFileSync(path.join(root,'config/schools.json')));
const backendReportPath=path.join(root,'reports/school-public-backends.json');
const backendReport=fs.existsSync(backendReportPath)?JSON.parse(fs.readFileSync(backendReportPath)):null;
const installed=(backendReport?.passed?backendReport:JSON.parse(fs.readFileSync(path.join(root,'reports/central-admin-live-qa.json')))).schools.map(s=>s.school.replace('-',''));
const records=schoolPublicRecords(schools,site.public_url||site.expected_url,new Set(installed));
fs.writeFileSync(path.join(root,'config/public-school-links.json'),JSON.stringify(records,null,2)+'\n');
let schoolHtml=fs.readFileSync(path.join(root,'frontend/Page.html'),'utf8').replace(/<\?!=\s*include_\('([\w-]+)'\);\s*\?>/g,(_,name)=>fs.readFileSync(path.join(root,'frontend',name+'.html'),'utf8'));
schoolHtml=schoolHtml.replace('<?!= JSON.stringify(getAppConfig_()) ?>','__SCHOOL_CONFIG_JSON__').replace('<?!= JSON.stringify(urlParams) ?>','__SCHOOL_PARAMS_JSON__').replace('<?!= JSON.stringify(centralLogin) ?>','__SCHOOL_LOGIN_JSON__');
if(schoolHtml.includes('<?'))throw Error('School template contains unexpanded server code.');
schoolHtml=schoolHtml.replace(/(['"])(CBT_[A-Z_]+)\1/g,(_,quote,key)=>quote+'__SCHOOL_ID___'+key+quote);
schoolHtml=schoolHtml.replace('</head>','<script>'+fs.readFileSync(path.join(root,'gateway/school-rpc-client.js'),'utf8')+'</script></head>');
const template=fs.readFileSync(path.join(root,'gateway/worker-template.mjs'),'utf8');
const workbookFiles=[['kelas-6-semua-mapel.xlsx','CONTOH-KELAS-6-SEMUA-MAPEL.xlsx'],['kelas-6-matematika.xlsx','CONTOH-KELAS-6-MATEMATIKA.xlsx'],['kelas-6-bahasa-indonesia.xlsx','CONTOH-KELAS-6-BAHASA-INDONESIA.xlsx'],['template-kosong.xlsx','Template-Import-Kosong.xlsx']];
const workbooks=Object.fromEntries(workbookFiles.filter(([,file])=>fs.existsSync(path.join(root,'docs/contoh-soal',file))).map(([route,filename])=>['/contoh-soal/'+route,{filename,base64:fs.readFileSync(path.join(root,'docs/contoh-soal',filename)).toString('base64')}]));
const source=template.replace('__PANEL_HTML__',()=>JSON.stringify(html))
 .replace('__BACKEND_URL__',()=>JSON.stringify(recovery.webapp_url))
 .replace('__PUBLIC_ORIGIN__',()=>JSON.stringify(site.expected_url))
 .replace('__SCHOOL_RECORDS__',()=>JSON.stringify(records))
 .replace('__SCHOOL_HTML__',()=>JSON.stringify(schoolHtml))
 .replace('__DEMO_WORKBOOKS__',()=>JSON.stringify(workbooks));
fs.mkdirSync(path.join(directory,'worker'),{recursive:true});fs.writeFileSync(path.join(directory,'worker/index.js'),source);
fs.mkdirSync(path.join(directory,'scripts'),{recursive:true});
fs.writeFileSync(path.join(directory,'scripts/build.mjs'),`import fs from 'node:fs';
fs.mkdirSync('dist/server',{recursive:true});fs.mkdirSync('dist/.openai',{recursive:true});
fs.copyFileSync('worker/index.js','dist/server/index.js');fs.copyFileSync('.openai/hosting.json','dist/.openai/hosting.json');
`);
fs.writeFileSync(path.join(directory,'package.json'),JSON.stringify({name:'cbt58-public-admin',private:true,type:'module',scripts:{build:'node scripts/build.mjs'}},null,2)+'\n');
fs.writeFileSync(path.join(directory,'README.md'),'# CBT 58 Sekolah — public central panel\n\nRun `node scripts/build.mjs` to build the Worker. Login is checked by the existing Apps Script backend; no credentials are stored in this repository.\n');
console.log('Antarmuka publik dibuat di public-admin/');
