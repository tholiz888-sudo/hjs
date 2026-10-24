const store=require('./garden-store.cjs');
async function handleGardenApi({req,res,p,u,json,read,actor,base}){
 const route=p.slice('/admin/api/garden'.length),method=req.method;
 if(route==='/pages'&&method==='GET')return json(200,store.list(Object.fromEntries(u.searchParams)));
 if(route==='/page'&&method==='GET')return json(200,{page:store.get(u.searchParams.get('id'))});
 if(route==='/page'&&method==='POST')return json(200,{page:store.save(await read(req),actor)});
 if(route==='/status'&&method==='POST'){const b=await read(req);return json(200,{page:store.action(b.id,b.status,actor)})}
 if(route==='/categories'&&method==='GET')return json(200,{items:store.categories()});
 if(route==='/categories'&&method==='POST')return json(200,{items:store.saveCategory(await read(req),actor)});
 if(route==='/media'&&method==='GET')return json(200,store.library(Object.fromEntries(u.searchParams)));
 if(route==='/upload'&&method==='POST')return json(200,{media:store.upload(await read(req),actor)});
 if(route==='/export'&&method==='GET')return json(200,store.exported());
 if(route==='/preview'&&method==='GET'){
  const page=store.get(u.searchParams.get('id')),prefix=base+'/garden/view';const {prepareDocument}=await import('./garden/presentation.mjs');
  const bytes=prepareDocument(store.pageHTML(page,prefix),{prefix,pagePath:page.path,...store.presentation(page.path,prefix),title:page.title});
  res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','X-Robots-Tag':'noindex, nofollow','Content-Security-Policy':"sandbox allow-scripts allow-popups; default-src 'self' data:; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; connect-src 'none'; object-src 'none'; form-action 'none'; base-uri 'self'"});return res.end(bytes);
 }
 return json(404,{error:'花园管理接口不存在'});
}
module.exports={handleGardenApi};
