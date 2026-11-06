import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const base=process.env.TEST_URL||'http://127.0.0.1:3107/crypto/position-calculator/';
const origin=new URL(base).origin,external=[],errors=[];
const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']});
try{
 const context=await browser.newContext({acceptDownloads:true});
 await context.route('**/*',route=>{if(new URL(route.request().url()).origin!==origin){external.push(route.request().url());return route.abort();}return route.continue();});
 const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
 for(const width of [1440,390]){
  await page.setViewportSize({width,height:1000});await page.goto(base);
  const link=page.locator('header.primary-nav a').last();assert.equal(await link.innerText(),'仓位实验室');assert.equal(await link.getAttribute('href'),new URL(base).pathname.replace(/\/$/,''));
  const frame=page.frameLocator('iframe[title="仓位实验室完整计算器"]');await frame.locator('.simple-workspace').waitFor();
  await page.waitForTimeout(250);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  assert.ok(await frame.locator('html').evaluate(el=>el.scrollWidth<=innerWidth));
 }
 const frame=page.frameLocator('iframe');await frame.getByRole('button',{name:'保存计划',exact:true}).click();await frame.getByRole('button',{name:'已保存计划',exact:true}).click();
 const downloadPromise=page.waitForEvent('download');await frame.getByRole('button',{name:'导出计划备份',exact:true}).click();const download=await downloadPromise;
 const backup=JSON.parse(await fs.readFile(await download.path(),'utf8'));assert.equal(backup.version,1);assert.equal(backup.plans.length,1);
 backup.plans[0].id='imported-plan';
 await frame.getByLabel('导入计划备份文件',{exact:true}).setInputFiles({name:'plans.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(backup))});
 await frame.getByRole('status').filter({hasText:'已导入 1 条计划'}).waitFor();
 assert.equal(await frame.locator('.saved-item').count(),2);
 const before=await page.evaluate(()=>localStorage.getItem('cpc:plans:v1'));
 await frame.getByLabel('导入计划备份文件',{exact:true}).setInputFiles({name:'invalid.json',mimeType:'application/json',buffer:Buffer.from('{"version":1,"plans":[{}]}')});
 await frame.getByRole('status').filter({hasText:'无效或重复计划'}).waitFor();assert.equal(await page.evaluate(()=>localStorage.getItem('cpc:plans:v1')),before);
 await page.reload();await frame.locator('.simple-workspace').waitFor();await page.waitForTimeout(250);await frame.getByRole('button',{name:'已保存计划',exact:true}).click();assert.equal(await frame.locator('.saved-item').count(),2);
 assert.deepEqual(external,[]);assert.deepEqual(errors,[]);
 console.log('PASS shared portal navigation, local-only assets, desktop/mobile layout, backup export/import, invalid-import preservation and reload persistence; zero external requests');
}finally{await browser.close();}
