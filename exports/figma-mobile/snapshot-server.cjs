const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const root = __dirname;
http.createServer((req,res)=>{
  res.setHeader('Access-Control-Allow-Origin','http://localhost:5183');
  res.setHeader('Access-Control-Allow-Headers','Content-Type');
  if(req.method==='OPTIONS'){res.end();return;}
  if(req.method!=='POST'){res.end('UI snapshot receiver');return;}
  let data=''; req.on('data',chunk=>{data+=chunk;if(data.length>15000000)req.destroy();});
  req.on('end',()=>{try{const s=JSON.parse(data);if(!/^[a-z0-9-]+$/.test(s.device)||!Number.isInteger(s.index))throw Error('Invalid snapshot');fs.mkdirSync(path.join(root,s.device),{recursive:true});fs.writeFileSync(path.join(root,s.device,String(s.index).padStart(3,'0')+'.json'),data);console.log(s.device,s.index,s.name,s.nodes);res.end('saved');}catch(e){res.statusCode=400;res.end(e.message);}});
}).listen(5197,'127.0.0.1',()=>console.log('Snapshot receiver on 5197'));

