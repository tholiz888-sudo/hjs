const {test}=require('node:test'),assert=require('node:assert/strict');
const dataset=require('../data/trades.json');
test('full workbook dataset preserves fields and reproduces screenshot statistics',()=>{
 const rows=dataset.records;assert.equal(rows.length,4806);assert.equal(new Set(rows.map(r=>r.pair)).size,128);assert.equal(new Set(rows.map(r=>r.id)).size,4806);
 const total=rows.reduce((s,r)=>s+r.profit,0);assert.ok(Math.abs(total-4810519.43356)<.00001);
 assert.equal(rows.filter(r=>r.profit>0).length,1771);assert.equal(rows.filter(r=>r.profit<0).length,3034);assert.equal(rows.filter(r=>r.profit===0).length,1);
 assert.equal(Math.max(...rows.map(r=>r.profit)),1178239);assert.equal(Math.min(...rows.map(r=>r.profit)),-78786);
 assert.equal(rows.filter(r=>!r.closed).length,11);assert.equal(dataset.metadata.end,'2024-06-21T21:51:00+08:00');
 for(const r of rows){assert.ok(Math.abs(r.profit-r.gross_profit-r.fee)<.000001);assert.ok(Number.isFinite(Date.parse(r.opened)));if(r.closed)assert.ok(Date.parse(r.closed)>=Date.parse(r.opened));assert.ok(Number.isFinite(r.net_return_rate))}
 const first=rows[0];assert.equal(first.gross_profit,-6.3);assert.equal(first.fee,-18.8);assert.equal(first.profit,-25.1);assert.equal(first.original_cumulative,-25.1);
 const averageDuration=rows.reduce((v,r)=>v+(r.closed?(Date.parse(r.closed)-Date.parse(r.opened))/60000:0),0)/rows.length;assert.equal(averageDuration.toFixed(2),'101.87');
 const win=rows.filter(r=>r.profit>0),loss=rows.filter(r=>r.profit<0);const ratio=(win.reduce((s,r)=>s+r.profit,0)/win.length)/(-loss.reduce((s,r)=>s+r.profit,0)/loss.length);assert.equal(ratio.toFixed(2),'3.44');
 assert.equal((rows.reduce((s,r)=>s+r.net_return_rate,0)/rows.length).toFixed(2),'2.09');
});
