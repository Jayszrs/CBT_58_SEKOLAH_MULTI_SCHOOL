import fs from 'node:fs';
const schools=JSON.parse(fs.readFileSync(new URL('../config/schools.json',import.meta.url)));
const results=[];
for(let i=0;i<schools.length;i+=5){
 await Promise.all(schools.slice(i,i+5).map(async s=>{
  try{
   const response=await fetch(s.drive_folder_url,{signal:AbortSignal.timeout(30000)});const html=await response.text();
   const title=html.match(/<title>(.*?)<\/title>/i)?.[1]||'';
   const accessible=response.ok&&!response.url.startsWith('https://accounts.google.com/')&&title.includes(s.school_name);
   results.push({school:s.school_code,drive_folder_url:s.drive_folder_url,http_status:response.status,title,public_view_verified:accessible});
  }catch(error){results.push({school:s.school_code,public_view_verified:false,error:error.message});}
 }));
}
results.sort((a,b)=>a.school.localeCompare(b.school));
fs.writeFileSync(new URL('../reports/public-drive-folders.json',import.meta.url),JSON.stringify({checked_at:new Date().toISOString(),results},null,2)+'\n');
console.log(JSON.stringify({checked:results.length,public:results.filter(r=>r.public_view_verified).length,installed:results.filter(r=>r.public_view_verified)}));
