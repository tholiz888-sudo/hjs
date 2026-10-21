import test from 'node:test';
import assert from 'node:assert/strict';
import {createApplication} from '../server/index.mjs';
import {createOkxRatios} from '../server/okx-ratios.mjs';
import {tdSequential} from '../server/indicators.mjs';

async function setup(options={}){
 let now=Date.now();const mail=[];
 const app=createApplication({autoMarket:false,dbPath:':memory:',adminEmails:'owner@example.local',adminPassword:'owner-test-password',clock:()=>now,sendMail:async m=>mail.push(m),...options});
 await new Promise(r=>app.server.listen(0,'127.0.0.1',r));
 const call=async(path,method='GET',data,cookie='',headers={})=>{const r=await fetch(`http://127.0.0.1:${app.server.address().port}/api`+path,{method,headers:{'Content-Type':'application/json',Cookie:cookie,...headers},body:data?JSON.stringify(data):undefined});return {status:r.status,data:await r.json(),cookie:r.headers.get('set-cookie')?.split(';')[0]};};
 const owner=await call('/login','POST',{email:'owner@example.local',password:'owner-test-password'}),reader=await call('/register','POST',{email:'reader@example.local',password:'reader-test-password'});
 return {app,call,owner:owner.cookie,reader,mail,advance:ms=>now+=ms};
}
const config={enabled:true,plans:[{id:'month',name:'月度',days:30,amount:9900,currency:'CNY'}],instructions:'核实交易凭证后开通',pointsCost:100,pointsDays:7};
test('membership review checks ownership, snapshots price, is idempotent and expires permissions',async()=>{
 const h=await setup();const {call,app,reader,owner,advance}=h;try{
 assert.equal((await call('/admin/operations')).status,401);
 assert.equal((await call('/admin/operations/settings/membership','PUT',config,reader.cookie)).status,403);
 assert.equal((await call('/admin/operations/settings/membership','PUT',config,owner)).status,200);
 const o=await call('/membership/orders','POST',{plan:'month',amount:1,days:9999},reader.cookie);
 assert.equal(o.status,200);
 assert.equal((await call('/membership/orders/'+o.data.id+'/submit','POST',{reference:'tx-owner'},owner)).status,409);
 await call('/membership/orders/'+o.data.id+'/submit','POST',{reference:'transaction-1'},reader.cookie);
 assert.equal((await call('/admin/operations/orders/'+o.data.id,'PATCH',{status:'approved'},reader.cookie)).status,403);
 assert.equal((await call('/admin/operations/orders/'+o.data.id,'PATCH',{status:'approved'},owner)).status,200);
 assert.equal((await call('/admin/operations/orders/'+o.data.id,'PATCH',{status:'approved'},owner)).status,409);
 const row=app.db.prepare('SELECT * FROM member_orders WHERE id=?').get(o.data.id);assert.equal(row.amount,9900);assert.equal(row.days,30);
 assert.equal((await call('/session','GET',null,reader.cookie)).data.user.role,'vip');
 advance(31*86400000);assert.equal(app.operations.membership({id:reader.data.user.id,role:'regular'}).active,false);
 }finally{await app.close();}
});
test('points membership redemption and activity are atomic and auditable',async()=>{const h=await setup();const {call,app,reader,owner}=h;try{
 await call('/admin/operations/settings/membership','PUT',config,owner);
 assert.equal((await call('/membership/redeem','POST',{},reader.cookie)).status,200);
 assert.equal((await call('/membership/redeem','POST',{},reader.cookie)).status,400);
 assert.equal(app.db.prepare('SELECT points FROM users WHERE id=?').get(reader.data.user.id).points,30);
 await call('/admin/operations/settings/activity','PUT',{enabled:true,cost:5,prizes:[{name:'固定奖',points:10,weight:1}]},owner);
 assert.equal((await call('/activity/draw','POST',{},reader.cookie)).data.prize.points,10);
 assert.equal((await call('/activity/draw','POST',{},reader.cookie)).status,409);
 assert.equal(app.db.prepare('SELECT points FROM users WHERE id=?').get(reader.data.user.id).points,35);
 assert.equal(app.db.prepare('SELECT count(*) n FROM activity_draws').get().n,1);
 assert.equal(app.db.prepare("SELECT count(*) n FROM points_ledger WHERE event_key LIKE 'draw:%'").get().n,1);
 }finally{await app.close();}});
test('password recovery hides account existence, consumes codes once and revokes sessions',async()=>{const {call,app,reader,mail}=await setup();try{
 const request=await call('/recovery/request','POST',{email:'reader@example.local'}),unknown=await call('/recovery/request','POST',{email:'unknown@example.local'});assert.deepEqual(request.data,unknown.data);
 const code=mail.at(-1).text.match(/\d{6}/)[0];
 assert.equal((await call('/recovery/reset','POST',{email:'reader@example.local',code:'000000',password:'new-test-password'})).status,400);
 assert.equal((await call('/recovery/reset','POST',{email:'reader@example.local',code,password:'new-test-password'})).status,200);
 assert.equal((await call('/session','GET',null,reader.cookie)).data.user,null);
 assert.equal((await call('/recovery/reset','POST',{email:'reader@example.local',code,password:'another-test-password'})).status,400);
 assert.equal((await call('/login','POST',{email:'reader@example.local',password:'new-test-password'})).status,200);
 }finally{await app.close();}});
test('external delivery respects verified address, consent, disabled accounts and deduplicates events',async()=>{const {call,app,reader,owner,mail,advance}=await setup();try{
 await call('/admin/operations/settings/services','PUT',{emailEnabled:true,telegramEnabled:false,aiEnabled:false,aiModel:'gpt-4.1-mini'},owner);
 await call('/preferences','PUT',{email:true,ma:true,inApp:false},reader.cookie);
 await call('/profile/email-code','POST',{email:'notify@example.local'},reader.cookie);
 const code=mail.at(-1).text.match(/\d{6}/)[0];await call('/profile/email-verify','POST',{email:'notify@example.local',code},reader.cookie);
 const event={userId:reader.data.user.id,title:'test',content:'test-body',topic:'ma',event:'unique-event'};
 app.operations.enqueue(event);app.operations.enqueue(event);assert.equal(app.db.prepare('SELECT count(*) n FROM delivery_jobs').get().n,1);
 await app.operations.drain();assert.equal(mail.at(-1).to,'notify@example.local');assert.equal(app.db.prepare('SELECT status FROM delivery_jobs').get().status,'sent');
 app.operations.enqueue({...event,event:'signal:expired'});advance(600001);const sent=mail.length;await app.operations.drain();assert.equal(mail.length,sent);assert.equal(app.db.prepare("SELECT status FROM delivery_jobs WHERE event_key='signal:expired'").get().status,'cancelled');
 app.operations.enqueue({...event,event:'disabled'});app.db.prepare('UPDATE users SET disabled=1 WHERE id=?').run(reader.data.user.id);await app.operations.drain();assert.equal(app.db.prepare("SELECT status FROM delivery_jobs WHERE event_key='disabled'").get().status,'cancelled');
 }finally{await app.close();}});
test('failed notification retries are bounded and never mark unsuccessful delivery sent',async()=>{let failMail=false;const h=await setup({sendMail:async()=>{if(failMail)throw new Error('network');}});const {call,app,reader,owner,advance}=h;try{
 await call('/admin/operations/settings/services','PUT',{emailEnabled:true,telegramEnabled:false,aiEnabled:false,aiModel:'gpt-4.1-mini'},owner);await call('/preferences','PUT',{email:true,ma:true},reader.cookie);
 app.db.prepare('INSERT INTO email_bindings VALUES(?,?,?)').run(reader.data.user.id,'verified@example.local',new Date().toISOString());failMail=true;
 app.operations.enqueue({userId:reader.data.user.id,title:'test',content:'body',event:'retry'});
 for(let i=0;i<5;i++){await app.operations.drain();advance(3600001);}
 const job=app.db.prepare('SELECT * FROM delivery_jobs').get();assert.equal(job.status,'failed');assert.equal(job.attempts,5);
 }finally{await app.close();}});
test('KOL consensus expires opinions and never uses reference rows in live API',async()=>{const {call,app,owner,advance}=await setup();try{
 assert.deepEqual((await call('/kol')).data.items,[]);const at=new Date().toISOString(),expiresAt=new Date(Date.now()+60000).toISOString();
 const items=[{id:'one',symbol:'BTC',trader:'A',direction:'bullish',weight:3,at,expiresAt,factors:['EMA']},{id:'two',symbol:'BTC',trader:'B',direction:'bearish',weight:1,at,expiresAt,factors:['volume']}];
 assert.equal((await call('/admin/operations/kol','POST',{items},owner)).status,200);
 const row=(await call('/kol')).data.items[0];assert.equal(row.bias,.5);assert.equal(row.confidence,50);assert.equal(row.decision,'看多');assert.equal(row.price,null);
 advance(61000);assert.deepEqual((await call('/kol')).data.items,[]);
 }finally{await app.close();}});
test('strategy tracking ignores pre-publication and unfinished bars; ambiguous bars stop conservatively',async()=>{const {app,call,owner,advance}=await setup();try{
 const sample={category:'major',symbol:'BTC',side:'long',entry:100,stop:90,targets:[110,120,130],status:'published',autoTrack:true};
 const r=await call('/admin/strategies','POST',sample,owner);assert.equal(r.status,200);const published=Date.parse(r.data.strategy.publishedAt),start=Math.ceil(published/300000)*300000;
 app.strategies.updateMarket({source:'okx',tickers:[],series:()=>[{timestamp:published-300000,low:80,high:150}]});assert.equal((await call('/strategies?category=major')).data.items[0].stopped,false);
 app.strategies.updateMarket({source:'okx',tickers:[],series:()=>[{timestamp:start,low:80,high:150}]});assert.equal((await call('/strategies?category=major')).data.items[0].stopped,false);
 advance(600001);app.strategies.updateMarket({source:'okx',tickers:[],series:()=>[{timestamp:start,low:80,high:150}]});const closed=(await call('/strategies?category=major')).data.items[0];assert.equal(closed.stopped,true);assert.equal(closed.ambiguousBar,true);assert.equal(closed.achieved,0);
 const tracked=app.db.prepare('SELECT payload FROM manual_strategies WHERE id=?').get(r.data.strategy.id);assert.equal(JSON.parse(tracked.payload).autoTrack,true);
 }finally{await app.close();}});
test('OKX ratio cache merges concurrent readers and derives proportions from genuine ratios',async()=>{let calls=0;const now=Date.now(),ratios=createOkxRatios({now:()=>now,sleep:async()=>{},get:async()=>{calls++;return Array.from({length:49},(_,i)=>[String(now-i*300000),String(2-i*.01)]);}});const [a,b]=await Promise.all([ratios.read([{symbol:'BTC',price:100}]),ratios.read()]);assert.equal(calls,10);assert.equal(a,b);assert.equal(a.items[0].longAccount,2/3);assert.equal(a.items[0].shortAccount,1/3);assert.ok(a.items[0].change4h>0);await ratios.read();assert.equal(calls,10);});
test('standard TD countdown waits for setup9 and cancels on opposite setup',()=>{const bars=Array.from({length:40},(_,i)=>({close:100-i*2,low:99-i*2,high:101-i*2})),r=tdSequential(bars);assert.equal(r[11].buyCountdown,0);assert.equal(r[12].buyCountdown,1);assert.equal(r[24].buyCountdown,13);assert.equal(r.at(-1).buyCountdown,13);const reverse=Array.from({length:20},(_,i)=>({close:30+i*3,low:29+i*3,high:31+i*3}));const end=tdSequential([...bars,...reverse]).at(-1);assert.equal(end.buyCountdown,0);assert.ok(end.sellCountdown>0);});

test('Telegram binds only through a signed private-chat webhook and invalidates start tokens',async()=>{
 const names=['TELEGRAM_BOT_TOKEN','TELEGRAM_WEBHOOK_SECRET','TELEGRAM_BOT_USERNAME'],before=names.map(n=>process.env[n]);
 process.env.TELEGRAM_BOT_TOKEN='test-bot-token';process.env.TELEGRAM_WEBHOOK_SECRET='test-webhook-secret';process.env.TELEGRAM_BOT_USERNAME='test_notifications_bot';
 let h;try{h=await setup();const {app,call,reader,owner}=h;await call('/admin/operations/settings/services','PUT',{emailEnabled:false,telegramEnabled:true,aiEnabled:false,aiModel:'gpt-4.1-mini'},owner);
 const link=await call('/telegram/binding','POST',{},reader.cookie),token=new URL(link.data.url).searchParams.get('start'),message={message:{chat:{id:123,type:'private'},text:'/start '+token}};
 assert.equal((await call('/telegram/webhook','POST',message)).status,401);
 assert.equal((await call('/telegram/webhook','POST',{message:{...message.message,chat:{id:123,type:'group'}}},'',{'x-telegram-bot-api-secret-token':'test-webhook-secret'})).status,200);
 assert.equal((await call('/telegram/binding','GET',null,reader.cookie)).data.bound,false);
 assert.equal((await call('/telegram/webhook','POST',message,'',{'x-telegram-bot-api-secret-token':'test-webhook-secret'})).status,200);
 assert.equal((await call('/telegram/binding','GET',null,reader.cookie)).data.bound,true);assert.equal(app.db.prepare('SELECT count(*) n FROM telegram_challenges').get().n,0);
 await call('/telegram/binding','DELETE',null,reader.cookie);await call('/telegram/webhook','POST',message,'',{'x-telegram-bot-api-secret-token':'test-webhook-secret'});assert.equal((await call('/telegram/binding','GET',null,reader.cookie)).data.bound,false);
 }finally{await h?.app.close();names.forEach((n,i)=>before[i]===undefined?delete process.env[n]:process.env[n]=before[i]);}
});
test('AI integration requires explicit enablement, limits usage and sends no account data',async()=>{
 const previous=process.env.OPENAI_API_KEY;process.env.OPENAI_API_KEY='test-key';let payload,h;
 try{h=await setup({operationsOptions:{fetcher:async(url,options)=>{assert.equal(url,'https://api.openai.com/v1/chat/completions');payload=JSON.parse(options.body);return {ok:true,json:async()=>({choices:[{message:{content:'EMA解释'}}]})};}}});const {call,owner,reader}=h;
 assert.equal((await call('/assistant/chat','POST',{question:'什么是EMA？'},reader.cookie)).status,503);
 await call('/admin/operations/settings/services','PUT',{emailEnabled:false,telegramEnabled:false,aiEnabled:true,aiModel:'test-model'},owner);
 assert.equal((await call('/assistant/chat','POST',{question:'什么是EMA？'})).status,401);
 assert.equal((await call('/assistant/chat','POST',{question:'什么是EMA？'},reader.cookie)).data.answer,'EMA解释');assert.equal(payload.model,'test-model');assert.ok(!JSON.stringify(payload).includes('reader@example.local'));
 for(let i=0;i<19;i++)assert.equal((await call('/assistant/chat','POST',{question:'说明指标'},reader.cookie)).status,200);
 assert.equal((await call('/assistant/chat','POST',{question:'说明指标'},reader.cookie)).status,429);
 }finally{await h?.app.close();if(previous===undefined)delete process.env.OPENAI_API_KEY;else process.env.OPENAI_API_KEY=previous;}
});

test('strategy target protection applies on the next closed candle and progress survives note edits',async()=>{const h=await setup();const {app,call,owner,advance}=h;try{
 const sample={category:'major',symbol:'BTC',side:'long',entry:100,stop:90,targets:[110,120,130],status:'published',autoTrack:true,protectAtEntry:true};
 const created=await call('/admin/strategies','POST',sample,owner),id=created.data.strategy.id,start=Math.ceil(Date.parse(created.data.strategy.publishedAt)/300000)*300000;
 advance(900001);const first={timestamp:start,open:100,close:108,high:112,low:95};app.strategies.updateMarket({source:'okx',tickers:[{symbol:'BTC',price:108}],series:()=>[first]});let r=(await call('/strategies?category=major')).data.items[0];assert.equal(r.achieved,1);assert.equal(r.stopped,false);assert.equal(r.protectionStop,100);
 await call('/admin/strategies/'+id,'PUT',{...sample,achieved:1,note:'只修改说明'},owner);r=(await call('/strategies?category=major')).data.items[0];assert.equal(r.evaluatedAt,new Date(start+300000).toISOString());
 app.strategies.updateMarket({source:'okx',tickers:[],series:()=>[first,{timestamp:start+300000,open:108,close:99,high:109,low:98}]});r=(await call('/strategies?category=major')).data.items[0];assert.equal(r.stopped,true);assert.equal(r.achieved,1);assert.equal(r.protectionStop,100);
 }finally{await app.close();}});

test('automatic short strategies validate ordering and stop assessment on missing history',async()=>{const {app,call,owner,advance}=await setup();try{
 const sample={category:'alt',symbol:'ETH',side:'short',entry:100,stop:110,targets:[90,80,70],status:'published',autoTrack:true};
 assert.equal((await call('/admin/strategies','POST',{...sample,stop:95},owner)).status,400);
 const created=await call('/admin/strategies','POST',sample,owner),start=Math.ceil(Date.parse(created.data.strategy.publishedAt)/300000)*300000;advance(1800001);
 app.strategies.updateMarket({source:'okx',tickers:[],series:()=>[{timestamp:start+900000,low:60,high:105}]});let r=(await call('/strategies?category=alt')).data.items[0];assert.equal(r.historyIncomplete,true);assert.equal(r.achieved,0);
 app.strategies.updateMarket({source:'okx',tickers:[],series:()=>Array.from({length:4},(_,i)=>({timestamp:start+i*300000,low:i===3?75:95,high:105}))});r=(await call('/strategies?category=alt')).data.items[0];assert.equal(r.historyIncomplete,false);assert.equal(r.achieved,2);assert.equal(r.stopped,false);
 }finally{await app.close();}});
