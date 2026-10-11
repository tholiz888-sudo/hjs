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
