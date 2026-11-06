const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'../position-calculator/portal-dist');
const files=new Set(require('../position-calculator/portal-dist/manifest.json').files);
const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function handlePositionCalculator(req,res,{base='',navigation=''}){
  const url=new URL(req.url,'http://localhost'),prefix=base+'/position-calculator',route=url.pathname.slice(prefix.length);
  res.setHeader('X-Content-Type-Options','nosniff');
  if(!['GET','HEAD'].includes(req.method)){res.writeHead(405,{Allow:'GET, HEAD'});return res.end();}
  if(route===''||route==='/app'){res.writeHead(308,{Location:prefix+(route===''?'/':'/app/')+url.search});return res.end();}
  if(route==='/'){
    const html=`<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>仓位实验室</title><link rel="stylesheet" href="${escape(base)}/assets/base.css"><link rel="stylesheet" href="${escape(base)}/assets/home.css"><style>html,body{height:100%;margin:0}body{display:flex;flex-direction:column;height:100dvh;overflow:hidden}.calculator-navigation{flex:none}iframe{display:block;width:100%;border:0;flex:1;min-height:0}</style></head><body><div class="calculator-navigation">${navigation}</div><iframe title="仓位实验室完整计算器" src="${escape(prefix)}/app/" allow="clipboard-write"></iframe></body></html>`;
    res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-cache'});return res.end(req.method==='HEAD'?undefined:html);
  }
  const file=route==='/app/'?'index.html':route.startsWith('/app/')?route.slice(5):'';
  if(!files.has(file)){res.writeHead(404);return res.end('Not found');}
  const type=file.endsWith('.html')?'text/html; charset=utf-8':file.endsWith('.js')?'text/javascript; charset=utf-8':file.endsWith('.css')?'text/css; charset=utf-8':'image/svg+xml';
  const data=fs.readFileSync(path.join(root,file));
  res.writeHead(200,{'Content-Type':type,'Content-Length':data.length,'Cache-Control':file.startsWith('assets/')?'public, max-age=31536000, immutable':'no-cache','Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; object-src 'none'; frame-ancestors 'self'; base-uri 'none'"});
  return res.end(req.method==='HEAD'?undefined:data);
}
module.exports={handlePositionCalculator};
