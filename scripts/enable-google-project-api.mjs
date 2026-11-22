import {googleOwnerApi} from './google-owner-api.mjs';
const [email,projectId,service='serviceusage.googleapis.com']=process.argv.slice(2);
if(!email||!/^cbt-grup-\d{2}$/.test(projectId)||!['serviceusage.googleapis.com','firebasedatabase.googleapis.com','sheets.googleapis.com'].includes(service))throw Error('Email, project CBT, dan API yang diizinkan wajib diisi.');
const request=await googleOwnerApi(email);
const operation=await request(`https://serviceusage.googleapis.com/v1/projects/${projectId}/services/${service}:enable`,'POST',{});
console.log(JSON.stringify({project:projectId,service,operation:operation.name,done:operation.done||false}));
if(operation.name&&!operation.done){
  for(let attempt=0;attempt<30;attempt++){
    await new Promise(resolve=>setTimeout(resolve,2000));
    const status=await request('https://serviceusage.googleapis.com/v1/'+operation.name);
    if(status.done){if(status.error)throw Error(status.error.message);console.log('API enabled.');break;}
  }
}
