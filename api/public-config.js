module.exports = function(req,res) {
 res.setHeader('Cache-Control','no-store');
 if(req.method!=='GET') {res.setHeader('Allow','GET');return res.status(405).json({error:'Método no permitido.'});}
 if(!process.env.TURNSTILE_SITE_KEY) return res.status(503).json({error:'Consulta temporalmente no disponible.'});
 return res.status(200).json({siteKey:process.env.TURNSTILE_SITE_KEY});
};
