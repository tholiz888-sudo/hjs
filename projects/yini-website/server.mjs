import http from 'node:http';
import fs from 'node:fs/promises';
import {createReadStream} from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {loadArchive,localize} from './archive.mjs';
const escape=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function createGardenHandler({prefix=''}={}){
 let archive;
 return async(req,res)=>{
  archive??=loadArchive();
  const url=new URL(req.url,'http://localhost');
  if(prefix&&url.pathname===prefix){res.writeHead(302,{Location:prefix+'/'+url.search}).end();return}
  if(prefix)url.pathname=url.pathname.slice(prefix.length)||'/';
  if(!['GET','HEAD'].includes(req.method)){res.writeHead(405,{'Allow':'GET, HEAD'}).end();return}
  if(url.pathname==='/api/health'||url.pathname==='/__archive/status'){res.writeHead(200,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(req.method==='HEAD'?undefined:JSON.stringify({ok:true,...archive.stats}));return}
  const entry=archive.pages.get(url.pathname+url.search);
  if(!entry?.available){const status=entry?.status===404?404:503;res.writeHead(status,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'});res.end(req.method==='HEAD'?undefined:`<!doctype html><meta charset="utf-8"><title>资源尚未导入</title><body style="margin:0;background:#9ab096;color:#304f3b;font:16px/1.8 serif"><main style="max-width:640px;margin:12vh auto;padding:32px;border:1px solid #527953"><h1>资源尚未导入</h1><p>该资源未成功采集、原站返回错误，或尚未导入。已取得的页面和音乐不受影响。</p><p>${escape(url.pathname)}</p><p><a href="${prefix}/">返回花园入口</a> · <a href="${prefix}/club/garden.html">查看栏目</a></p></main>`);return}
  try{
   const html=/html/i.test(entry.type||''),css=/css/i.test(entry.type||'');
   const headers={'Content-Type':entry.type||'application/octet-stream','Accept-Ranges':'bytes','X-Content-Type-Options':'nosniff','Cache-Control':'no-cache','Content-Security-Policy':"default-src 'self' data:; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; media-src 'self'; connect-src 'none'; object-src 'none'; form-action 'none'; base-uri 'self'"};
   if(/^audio\//i.test(entry.type||'')){
    const length=entry.bytes,range=req.headers.range;
    if(!range){headers['Content-Length']=length;res.writeHead(200,headers);if(req.method==='HEAD')res.end();else streamFile(entry.filePath,res,req);return}
    const m=range.match(/^bytes=(\d+)-(\d*)$/);let start=Number(m?.[1]),end=m?.[2]?Number(m[2]):length-1;
    if(!m||start>=length||end<start){res.writeHead(416,{'Content-Range':`bytes */${length}`}).end();return}end=Math.min(end,length-1);headers['Content-Range']=`bytes ${start}-${end}/${length}`;headers['Content-Length']=end-start+1;res.writeHead(206,headers);if(req.method==='HEAD')res.end();else streamFile(entry.filePath,res,req,{start,end});return;
   }
   let bytes=await fs.readFile(entry.filePath);if(html||css)bytes=localize(bytes,prefix);
   headers['Content-Length']=bytes.length;res.writeHead(200,headers);res.end(req.method==='HEAD'?undefined:bytes);
  }catch{res.writeHead(500).end('Local archive read failed')}
 };
}
function streamFile(file,res,req,range){const stream=createReadStream(file,range);stream.on('error',()=>res.destroy());res.on('close',()=>stream.destroy());stream.pipe(res)}
export function createServer(){const handler=createGardenHandler();return http.createServer((req,res)=>{handler(req,res).catch(()=>{if(!res.headersSent)res.writeHead(500);res.end()})})}
if(process.argv[1]&&pathToFileURL(path.resolve(process.argv[1])).href===import.meta.url){const server=createServer();server.listen(Number(process.env.PORT)||3030,'0.0.0.0',()=>console.log('Secret Garden archive server started on port '+server.address().port));}
