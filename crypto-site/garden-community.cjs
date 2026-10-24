const fs=require('node:fs'),path=require('node:path'),store=require('./garden-community-store.cjs');
const e=s=>String(s||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
async function handleCommunity(req,res,{base='',pageRoute}){
 const u=new URL(req.url,'http://localhost'),p=pageRoute??u.pathname.slice((base+'/garden/community').length),method=req.method;
 const visitorCookie=(req.headers.cookie||'').split(';').map(x=>x.trim()).find(x=>x.startsWith('garden_visitor='))?.slice(15);const visitor=/^[a-f0-9]{64}$/.test(visitorCookie||'')?visitorCookie:require('node:crypto').randomBytes(32).toString('hex');if(visitor!==visitorCookie)res.setHeader('Set-Cookie',`garden_visitor=${visitor}; HttpOnly; SameSite=Strict; Path=${base}/garden; Max-Age=2592000${req.headers['x-forwarded-proto']==='https'||req.socket.encrypted?'; Secure':''}`);
 const json=(status,value)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(value))};
 try{
  if(!['GET','HEAD'].includes(method)&&((req.headers.origin&&new URL(req.headers.origin).host!==req.headers.host)||req.headers['sec-fetch-site']==='cross-site'))return json(403,{error:'请求来源不匹配'});
  if(['/app.js','/bridge.js'].includes(p)&&method==='GET'){res.writeHead(200,{'Content-Type':'text/javascript; charset=utf-8','Cache-Control':'no-cache','X-Content-Type-Options':'nosniff'});return res.end(fs.readFileSync(path.join(__dirname,p==='/bridge.js'?'public/garden-guestbook-bridge.js':'public/garden-community.js')))}
  if(/^\/captcha\/[a-f0-9]{48}\.svg$/.test(p)&&method==='GET'){const answer=store.captchaImage(p.split('/').pop().slice(0,-4),visitor);if(!answer){res.writeHead(404).end();return}res.writeHead(200,{'Content-Type':'image/svg+xml','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'none'; style-src 'unsafe-inline'"});return res.end(`<svg xmlns="http://www.w3.org/2000/svg" width="100" height="32" viewBox="0 0 100 32"><rect width="100" height="32" fill="#f5f0d8"/><path d="M0 10L100 25M0 27L100 6" stroke="#aaa"/>${answer.split('').map((c,i)=>`<text x="${9+i*23}" y="24" font-size="23" font-family="monospace" font-weight="bold" fill="#203f2b">${c}</text>`).join('')}</svg>`)}
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
   if(p==='/api/messages'&&method==='POST'){const input=await read(req);return json(200,user?store.submit(user,input):store.submitGuest(visitor,input))}
   return json(404,{error:'接口不存在'});
  }
  const action=p.match(/^\/action\/(register|login|logout|messages|refresh)$/)?.[1];
  if(!action&&p!==''&&p!=='/')return json(404,{error:'页面不存在'});
  if(action?method!=='POST':!['GET','HEAD'].includes(method))return json(405,{error:'不支持此请求'});
  const {researchCall}=require('./admin.cjs');let handler,user=null,error='',notice='',data=null,draft={},refresh=false;
  const getHandler=async()=>handler??=await require('./research-handler.cjs').researchHandler(base,()=>require('./views').renderNavigation('/research',base).replace(/class="primary-nav"/g,'class="portal-primary-nav"').replace(/class="brand"/g,'class="portal-brand"').replace(/class="category-nav"/g,'class="portal-category-nav"'));
  const call=async(endpoint,input)=>researchCall(await getHandler(),req,base,endpoint,input);
  try{const result=await call('session');if(result.status!==200)throw Error('账号服务暂时不可用');user=result.value.user;if(user){if(!store.member(user.id))store.join(user);user={id:user.id,nickname:user.nickname,email:user.email,muted:!!store.member(user.id)?.muted}}}catch{error='' }
  if(action){
   try{
    if(!/^application\/x-www-form-urlencoded(?:;|$)/i.test(req.headers['content-type']||''))throw Error('表单格式不正确');let text='';for await(const chunk of req){text+=chunk;if(Buffer.byteLength(text)>32768)throw Error('表单内容过大')}const input=Object.fromEntries(new URLSearchParams(text));
    if(action==='refresh'){draft=input;refresh=true}
    else if(action==='messages'){draft=input;if(user)store.submit(user,input);else store.submitGuest(visitor,input)}
    else{const result=await call(action,input);if(result.status!==200)throw Error(result.value.error||'账号操作失败');if(result.value.user)store.join(result.value.user,action==='register'?'garden-register':'existing');const cookie=result.headers['set-cookie'];if(cookie)res.setHeader('Set-Cookie',[cookie.replace(/Path=[^;]+/,`Path=${base||'/'}`),`jiange_session=; HttpOnly; SameSite=Strict; Path=${base}/research; Max-Age=0`])}
    if(!refresh){res.writeHead(303,{Location:base+'/garden/community?notice='+action+'#compose','Cache-Control':'no-store'});return res.end()}
   }catch(failure){error=failure.message}
  }
  const notices={register:'注册成功，欢迎来到秘密花园。',login:'登录成功。',logout:'已退出登录。',messages:'留言已提交，审核通过后会公开显示。'};notice=notices[u.searchParams.get('notice')]||'';
  try{data=store.messages(Object.fromEntries(u.searchParams),true)}catch{error=error||'留言暂时无法读取，请稍后刷新重试。'}
  res.writeHead(action&&!refresh?400:200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'none'; style-src 'unsafe-inline'; img-src 'self' data:; script-src 'self'; connect-src 'self'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'"});
  res.end(method==='HEAD'?undefined:require('./garden-community-page.cjs').renderCommunity({base,user,data,error,notice,page:data?.page||1,draft,captchaToken:!user?store.challenge(visitor,refresh||u.searchParams.has('refreshCaptcha')):''}));
 }catch(error){return json(400,{error:error.message})}
}
module.exports={handleCommunity};
