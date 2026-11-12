const http=require('node:http');
const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'app');
const allowed={'/':'index.html','/index.html':'index.html','/style.css':'style.css','/model.js':'model.js','/app.js':'app.js'};
const mime={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'application/javascript; charset=utf-8'};
const server=http.createServer((req,res)=>{
 const pathname=new URL(req.url,'http://127.0.0.1').pathname;
 const file=allowed[pathname];
 if(req.method!=='GET'||!file){res.writeHead(404);res.end();return;}
 fs.readFile(path.join(root,file),(err,data)=>{if(err){res.writeHead(500);res.end('Unable to read app');return;}res.writeHead(200,{'Content-Type':mime[path.extname(file)],'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(data);});
});
server.on('error',e=>{console.error(e.message);process.exitCode=1;});
server.listen(8766,'127.0.0.1',()=>console.log('Dalsseum local test: http://127.0.0.1:8766\nKeep this window open. Ctrl+C stops the server. No external network is exposed.'));
