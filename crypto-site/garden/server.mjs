import http from 'node:http';
import fs from 'node:fs/promises';
import {createReadStream} from 'node:fs';
import path from 'node:path';
import {pathToFileURL,fileURLToPath} from 'node:url';
import {loadArchive,localize} from './archive.mjs';
import {prepareDocument,decodeDocument} from './presentation.mjs';
const escape=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function createGardenHandler({prefix='',content}={}){
 let archive;
 return async(req,res)=>{
  archive??=loadArchive();archive.availablePaths??=new Set([...archive.pages.entries()].filter(([,v])=>v.available).map(([k])=>k));
  const url=new URL(req.url,'http://localhost');
  if(prefix&&url.pathname===prefix){res.writeHead(302,{Location:prefix+'/'+url.search}).end();return}
  if(prefix)url.pathname=url.pathname.slice(prefix.length)||'/';
  if(!['GET','HEAD'].includes(req.method)){res.writeHead(405,{'Allow':'GET, HEAD'}).end();return}
  if(url.pathname==='/api/health'||url.pathname==='/__archive/status'){res.writeHead(200,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(req.method==='HEAD'?undefined:JSON.stringify({ok:true,...archive.stats}));return}
  if(url.pathname.startsWith('/__compat/')){
   const name=url.pathname.slice('/__compat/'.length);const relative=name==='effects.js'?'compat/effects.js':/^ruffle\/[a-zA-Z0-9_.-]+\.(?:js|wasm)$/.test(name)?'compat/'+name:null;
   if(!relative){res.writeHead(404).end();return}try{const file=path.join(path.dirname(fileURLToPath(import.meta.url)),relative),stat=await fs.stat(file);res.writeHead(200,{'Content-Type':name.endsWith('.wasm')?'application/wasm':'text/javascript; charset=utf-8','Content-Length':stat.size,'Access-Control-Allow-Origin':'*','Cache-Control':'public, max-age=3600','X-Content-Type-Options':'nosniff'});if(req.method==='HEAD')res.end();else streamFile(file,res,req);return}catch{res.writeHead(404).end();return}
  }
  const pagePath=url.pathname+url.search;const dynamic=content?.resolve(pagePath,prefix);
  if(dynamic?.html!==undefined){const bytes=prepareDocument(dynamic.html,{prefix,pagePath,availablePaths:new Set([...archive.availablePaths,...(content?.effectPaths?.()||[])]),...content?.presentation(pagePath,prefix)});res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Content-Security-Policy':"sandbox allow-scripts allow-popups; default-src 'self' data:; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; connect-src 'self'; worker-src 'self' blob:; object-src 'none'; form-action 'none'; base-uri 'self'"});res.end(req.method==='HEAD'?undefined:bytes);return}
  const entry=dynamic?.notFound?{status:404}:dynamic?.asset||archive.pages.get(pagePath);
  if(!entry?.available){const status=entry?.status===404?404:503;res.writeHead(status,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'});res.end(req.method==='HEAD'?undefined:`<!doctype html><meta charset="utf-8"><title>资源尚未导入</title><body style="margin:0;background:#9ab096;color:#304f3b;font:16px/1.8 serif"><main style="max-width:640px;margin:12vh auto;padding:32px;border:1px solid #527953"><h1>资源尚未导入</h1><p>该资源未成功采集、原站返回错误，或尚未导入。已取得的页面和音乐不受影响。</p><p>${escape(url.pathname)}</p><p><a href="${prefix}/">返回花园入口</a> · <a href="${prefix}/club/garden.html">查看栏目</a></p></main>`);return}
  try{
   const html=/html/i.test(entry.type||''),css=/css/i.test(entry.type||''),js=/javascript/i.test(entry.type||'');
   const headers={'Content-Type':entry.type||'application/octet-stream','Accept-Ranges':'bytes','X-Content-Type-Options':'nosniff','Cache-Control':'no-cache','Access-Control-Allow-Origin':'*','Content-Security-Policy':"sandbox allow-scripts allow-popups; default-src 'self' data:; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; media-src 'self'; connect-src 'self'; worker-src 'self' blob:; object-src 'none'; form-action 'none'; base-uri 'self'"};
   if(/^audio\//i.test(entry.type||'')){
    const length=entry.bytes,range=req.headers.range;
    if(!range){headers['Content-Length']=length;res.writeHead(200,headers);if(req.method==='HEAD')res.end();else streamFile(entry.filePath,res,req);return}
    const m=range.match(/^bytes=(\d+)-(\d*)$/);let start=Number(m?.[1]),end=m?.[2]?Number(m[2]):length-1;
    if(!m||start>=length||end<start){res.writeHead(416,{'Content-Range':`bytes */${length}`}).end();return}end=Math.min(end,length-1);headers['Content-Range']=`bytes ${start}-${end}/${length}`;headers['Content-Length']=end-start+1;res.writeHead(206,headers);if(req.method==='HEAD')res.end();else streamFile(entry.filePath,res,req,{start,end});return;
   }
   let bytes=await fs.readFile(entry.filePath);if(html){bytes=prepareDocument(bytes,{type:entry.type,prefix,pagePath,availablePaths:new Set([...archive.availablePaths,...(content?.effectPaths?.()||[])]),...content?.presentation(pagePath,prefix)});headers['Content-Type']='text/html; charset=utf-8'}else if(css||js){let text=decodeDocument(bytes,entry.type);if(pagePath==='/welcome/java/yanhua/game.min.js')text=text.replace('this.data=new Image();',"this.data=new Image();this.data.crossOrigin='anonymous';");bytes=localize(Buffer.from(text),prefix);headers['Content-Type']=css?'text/css; charset=utf-8':'text/javascript; charset=utf-8'}
   headers['Content-Length']=bytes.length;res.writeHead(200,headers);res.end(req.method==='HEAD'?undefined:bytes);
  }catch{res.writeHead(500).end('Local archive read failed')}
 };
}
function streamFile(file,res,req,range){const stream=createReadStream(file,range);stream.on('error',()=>res.destroy());res.on('close',()=>stream.destroy());stream.pipe(res)}
export function createServer(){const handler=createGardenHandler();return http.createServer((req,res)=>{handler(req,res).catch(()=>{if(!res.headersSent)res.writeHead(500);res.end()})})}
if(process.argv[1]&&pathToFileURL(path.resolve(process.argv[1])).href===import.meta.url){const server=createServer();server.listen(Number(process.env.PORT)||3030,'0.0.0.0',()=>console.log('Secret Garden archive server started on port '+server.address().port));}
