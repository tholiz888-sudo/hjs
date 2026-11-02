'use strict';
const fs=require('node:fs'),path=require('node:path');
async function handleKronosAdmin({req,res,p,u,json,read,store=require('./store.cjs').getStore()}){
 if(p==='/admin/api/kronos/state'&&req.method==='GET')return json(200,{settings:store.settings(),history:store.list(),currentId:store.currentId(),issues:store.issues});
 if(p==='/admin/api/kronos/settings'&&req.method==='PUT')return json(200,{settings:store.saveSettings(await read(req))});
 if(p==='/admin/api/kronos/forecast'&&req.method==='POST')return json(200,{id:store.add(await read(req))});
 const record=/^\/admin\/api\/kronos\/records\/([a-f0-9]{24})(\/select)?$/.exec(p);
 if(record){if(record[2]&&req.method==='POST'){store.select(record[1]);return json(200,{ok:true});}if(!record[2]&&req.method==='DELETE'){store.remove(record[1]);return json(200,{ok:true});}if(!record[2]&&req.method==='GET'){const result=store.get(record[1]);return json(result?200:404,result||{error:'记录不存在'});}}
 if(p==='/admin/api/kronos/backup'&&req.method==='GET'){res.setHeader('Content-Disposition','attachment; filename="kronos-backup.json"');return json(200,store.backup());}
 if(p==='/admin/api/kronos/backup'&&req.method==='POST'){store.restore(await read(req));return json(200,{ok:true});}
 return json(404,{error:'接口不存在'});
}
function page(res,{base='/crypto'}={}){res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','X-Robots-Tag':'noindex, nofollow'});res.end(fs.readFileSync(path.join(__dirname,'admin.html'),'utf8').replaceAll('__ADMIN_BASE__',base));}
module.exports={handleKronosAdmin,page};
