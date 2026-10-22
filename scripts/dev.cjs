const http=require('node:http'),fs=require('node:fs'),path=require('node:path');
try{process.loadEnvFile('.env');}catch{}
const root=process.cwd();
const server=http.createServer(async(req,res)=>{
 const pathname=new URL(req.url,'http://localhost').pathname;
 if(pathname==='/api/consulta'||pathname==='/api/public-config'){
  let body='';for await(const chunk of req){body+=chunk;if(body.length>4096){res.writeHead(413);res.end();return;}}
  req.body=body;res.status=n=>{res.statusCode=n;return res;};res.json=value=>{res.setHeader('Content-Type','application/json');res.end(JSON.stringify(value));};
  await require(path.join(root,pathname==='/api/consulta'?'api/consulta.js':'api/public-config.js'))(req,res);return;
 }
 const relative=pathname==='/'?'index.html':decodeURIComponent(pathname.slice(1));
 if(!/^(?:[a-z0-9-]+\.html|(?:js|css|img)\/(?:fonts\/)?[\w.-]+)$/.test(relative)){res.writeHead(404);res.end('Not found');return;}
 const file=path.join(root,relative);if(!fs.existsSync(file)){res.writeHead(404);res.end('Not found');return;}
 const types={'.html':'text/html; charset=utf-8','.js':'application/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.png':'image/png','.woff2':'font/woff2','.woff':'font/woff'};
 res.setHeader('Content-Type',types[path.extname(file)]||'application/octet-stream');res.setHeader('Cache-Control','no-store');fs.createReadStream(file).pipe(res);
});
server.listen(Number(process.env.PORT)||3000,'127.0.0.1',()=>console.log('Local preview: http://localhost:'+(process.env.PORT||3000)));
