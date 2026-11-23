import fs from 'node:fs';
import path from 'node:path';
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
const template=fs.readFileSync(path.join(root,'gateway/worker-template.mjs'),'utf8');
const source=template.replace('__PANEL_HTML__',()=>JSON.stringify(html))
 .replace('__BACKEND_URL__',()=>JSON.stringify(recovery.webapp_url))
 .replace('__PUBLIC_ORIGIN__',()=>JSON.stringify(site.expected_url));
fs.mkdirSync(path.join(directory,'worker'),{recursive:true});fs.writeFileSync(path.join(directory,'worker/index.js'),source);
fs.mkdirSync(path.join(directory,'scripts'),{recursive:true});
fs.writeFileSync(path.join(directory,'scripts/build.mjs'),`import fs from 'node:fs';
fs.mkdirSync('dist/server',{recursive:true});fs.mkdirSync('dist/.openai',{recursive:true});
fs.copyFileSync('worker/index.js','dist/server/index.js');fs.copyFileSync('.openai/hosting.json','dist/.openai/hosting.json');
`);
fs.writeFileSync(path.join(directory,'package.json'),JSON.stringify({name:'cbt58-public-admin',private:true,type:'module',scripts:{build:'node scripts/build.mjs'}},null,2)+'\n');
fs.writeFileSync(path.join(directory,'README.md'),'# CBT 58 Sekolah — public central panel\n\nRun `node scripts/build.mjs` to build the Worker. Login is checked by the existing Apps Script backend; no credentials are stored in this repository.\n');
console.log('Antarmuka publik dibuat di public-admin/');
