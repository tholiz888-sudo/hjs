const {Readable}=require('node:stream');
const {e,renderNavigation}=require('./views');
const store=require('./content-store.cjs');
// Delegate authentication to the existing local research service. No remote service or password copy.
async function researchCall(handler,req,base,endpoint,data){return new Promise((resolve,reject)=>{const input=Readable.from(data?[JSON.stringify(data)]:[]);Object.assign(input,{url:base+'/research/api/'+endpoint,method:data?'POST':'GET',headers:{...req.headers,'content-type':'application/json'},socket:{remoteAddress:req.socket.remoteAddress}});const headers={};const output={statusCode:200,setHeader(k,v){headers[k.toLowerCase()]=v},getHeader(k){return headers[k.toLowerCase()]},writeHead(s,h){this.statusCode=s;Object.assign(headers,h)},end(body){let value;try{value=JSON.parse(String(body))}catch{value={error:'管理服务响应异常'}}resolve({status:this.statusCode,headers,value})}};Promise.resolve(handler(input,output)).catch(reject)})}
async function read(req){let text='';for await(const chunk of req){text+=chunk;if(Buffer.byteLength(text)>(req.url.includes('/backup')?16*1024*1024:req.url.includes('/garden/upload')?4*1024*1024:2*1024*1024))throw Error('内容过大')}return JSON.parse(text||'{}')}
async function handleAdmin(req,res,{base,research,review}){const u=new URL(req.url,'http://localhost'),p=u.pathname.slice(base.length);const json=(status,value)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(value))};const redirect=target=>{res.writeHead(303,{Location:base+target});res.end()};try{if(!['GET','HEAD'].includes(req.method)){if(req.headers.origin&&new URL(req.headers.origin).host!==req.headers.host)return json(403,{error:'请求来源不匹配'})}const handler=await research();
if(p==='/admin/api/login'&&req.method==='POST'){const result=await researchCall(handler,req,base,'login',await read(req));if(result.status!==200)return json(result.status,result.value);if(!result.value.user?.isAdmin)return json(403,{error:'此账户没有管理员权限'});const cookie=result.headers['set-cookie'];if(cookie)res.setHeader('Set-Cookie',[cookie.replace(/Path=[^;]+/,`Path=${base||'/'}`),`jiange_session=; HttpOnly; SameSite=Strict; Path=${base}/research; Max-Age=0`]);return json(200,{ok:true})}
const session=await researchCall(handler,req,base,'session');const user=session.value.user;const signed=user?.isAdmin;
if(p==='/admin/api/logout'&&req.method==='POST'){const result=await researchCall(handler,req,base,'logout',{});res.setHeader('Set-Cookie',[`jiange_session=; HttpOnly; SameSite=Strict; Path=${base||'/'}; Max-Age=0`,`jiange_session=; HttpOnly; SameSite=Strict; Path=${base}/research; Max-Age=0`]);return json(result.status,{ok:true})}
if(p.startsWith('/admin/api/')){
 if(!signed)return json(401,{error:'请使用管理员账户登录'});
 const actor=user.email;
 if(p.startsWith('/admin/api/garden'))return await require('./garden-api.cjs').handleGardenApi({req,res,p,u,json,read,actor,base});
 if(p==='/admin/api/state'&&req.method==='GET')return json(200,store.dashboard());
 if(p==='/admin/api/articles'&&req.method==='GET')return json(200,{articles:store.list(),categories:store.tree()});
 if(p==='/admin/api/articles'&&req.method==='POST')return json(200,{article:store.save(await read(req),actor)});
 if(p==='/admin/api/articles/bulk'&&req.method==='POST'){const b=await read(req);return json(200,{count:store.articleAction(b.slugs,b.action,b.category,actor)})}
 if(p==='/admin/api/categories'&&req.method==='POST')return json(200,{categories:store.saveCategory(await read(req),actor)});
 if(p==='/admin/api/categories'&&req.method==='DELETE'){store.deleteCategory((await read(req)).id,actor);return json(200,{ok:true})}
 if(p==='/admin/api/exchanges'&&req.method==='POST')return json(200,{exchange:store.saveExchange(await read(req),actor)});
 if(p==='/admin/api/exchanges'&&req.method==='DELETE'){store.deleteExchange((await read(req)).id,actor);return json(200,{ok:true})}
 if(p==='/admin/api/settings'&&req.method==='PUT')return json(200,{settings:store.saveSite(await read(req),actor)});
 if(p==='/admin/api/backup'&&req.method==='GET')return json(200,store.backup());
 if(p==='/admin/api/backup'&&req.method==='POST'){store.restore(await read(req),actor);return json(200,{ok:true})}
 return json(404,{error:'接口不存在'})
}
if(p==='/admin/research'){if(!signed)return redirect('/admin');return redirect('/research/admin')}
if(p==='/admin/review'){if(!signed)return redirect('/admin');review().createAdminSession(res,user.email);return redirect('/review/?manage=1')}
if(p!=='/admin'&&p!=='/admin/')return json(404,{error:'页面不存在'});
const sections=[['overview','工作台','01'],['articles','文章管理','02'],['categories','栏目管理','03'],['exchanges','交易所管理','04'],['settings','网站设置','05'],['backup','备份与恢复','06'],['garden','秘密花园','07']];
const body=signed?`<div class="admin-shell"><aside class="admin-sidebar"><a class="admin-logo" href="${base}/admin"><span>链</span><div>网站管理中心<small>内容与运营工作台</small></div></a><p class="menu-caption">主站管理</p><nav aria-label="后台功能导航">${sections.map(([id,title,num])=>`<a href="#${id}" data-panel="${id}"><span>${num}</span>${title}</a>`).join('')}</nav><p class="menu-caption">应用后台</p><nav class="module-nav"><a href="${base}/admin/research">天机看盘后台 <span>↗</span></a><a href="${base}/admin/review">BIT浪浪研究室后台 <span>↗</span></a></nav><div class="sidebar-bottom"><span class="status-dot"></span> 统一管理员权限</div></aside><div class="admin-workspace"><header class="admin-toolbar"><div><span class="toolbar-kicker">主站运营</span><strong id="panel-title">工作台</strong></div><div class="toolbar-actions"><a href="${base}/" target="_blank" rel="noopener">查看网站 ↗</a><span class="admin-user">${e(user.email)}</span><button id="logout" class="quiet">退出登录</button></div></header><main id="admin-main"><div id="status" role="status" aria-live="polite" hidden></div><div id="workspace"><div class="loading-card">正在加载管理数据…</div></div></main></div></div>`:`<main class="login-screen"><a class="login-brand" href="${base}/">← 返回网站</a><section class="login-card"><span class="login-icon">链</span><h1>网站管理中心</h1><p>内容、栏目与应用，集中管理。</p><div id="status" role="status" hidden></div><form id="login"><label>管理员邮箱<input name="email" type="email" required autocomplete="username" placeholder="请输入邮箱"></label><label>密码<input name="password" type="password" required autocomplete="current-password" placeholder="请输入管理员密码"></label><button class="primary">登录后台</button></form><details><summary>首次使用说明</summary><p>使用天机看盘管理员账户登录。首次部署需在 Render 环境变量配置 ADMIN_EMAILS 和 ADMIN_PASSWORD（10–128 位），保存并重新部署。</p></details></section></main>`;
res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','X-Robots-Tag':'noindex, nofollow','X-Content-Type-Options':'nosniff'});
res.end(`<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>网站管理中心</title><link rel="stylesheet" href="${base}/assets/admin.css"></head><body data-base="${e(base)}">${body}<script src="${base}/assets/garden-admin.js" defer></script><script src="${base}/assets/admin.js" defer></script></body></html>`)

}catch(error){json(400,{error:error.message})}}
module.exports={handleAdmin};
