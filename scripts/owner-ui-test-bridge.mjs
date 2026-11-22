// Local QA transport: forwards Google Apps Script requests with the existing
// owner's OAuth identity. No tokens leave this process; no application auth is mocked.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {findGoogleOwnerCredentials} from './google-owner-api.mjs';
const schools=JSON.parse(fs.readFileSync(new URL('../config/schools.json',import.meta.url)));
const school=schools.find(s=>s.school_id===(process.argv[2]||'SCH001'));
if(!school?.deployment_id) throw Error('Deployment sekolah tidak tersedia.');
const authDirectory=path.join(process.env.APPDATA,'npm','node_modules','@google','clasp','build','src','auth','auth.js');
const auth=await import(pathToFileURL(authDirectory));
const credentials=await findGoogleOwnerCredentials(school.account_email,auth);
const allowed=`https://script.google.com/macros/s/${school.deployment_id}`;
const server=http.createServer(async(req,res)=>{
  if(req.method!=='POST'||req.url!=='/forward'||req.headers.origin||!String(req.headers['content-type']).startsWith('application/json')) {res.writeHead(403).end();return;}
  try {
    let body='';for await(const chunk of req){body+=chunk;if(body.length>5000000)throw Error('Payload terlalu besar');}
    const input=JSON.parse(body), url=new URL(input.url);
    if(![allowed+'/exec',allowed+'/callback'].includes(url.origin+url.pathname)||!['GET','POST'].includes(input.method)) throw Error('Tujuan QA tidak diizinkan.');
    const headers=Object.fromEntries(Object.entries(input.headers||{}).filter(([key])=>!['host','content-length','authorization','connection','accept-encoding'].includes(key.toLowerCase())));
    if(input.contentType)headers['Content-Type']=input.contentType;
    const response=await credentials.request({url:input.url,method:input.method,data:input.body||undefined,headers,responseType:'text',validateStatus:()=>true});
    console.log(JSON.stringify({path:url.pathname.split('/').pop(),method:input.method,status:response.status,type:response.headers.get('content-type'),bytes:String(response.data).length}));
    res.setHeader('Content-Type','application/json');
    if(response.status>=400) console.log(String(response.data).replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').slice(0,500));
    res.end(JSON.stringify({status:response.status,contentType:response.headers.get('content-type'),cookies:response.headers.getSetCookie?.()||[],body:response.data}));
  }catch(error){res.writeHead(502,{'Content-Type':'application/json'}).end(JSON.stringify({error:error.message}));}
});
server.listen(8767,'127.0.0.1',()=>console.log(`QA owner transport ${school.school_id} ready at 127.0.0.1:8767`));
