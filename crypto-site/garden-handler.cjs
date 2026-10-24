const handlers=new Map();
const e=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function gardenPage(base=''){
 return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>秘密花园</title><meta name="description" content="走进绿色花园，读诗、看画，听一曲轻音乐。"><style>html,body{margin:0;width:100%;height:100%;overflow:hidden;background:#9ab096}iframe{display:block;width:100%;height:100%;border:0;background:#9ab096}.garden-return{position:fixed;top:12px;left:12px;z-index:2;padding:7px 12px;border:1px solid #5d78565c;border-radius:4px;background:#e8eedfdf;color:#3e5b3b;font:13px/1.4 "Microsoft YaHei",sans-serif;text-decoration:none;box-shadow:0 1px 5px #304c3020}.garden-community{left:auto;right:12px}.garden-return:hover,.garden-return:focus-visible{background:#f0f3e9;outline:2px solid #547052;outline-offset:2px}</style></head><body><a class="garden-return" href="${e(base+'/')}">‹ 返回主站</a><a class="garden-return garden-community" href="${e(base+'/garden/community')}">留言板 · 登录／注册</a><iframe title="秘密花园" src="${e(base+'/garden/view/')}" allow="autoplay" sandbox="allow-scripts allow-popups"></iframe></body></html>`;
}
function getHandler(base){
 if(!handlers.has(base))handlers.set(base,import('./garden/server.mjs').then(({createGardenHandler})=>createGardenHandler({prefix:base+'/garden/view',content:require('./garden-store.cjs')})).catch(error=>{handlers.delete(base);throw error}));
 return handlers.get(base);
}
async function handleGardenRequest(req,res,{base=''}={}){
 const url=new URL(req.url,'http://localhost'),route=url.pathname.slice(base.length);
 if(route==='/garden/community'||route.startsWith('/garden/community/'))return require('./garden-community.cjs').handleCommunity(req,res,{base});
 if(route==='/garden'||route==='/garden/'){
  if(!['GET','HEAD'].includes(req.method)){res.writeHead(405,{Allow:'GET, HEAD'}).end();return}
  res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','X-Content-Type-Options':'nosniff','Cache-Control':'no-cache','Referrer-Policy':'same-origin','Content-Security-Policy':"default-src 'none'; style-src 'unsafe-inline'; frame-src 'self'; base-uri 'none'; form-action 'none'"});
  res.end(req.method==='HEAD'?undefined:gardenPage(base));return;
 }
 if(route==='/garden/view'||route.startsWith('/garden/view/')){try{const handler=await getHandler(base);return await handler(req,res)}catch(error){console.error('Garden request failed:',error.message);if(!res.headersSent)res.writeHead(503,{'Content-Type':'text/plain; charset=utf-8'});res.end('花园暂时无法读取，请稍后重试。');return}}
 res.writeHead(404,{'Content-Type':'text/plain; charset=utf-8'}).end('页面不存在');
}
module.exports={handleGardenRequest,gardenPage};
