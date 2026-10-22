const fs=require('node:fs'), path=require('node:path');
// Explicit allowlist keeps .env, SQL, tests and node_modules out of published assets.
fs.mkdirSync('dist',{recursive:true});
for(const name of fs.readdirSync('.').filter(n=>n.endsWith('.html'))) fs.copyFileSync(name,path.join('dist',name));
for(const folder of ['css','js','img']) fs.cpSync(folder,path.join('dist',folder),{recursive:true});
console.log('Static assets prepared in dist/. Vercel deploys api/ as server functions.');
