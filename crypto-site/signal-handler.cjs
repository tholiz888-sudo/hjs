const fs=require('node:fs'),path=require('node:path');
const root=path.join(__dirname,'../signal-dashboard/portal-dist');
const files=new Set(require('../signal-dashboard/portal-dist/manifest.json').files);
const {GET}=require('../signal-dashboard/portal-dist/market.cjs');
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
async function handleSignalDashboard(req,res,{base='',navigation=''}){
 const url=new URL(req.url,'http://localhost'),prefix=base+'/ten-minute',route=url.pathname.slice(prefix.length);
 res.setHeader('X-Content-Type-Options','nosniff');
 if(!['GET','HEAD'].includes(req.method)){res.writeHead(405,{Allow:'GET, HEAD'});return res.end();}
 if(route===''||route==='/app'){res.writeHead(308,{Location:prefix+(route===''?'/':'/app/')+url.search});return res.end();}
 if(route==='/api/market'){
  try{const response=await GET({nextUrl:url});res.writeHead(response.status,Object.fromEntries(response.headers));return res.end(req.method==='HEAD'?undefined:Buffer.from(await response.arrayBuffer()));}
  catch{res.writeHead(503,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});return res.end(req.method==='HEAD'?undefined:JSON.stringify({error:'行情暂时不可用，实时信号已暂停'}));}
 }
 if(route==='/'){
  const html=`<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>十分钟事件合约</title><link rel="stylesheet" href="${esc(base)}/assets/base.css"><link rel="stylesheet" href="${esc(base)}/assets/home.css"><style>html,body{height:100%;margin:0}body{display:flex;flex-direction:column;height:100dvh;overflow:hidden}.signal-navigation{flex:none}iframe{width:100%;border:0;display:block;flex:1;min-height:0}</style></head><body><div class="signal-navigation">${navigation}</div><iframe title="十分钟事件合约研究仪表盘" src="${esc(prefix)}/app/" allow="clipboard-write"></iframe></body></html>`;
  res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-cache'});return res.end(req.method==='HEAD'?undefined:html);
 }
 const pages=new Set(['/app/','/app/rules','/app/backtest']);
 let data,type;
 if(pages.has(route)){data=Buffer.from(fs.readFileSync(path.join(root,'index.html'),'utf8').replaceAll('__SIGNAL_BASE__',esc(prefix+'/app')).replaceAll('__SIGNAL_API__',esc(prefix+'/api/market')));type='text/html; charset=utf-8';}
 else{const file=route.startsWith('/app/')?route.slice(5):'';if(!files.has(file)){res.writeHead(404);return res.end('Not found');}data=fs.readFileSync(path.join(root,file));type=file.endsWith('.js')?'text/javascript; charset=utf-8':'text/css; charset=utf-8';}
 res.writeHead(200,{'Content-Type':type,'Content-Length':data.length,'Cache-Control':pages.has(route)?'no-cache':'public, max-age=31536000, immutable','Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; object-src 'none'; frame-ancestors 'self'; base-uri 'none'"});
 return res.end(req.method==='HEAD'?undefined:data);
}
module.exports={handleSignalDashboard};
