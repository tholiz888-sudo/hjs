import test from 'node:test';
import assert from 'node:assert/strict';
import {createApplication} from '../server/index.mjs';

const image='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jgXcAAAAASUVORK5CYII=';
async function setup(){const app=createApplication({dbPath:':memory:',autoMarket:false,adminEmails:'owner@example.local',adminPassword:'owner-test-password'});await new Promise(r=>app.server.listen(0,'127.0.0.1',r));const base=`http://127.0.0.1:${app.server.address().port}/api`;const call=async(path,method='GET',data,cookie='')=>{const r=await fetch(base+path,{method,headers:{'Content-Type':'application/json',Cookie:cookie},body:data?JSON.stringify(data):undefined});return {status:r.status,data:r.headers.get('content-type')?.startsWith('image/')?new Uint8Array(await r.arrayBuffer()):await r.json(),cookie:r.headers.get('set-cookie')?.split(';')[0],cache:r.headers.get('cache-control')};};const owner=(await call('/login','POST',{email:'owner@example.local',password:'owner-test-password'})).cookie;const reader=await call('/register','POST',{email:'reader@example.local',password:'reader-test-password'});return {app,call,owner,reader};}
const config={enabled:true,plans:[{id:'monthly',name:'月度会员',days:30,amount:9900,currency:'CNY'}],instructions:'按账号转账后上传截图',paymentAccounts:[{label:'支付宝',account:'test@example.local',holder:'测试收款人',network:''}],pointsEnabled:true,redemptionTiers:[{id:'vip15',name:'15天VIP体验卡',days:15,points:960},{id:'vip1',name:'1天VIP体验卡',days:1,points:120}]};

test('enabled membership configuration rejects mismatched receiving currencies without changing the price',async()=>{const {app,call,owner}=await setup();try{const r=await call('/admin/operations/settings/membership','PUT',{...config,paymentAccounts:[{label:'USDT',account:'TEST',currency:'USDT'}]},owner);assert.equal(r.status,400);assert.match(r.data.error,/CNY/);const saved=(await call('/membership/plans')).data;assert.equal(saved.enabled,false);assert.equal(saved.plans[0].currency,'CNY');assert.equal(saved.plans[0].amount,9900);}finally{await app.close();}});

test('payment accounts are public, captured on orders, and screenshot access is restricted to owner/admin',async()=>{const {app,call,owner,reader}=await setup();try{
 assert.equal((await call('/admin/operations/settings/membership','PUT',config,owner)).status,200);
 assert.equal((await call('/membership/plans')).data.paymentAccounts[0].account,'test@example.local');
 const id=(await call('/membership/orders','POST',{plan:'monthly'},reader.cookie)).data.id;
 await call('/admin/operations/settings/membership','PUT',{...config,paymentAccounts:[{label:'银行转账',account:'NEW-ACCOUNT',holder:'新收款人'}]},owner);
 assert.equal((await call('/membership','GET',null,reader.cookie)).data.orders[0].paymentAccounts[0].account,'test@example.local');
 assert.equal((await call('/membership/orders/'+id+'/submit','POST',{image:'data:image/png;base64,PGh0bWw+c2NyaXB0PC9odG1sPg=='},reader.cookie)).status,400);
 const outsider=(await call('/demo','POST',{})).cookie;
 assert.equal((await call('/membership/orders/'+id+'/submit','POST',{image},outsider)).status,409);
 assert.equal((await call('/membership/orders/'+id+'/submit','POST',{image},reader.cookie)).status,200);
 assert.equal((await call('/membership/orders/'+id+'/proof')).status,401);
 assert.equal((await call('/membership/orders/'+id+'/proof','GET',null,outsider)).status,403);
 const proof=await call('/membership/orders/'+id+'/proof','GET',null,reader.cookie);assert.equal(proof.status,200);assert.ok(proof.data.length>12);assert.match(proof.cache,/no-store/);
 assert.equal((await call('/membership/orders/'+id+'/proof','GET',null,owner)).status,200);
 const order=(await call('/admin/operations','GET',null,owner)).data.orders[0];assert.equal(order.proofUrl,'/api/membership/orders/'+id+'/proof');assert.equal('image' in order,false);
 assert.equal((await call('/admin/operations/orders/'+id,'PATCH',{status:'approved'},owner)).status,200);
 const id2=(await call('/membership/orders','POST',{plan:'monthly'},reader.cookie)).data.id;await call('/membership/orders/'+id2+'/submit','POST',{image},reader.cookie);
 assert.equal((await call('/admin/operations/orders/'+id2,'PATCH',{status:'approved'},owner)).status,409);
 }finally{await app.close();}});

test('oversized receipts are rejected without submitting the order',async()=>{const {app,call,owner,reader}=await setup();try{
 await call('/admin/operations/settings/membership','PUT',config,owner);const id=(await call('/membership/orders','POST',{plan:'monthly'},reader.cookie)).data.id;
 const huge=Buffer.alloc(2*1024*1024+1,1);huge[0]=255;huge[1]=216;huge[2]=255;
 assert.equal((await call('/membership/orders/'+id+'/submit','POST',{image:'data:image/jpeg;base64,'+huge.toString('base64')},reader.cookie)).status,413);
 assert.equal((await call('/membership','GET',null,reader.cookie)).data.orders[0].status,'pending');
 }finally{await app.close();}});

test('tier redemption is independent of paid purchase and uses backend price with atomic deduction/extension',async()=>{const {app,call,owner,reader}=await setup();try{
 await call('/admin/operations/settings/membership','PUT',{...config,enabled:false},owner);
 const list=await call('/membership/redemption-tiers');assert.equal(list.data.enabled,true);assert.equal(list.data.items[0].points,960);
 assert.equal((await call('/membership/redeem','POST',{tier:'vip15',points:1},reader.cookie)).status,400);
 const result=await call('/membership/redeem','POST',{tier:'vip1',points:1,days:1000},reader.cookie);assert.equal(result.status,200);
 assert.equal((await call('/session','GET',null,reader.cookie)).data.user.points,10);assert.equal((await call('/session','GET',null,reader.cookie)).data.user.role,'vip');
 assert.ok(Date.parse(result.data.expiresAt)-Date.now()>86000000);assert.ok(Date.parse(result.data.expiresAt)-Date.now()<86500000);
 app.db.prepare('UPDATE users SET points=130 WHERE id=?').run(reader.data.user.id);
 const renewed=await call('/membership/redeem','POST',{tier:'vip1'},reader.cookie);assert.equal(Date.parse(renewed.data.expiresAt)-Date.parse(result.data.expiresAt),86400000);
 assert.equal((await call('/membership/redeem','POST',{tier:'missing'},reader.cookie)).status,400);
 await call('/admin/operations/settings/membership','PUT',{...config,pointsEnabled:false},owner);assert.equal((await call('/membership/redeem','POST',{tier:'vip1'},reader.cookie)).status,400);
 assert.equal(app.db.prepare("SELECT count(*) n FROM points_ledger WHERE reason LIKE '积分兑换：%'").get().n,2);
 }finally{await app.close();}});
