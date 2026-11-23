import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source=fs.readFileSync(new URL('../frontend/AdminLoginJs.html',import.meta.url),'utf8').replace(/^<script>\s*/,'').replace(/<\/script>\s*$/,'');

test('the school form supports superadmin and persists only the issued session',async()=>{
 let sent,saved,navigated;
 const elements={'admin-username':{value:' superadmin '},'admin-password':{value:'private-central-password'},'btn-admin-login':{}};
 const ctx=vm.createContext({document:{getElementById:id=>elements[id]},AppStore:{user:null},
  api:{call:async(...args)=>{sent=args;return{success:true,sessionToken:'CENTRAL:issued-session'};}},
  localStorage:{setItem:(key,value)=>{saved=value;}},navigateTo:page=>{navigated=page;},showToast(){}});
 vm.runInContext(source,ctx);ctx.doAdminLogin();await new Promise(resolve=>setImmediate(resolve));
 assert.deepEqual(sent,['loginAdmin','private-central-password','superadmin']);
 assert.equal(JSON.parse(saved).data.token,'CENTRAL:issued-session');assert.equal(saved.includes('private-central-password'),false);assert.equal(navigated,'admin-dashboard');
});

test('the existing school administrator login still stores its issued session and opens the dashboard',async()=>{
 let sent,navigated,saved;
 const elements={'admin-username':{value:'admin'},'admin-password':{value:'school-admin-password'},'btn-admin-login':{}};
 const ctx=vm.createContext({document:{getElementById:id=>elements[id]},AppStore:{user:null},
  api:{call:async(...args)=>{sent=args;return{success:true,sessionToken:'ADMIN:issued-session'};}},
  localStorage:{setItem:(key,value)=>{saved=JSON.parse(value);}},navigateTo:page=>{navigated=page;},showToast(){}});
 vm.runInContext(source,ctx);ctx.doAdminLogin();await new Promise(resolve=>setImmediate(resolve));
 assert.deepEqual(sent,['loginAdmin','school-admin-password','admin']);
 assert.equal(navigated,'admin-dashboard');assert.equal(saved.data.token,'ADMIN:issued-session');assert.equal(elements['btn-admin-login'].disabled,false);
});
