import test from 'node:test';
import assert from 'node:assert/strict';
import {parseBinanceResponse} from '../server/binance-response.mjs';
test('Binance retry guidance handles JSON, HTML, absolute bans and HTTP dates',()=>{const now=Date.UTC(2026,9,16);for(const [input,delay] of [[{status:418,body:'<html>blocked</html>',headers:'Retry-After: 3600'},3605000],[{status:429,body:'{}',headers:'Retry-After: '+new Date(now+600000).toUTCString()},605000],[{status:418,body:JSON.stringify({msg:`IP banned until ${now+7200000}`})},7205000],[{status:418,body:'invalid'},1800000]])assert.throws(()=>parseBinanceResponse({...input,now}),e=>e.code==='RATE_LIMITED'&&e.retryAfterMs===delay);assert.deepEqual(parseBinanceResponse({status:200,body:'[]'}),[])});
