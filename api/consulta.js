const { createHmac } = require('node:crypto');
const { isIP } = require('node:net');
const SAFE_FIELDS = ['numero_caso','fecha_registro','tipo_solicitud','estado','area_responsable','actualizado_en'];
function normalize(body) {
  if (!body || typeof body!=='object' || Array.isArray(body)) return null;
  const { criterio,valor,numero,correo,token } = body;
  if (![criterio,valor,correo,token].every(x=>typeof x==='string') || (numero!==undefined && typeof numero!=='string')) return null;
  const v=valor.trim(), n=(criterio==='numero'?v:numero||'').trim().toUpperCase(), email=correo.trim().toLowerCase();
  if(!/^(PC-\d{4}-\d{5,20}|PQR-\d{8}-\d{4,20})$/.test(n) || email.length>200 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || token.length<1 || token.length>2048) return null;
  if(criterio==='cedula' && (!/^[0-9 .-]{5,30}$/.test(v) || v.replace(/\D/g,'').length<5)) return null;
  if(criterio==='telefono' && (!/^[+0-9 ()-]{7,30}$/.test(v) || !/^\d{7,15}$/.test(v.replace(/\D/g,'')))) return null;
  if(!['numero','cedula','telefono'].includes(criterio)) return null;
  return {criterio,valor:criterio==='numero'?n:v,numero:n,correo:email,token};
}
function createHandler({ env=process.env, fetchFn=fetch }={}) {
 return async function handler(req,res) {
  res.setHeader('Cache-Control','no-store'); res.setHeader('X-Content-Type-Options','nosniff');
  const send=(status,error)=>res.status(status).json({error});
  if(req.method!=='POST') { res.setHeader('Allow','POST');return send(405,'Método no permitido.'); }
  if(!['SUPABASE_URL','SUPABASE_SERVICE_ROLE_KEY','TURNSTILE_SECRET_KEY','TURNSTILE_HOSTNAME','PUBLIC_ORIGIN','RATE_LIMIT_SECRET'].every(k=>env[k]) || env.RATE_LIMIT_SECRET.length<32) return send(503,'Consulta temporalmente no disponible.');
  if(req.headers.origin!==env.PUBLIC_ORIGIN) return send(403,'Solicitud no permitida.');
  if(!String(req.headers['content-type']||'').startsWith('application/json')) return send(415,'Formato no permitido.');
  if(Number(req.headers['content-length']||0)>4096) return send(413,'Solicitud demasiado grande.');
  let body;
  try { body=typeof req.body==='string'?JSON.parse(req.body):req.body; if(JSON.stringify(body).length>4096) return send(413,'Solicitud demasiado grande.'); } catch { return send(400,'Revisa los datos de consulta.'); }
  const input=normalize(body); if(!input) return send(400,'Revisa los datos de consulta y la verificación.');
  // Trust only Vercel's overwritten header in production; never a browser-supplied X-Forwarded-For.
  const ip=env.VERCEL==='1'?String(req.headers['x-vercel-forwarded-for']||'').split(',')[0].trim():req.socket?.remoteAddress;
  if(!isIP(ip||'')) return send(503,'Consulta temporalmente no disponible.');
  const hash=value=>createHmac('sha256',env.RATE_LIMIT_SECRET).update(value).digest('hex');
  const rpc=async(name,args)=>{
    const response=await fetchFn(`${env.SUPABASE_URL}/rest/v1/rpc/${name}`,{method:'POST',headers:{apikey:env.SUPABASE_SERVICE_ROLE_KEY,Authorization:`Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,'Content-Type':'application/json'},body:JSON.stringify(args),signal:AbortSignal.timeout(8000)});
    if(!response.ok) throw new Error('Backend unavailable'); return response.json();
  };
  try {
    const check=await fetchFn('https://challenges.cloudflare.com/turnstile/v0/siteverify',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({secret:env.TURNSTILE_SECRET_KEY,response:input.token,remoteip:ip}),signal:AbortSignal.timeout(8000)});
    if(!check.ok) throw new Error('Verification unavailable');
    const verification=await check.json();
    if(!verification.success || verification.hostname!==env.TURNSTILE_HOSTNAME || verification.action!=='consulta') return send(400,'Completa nuevamente la verificación de seguridad.');
    // Only verified challenges may consume shared case/global quotas.
    const allowed=await rpc('consumir_consulta',{p_ip:hash('ip:'+ip),p_objetivo:hash('case:'+input.numero)});
    if(allowed!==true) { res.setHeader('Retry-After','900');return send(429,'Demasiados intentos. Espera 15 minutos antes de volver a consultar.'); }
    const rows=await rpc('consultar_pqrs_servidor',{p_criterio:input.criterio,p_valor:input.valor,p_numero:input.numero,p_correo:input.correo});
    const row=Array.isArray(rows)?rows[0]:null;
    // Explicit second allowlist: never return unexpected SQL columns or raw errors.
    return res.status(200).json({caso:row?Object.fromEntries(SAFE_FIELDS.map(key=>[key,row[key]??null])):null});
  } catch { return send(503,'No se pudo consultar en este momento. Intenta más tarde.'); }
 };
}
module.exports=createHandler(); module.exports.createHandler=createHandler; module.exports.normalize=normalize;
