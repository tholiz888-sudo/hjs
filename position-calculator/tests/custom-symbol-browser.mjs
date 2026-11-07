import { chromium } from 'playwright';
import assert from 'node:assert/strict';
const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']});
try{
 const page=await browser.newPage({viewport:{width:1440,height:1000}});const errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.goto(process.env.TEST_URL||'http://127.0.0.1:3118/crypto/position-calculator/app/');await page.locator('.simple-workspace').waitFor();await page.waitForTimeout(200);
 const select=page.getByLabel('交易标的',{exact:true}),input=page.getByLabel('自定义标的',{exact:true});
 await select.selectOption('CUSTOM');await input.fill('SQLUSDT');await page.getByRole('button',{name:'添加标的',exact:true}).click();
 assert.deepEqual(await select.locator('option').evaluateAll(options=>options.map(o=>o.value)),['BTCUSDT','ETHUSDT','saved:SQLUSDT','CUSTOM']);
 await select.selectOption('CUSTOM');assert.equal(await input.inputValue(),'');await input.fill('SOLUSDT');await page.getByRole('button',{name:'保存计划',exact:true}).click();
 await page.waitForFunction(()=>JSON.parse(localStorage.getItem('cpc:symbols:v1')||'[]').includes('SOLUSDT'));
 await select.selectOption('CUSTOM');await input.fill('sqlusdt');await page.getByRole('button',{name:'添加标的',exact:true}).click();assert.equal(await select.locator('option[value="saved:SQLUSDT"]').count(),1);
 await page.getByRole('button',{name:'新建计划',exact:true}).click();assert.equal(await select.locator('option').count(),5);
 await page.reload();await page.locator('.simple-workspace').waitFor();await page.waitForTimeout(200);await select.selectOption('saved:SQLUSDT');assert.equal(await input.inputValue(),'SQLUSDT');
 await page.getByRole('button',{name:'专业版',exact:true}).click();assert.equal(await select.inputValue(),'saved:SQLUSDT');await select.selectOption('CUSTOM');await input.fill('XRPUSDT');await page.getByRole('button',{name:'添加标的',exact:true}).click();
 await page.getByRole('button',{name:'简易版',exact:true}).click();assert.equal(await select.locator('option').last().getAttribute('value'),'CUSTOM');assert.equal(await select.locator('option[value="saved:XRPUSDT"]').count(),1);
 await page.setViewportSize({width:390,height:844});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));assert.deepEqual(errors,[]);
 console.log('PASS continuous custom-symbol additions, plan-save registration, deduplication, new-plan retention, reload persistence, shared simple/professional list and mobile layout');
}finally{await browser.close();}
