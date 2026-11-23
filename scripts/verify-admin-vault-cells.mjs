import {readAdminManifest}from './school-admin-manifest.mjs';
if(process.stdin.isTTY)process.stdin.setRawMode(true);
process.stdin.setEncoding('utf8');let text='';
console.log('Ready for private cell verification on hidden stdin.');
process.stdin.on('data',chunk=>{
  text+=chunk;if(!/[\r\n]/.test(text))return;
  try{
    const rows=JSON.parse(text.trim()),records=readAdminManifest();
    if(rows.length!==58)throw Error('Jumlah baris kredensial tidak cocok.');
    for(let i=0;i<58;i++)if(rows[i][0]!==records[i].school_code||rows[i][2]!==records[i].username||rows[i][3]!==records[i].password)throw Error('Isi kredensial tidak cocok pada '+records[i].school_code);
    console.log(JSON.stringify({rows:58,usernames_matched:58,passwords_matched:58}));
    process.exit(0);
  }catch(e){console.log(JSON.stringify({verified:false,error:e.message}));process.exit(1);}
});
process.stdin.resume();
