// Build replaces these public constants. No password, OAuth token or school key.
const HTML = __PANEL_HTML__;
const BACKEND_URL = __BACKEND_URL__;
const PUBLIC_ORIGIN = __PUBLIC_ORIGIN__;
const SCHOOLS = __SCHOOL_RECORDS__;
const SCHOOL_HTML = __SCHOOL_HTML__;
const METHODS = new Set(['centralLogin','centralSchools','centralOpenSchool','centralLogout','centralChangePassword']);
const SCHOOL_METHODS = new Set(['loginAdmin','checkAdminLoginStatus','loginSiswa','executeAdminAction','startUjian','pingSimpanJawaban','submitUjian','getImageBase64','getMultipleImageBase64']);

function json(value,status=200){return new Response(JSON.stringify(value),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});}

async function relay(method,args,upstreamFetch,endpoint=BACKEND_URL){
  const upstream=await upstreamFetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({method,args}),redirect:'follow',signal:AbortSignal.timeout(35000)});
  if(!upstream.ok)throw Error('Server panel belum merespons. Coba kembali.');
  let result;try{result=await upstream.json();}catch{throw Error('Server panel belum memberikan respons yang valid.');}
  if(typeof result?.ok!=='boolean')throw Error('Respons server panel tidak valid.');
  return result;
}

function pageResponse(body,status=200){return new Response(body,{status,headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','X-Frame-Options':'DENY','Referrer-Policy':'no-referrer'}});}
function scriptJson(value){return JSON.stringify(value).replaceAll('<','\\u003c').replaceAll('\u2028','\\u2028').replaceAll('\u2029','\\u2029');}
function escapeHtml(value){return String(value).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');}
function panelOrigin(url){return ['127.0.0.1','localhost'].includes(url.hostname)?url.origin:PUBLIC_ORIGIN;}
function publicSchoolUrl(school,origin){return origin+'/sekolah/'+school.slug;}

async function renderSchool(request,url,school,upstreamFetch){
  if(request.method==='HEAD')return pageResponse(null);
  if(!school.enabled)return pageResponse('<!doctype html><html lang="id"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>'+escapeHtml(school.name)+'</title><main style="font:16px system-ui;max-width:620px;margin:10vh auto;padding:24px"><h1>'+escapeHtml(school.name)+'</h1><p>Aplikasi sekolah ini menunggu aktivasi oleh pemiliknya. Hubungi admin pusat untuk melanjutkan.</p><a href="'+escapeHtml(panelOrigin(url))+'">Buka Panel Super Admin</a></main></html>');
  const params={};for(const key of ['admin','page','central_ticket'])if(url.searchParams.has(key))params[key]=url.searchParams.get(key);
  const wire=await relay('bootstrap',[params],upstreamFetch,school.backend);
  if(!wire.ok||!wire.result?.config)throw Error(wire.error||'Aplikasi sekolah belum terhubung.');
  delete params.central_ticket;
  const html=SCHOOL_HTML.replaceAll('__SCHOOL_SLUG__',school.slug).replaceAll('__SCHOOL_ID__',school.id)
    .replace('__SCHOOL_CONFIG_JSON__',()=>scriptJson(wire.result.config))
    .replace('__SCHOOL_PARAMS_JSON__',()=>scriptJson(params))
    .replace('__SCHOOL_LOGIN_JSON__',()=>scriptJson(wire.result.centralLogin||null));
  return pageResponse(html);
}

function rewriteCentralResult(wire,method,args,url){
  if(!wire.ok||!wire.result)return wire;
  const origin=panelOrigin(url);
  if(method==='centralSchools'&&Array.isArray(wire.result.schools))wire.result.schools=wire.result.schools.map(row=>{
    const school=SCHOOLS.find(s=>s.code===row.code);return school?{...row,spreadsheet:origin+'/data/'+school.slug,webapp:publicSchoolUrl(school,origin),centralAccess:!!row.centralAccess&&school.enabled}:row;
  });
  if(method==='centralOpenSchool'){
    const school=SCHOOLS.find(s=>s.code===args[1]);if(!school?.enabled)throw Error('Sekolah belum diaktifkan.');
    const original=new URL(wire.result.url);if(original.origin!=='https://script.google.com'||original.pathname!==new URL(school.backend).pathname)throw Error('Tujuan sekolah tidak sesuai.');
    const ticket=original.searchParams.get('central_ticket');if(!ticket)throw Error('Tiket sekolah tidak tersedia.');
    wire.result.url=publicSchoolUrl(school,origin)+'?admin=1&central_ticket='+encodeURIComponent(ticket);
  }
  return wire;
}

export async function handleRequest(request,{upstreamFetch=fetch}={}){
  const url=new URL(request.url);
  if(url.pathname==='/favicon.ico')return new Response(null,{status:204});
  const shortcut=url.pathname.match(/^\/(sekolah|data)\/([a-z0-9-]+)$/);
  if(shortcut&&['GET','HEAD'].includes(request.method)){
    const school=SCHOOLS.find(s=>s.slug===shortcut[2]);if(!school)return json({ok:false,error:'Sekolah tidak ditemukan.'},404);
    if(shortcut[1]==='data')return Response.redirect(school.spreadsheet,302);
    try{return await renderSchool(request,url,school,upstreamFetch);}catch{return pageResponse('<!doctype html><html lang="id"><meta charset="utf-8"><h1>Aplikasi sekolah belum dapat dihubungkan</h1><p>Coba muat ulang halaman atau hubungi admin pusat.</p></html>',503);}
  }
  if(url.pathname==='/'&&['GET','HEAD'].includes(request.method))return new Response(request.method==='HEAD'?null:HTML,{headers:{
    'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','X-Frame-Options':'DENY','Referrer-Policy':'no-referrer'}});
  if(url.pathname==='/api/health'&&request.method==='GET'){
    try{return json(await relay('health',[],upstreamFetch));}catch{return json({ok:false,error:'Server panel belum terhubung.'},502);}
  }
  const schoolApi=url.pathname.match(/^\/api\/school\/([a-z0-9-]+)$/);
  if(url.pathname!=='/api/central'&&!schoolApi)return json({ok:false,error:'Halaman tidak ditemukan.'},404);
  if(request.method!=='POST')return json({ok:false,error:'Gunakan POST.'},405);
  const origin=request.headers.get('origin');
  if(origin&&origin!==url.origin&&origin!==PUBLIC_ORIGIN)return json({ok:false,error:'Asal permintaan tidak diizinkan.'},403);
  if(!request.headers.get('content-type')?.startsWith('application/json'))return json({ok:false,error:'Gunakan JSON.'},415);
  const limit=schoolApi?6000000:16384;
  if(Number(request.headers.get('content-length')||0)>limit)return json({ok:false,error:'Permintaan terlalu besar.'},413);
  try{
    const raw=await request.text();if(raw.length>limit)return json({ok:false,error:'Permintaan terlalu besar.'},413);
    const input=JSON.parse(raw);
    if(schoolApi){
      const school=SCHOOLS.find(s=>s.slug===schoolApi[1]);if(!school)return json({ok:false,error:'Sekolah tidak ditemukan.'},404);
      if(!school.enabled)return json({ok:false,error:'Sekolah belum diaktifkan oleh pemiliknya.'},403);
      if(!SCHOOL_METHODS.has(input.method)||!Array.isArray(input.args)||input.args.length>8)return json({ok:false,error:'Operasi sekolah tidak tersedia.'},400);
      return json(await relay(input.method,input.args,upstreamFetch,school.backend));
    }
    if(!METHODS.has(input.method)||!Array.isArray(input.args)||input.args.length>4)return json({ok:false,error:'Operasi tidak tersedia.'},400);
    return json(rewriteCentralResult(await relay(input.method,input.args,upstreamFetch),input.method,input.args,url));
  }catch{return json({ok:false,error:'Panel belum dapat memproses permintaan. Coba kembali.'},502);}
}

export default {fetch:handleRequest};
