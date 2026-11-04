const {chromium}=require('playwright');
const {spawn}=require('node:child_process'),fs=require('node:fs'),assert=require('node:assert/strict');
const server=spawn(process.execPath,['scripts/dev.cjs'],{env:{...process.env,PORT:'3100'},stdio:'pipe',windowsHide:true});
const base='http://localhost:3100';
const fixture={id:'00000000-0000-4000-8000-000000000010',numero_caso:'PC-2026-00042',nombre_cliente:'Cliente de prueba',cedula:'12345678',telefono_cliente:'3001234567',correo_cliente:'client@example.test',tipo_solicitud:'Queja',area_responsable:'Envios',prioridad:'Alta',motivo:'Entrega de pedido',descripcion:'Descripción suficientemente extensa para la prueba.',estado:'Pendiente',fecha_registro:new Date().toISOString(),actualizado_en:new Date().toISOString(),tags:['urgente'],imagenes:[],eliminado:false};
function mock({role,fixture}) {
 const profile={id:'00000000-0000-4000-8000-000000000001',nombre:'Administración de prueba',rol:role,activo:true};
 if(!sessionStorage.getItem('mockRows'))sessionStorage.setItem('mockRows',JSON.stringify([fixture]));
 const read=()=>JSON.parse(sessionStorage.getItem('mockRows'));
 const write=rows=>sessionStorage.setItem('mockRows',JSON.stringify(rows));
 const user=()=>sessionStorage.getItem('signedOut')?null:(role?{id:profile.id,email:'admin@example.test'}:null);
 window.supabase={createClient:()=>({
  auth:{getSession:async()=>({data:{session:user()?{user:user()}:null},error:null}),getUser:async()=>({data:{user:user()},error:null}),signInWithPassword:async()=>{sessionStorage.removeItem('signedOut');return{data:{user:{id:profile.id}},error:null}},signOut:async()=>{sessionStorage.setItem('signedOut','1');return{error:null}},onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}})},
  channel:()=>({on(){return this},subscribe(){return this}}),
  storage:{from:()=>({createSignedUrl:async path=>({data:{signedUrl:'https://kxxnyhyliqvqfnrlkaxd.supabase.co/storage/v1/object/sign/evidencias-pqrs/'+path+'?token=test'}}),upload:async()=>({error:sessionStorage.getItem('uploadFail')?{message:'upload failed'}:null}),remove:async()=>({error:null})})},
  rpc:async(name,args)=>{
   if(name==='resumen_pqrs'){const rows=read().filter(x=>!x.eliminado);return{data:{total:rows.length,pendiente:rows.filter(x=>x.estado==='Pendiente').length,proceso:0,resuelto:rows.filter(x=>x.estado==='Resuelto').length,vencido:0,por_vencer:0,archivados:read().filter(x=>x.eliminado).length,areas:{Envios:rows.length},tipos:{Queja:rows.length},meses:{'2026-10':rows.length}},error:null};}
   if(name==='actualizar_estado_pqrs'){const rows=read(),r=rows.find(x=>x.id===args.p_id);r.estado=args.p_estado;r.solucion=args.p_solucion;r.actualizado_en=new Date().toISOString();write(rows);return{data:r.id,error:null};}
   return{data:null,error:{message:'unknown RPC'}};
  },
  from(table){let filters=[],operation='select',payload,one=false,offset=0,end=Infinity,head=false;const q={
   select(fields,options){head=options?.head;return q},eq(k,v){filters.push(row=>row[k]===v);return q},or(expression){if(expression.startsWith('eliminado.'))filters.push(row=>!row.eliminado);else if(expression.startsWith('estado.eq.'))filters.push(row=>['Pendiente','En_proceso'].includes(row.estado));else{const term=expression.split('%')[1];filters.push(row=>['numero_caso','nombre_cliente','cedula','telefono_cliente'].some(k=>String(row[k]||'').toLowerCase().includes(term)));}return q},contains(k,v){filters.push(row=>v.every(x=>(row[k]||[]).includes(x)));return q},gte(k,v){filters.push(row=>row[k]>=v);return q},lt(k,v){filters.push(row=>row[k]<v);return q},lte(k,v){filters.push(row=>row[k]<=v);return q},order(){return q},range(a,b){offset=a;end=b+1;return q},limit(n){end=n;return q},single(){one=true;return q},insert(p){operation='insert';payload=p;return q},update(p){operation='update';payload=p;return q},
   then(resolve,reject){try{let rows=table==='usuarios'?[profile]:table==='pqrs'?read():[];let filtered=rows.filter(row=>filters.every(fn=>fn(row)));if(operation==='insert' && rows.some(x=>x.id===payload.id))return Promise.resolve({data:null,error:{code:'23505'}}).then(resolve,reject);if(operation==='insert'){const row={...fixture,...payload,numero_caso:'PC-2026-00043',fecha_registro:new Date().toISOString(),actualizado_en:new Date().toISOString()};rows.push(row);write(rows);filtered=[row];if(sessionStorage.getItem('commitError')){sessionStorage.removeItem('commitError');return Promise.resolve({data:null,error:{message:'connection lost'}}).then(resolve,reject);}}if(operation==='update'){filtered.forEach(row=>Object.assign(row,payload,{actualizado_en:new Date().toISOString()}));write(rows);}const result={data:head?null:one?(filtered[0]||null):filtered.slice(offset,end),count:filtered.length,error:one&&!filtered.length?{message:'not found'}:null};return Promise.resolve(result).then(resolve,reject);}catch(e){return Promise.reject(e).then(resolve,reject)}}};return q;
  }
 })};
 window.XLSX={utils:{book_new:()=>({}),json_to_sheet:rows=>{window.lastExport=rows;return{}},book_append_sheet(){}},writeFile:()=>{window.excelSaved=true}};
 window.jspdf={jsPDF:class{constructor(){this.internal={pageSize:{getWidth:()=>210,getHeight:()=>297}}}setFillColor(){}rect(){}setFontSize(){}setTextColor(){}setFont(){}text(){}roundedRect(){}addPage(){}splitTextToSize(s){return[s]}getNumberOfPages(){return 1}setPage(){}save(){window.pdfSaved=true}setDrawColor(){}setLineWidth(){}line(){}}};
}
(async()=>{
 await new Promise((resolve,reject)=>{server.stdout.once('data',resolve);server.once('error',reject)});
 fs.mkdirSync('artifacts',{recursive:true});const browser=await chromium.launch();
 const errors=[];
 async function ctx(role='admin',viewport={width:1440,height:1000}){
  const context=await browser.newContext({viewport});
  await context.addInitScript(mock,{role,fixture});
  await context.route('**/*',route=>{
   const url=route.request().url();
   if(url.startsWith(base))return route.continue();
   if(url.includes('turnstile/v0/api.js'))return route.fulfill({contentType:'application/javascript',body:`window.turnstile={render:(s,o)=>{window.turnstileCallback=o.callback;setTimeout(()=>o.callback('test'),0);return 'widget'},getResponse:()=>'test',reset:()=>setTimeout(()=>window.turnstileCallback('test'),0)};`});
   if(url.includes('jspdf')||url.includes('xlsx')||url.includes('supabase'))return route.fulfill({contentType:'application/javascript',body:''});
   return route.abort();
  });
  const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));return{context,page};
 }
 const {context,page}=await ctx();
 await page.goto(base+'/dashboard.html');await page.waitForFunction(()=>document.getElementById('statTotal').textContent==='1');
 await page.screenshot({path:'artifacts/dashboard-desktop.png',fullPage:true});
 await page.goto(base+'/nuevo-pqrs.html');await page.waitForFunction(()=>!document.documentElement.classList.contains('auth-pending'));
 await page.click('#btnGuardar');assert.equal(await page.getAttribute('#nombre_cliente','aria-invalid'),'true');
 await page.fill('#nombre_cliente','Cliente creado');await page.selectOption('#tipo_solicitud','Queja');await page.selectOption('#area_responsable','Envios');await page.fill('#motivo','Registro de prueba');await page.fill('#descripcion','Descripción de prueba con suficiente detalle');
 await page.click('#btnGuardar');await page.waitForURL('**/detalle-pqrs.html?id=*');await page.waitForSelector('#d-nombre_cliente');assert.equal(await page.textContent('#d-nombre_cliente'),'Cliente creado');
 await page.click('#editarCaso');await page.waitForFunction(()=>!document.getElementById('btnGuardar').disabled);await page.fill('#motivo','Motivo corregido');await page.click('#btnGuardar');await page.waitForURL('**/detalle-pqrs.html?id=*');await page.waitForSelector('#d-motivo');assert.equal(await page.textContent('#d-motivo'),'Motivo corregido');
 await page.reload();await page.waitForSelector('#d-motivo');assert.equal(await page.textContent('#d-motivo'),'Motivo corregido');
 await page.selectOption('#nuevoEstado','Resuelto');await page.fill('#textoSolucion','Caso atendido');await page.fill('#textoComentario','Seguimiento interno de prueba');await page.click('#btnActualizar');await page.waitForFunction(()=>document.getElementById('d-badge-estado')?.textContent==='Resuelto');
 await page.click('#btnPDF');assert.equal(await page.evaluate(()=>window.pdfSaved),true);
 await page.goto(base+'/lista-pqrs.html');await page.waitForSelector('#tbodyLista a');
 await page.fill('#filtroTag','no-existe');await page.click('#btnFiltrar');await page.waitForSelector('.empty-title');
 await page.click('#btnLimpiar');await page.waitForSelector('#tbodyLista a');
 await page.click('#btnExportExcel');await page.waitForFunction(()=>window.excelSaved===true);
 await page.locator('#tbodyLista button[title="Archivar"]').first().click();await page.click('[data-modal="ok"]');await page.waitForFunction(()=>JSON.parse(sessionStorage.getItem('mockRows')).some(x=>x.eliminado));
 await page.click('#btnVerEliminados');await page.waitForSelector('button[title="Restaurar"]');await page.click('button[title="Restaurar"]');await page.click('[data-modal="ok"]');
 await page.goto(base+'/reportes.html');await page.waitForFunction(()=>document.getElementById('rTotal').textContent==='2');await page.click('#btnExportPDF');assert.equal(await page.evaluate(()=>window.pdfSaved),true);
 await page.goto(base+'/usuarios.html');await page.waitForSelector('.select-rol');assert.equal(await page.isDisabled('.select-rol'),true);
 await page.click('#logoutBtn');await page.waitForURL('**/index.html');
 await page.fill('#email','admin@example.test');await page.fill('#password','local-test');await page.click('#loginBtn');await page.waitForURL('**/dashboard.html');
 for(const role of [null,'cliente']){const t=await ctx(role);await t.page.goto(base+'/dashboard.html');await t.page.waitForURL('**/index.html?acceso=1');await t.context.close();}
 const reader=await ctx('empleado');
 await reader.page.goto(base+'/dashboard.html');await reader.page.waitForFunction(()=>document.getElementById('statTotal').textContent==='1');
 assert.equal(await reader.page.isVisible('a[href="nuevo-pqrs.html"] >> nth=0'),false);
 await reader.page.goto(base+'/lista-pqrs.html');await reader.page.waitForSelector('#tbodyLista a');assert.equal(await reader.page.locator('[data-archive],[data-restore]').count(),0);
 await reader.page.click('#tbodyLista a');await reader.page.waitForSelector('#d-nombre_cliente');
 assert.equal(await reader.page.textContent('#d-cedula'),fixture.cedula);
 assert.equal(await reader.page.isVisible('#editarCaso'),false);assert.equal(await reader.page.isVisible('#formActualizarEstado'),false);assert.equal(await reader.page.isVisible('#btnEliminar'),false);
 await reader.page.goto(base+'/reportes.html');await reader.page.waitForFunction(()=>document.getElementById('rTotal').textContent==='1');
 for(const file of ['nuevo-pqrs','usuarios']){await reader.page.goto(base+'/'+file+'.html');await reader.page.waitForURL('**/dashboard.html');}
 const pub=await ctx(null);await pub.page.goto(base+'/consulta.html');await pub.page.waitForURL('**/index.html');
 const mobile=await ctx('admin',{width:390,height:844});
 for(const file of ['dashboard','lista-pqrs','nuevo-pqrs','reportes','usuarios','detalle-pqrs']){
  await mobile.page.goto(base+'/'+file+'.html'+(file==='detalle-pqrs'?'?id='+fixture.id:''));await mobile.page.waitForFunction(()=>!document.documentElement.classList.contains('auth-pending'));
  assert.equal(await mobile.page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'Horizontal overflow '+file);
  await mobile.page.screenshot({path:'artifacts/'+file+'-mobile.png',fullPage:true});
 }

 const retry=await ctx();await retry.page.goto(base+'/nuevo-pqrs.html');await retry.page.waitForFunction(()=>!document.documentElement.classList.contains('auth-pending'));
 await retry.page.fill('#nombre_cliente','Reintento');await retry.page.selectOption('#tipo_solicitud','Queja');await retry.page.selectOption('#area_responsable','Envios');await retry.page.fill('#motivo','Error de subida');await retry.page.fill('#descripcion','Descripción de prueba para carga fallida');
 await retry.page.setInputFiles('#evidenciasInput',{name:'test.png',mimeType:'image/png',buffer:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j4V8AAAAASUVORK5CYII=','base64')});
 await retry.page.evaluate(()=>sessionStorage.setItem('uploadFail','1'));await retry.page.click('#btnGuardar');await retry.page.waitForFunction(()=>!document.getElementById('btnGuardar').disabled);assert.equal(await retry.page.inputValue('#nombre_cliente'),'Reintento');assert.equal(await retry.page.evaluate(()=>JSON.parse(sessionStorage.getItem('mockRows')).length),1);
 await retry.page.evaluate(()=>{sessionStorage.removeItem('uploadFail');sessionStorage.setItem('commitError','1')});await retry.page.click('#btnGuardar');await retry.page.waitForFunction(()=>!document.getElementById('btnGuardar').disabled);assert.equal(await retry.page.evaluate(()=>JSON.parse(sessionStorage.getItem('mockRows')).length),2);
 await retry.page.click('#btnGuardar');await retry.page.waitForURL('**/detalle-pqrs.html?id=*');assert.equal(await retry.page.evaluate(()=>JSON.parse(sessionStorage.getItem('mockRows')).length),2);
 await mobile.page.goto(base+'/lista-pqrs.html');await mobile.page.waitForFunction(()=>!document.documentElement.classList.contains('auth-pending'));
 assert.equal(await mobile.page.evaluate(()=>{const header=document.querySelector('.topbar').getBoundingClientRect();return [...document.querySelectorAll('.topbar button,.topbar a')].every(el=>{const b=el.getBoundingClientRect();return b.top>=header.top&&b.bottom<=header.bottom;});}),true,'Header actions must stay inside header');
 await mobile.page.click('#menuToggle');assert.equal(await mobile.page.getAttribute('#menuToggle','aria-expanded'),'true');await mobile.page.keyboard.press('Escape');assert.equal(await mobile.page.getAttribute('#menuToggle','aria-expanded'),'false');
 await mobile.page.setViewportSize({width:320,height:740});assert.equal(await mobile.page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
 for(const theme of ['light','dark'])for(const width of [320,390,768,1024,1440]){
  await mobile.page.setViewportSize({width,height:1000});
  await mobile.page.evaluate(t=>localStorage.setItem('pqrs_tema',t),theme);
  for(const file of ['dashboard','reportes']){
   await mobile.page.goto(base+'/'+file+'.html');
   await mobile.page.waitForFunction(id=>document.getElementById(id)?.textContent!=='--',file==='dashboard'?'statTotal':'rTotal');
   assert.equal(await mobile.page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,`${file} overflow at ${width}px (${theme})`);
   await mobile.page.screenshot({path:`artifacts/design-${file}-${width}-${theme}.png`,fullPage:true});
  }
 }
 assert.deepEqual(errors,[]);
 await browser.close();server.kill();console.log('PASS: browser login/logout, role redirects, create/edit/reload/state/archive/restore, filters, export wiring, reader access and denied write controls, retired public lookup, six mobile screens and JS errors. Backend and export libraries mocked; SQL tested separately.');
})().catch(error=>{console.error(error);server.kill();process.exit(1)});
