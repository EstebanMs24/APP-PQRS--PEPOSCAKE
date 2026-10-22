import handler from '../../api/consulta.js';
export default async function(request, context) {
  let status=200, body='';
  const headers={};
  const response={setHeader(k,v){headers[k]=v;},status(s){status=s;return this;},json(value){headers['Content-Type']='application/json';body=JSON.stringify(value);return this;}};
  await handler({method:request.method,headers:Object.fromEntries(request.headers),body:await request.text(),socket:{remoteAddress:context.ip}},response);
  return new Response(body,{status,headers});
}
