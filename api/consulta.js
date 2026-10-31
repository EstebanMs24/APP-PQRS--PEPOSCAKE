module.exports = (_req, res) => { res.setHeader('Cache-Control', 'no-store'); return res.status(410).json({error:'La consulta pública está deshabilitada. Inicia sesión en la aplicación.'}); };
