'use strict';
const fs=require('node:fs'),path=require('node:path');
const root=__dirname;
function handleKronos(req,res){
  const pathname=new URL(req.url,'http://localhost').pathname;
  const files={'/kronos/':'index.html','/kronos/index.html':'index.html','/kronos/app.js':'app.js','/kronos/validation.js':'validation.js','/kronos/evaluations.json':'results/evaluations.json','/kronos/admin.js':'admin.js','/kronos/style.css':'style.css','/kronos/forecast.json':'results/forecast.json'};
  res.setHeader('X-Content-Type-Options','nosniff');
  res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'self'; frame-src 'none'");
  if(!['GET','HEAD'].includes(req.method)){res.writeHead(405,{'Allow':'GET, HEAD'});return res.end();}
  if(pathname==='/kronos'){res.writeHead(302,{'Location':'/kronos/'});return res.end();}
  if(pathname==='/kronos/admin'){res.writeHead(303,{Location:'/crypto/admin/kronos'});return res.end();}
  if(['/kronos/settings.json','/kronos/history.json','/kronos/forecast.json'].includes(pathname)){
    try{const store=require('./store.cjs').getStore();let value=pathname.endsWith('/settings.json')?store.settings():pathname.endsWith('/history.json')?{history:store.list()}:store.get(new URL(req.url,'http://localhost').searchParams.get('id')||undefined);res.writeHead(value?200:404,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});return res.end(req.method==='HEAD'?undefined:JSON.stringify(value||{error:'尚未生成真实预测'}));}catch{res.writeHead(503,{'Content-Type':'application/json; charset=utf-8'});return res.end(JSON.stringify({error:'预测数据暂时无法读取'}));}
  }
  const file=files[pathname];
  if(!file){res.writeHead(404);return res.end('Not found');}
  fs.readFile(path.join(root,file),(error,data)=>{
    const isResult=file.endsWith('.json');
    const type=isResult?'application/json; charset=utf-8':file.endsWith('.html')?'text/html; charset=utf-8':file.endsWith('.js')?'text/javascript; charset=utf-8':'text/css; charset=utf-8';
    if(error){res.writeHead(error.code==='ENOENT'?404:500,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});return res.end(req.method==='HEAD'?undefined:JSON.stringify({error:isResult?'尚未生成真实预测，请先在本地生成并发布结果。':'文件不可用'}));}
    res.writeHead(200,{'Content-Type':type,'Cache-Control':isResult?'no-store':'no-cache'});
    res.end(req.method==='HEAD'?undefined:data);
  });
}
module.exports={handleKronos};
