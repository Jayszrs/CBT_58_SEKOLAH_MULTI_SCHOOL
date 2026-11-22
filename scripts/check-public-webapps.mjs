import fs from 'node:fs';
const schools=JSON.parse(fs.readFileSync(new URL('../config/schools.json',import.meta.url))).filter(s=>s.deployment_access==='ANYONE_ANONYMOUS');
const results=[];
for(const school of schools){
  try{
    const response=await fetch(school.webapp_url,{signal:AbortSignal.timeout(30000)});
    const html=await response.text();
    const title=html.match(/<title>(.*?)<\/title>/i)?.[1]||'';
    const status=response.ok&&title===`CBT | ${school.school_name}`&&html.includes('APP_GLOBAL_CONFIG')?'PUBLIC_LOGIN_RENDERED':title==='Authorization needed'?'OWNER_AUTHORIZATION_REQUIRED':'PUBLIC_ACCESS_FAILED';
    const item={school:school.school_code,status,http_status:response.status,title};
    results.push(item);console.log(JSON.stringify(item));
  }catch(error){const item={school:school.school_code,status:'CHECK_FAILED',error:error.message};results.push(item);console.log(JSON.stringify(item));}
}
fs.writeFileSync(new URL('../reports/public-webapps.json',import.meta.url),JSON.stringify({checked_at:new Date().toISOString(),results},null,2)+'\n');
