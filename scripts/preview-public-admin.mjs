import http from 'node:http';
import {handleRequest} from '../public-admin/worker/index.js';
const server=http.createServer(async(req,res)=>{
 if(!['127.0.0.1:8770','localhost:8770'].includes(req.headers.host)){res.writeHead(403).end();return;}
 try{
  let body='';for await(const chunk of req){body+=chunk;if(body.length>32768){res.writeHead(413).end();return;}}
  const response=await handleRequest(new Request('http://'+req.headers.host+req.url,{method:req.method,headers:req.headers,...(['GET','HEAD'].includes(req.method)?{}:{body})}));
  res.writeHead(response.status,Object.fromEntries(response.headers));res.end(Buffer.from(await response.arrayBuffer()));
 }catch{res.writeHead(502,{'Content-Type':'application/json'}).end('{"ok":false,"error":"Server panel belum merespons."}');}
});
server.listen(8770,'127.0.0.1',()=>console.log('Panel preview: http://127.0.0.1:8770'));
