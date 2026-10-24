const fs=require('node:fs'),path=require('node:path'),store=require('./garden-community-store.cjs');
const e=s=>String(s||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
async function handleCommunity(req,res,{base=''}){
 const u=new URL(req.url,'http://localhost'),p=u.pathname.slice((base+'/garden/community').length),method=req.method;
 const json=(status,value)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(value))};
 try{
  if(!['GET','HEAD'].includes(method)&&((req.headers.origin&&new URL(req.headers.origin).host!==req.headers.host)||req.headers['sec-fetch-site']==='cross-site'))return json(403,{error:'请求来源不匹配'});
  if(['/app.js','/bridge.js'].includes(p)&&method==='GET'){res.writeHead(200,{'Content-Type':'text/javascript; charset=utf-8','Cache-Control':'no-cache','X-Content-Type-Options':'nosniff'});return res.end(fs.readFileSync(path.join(__dirname,p==='/bridge.js'?'public/garden-guestbook-bridge.js':'public/garden-community.js')))}
  if(p==='/api/messages'&&method==='GET')return json(200,store.messages(Object.fromEntries(u.searchParams),true));
  if(p.startsWith('/api/')){
   const {researchCall,read}=require('./admin.cjs'),handler=await require('./research-handler.cjs').researchHandler(base,()=>require('./views').renderNavigation('/research',base).replace(/class="primary-nav"/g,'class="portal-primary-nav"').replace(/class="brand"/g,'class="portal-brand"').replace(/class="category-nav"/g,'class="portal-category-nav"')),call=(endpoint,data)=>researchCall(handler,req,base,endpoint,data);
   if(['/api/register','/api/login','/api/logout'].includes(p)&&method==='POST'){
    const endpoint=p.slice(5),input=await read(req),result=await call(endpoint,input);
    if(result.status!==200)return json(result.status,result.value);
    if(result.value.user)store.join(result.value.user,endpoint==='register'?'garden-register':'existing');
    const cookie=result.headers['set-cookie'];if(cookie)res.setHeader('Set-Cookie',[cookie.replace(/Path=[^;]+/,`Path=${base||'/'}`),`jiange_session=; HttpOnly; SameSite=Strict; Path=${base}/research; Max-Age=0`]);
    return json(200,{user:result.value.user?{id:result.value.user.id,nickname:result.value.user.nickname,email:result.value.user.email}:null,ok:true});
   }
   const session=await call('session'),user=session.value.user;
   if(p==='/api/session'&&method==='GET'){if(user&&!store.member(user.id))store.join(user);return json(200,{user:user?{id:user.id,email:user.email,nickname:user.nickname,muted:!!store.member(user.id)?.muted}:null})}
   if(p==='/api/messages'&&method==='POST'){if(!user)return json(401,{error:'请先注册或登录后留言'});return json(200,store.submit(user,await read(req)))}
   return json(404,{error:'接口不存在'});
  }
  if(p!==''&&p!=='/')return json(404,{error:'页面不存在'});if(!['GET','HEAD'].includes(method))return json(405,{error:'不支持此请求'});
  res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'none'; style-src 'unsafe-inline'; img-src 'self' data:; script-src 'self'; connect-src 'self'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'"});
  res.end(method==='HEAD'?undefined:`<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>秘密花园 · 留言板</title><style>body{margin:0;padding:35px 18px;background:#9ab096 url('${e(base)}/garden/view/garden2018.jpg') fixed;color:#3e5a38;font:16px/1.9 Georgia,'Microsoft YaHei',serif}main{max-width:820px;margin:auto;padding:28px;background:#e2e8cbed;border:5px double #678264}a{color:#40694c}h1{text-align:center;font-weight:normal}section,article{border-bottom:1px solid #9cab85;padding:18px 0}label{display:block}input,textarea,button{box-sizing:border-box;font:inherit;padding:7px;border:1px solid #82936d;background:#f4f4e7;color:#345236;border-radius:3px}input,textarea{width:100%;margin:6px 0 12px}button{cursor:pointer;margin:6px 8px 6px 0}button:disabled{opacity:.5;cursor:default}small{opacity:.8}.text{white-space:pre-wrap;overflow-wrap:anywhere}blockquote{border-left:3px solid #82936d;padding-left:15px;margin-left:10px}#notice{white-space:pre-wrap}#notice.error{color:#9c2f26}.links{display:flex;gap:20px;flex-wrap:wrap}</style></head><body data-base="${e(base)}"><main><div class="links"><a href="${e(base)}/garden">‹ 返回秘密花园</a><a href="${e(base)}/garden/view/liuyan/default.asp">历史留言</a></div><h1>花园留言板</h1><p>把此刻的心情，留在花园里。</p><p id="notice" role="status" aria-live="polite"></p><section id="account"></section><section id="compose" hidden><h2>写下你的留言</h2><form id="message-form"><label>标题（可选）<input name="title" maxlength="80"></label><label>留言内容<textarea name="body" maxlength="2000" rows="5" required></textarea></label><small>留言经管理员审核后公开，请勿填写密码或其他私密信息。</small><br><button>提交留言</button></form></section><section><h2>花园里的声音</h2><div id="messages">正在读取留言…</div><button id="prev">上一页</button><span id="pagination"></span><button id="next">下一页</button></section></main><script src="${e(base)}/garden/community/app.js" defer></script></body></html>`);
 }catch(error){return json(400,{error:error.message})}
}
module.exports={handleCommunity};
