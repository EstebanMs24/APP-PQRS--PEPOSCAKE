const {chromium}=require('playwright'),fs=require('node:fs'),assert=require('node:assert/strict');
const base=process.argv[2];if(!base?.startsWith('https://'))throw Error('Provide HTTPS deployment URL');
(async()=>{
 for(const p of ['/','/js/auth.js'])assert.equal((await fetch(base+p)).status,200,p);
 for(const p of ['/api/consulta','/api/public-config']){
  for(const method of ['GET','POST']){const r=await fetch(base+p,{method});assert.equal(r.status,410,p);assert.ok(!(await r.text()).includes('numero_caso'));}
 }
 for(const p of ['/.env','/supabase/preflight.sql','/tests/database.cjs','/artifacts/pre-internal-snapshot.json'])assert.equal((await fetch(base+p)).status,404,p);
 const browser=await chromium.launch();try{
 const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(base+'/');await page.waitForFunction(()=>!!window._supabaseClient);await page.waitForSelector('#loginBtn');
 for(const p of ['/dashboard.html','/lista-pqrs.html','/usuarios.html']){await page.goto(base+p);await page.waitForURL(/index(?:\.html)?\?acceso=1/);}
 await page.goto(base+'/consulta.html');await page.waitForURL(/\/index(?:\.html)?\/?$/);
 assert.deepEqual(errors,[]);
 if(!process.argv.includes('--frontend-only')){
  const client=fs.readFileSync('js/supabase-client.js','utf8');
  const url=client.match(/const SUPABASE_URL\s*=\s*['"]([^'"]+)/)[1];
  const key=client.match(/const SUPABASE_ANON_KEY\s*=\s*['"]([^'"]+)/)[1];
  const headers={apikey:key,'Content-Type':'application/json'};
  for(const table of ['pqrs','usuarios','seguimiento_pqrs']){const r=await fetch(url+'/rest/v1/'+table+'?select=id&limit=1',{headers});assert.ok([401,403].includes(r.status),table+' anonymous access');}
  const r=await fetch(url+'/rest/v1/rpc/consultar_pqrs_publico',{method:'POST',headers,body:JSON.stringify({p_numero:'invalid',p_correo:'invalid@example.test'})});assert.ok([401,403,404].includes(r.status),'legacy RPC denied');
 }
 console.log('PASS: live deployment routes, retired APIs, private build files, real SDK loads and anonymous redirects'+(process.argv.includes('--frontend-only')?'':', database anonymous access denied'));
 }finally{await browser.close();}
})().catch(e=>{console.error(e.message);process.exit(1)});
