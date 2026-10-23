import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import {createApplication} from '../server/index.mjs';
const app=createApplication({dbPath:':memory:',autoMarket:false});let browser;
try{
 await new Promise(r=>app.server.listen(0,'127.0.0.1',r));const base=`http://127.0.0.1:${app.server.address().port}`;
 browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox','--autoplay-policy=user-gesture-required']});const page=await browser.newPage({viewport:{width:1440,height:1000}});let ticks=0;
 await page.route('**/api/market/status',route=>route.fulfill({contentType:'application/json',body:JSON.stringify({source:'okx',ready:false,automatic:false,updatedAt:new Date().toISOString(),sequence:++ticks})}));
 await page.goto(base+'/strategy');await page.getByRole('link',{name:'秘密花园',exact:true}).click();await page.waitForURL('**/garden');const frame=page.frameLocator('.garden-frame');
 await frame.getByText('Enter',{exact:true}).click();await frame.getByText('月光情诗',{exact:true}).waitFor();await frame.locator('body').click({position:{x:15,y:15}});
 const audio=frame.locator('#p-music');await audio.evaluate(async a=>{await a.play();window.__archiveMarker='keep-playing'});await page.waitForTimeout(11000);
 assert.equal(await audio.evaluate(a=>window.__archiveMarker==='keep-playing'&&!a.paused&&a.currentTime>5),true);assert.equal(new URL(page.url()).pathname,'/garden');
 assert.equal(await page.getByRole('navigation',{name:'主导航'}).count(),1);assert.equal(await page.locator('.garden-frame').getAttribute('sandbox'),'allow-scripts allow-popups');
 await page.setViewportSize({width:390,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
 await page.getByRole('link',{name:'策略',exact:true}).click();await page.waitForURL('**/strategy');assert.equal(await page.locator('.garden-frame').count(),0);
 console.log('PASS main-site garden navigation, prefixed links, sandboxed real audio, uninterrupted playback across refresh intervals, mobile width and return navigation');
}finally{await browser?.close();await app.close()}
