const {test}=require('node:test'),assert=require('node:assert/strict');const {historicalCandles}=require('../market.cjs');
const start=1653390000000,end=start+5*60000;
test('historical adapter restricts upstream and filters/sorts confirmed OHLC data',async()=>{
 let called=0;const result=await historicalCandles({pair:'BTC-USDT-SWAP',period:5,start,end},async url=>{called++;assert.equal(url.hostname,'www.okx.com');assert.equal(url.searchParams.get('bar'),'5m');return {ok:true,json:async()=>({code:'0',data:[[String(end),'100','110','90','105','12'],[String(start),'99','105','95','100','10'],[String(start-300000),'98','100','90','99','7']]})}});
 assert.equal(called,1);assert.equal(result.candles.length,2);assert.equal(result.candles[0].time,start);assert.equal(result.partial,false);
});
test('historical adapter rejects invalid parameters, HTTP failures and malformed candles',async()=>{
 await assert.rejects(historicalCandles({pair:'http://evil',period:5,start,end}),/参数/);
 await assert.rejects(historicalCandles({pair:'BTC-USDT-SWAP',period:5,start,end},async()=>({ok:false,status:403})),/403/);
 await assert.rejects(historicalCandles({pair:'BTC-USDT-SWAP',period:5,start,end},async()=>({ok:true,json:async()=>({code:'0',data:[[String(start),'100','80','90','105','12']]})})),/无效/);
});
test('local network failures use fixed HTTPS relay without credentials or recursive forwarding',async()=>{
 const {candlesWithFallback}=require('../market.cjs');let calls=0;
 const result=await candlesWithFallback({pair:'BTC-USDT-SWAP',period:5,start,end},{allowRelay:true,fetcher:async(url,options)=>{calls++;if(calls===1)throw Error('fetch failed');assert.equal(url.hostname,'hjs-fqyj.onrender.com');assert.equal(url.pathname,'/api/candles');assert.deepEqual(options.headers,{'X-HJS-Market-Relay':'1'});assert.equal(options.redirect,'error');return {ok:true,json:async()=>({candles:[{pair:'BTC-USDT-SWAP',time:start,open:100,high:110,low:90,close:105,volume:12}],partial:false})}}});assert.equal(calls,2);assert.equal(result.candles.length,1);
 let disabledCalls=0;await assert.rejects(candlesWithFallback({pair:'BTC-USDT-SWAP',period:5,start,end},{allowRelay:false,fetcher:async()=>{disabledCalls++;throw Error('fetch failed')}}));assert.equal(disabledCalls,1);
});
test('relay cannot turn invalid requests or invalid returned prices into successful candles',async()=>{
 const {candlesWithFallback}=require('../market.cjs');let calls=0;
 await assert.rejects(candlesWithFallback({pair:'bad',period:5,start,end},{allowRelay:true,fetcher:async()=>{calls++;throw Error()}}),/参数/);assert.equal(calls,0);
 await assert.rejects(candlesWithFallback({pair:'BTC-USDT-SWAP',period:5,start,end},{allowRelay:true,fetcher:async()=>{if(++calls===1)throw Error('fetch failed');return {ok:true,json:async()=>({candles:[{pair:'BTC-USDT-SWAP',time:start,open:100,high:80,low:90,close:105,volume:12}]})}}}),/备用通道/);
});
