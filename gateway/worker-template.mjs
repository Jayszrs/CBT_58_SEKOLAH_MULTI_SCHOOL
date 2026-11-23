// Build replaces these public constants. No password, OAuth token or school key.
const HTML = __PANEL_HTML__;
const BACKEND_URL = __BACKEND_URL__;
const PUBLIC_ORIGIN = __PUBLIC_ORIGIN__;
const METHODS = new Set(['centralLogin','centralSchools','centralOpenSchool','centralLogout','centralChangePassword']);

function json(value,status=200){return new Response(JSON.stringify(value),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});}

async function relay(method,args,upstreamFetch){
  const upstream=await upstreamFetch(BACKEND_URL,{method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({method,args}),redirect:'follow',signal:AbortSignal.timeout(35000)});
  if(!upstream.ok)throw Error('Server panel belum merespons. Coba kembali.');
  let result;try{result=await upstream.json();}catch{throw Error('Server panel belum memberikan respons yang valid.');}
  if(typeof result?.ok!=='boolean')throw Error('Respons server panel tidak valid.');
  return result;
}

export async function handleRequest(request,{upstreamFetch=fetch}={}){
  const url=new URL(request.url);
  if(url.pathname==='/favicon.ico')return new Response(null,{status:204});
  if(url.pathname==='/'&&['GET','HEAD'].includes(request.method))return new Response(request.method==='HEAD'?null:HTML,{headers:{
    'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','X-Frame-Options':'DENY','Referrer-Policy':'no-referrer'}});
  if(url.pathname==='/api/health'&&request.method==='GET'){
    try{return json(await relay('health',[],upstreamFetch));}catch{return json({ok:false,error:'Server panel belum terhubung.'},502);}
  }
  if(url.pathname!=='/api/central')return json({ok:false,error:'Halaman tidak ditemukan.'},404);
  if(request.method!=='POST')return json({ok:false,error:'Gunakan POST.'},405);
  const origin=request.headers.get('origin');
  if(origin&&origin!==url.origin&&origin!==PUBLIC_ORIGIN)return json({ok:false,error:'Asal permintaan tidak diizinkan.'},403);
  if(!request.headers.get('content-type')?.startsWith('application/json'))return json({ok:false,error:'Gunakan JSON.'},415);
  if(Number(request.headers.get('content-length')||0)>16384)return json({ok:false,error:'Permintaan terlalu besar.'},413);
  try{
    const raw=await request.text();if(raw.length>16384)return json({ok:false,error:'Permintaan terlalu besar.'},413);
    const input=JSON.parse(raw);
    if(!METHODS.has(input.method)||!Array.isArray(input.args)||input.args.length>4)return json({ok:false,error:'Operasi tidak tersedia.'},400);
    return json(await relay(input.method,input.args,upstreamFetch));
  }catch{return json({ok:false,error:'Panel belum dapat memproses permintaan. Coba kembali.'},502);}
}

export default {fetch:handleRequest};
