import { chromium } from 'playwright';
import assert from 'node:assert/strict';
const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']});
try{
 const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(process.env.TEST_URL||'http://127.0.0.1:3120/crypto/position-calculator/app/');await page.locator('.simple-workspace').waitFor();await page.waitForTimeout(200);
 await page.getByRole('button',{name:'按风险算仓位',exact:true}).click();
 for(const [label,value] of [['账户本金','10000'],['单笔风险比例','2'],['开仓价格','100'],['止损价格','90'],['杠杆倍数','1']])await page.getByLabel(label,{exact:true}).fill(value);
 assert.match(await page.getByTestId('risk-budget').innerText(),/200.00/);assert.match(await page.getByTestId('risk-notional').innerText(),/2,000.00/);assert.match(await page.getByTestId('risk-margin').innerText(),/2,000.00/);
 await page.getByLabel('杠杆倍数',{exact:true}).fill('5');assert.match(await page.getByTestId('risk-margin').innerText(),/400.00/);assert.match(await page.getByTestId('risk-notional').innerText(),/2,000.00/);
 await page.getByLabel('止损价格',{exact:true}).fill('98');assert.match(await page.getByTestId('risk-notional').innerText(),/10,000.00/);
 await page.getByRole('button',{name:'保存计划',exact:true}).click();await page.reload();await page.getByTestId('risk-margin').waitFor();assert.equal(await page.getByLabel('单笔风险比例',{exact:true}).inputValue(),'2');
 await page.getByRole('button',{name:'专业版',exact:true}).click();await page.getByRole('button',{name:'简易版',exact:true}).click();await page.getByTestId('risk-margin').waitFor();
 await page.getByRole('button',{name:'按保证金算止损',exact:true}).click();await page.getByTestId('stop-price').waitFor();await page.getByRole('button',{name:'已保存计划',exact:true}).click();await page.getByRole('dialog').getByRole('button',{name:'载入计划',exact:true}).click();await page.getByTestId('risk-margin').waitFor();
 await page.setViewportSize({width:390,height:844});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));assert.deepEqual(errors,[]);
 console.log('PASS account risk mode, amount/stop examples, leverage separation, preferences and saved-plan restoration, mode switches and mobile layout');
}finally{await browser.close();}
