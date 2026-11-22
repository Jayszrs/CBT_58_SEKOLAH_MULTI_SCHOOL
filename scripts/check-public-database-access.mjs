import fs from 'node:fs';
const directory=new URL('../firebase-groups/',import.meta.url);
const results=[];
for(const name of fs.readdirSync(directory).filter(n=>/^FB-\d+$/.test(n))){
  const file=new URL(name+'/provision-result.json',directory);
  if(!fs.existsSync(file))continue;
  const group=JSON.parse(fs.readFileSync(file));
  if(group.database_status!=='VERIFIED')continue;
  const response=await fetch(group.database_url+'/.json',{signal:AbortSignal.timeout(20000)});
  const denied=[401,403].includes(response.status);
  const result={group:name,project:group.project_id,http_status:response.status,public_read_denied:denied};
  results.push(result);console.log(JSON.stringify(result));
}
fs.writeFileSync(new URL('../reports/public-database-access.json',import.meta.url),JSON.stringify({checked_at:new Date().toISOString(),results},null,2)+'\n');
if(results.some(result=>!result.public_read_denied))process.exitCode=1;
