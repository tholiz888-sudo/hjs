import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
import {spawn,spawnSync} from 'node:child_process';
import assert from 'node:assert/strict';
const root=new URL('../',import.meta.url),temp=await fs.mkdtemp(path.join(os.tmpdir(),'jiange-prod-start-'));let child;let output='';
try{
 for(const name of ['package.json','package-lock.json','index.html','vite.config.js','server','src','public','scripts'])await fs.cp(new URL(name,root),path.join(temp,name),{recursive:true});
 await fs.mkdir(path.join(temp,'data'));for(const name of await fs.readdir(new URL('data/',root)))if(name.endsWith('.json'))await fs.copyFile(new URL('data/'+name,root),path.join(temp,'data',name));
 const env={...process.env,NODE_ENV:'production',npm_config_cache:'/tmp/hjs-npm-cache'};
 const install=spawnSync('npm',['ci','--omit=dev','--no-audit','--no-fund'],{cwd:temp,env,encoding:'utf8'});assert.equal(install.status,0,install.stderr);
 await assert.rejects(fs.access(path.join(temp,'dist/index.html')));
 const probe=net.createServer();await new Promise(r=>probe.listen(0,'127.0.0.1',r));const port=probe.address().port;await new Promise(r=>probe.close(r));
 child=spawn(process.execPath,['scripts/start.mjs'],{cwd:temp,env:{...env,PORT:String(port),DB_PATH:path.join(temp,'account.sqlite')}});child.stdout.on('data',b=>output+=b);child.stderr.on('data',b=>output+=b);
 let ready=false;for(let i=0;i<200;i++){try{const response=await fetch(`http://127.0.0.1:${port}/api/health`);if(response.ok){ready=true;break}}catch{}if(child.exitCode!=null)break;await new Promise(r=>setTimeout(r,100))}assert.ok(ready,output);
 const page=await fetch(`http://127.0.0.1:${port}/discover`);assert.equal(page.status,200);assert.match(page.headers.get('content-type'),/text\/html/);const html=await page.text();const script=html.match(/src="([^"]+\.js)"/)[1];assert.equal((await fetch(`http://127.0.0.1:${port}${script}`)).status,200);assert.match(output,/首次启动/);assert.match(output,/built in/);console.log('PASS: production-only dependency install, missing dist automatically built, SPA HTML and compiled asset served successfully');
}finally{if(child&&child.exitCode==null){child.kill('SIGTERM');await new Promise(r=>child.once('exit',r))}await fs.rm(temp,{recursive:true,force:true})}
