import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
const root = path.resolve(import.meta.dirname, '..');
const schools = JSON.parse(fs.readFileSync(path.join(root,'config','schools.json'),'utf8'));
const frontend = name => fs.readFileSync(path.join(root,'frontend',name+'.html'),'utf8');
const server = http.createServer((request,response)=>{
  const url = new URL(request.url,'http://127.0.0.1:8766');
  const school = schools.find(item=>item.school_id===url.searchParams.get('school')) || schools[0];
  const config = {schoolId:school.school_id,schoolName:school.school_name,logo_url:'',ownerGoogleLoginAvailable:false,schoolTheme:{primary:school.theme_primary,hover:school.theme_hover,accent:school.theme_accent,background:school.theme_background,onPrimary:school.theme_on_primary}};
  let html = frontend('Page').replace(/<\?!= include_\('([^']+)'\); \?>/g,(_,name)=>frontend(name));
  html = html.replace(/<\?!= JSON\.stringify\(getAppConfig_\(\)\) \?>/,JSON.stringify(config)).replace(/<\?!= JSON\.stringify\(urlParams\) \?>/,'{}');
  html = html.replace('<body>','<body><div style="position:fixed;bottom:0;left:0;right:0;z-index:10000;background:#111827;color:white;padding:5px;text-align:center;font:12px sans-serif">Pratinjau tampilan lokal; koneksi backend tidak dijalankan. Gunakan tautan Web App untuk aplikasi.</div><script>window.google={script:{get run(){var failed;var runner=new Proxy({}, {get:function(_,key){if(key===\'withSuccessHandler\')return function(){return runner};if(key===\'withFailureHandler\')return function(fn){failed=fn;return runner};return function(){if(failed)queueMicrotask(function(){failed({message:\'Pratinjau lokal: buka Web App untuk menggunakan backend.\'})})}}});return runner}}};</script>');
  response.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'});response.end(html);
});
server.listen(8766,'127.0.0.1',()=>console.log('UI preview: http://127.0.0.1:8766/?school=SCH001'));
