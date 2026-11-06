import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_PLAN } from '../lib/types';
import { parsePlanBackup } from '../lib/storage';
const plan={id:'one',savedAt:'2026-11-06T00:00:00.000Z',quantity:'0.1',targetPrices:['101000','102000'],view:'professional',plan:structuredClone(DEFAULT_PLAN)};
test('plan backup round-trips full plan precision and accepts legacy array exports',()=>{
  assert.deepEqual(parsePlanBackup(JSON.stringify({version:1,plans:[plan]})),[plan]);
  assert.deepEqual(parsePlanBackup(JSON.stringify([plan])),[plan]);
});
test('invalid, duplicate, excessive and oversized backups are rejected as a whole',()=>{
  for(const value of [{version:2,plans:[plan]},[plan,{bad:true}],[plan,plan],Array.from({length:101},(_,i)=>({...plan,id:String(i)}))])assert.throws(()=>parsePlanBackup(JSON.stringify(value)));
  assert.throws(()=>parsePlanBackup(' '.repeat(2_000_001)));
});
