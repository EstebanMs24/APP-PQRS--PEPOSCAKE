const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
let count=0;
for(const folder of ['js','api','scripts','tests'])for(const name of fs.readdirSync(folder).filter(n=>/\.(js|cjs)$/.test(n))){new vm.Script(fs.readFileSync(path.join(folder,name),'utf8'),{filename:path.join(folder,name)});count++;}
for(const file of fs.readdirSync('.').filter(n=>n.endsWith('.html'))){const html=fs.readFileSync(file,'utf8');for(const m of html.matchAll(/(?:src|href)="([^"#]+)"/g)){const target=m[1].split('?')[0];if(/^(https?:|data:|mailto:)/.test(target))continue;if(!fs.existsSync(target))throw Error(`Broken target in ${file}: ${target}`);}for(const m of html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g))new vm.Script(m[1],{filename:file});}
console.log(`PASS: ${count} JavaScript files, inline scripts and local HTML references.`);
