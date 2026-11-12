import test from 'node:test';
import assert from 'node:assert/strict';
import {wilderTrend} from '../lib/technical-filters';
import {analyze,defaults,simulate,validateParams,type Candle} from '../lib/engine';
import {compareFilters} from '../lib/filter-comparison';
test('Wilder ATR handles gaps, smooths recursively and ADX has correct warmup',()=>{
 const rows:Candle[]=[{datetime:'2026-11-12T00:00:00Z',open:100,high:101,low:99,close:100,volume:1},{datetime:'2026-11-12T00:01:00Z',open:109,high:110,low:108,close:109,volume:1},{datetime:'2026-11-12T00:02:00Z',open:110,high:113,low:109,close:112,volume:1},{datetime:'2026-11-12T00:03:00Z',open:112,high:114,low:110,close:113,volume:1}];
 const output=wilderTrend(rows,2);assert.deepEqual(output.atr,[null,null,7,5.5]);assert.deepEqual(output.adx,[null,null,null,100]);
 const flat=wilderTrend(rows.map(row=>({...row,open:100,high:100,low:100,close:100})),2);assert.deepEqual(flat.atr,[null,null,0,0]);assert.deepEqual(flat.adx,[null,null,null,0]);
});
test('enabled filters only remove signals, remain causal and defaults preserve the original direction rules',()=>{
 const rows=simulate(),baseline=analyze(rows,defaults),params={...defaults,adxEnabled:true,atrEnabled:true,deviationEnabled:true};
 const filtered=analyze(rows,params);for(let i=0;i<filtered.length;i++)if(filtered[i].direction!=='neutral')assert.equal(filtered[i].direction,baseline[i].direction);
 assert.deepEqual(analyze(rows.slice(0,600),params),filtered.slice(0,600));
 const restrictive=analyze(rows,{...defaults,deviationEnabled:true,deviationMaxAtr:.000001});assert.ok(restrictive.filter(row=>row.direction!=='neutral').length<baseline.filter(row=>row.direction!=='neutral').length);
 assert.deepEqual(analyze(rows,{...defaults,adxMin:100,atrMinPercent:20,atrMaxPercent:30,deviationMaxAtr:.000001}).map(row=>row.direction),baseline.map(row=>row.direction));
 assert.ok(validateParams({...defaults,atrMinPercent:1,atrMaxPercent:.5}));assert.ok(validateParams({...defaults,adxPeriod:1}));assert.ok(validateParams({...defaults,deviationMaxAtr:0}));
});
test('comparison keeps the same base settings and excludes unfinished windows',()=>{
 const report=compareFilters(simulate(),defaults),baseline=report.find(row=>row.id==='baseline')!,selected=report.find(row=>row.id==='selected')!;assert.equal(report.length,5);assert.equal(baseline.total,selected.total);assert.equal(baseline.successRate,selected.successRate);
 for(const row of report){assert.ok(row.total<=baseline.total);assert.equal(row.settled,row.wins+row.losses+row.flats);assert.ok(row.settled<=row.total);assert.ok(row.tailCount<=row.settled);}
});
