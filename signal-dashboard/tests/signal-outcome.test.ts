import test from 'node:test';
import assert from 'node:assert/strict';
import {signalOutcome} from '../lib/signal-outcome';
const rows=Array.from({length:12},(_,i)=>({datetime:new Date(Date.UTC(2026,10,12,0,i)).toISOString(),open:100,high:110,low:90,close:i===10?105:100,volume:10}));
test('directional outcome compares the signal close to the exact close ten minutes later',()=>{
 const bull=signalOutcome(rows,0,'bullish');assert.equal(bull.status,'success');assert.equal(bull.price,105);assert.equal(bull.changePercent,5);assert.equal(bull.dueAt,'2026-11-12T00:11:00.000Z');assert.equal(signalOutcome(rows,0,'bearish').status,'failure');
 const lower=rows.map((row,i)=>({...row,close:i===10?95:row.close}));assert.equal(signalOutcome(lower,0,'bearish').status,'success');assert.equal(signalOutcome(lower,0,'bullish').status,'failure');
 assert.equal(signalOutcome(rows.map(row=>({...row,close:100})),0,'bullish').status,'flat');
});
test('pending and missing observations never use a later price or future information',()=>{
 assert.equal(signalOutcome(rows.slice(0,10),0,'bullish').status,'pending');
 const gap=signalOutcome(rows.filter((_,i)=>i!==10),0,'bullish');assert.equal(gap.status,'missing');assert.equal(gap.price,null);
 assert.equal(signalOutcome(rows,11,'bearish').status,'pending');assert.equal(signalOutcome(rows,-1,'bullish').status,'missing');
});
