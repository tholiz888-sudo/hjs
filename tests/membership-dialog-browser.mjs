import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import {createApplication} from '../server/index.mjs';
const app=createApplication({dbPath:':memory:',autoMarket:false,adminEmails:'dialog@example.local',adminPassword:'dialog-test-password'});
let browser;
try{
 await new Promise(r=>app.server.listen(0,'127.0.0.1',r));const base=`http://127.0.0.1:${app.server.address().port}`;
 browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']});const context=await browser.newContext();await context.request.post(base+'/api/login',{data:{email:'dialog@example.local',password:'dialog-test-password'}});
 const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 // Shorten the real timeout only in this controlled browser fixture.
 await page.addInitScript(()=>{const timeout=AbortSignal.timeout.bind(AbortSignal);AbortSignal.timeout=ms=>timeout(ms===20000?1000:ms);});
 const plans={enabled:true,plans:[{id:'monthly',name:'月度会员',days:30,amount:9900,currency:'CNY'}],paymentAccounts:[{label:'USDT',account:'TEST-ACCOUNT',currency:'USDT',holder:'测试',network:'TRC20'}],pointsEnabled:true};
 await page.route('**/api/membership/plans',route=>route.fulfill({json:plans}));
 await page.goto(base+'/account');await page.getByRole('button',{name:'会员与订单',exact:true}).click();await page.getByText(/未配置 CNY 收款账号/).waitFor();assert.equal(await page.getByRole('button',{name:'创建订单',exact:true}).isDisabled(),true);
 await page.getByRole('button',{name:'管理套餐与收款账号'}).click();await page.waitForURL(base+'/admin?tab=operations');await page.locator('.admin-nav').waitFor();assert.equal(await page.locator('dialog[open]').count(),0);console.log('PASS mismatched CNY/USDT config explains disabled purchase and links admin to settings');
 let hang=true;await page.route('**/api/membership',route=>{if(!hang)return route.continue();});await page.goto(base+'/account');await page.getByRole('button',{name:'会员与订单',exact:true}).click();await page.getByText(/会员请求超时/).waitFor();await page.getByRole('button',{name:'重新加载',exact:true}).waitFor();hang=false;await page.getByRole('button',{name:'重新加载',exact:true}).click();await page.getByText(/未配置 CNY 收款账号/).waitFor();console.log('PASS stalled membership fetch has bounded timeout, visible error and working retry');
 await page.locator('#modal [data-action=close-modal]').click();plans.plans[0].currency='USDT';let posts=0;await page.route('**/api/membership/orders',async route=>{posts++;await new Promise(r=>setTimeout(r,300));await route.fulfill({json:{id:'fixture'}});});await page.getByRole('button',{name:'会员与订单',exact:true}).click();const create=page.getByRole('button',{name:'创建订单',exact:true});await create.click();await page.getByRole('button',{name:'正在创建…',exact:true}).waitFor();assert.equal(await page.getByRole('button',{name:'正在创建…',exact:true}).isDisabled(),true);await page.locator('[data-action=member-order]').evaluate(el=>el.click());await page.getByRole('button',{name:'创建订单',exact:true}).waitFor();assert.equal(posts,1);assert.deepEqual(errors,[]);console.log('PASS pending creation shows progress and prevents duplicate clicks');
}finally{await browser?.close();await app.close();}
