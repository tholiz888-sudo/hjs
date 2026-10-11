const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),crypto=require('node:crypto');
const {spawn}=require('node:child_process');
test('authenticated journal CRUD, isolation and atomic imports',async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'hjs-api-'));
 const port=15000+crypto.randomInt(10000),base=`http://127.0.0.1:${port}`;
 const child=spawn(process.execPath,['server.js'],{cwd:path.join(__dirname,'..'),env:{...process.env,PORT:String(port),DATA_DIR:dir,COOKIE_SECURE:'0'},stdio:['ignore','pipe','pipe']});
 try{
  await new Promise((resolve,reject)=>{const timeout=setTimeout(()=>reject(Error('Startup timeout')),5000);child.stdout.once('data',()=>{clearTimeout(timeout);resolve()});child.once('exit',()=>{clearTimeout(timeout);reject(Error('Server exited'))})});
  async function req(p,method='GET',data,cookie){const r=await fetch(base+p,{method,headers:{'Content-Type':'application/json',...(cookie?{Cookie:cookie}:{})},body:data?JSON.stringify(data):undefined});return {status:r.status,body:await r.text().then(t=>{try{return JSON.parse(t)}catch{return t}}),cookie:r.headers.get('set-cookie')?.split(';')[0]}}
  const publicData=await req('/api/dataset');assert.equal(publicData.status,200);assert.equal(publicData.body.records.length,4806);assert.equal(publicData.body.metadata.pairs,128);
  const password=crypto.randomBytes(20).toString('hex');
  const a=await req('/api/register','POST',{email:'a@example.com',password});assert.equal(a.status,201);assert.equal(a.body.user.role,'member');
  const b=await req('/api/register','POST',{email:'b@example.com',password});
  const row={pair:'BTC-USDT-SWAP',direction:'多',profit:100,opened:'2026-10-01T10:00:00+08:00',closed:'2026-10-01T11:00:00+08:00',return_rate:5,entry_price:60000};
  const created=await req('/api/records','POST',row,a.cookie);assert.equal(created.status,201);
  assert.equal((await req('/api/records')).status,401);
  assert.equal((await req('/api/admin/users','GET',null,a.cookie)).status,403);
  assert.equal((await req('/api/records','GET',null,b.cookie)).body.records.length,0);
  assert.equal((await req('/api/records/'+created.body.id,'PUT',row,b.cookie)).status,404);
  assert.equal((await req('/api/records/'+created.body.id,'DELETE',null,b.cookie)).status,404);
  assert.equal((await req('/api/records/'+created.body.id,'PUT',{...row,profit:20},a.cookie)).status,200);
  assert.equal((await req('/api/records','GET',null,a.cookie)).body.records[0].profit,20);
  assert.equal((await req('/api/records','POST',{...row,profit:''},a.cookie)).status,400);
  assert.equal((await req('/api/records','POST',{...row,closed:'2020-01-01'},a.cookie)).status,400);
  assert.equal((await req('/api/records/import','POST',{records:[row,{...row,pair:'bad'}]},a.cookie)).status,400);
  assert.equal((await req('/api/records','GET',null,a.cookie)).body.records.length,1);
  const imported=await req('/api/records/import','POST',{records:[row,{...row,profit:-30}]},a.cookie);assert.equal(imported.status,201);assert.equal(imported.body.count,2);
  assert.equal((await req('/api/records','GET',null,a.cookie)).body.records.length,3);
  assert.equal((await req('/.local/dashboard.sqlite')).status,404);
  assert.equal((await req('/api/records/'+created.body.id,'DELETE',null,a.cookie)).status,200);
  await req('/api/logout','POST',null,a.cookie);
  assert.equal((await req('/api/records','GET',null,a.cookie)).status,401);
  assert.equal((await req('/api/login','POST',{email:'a@example.com',password})).status,200);
 }finally{child.kill();await new Promise(resolve=>child.exitCode!==null?resolve():child.once('exit',resolve));fs.rmSync(dir,{recursive:true,force:true})}
});
