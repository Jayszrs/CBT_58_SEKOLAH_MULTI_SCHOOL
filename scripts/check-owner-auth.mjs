import {googleOwnerApi} from './google-owner-api.mjs';
const email=process.argv[2];
if(!email)process.exit(2);
try{await googleOwnerApi(email);console.log(email+': login sesuai.');}
catch(error){console.error(email+': login diperlukan.');process.exitCode=2;}
