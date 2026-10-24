import {chromium} from '@playwright/test';
import {spawn} from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
const dir=await fs.mkdtemp(path.join(os.tmpdir(),'garden-ui-'));let child,browser;
try{
 child=spawn(process.execPath,['-e',`const http=require('node:http');const {handleSiteRequest}=require('./server');http.createServer((q,s)=>handleSiteRequest(q,s,{mountPath:'/crypto'})).listen(0,'127.0.0.1',function(){console.log('PORT='+this.address().port)})`],{cwd:new URL('..',import.meta.url),env:{...process.env,ADMIN_EMAILS:'ui-owner@example.com',ADMIN_PASSWORD:'test-garden-ui-password',MARKET_AUTO_SYNC:'0',PORTAL_DB_PATH:path.join(dir,'content.sqlite'),RESEARCH_DB_PATH:path.join(dir,'research.sqlite')}});
 const port=await new Promise((resolve,reject)=>{let log='';const timer=setTimeout(()=>reject(Error(log)),10000);child.stdout.on('data',b=>{log+=b;const m=log.match(/PORT=(\d+)/);if(m){clearTimeout(timer);resolve(m[1])}});child.stderr.on('data',b=>log+=b);child.on('error',reject)});
 const base=`http://127.0.0.1:${port}/crypto`;browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(base+'/admin');await page.locator('[name=email]').fill('ui-owner@example.com');await page.locator('[name=password]').fill('test-garden-ui-password');await page.getByRole('button',{name:'登录后台'}).click();await page.locator('[data-panel=garden]').click();await page.locator('#garden-work table').waitFor();
 await page.locator('[data-garden-tab=new]').click();await page.locator('#garden-editor [name=title]').fill('花园里的春天');await page.locator('[name=slug]').fill('garden-spring-ui');await page.locator('#garden-editor [name=body]').fill('一段可以放松的文字。\n\n第二段保留绿色风格。');
 await page.locator('#garden-image-query').fill('garden');const searched=page.waitForResponse(r=>r.url().includes('/garden/media?type=image&q=garden'));await page.locator('#garden-image-query').press('Enter');await searched;assert.equal(await page.locator('#garden-editor [data-preview]').count(),0);
 const music=await page.locator('[name=musicId] option').nth(1).getAttribute('value');await page.locator('[name=musicId]').selectOption(music);await page.getByRole('button',{name:'保存内容',exact:true}).click();await page.getByRole('button',{name:'预览已保存版本'}).waitFor();
 await page.getByRole('button',{name:'预览已保存版本'}).click();await page.frameLocator('#garden-preview iframe').getByRole('heading',{name:'花园里的春天'}).waitFor();
 let response=await page.request.get(base+'/garden/view/posts/garden-spring-ui.html');assert.equal(response.status(),404);
 await page.locator('#garden-editor [name=status]').selectOption('published');await page.getByRole('button',{name:'保存内容',exact:true}).click();await page.getByText('已发布，花园前台立即生效。',{exact:true}).waitFor();
 const publicPage=await browser.newPage();response=await publicPage.goto(base+'/garden/view/posts/garden-spring-ui.html');assert.equal(response.status(),200);assert.ok(response.headers()['content-security-policy'].includes('sandbox allow-scripts'));
 await publicPage.getByRole('heading',{name:'花园里的春天'}).waitFor();await publicPage.locator('body').click({position:{x:20,y:120}});await publicPage.waitForFunction(()=>document.querySelector('audio')?.currentTime>0);assert.equal(await publicPage.locator('body').evaluate(b=>getComputedStyle(b).backgroundColor),'rgb(154, 176, 150)');
 await page.locator('[data-garden-tab=pages]').click();await page.locator('#garden-q').fill('花园里的春天');await page.locator('#garden-search').click();await page.locator('#garden-work tbody tr').filter({hasText:'花园里的春天'}).locator('[data-state=draft]').waitFor();page.once('dialog',d=>d.accept());await page.locator('#garden-work tbody tr').filter({hasText:'花园里的春天'}).locator('[data-state=draft]').click();await page.getByText('内容状态已更新。',{exact:true}).waitFor();assert.equal((await page.request.get(base+'/garden/view/posts/garden-spring-ui.html')).status(),404);
 await publicPage.goto(base+'/garden');const frame=publicPage.frameLocator('iframe');await frame.getByText('Enter',{exact:true}).waitFor();const html=await frame.locator('html').innerHTML();assert.doesNotMatch(html,/yini\.org|lili\.cc|beian\.miit|ICP[备案]/i);
 assert.deepEqual(errors,[]);console.log('PASS unified admin login, original-page list, new draft, private preview, publication, real music playback, green appearance, withdrawal and original URL cleanup');
}finally{await browser?.close();if(child){child.kill();await new Promise(r=>child.once('exit',r))}await fs.rm(dir,{recursive:true,force:true})}
