import { chromium } from 'playwright';
import assert from 'node:assert/strict';
const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']});
try{
 const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(process.env.TEST_URL||'http://127.0.0.1:3121/crypto/position-calculator/app/');await page.locator('.simple-workspace').waitFor();await page.waitForTimeout(200);
 await page.getByRole('button',{name:'按风险算仓位',exact:true}).click();
 for(const [name,value] of [['账户本金','10000'],['单笔风险比例','2'],['开仓价格','100'],['止损价格','90'],['杠杆倍数','1']])await page.getByLabel(name,{exact:true}).fill(value);
 assert.match(await page.getByTestId('risk-margin').innerText(),/2,000.00/);
 await page.getByRole('button',{name:'专业版',exact:true}).click();assert.equal(await page.getByLabel('入场价格',{exact:true}).inputValue(),'100200');await page.getByLabel('入场价格',{exact:true}).fill('777');await page.getByLabel('止损价格',{exact:true}).fill('770');
 await page.getByRole('button',{name:'简易版',exact:true}).click();assert.equal(await page.getByLabel('开仓价格',{exact:true}).inputValue(),'100');assert.match(await page.getByTestId('risk-margin').innerText(),/2,000.00/);
 await page.getByRole('button',{name:'按保证金算止损',exact:true}).click();await page.getByRole('button',{name:'按账户比例',exact:true}).click();await page.getByLabel('投入保证金',{exact:true}).fill('2000');assert.match(await page.getByTestId('stop-price').innerText(),/90.00/);assert.equal(await page.getByLabel('单笔风险比例',{exact:true}).inputValue(),'2');
 await page.getByLabel('杠杆倍数',{exact:true}).fill('5');await page.getByLabel('投入保证金',{exact:true}).fill('400');assert.match(await page.getByTestId('stop-price').innerText(),/90.00/);
 await page.getByRole('button',{name:'保存计划',exact:true}).click();await page.reload();await page.getByTestId('stop-price').waitFor();await page.waitForTimeout(200);assert.equal(await page.getByLabel('投入保证金',{exact:true}).inputValue(),'400');assert.equal(await page.getByLabel('账户本金',{exact:true}).inputValue(),'10000');
 await page.getByRole('button',{name:'专业版',exact:true}).click();assert.equal(await page.getByLabel('入场价格',{exact:true}).inputValue(),'777');assert.equal(await page.getByLabel('止损价格',{exact:true}).inputValue(),'770');
 await page.reload();await page.locator('.workspace').waitFor();await page.waitForTimeout(200);assert.equal(await page.getByLabel('入场价格',{exact:true}).inputValue(),'777');
 await page.getByRole('button',{name:'简易版',exact:true}).click();assert.equal(await page.getByLabel('开仓价格',{exact:true}).inputValue(),'100');
 await page.getByRole('button',{name:'新建计划',exact:true}).click();await page.getByRole('button',{name:'已保存计划',exact:true}).click();await page.getByRole('dialog').getByRole('button',{name:'载入计划',exact:true}).click();assert.equal(await page.getByLabel('投入保证金',{exact:true}).inputValue(),'400');assert.equal(await page.getByLabel('单笔风险比例',{exact:true}).inputValue(),'2');
 await page.setViewportSize({width:390,height:844});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));assert.deepEqual(errors,[]);
 console.log('PASS independent version inputs across switches/reloads, 2% risk in both solve directions, leverage, saved inverse-percent plan restoration and mobile layout');
}finally{await browser.close();}
