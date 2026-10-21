import test from 'node:test';
import assert from 'node:assert/strict';
import {createApplication} from '../server/index.mjs';
async function setup(){const app=createApplication({dbPath:':memory:',autoMarket:false,adminEmails:'admin@example.local',adminPassword:'admin-test-password'});await new Promise(r=>app.server.listen(0,'127.0.0.1',r));const base=`http://127.0.0.1:${app.server.address().port}/api`;const call=async(path,method='GET',data,cookie='')=>{const r=await fetch(base+path,{method,headers:{'Content-Type':'application/json',Cookie:cookie},body:data?JSON.stringify(data):undefined});return {status:r.status,data:r.headers.get('content-type')?.startsWith('image/')?await r.arrayBuffer():await r.json(),cookie:r.headers.get('set-cookie')?.split(';')[0]};};const admin=(await call('/login','POST',{email:'admin@example.local',password:'admin-test-password'})).cookie,reader=await call('/register','POST',{email:'orders@example.local',password:'reader-test-password'});function seed(i,status='pending'){const id=i.toString(16).padStart(24,'0'),at=new Date(Date.now()-i*1000).toISOString();app.db.prepare('INSERT INTO member_orders(id,user_id,plan,amount,currency,days,status,reference,created,updated) VALUES(?,?,?,?,?,?,?,?,?,?)').run(id,reader.data.user.id,'monthly',9900,'CNY',30,status,'reference-'+i,at,at);return id;}return {app,call,admin,reader,seed};}

test('order management paginates and filters in SQL with admin authorization and literal search',async()=>{const {app,call,admin,reader,seed}=await setup();try{
 for(let i=1;i<=45;i++)seed(i,i===1?'submitted':i===2?'approved':'pending');
 assert.equal((await call('/admin/operations/orders')).status,401);assert.equal((await call('/admin/operations/orders','GET',null,reader.cookie)).status,403);
 const first=(await call('/admin/operations/orders','GET',null,admin)).data;assert.equal(first.total,45);assert.equal(first.items.length,20);assert.equal(first.pages,3);assert.equal(first.items[0].status,'submitted');
 const last=(await call('/admin/operations/orders?page=999','GET',null,admin)).data;assert.equal(last.page,3);assert.equal(last.items.length,5);
 const filtered=(await call('/admin/operations/orders?status=pending&pageSize=50','GET',null,admin)).data;assert.equal(filtered.total,43);assert.ok(filtered.items.every(o=>o.status==='pending'));assert.equal(filtered.counts.submitted,1);
 assert.equal((await call('/admin/operations/orders?q=reference-45','GET',null,admin)).data.total,1);
 assert.equal((await call('/admin/operations/orders?q=%25','GET',null,admin)).data.total,0);
 assert.equal((await call('/admin/operations/orders?q='+encodeURIComponent("' OR 1=1--"),'GET',null,admin)).data.total,0);
 assert.equal((await call('/admin/operations/orders?status=bogus','GET',null,admin)).status,400);assert.equal((await call('/admin/operations/orders?page=-1','GET',null,admin)).status,400);assert.equal((await call('/admin/operations/orders?pageSize=99999','GET',null,admin)).status,400);
 assert.equal('orders' in (await call('/admin/operations','GET',null,admin)).data,false);
 }finally{await app.close();}});

test('deleting unused orders is reversible, audited and blocks hidden-order submission and review',async()=>{const {app,call,admin,reader,seed}=await setup();try{
 const id=seed(1),rejected=seed(2,'rejected'),cancelled=seed(3,'cancelled');
 assert.equal((await call('/admin/operations/orders/'+id,'DELETE',null,reader.cookie)).status,403);
 assert.equal((await call('/admin/operations/orders/'+id,'DELETE',null,admin)).status,200);
 assert.equal((await call('/admin/operations/orders/'+id,'DELETE',null,admin)).status,409);
 assert.equal((await call('/admin/operations/orders','GET',null,admin)).data.total,2);
 const trash=(await call('/admin/operations/orders?deleted=1','GET',null,admin)).data;assert.equal(trash.total,1);assert.equal(trash.items[0].id,id);assert.ok(trash.items[0].deletedAt);
 assert.ok(!(await call('/membership','GET',null,reader.cookie)).data.orders.some(o=>o.id===id));
 assert.equal((await call('/membership/orders/'+id+'/submit','POST',{reference:'new-reference'},reader.cookie)).status,409);
 assert.equal((await call('/admin/operations/orders/'+id,'PATCH',{status:'approved'},admin)).status,409);
 assert.equal((await call('/admin/operations/orders/'+id+'/restore','POST',{},reader.cookie)).status,403);
 assert.equal((await call('/admin/operations/orders/'+id+'/restore','POST',{},admin)).status,200);
 assert.ok((await call('/membership','GET',null,reader.cookie)).data.orders.some(o=>o.id===id));
 assert.equal((await call('/admin/operations/orders/'+rejected,'DELETE',null,admin)).status,200);assert.equal((await call('/admin/operations/orders/'+cancelled,'DELETE',null,admin)).status,200);
 const events=app.db.prepare('SELECT action FROM admin_audit').all().map(r=>r.action);assert.equal(events.filter(s=>s==='delete-membership-order').length,3);assert.ok(events.includes('restore-membership-order'));
 }finally{await app.close();}});

test('paid/submitted orders cannot be deleted and archived proof remains private and auditable',async()=>{const {app,call,admin,reader,seed}=await setup();try{
 const paid=seed(1,'submitted');assert.equal((await call('/admin/operations/orders/'+paid,'DELETE',null,admin)).status,409);await call('/admin/operations/orders/'+paid,'PATCH',{status:'approved'},admin);const expires=app.operations.membership({id:reader.data.user.id,role:'regular'}).expiresAt;
 assert.equal((await call('/admin/operations/orders/'+paid,'DELETE',null,admin)).status,409);assert.equal(app.operations.membership({id:reader.data.user.id,role:'regular'}).expiresAt,expires);
 const rejected=seed(2,'rejected');app.db.prepare('INSERT INTO order_proofs VALUES(?,?,?,?,?)').run(rejected,'image/png',Buffer.from('private-proof-fixture'),'fixture-sha',new Date().toISOString());await call('/admin/operations/orders/'+rejected,'DELETE',null,admin);
 assert.equal((await call('/membership/orders/'+rejected+'/proof','GET',null,reader.cookie)).status,403);assert.equal((await call('/membership/orders/'+rejected+'/proof','GET',null,admin)).status,200);
 const detail=(await call('/admin/operations/orders/'+rejected,'GET',null,admin)).data.order;assert.ok(detail.deletedAt);assert.equal(detail.proofUrl,'/api/membership/orders/'+rejected+'/proof');assert.equal(detail.canDelete,false);
 }finally{await app.close();}});
