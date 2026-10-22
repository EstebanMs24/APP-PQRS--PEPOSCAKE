const form=document.getElementById('formConsulta'), button=document.getElementById('consultarBtn'), message=document.getElementById('consultaMensaje');
let widget, busy=false;
function resetResult(){document.getElementById('resultado').hidden=true;document.getElementById('resDatos').replaceChildren();message.textContent='';}
document.getElementById('criterio').addEventListener('change',()=>{
 const criterion=document.getElementById('criterio').value, value=document.getElementById('valor'), number=document.getElementById('numero');
 resetResult(); value.value=''; value.placeholder=criterion==='numero'?'PC-2026-00042':''; value.inputMode=criterion==='numero'?'text':'tel';
 document.getElementById('valorLabel').textContent={numero:'Número de PQRS',cedula:'Cédula',telefono:'Teléfono'}[criterion];
 document.getElementById('numeroGroup').hidden=criterion==='numero'; number.required=criterion!=='numero';
});
(async()=>{
 try {
  const response=await fetch('/api/public-config',{cache:'no-store'}); if(!response.ok) throw new Error();
  const {siteKey}=await response.json();
  await new Promise((resolve,reject)=>{const script=document.createElement('script');script.src='https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';script.onload=resolve;script.onerror=reject;document.head.append(script);});
  widget=window.turnstile.render('#captcha',{sitekey:siteKey,action:'consulta',callback:()=>{button.disabled=busy;},'expired-callback':()=>{button.disabled=true;},'error-callback':()=>{message.textContent='No se pudo completar la verificación. Recarga para reintentar.';button.disabled=true;}});
 } catch { message.textContent='La consulta no está disponible en este momento. Intenta más tarde.'; }
})();
form.addEventListener('input',resetResult);
form.addEventListener('submit',async event=>{
 event.preventDefault(); if(busy) return; resetResult();
 if(!form.reportValidity()) return;
 const criterion=document.getElementById('criterio').value,value=document.getElementById('valor').value.trim();
 if(criterion==='numero' && !/^(PC-\d{4}-\d{5,20}|PQR-\d{8}-\d{4,20})$/i.test(value)) {message.textContent='Revisa el número de PQRS, por ejemplo PC-2026-00042.';return;}
 if(criterion!=='numero' && !/^[+0-9 ().-]+$/.test(value)) {message.textContent='Revisa el formato del documento o teléfono.';return;}
 const token=window.turnstile?.getResponse(widget);if(!token){message.textContent='Completa la verificación de seguridad.';return;}
 busy=true; button.disabled=true;button.textContent='Consultando…';form.setAttribute('aria-busy','true');
 try {
  const response=await fetch('/api/consulta',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({criterio:criterion,valor:value,numero:document.getElementById('numero').value.trim(),correo:document.getElementById('correo').value.trim(),token}),signal:AbortSignal.timeout(25000)});
  const body=await response.json();if(!response.ok) throw new Error(body.error||'Error temporal. Intenta más tarde.');
  if(!body.caso){message.textContent='No encontramos un caso con los datos de verificación. Revisa los datos o contacta al responsable.';return;}
  const c=body.caso;document.getElementById('resNumero').textContent=c.numero_caso;
  const fields=[['Estado',getLabelEstado(c.estado)],['Tipo de solicitud',getLabelTipo(c.tipo_solicitud)],['Área responsable',getLabelArea(c.area_responsable)],['Fecha de registro',Utils.formatFecha(c.fecha_registro)],['Última actualización',Utils.formatFecha(c.actualizado_en)]];
  for(const [label,value] of fields){const dt=document.createElement('dt'),dd=document.createElement('dd');dt.textContent=label;dd.textContent=value;document.getElementById('resDatos').append(dt,dd);}
  const result=document.getElementById('resultado');result.hidden=false;result.focus();message.textContent='Consulta completada.';
 } catch(error) {message.textContent=error.name==='TypeError'?'No se pudo conectar. Revisa tu conexión a internet.':error.name==='TimeoutError'?'La consulta tardó demasiado. Intenta de nuevo.':error.message;}
 finally{busy=false;button.textContent='Consultar estado';button.disabled=true;form.removeAttribute('aria-busy');window.turnstile?.reset(widget);}
});
