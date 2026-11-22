import fs from 'node:fs';
import {googleOwnerApi} from './google-owner-api.mjs';
const schools=JSON.parse(fs.readFileSync(new URL('../config/schools.json',import.meta.url)));
const results=[];
for(const email of [...new Set(schools.map(s=>s.account_email))]){
  const request=await googleOwnerApi(email);
  for(const s of schools.filter(s=>s.account_email===email)){
    try{
      const base='https://www.googleapis.com/drive/v3/files/'+s.spreadsheet_id+'/permissions';
      const list=()=>request(base+'?fields=permissions(id,type,role,allowFileDiscovery)');
      const existing=(await list()).permissions?.find(p=>p.type==='anyone');
      if(existing&&existing.role!=='writer')await request(base+'/'+existing.id,'PATCH',{role:'writer',allowFileDiscovery:false});
      else if(!existing)await request(base+'?fields=id,type,role','POST',{type:'anyone',role:'writer',allowFileDiscovery:false});
      const verified=(await list()).permissions?.find(p=>p.type==='anyone'&&p.role==='writer');
      if(!verified)throw Error('Izin editor publik belum terbaca.');
      results.push({school:s.school_code,spreadsheet_url:s.spreadsheet_url,public_editor:true,discoverable:verified.allowFileDiscovery===true});
    }catch(e){results.push({school:s.school_code,public_editor:false,error:e.message});}
    fs.writeFileSync(new URL('../reports/public-spreadsheet-editing.json',import.meta.url),JSON.stringify({checked_at:new Date().toISOString(),results},null,2)+'\n');
    console.log(JSON.stringify(results.at(-1)));
  }
}
if(results.some(r=>!r.public_editor))process.exitCode=1;
