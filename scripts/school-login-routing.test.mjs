import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source=fs.readFileSync(new URL('../frontend/AdminLoginJs.html',import.meta.url),'utf8').replace(/^<script>\s*/,'').replace(/<\/script>\s*$/,'');

test('the school login clears a central password and guides the user before making an RPC',()=>{
 let focused=false,message='';
 const elements={'admin-username':{value:' SuperAdmin '},'admin-password':{value:'private-central-password'},
  'central-admin-link':{href:'https://script.google.com/macros/s/central/exec',focus(){focused=true;}}};
 const ctx=vm.createContext({document:{getElementById:id=>elements[id]},
  api:{call(){assert.fail('A central password must not be sent to the school backend.');}},
  showToast:text=>{message=text;}});
 vm.runInContext(source,ctx);ctx.doAdminLogin();
 assert.equal(elements['admin-password'].value,'');assert.equal(focused,true);assert.match(message,/Panel Super Admin/);
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
