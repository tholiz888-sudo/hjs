import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import {createApplication} from '../server/index.mjs';
const app=createApplication({dbPath:':memory:',autoMarket:false,adminEmails:'owner@example.local',adminPassword:'owner-test-password'});
let browser;
try{
 await new Promise(r=>app.server.listen(0,'127.0.0.1',r));const base=`http://127.0.0.1:${app.server.address().port}`;
 browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});
 const admin=await browser.newContext(),customer=await browser.newContext(),errors=[];
 await admin.request.post(base+'/api/login',{data:{email:'owner@example.local',password:'owner-test-password'}});
 await customer.request.post(base+'/api/register',{data:{email:'customer@example.local',password:'customer-test-password'}});
 const page=await admin.newPage(),reader=await customer.newPage();for(const p of [page,reader])p.on('pageerror',e=>errors.push(e.message));
 await page.goto(base+'/admin');await page.getByRole('link',{name:'会员与服务',exact:true}).click();await page.getByRole('heading',{name:'会员、服务与活动管理'}).waitFor();
 const form=page.locator('[data-operations-form=config][data-key=membership]');await form.locator('[name=enabled]').check();await form.locator('[name=instructions]').fill('测试收款说明');await form.locator('[name=planId]').fill('month');await form.locator('[name=pointsCost]').fill('100');await form.locator('[name=pointsDays]').fill('7');await form.getByRole('button',{name:'保存配置'}).click();await page.getByText('已保存',{exact:true}).waitFor();
 await reader.goto(base+'/account');await reader.getByRole('button',{name:'会员与订单',exact:true}).click();await reader.getByText('测试收款说明',{exact:true}).waitFor();await reader.getByRole('button',{name:'创建订单',exact:true}).click();const proof=reader.locator('[data-operations-form=proof]');await proof.locator('[name=reference]').fill('proof-browser-123');await proof.getByRole('button',{name:'提交审核'}).click();await reader.getByText(/待审核/).waitFor();
 await page.reload();const review=page.locator('[data-operations-form=review]');await review.getByRole('button',{name:'确认审核'}).click();await page.getByText('审核已保存',{exact:true}).waitFor();await reader.locator('#modal [data-action=close-modal]').click();await reader.reload();await reader.locator('.account-name').filter({hasText:'VIP'}).waitFor();console.log('PASS customer order/proof → admin approval → VIP permission in real browser');
 await reader.goto(base+'/data/smart-money-v1?tab=kol');await reader.getByText('本站授权观点',{exact:true}).waitFor();assert.equal(await reader.locator('tbody tr').count(),0);console.log('PASS live KOL has no historical rows without an authorized source');
 await reader.goto(base+'/account/push-settings');await reader.getByRole('button',{name:'绑定／解除Telegram'}).click();await reader.getByText('尚未绑定',{exact:true}).waitFor();await reader.locator('#modal [data-action=close-modal]').click();
 await reader.goto(base+'/activities/fans');await reader.getByText('活动暂未开启。',{exact:true}).waitFor();
 await page.goto(base+'/admin?tab=market');await page.locator('summary').filter({hasText:'指标与监听参数'}).click();await page.locator('[name=config-supertrendMultiplier]').fill('4');await page.getByRole('button',{name:'保存并切换全站数据源'}).click();await page.waitForFunction(()=>document.querySelector('[name=config-supertrendMultiplier]')?.value==='4');const settings=await(await admin.request.get(base+'/api/admin/market')).json();assert.equal(settings.settings.config.supertrendMultiplier,4);
 await reader.goto(base+'/download');await reader.getByText(/支持安装为网页应用/).waitFor();assert.equal(await reader.locator('.error-panel').count(),0);
 await reader.setViewportSize({width:390,height:844});await reader.goto(base+'/account');await reader.getByRole('button',{name:'会员有效期与订单'}).click();assert.equal(await reader.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
 assert.deepEqual(errors,[]);console.log('PASS Telegram binding entry, disabled activity, indicator configuration, downloads and mobile membership dialog');
}finally{await browser?.close();await app.close();}
