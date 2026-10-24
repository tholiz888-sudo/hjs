const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),{spawnSync}=require('node:child_process');
test('captcha is independent per page, tolerates cookie changes and full-width digits, and rejects expiry/reuse',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'garden-captcha-'));
 try{const result=spawnSync(process.execPath,['-e',`
const assert=require('node:assert/strict'),store=require('./garden-community-store.cjs'),portal=require('./content-store.cjs');
const a='a'.repeat(64),b='b'.repeat(64),first=store.challenge(a),firstAnswer=store.captchaImage(first,a),second=store.challenge(a,true);
assert.notEqual(first,second);assert.equal(store.captchaImage(first,a),firstAnswer);assert.equal(store.captchaImage(first,b),firstAnswer);
const fullWidth=firstAnswer.split('').map(c=>String.fromCharCode(c.charCodeAt(0)+0xfee0)).join(' ');
const submitted=store.submitGuest(b,{nickname:'多页访客',body:'首张图在另一页刷新后仍然可用',captchaToken:first,captcha:fullWidth});assert.equal(submitted.status,'pending');assert.equal(store.captchaImage(first),null);
assert.throws(()=>store.submitGuest(a,{body:'验证码重放',captchaToken:first,captcha:firstAnswer}),/已失效/);
assert.equal(store.captchaImage(second),store.captchaImage(second,a));assert.throws(()=>store.submitGuest(a,{body:'提交间隔应继续生效',captchaToken:second,captcha:store.captchaImage(second)}),/过于频繁/);
const expired=store.challenge(b);portal.database().prepare('UPDATE garden_captcha SET expires=0 WHERE token=?').run(expired);assert.equal(store.captchaImage(expired),null);assert.throws(()=>store.submitGuest(b,{body:'过期验证码',captchaToken:expired,captcha:'1234'}),/已失效/);
const wrong=store.challenge(b);for(let i=0;i<5;i++)assert.throws(()=>store.submitGuest(b,{body:'错误验证码',captchaToken:wrong,captcha:'0000'}),/不一致/);assert.equal(store.captchaImage(wrong),null);assert.throws(()=>store.submitGuest(b,{body:'次数过多',captchaToken:wrong,captcha:'0000'}),/已失效/);
assert.equal(store.users().total,0);console.log('PASS captcha per-page isolation, cookie changes, normalized digits, single use, expiry, attempt limit, rate limit and no fake accounts');
`],{cwd:path.resolve(__dirname,'..'),env:{...process.env,PORTAL_DB_PATH:path.join(dir,'content.sqlite')},encoding:'utf8'});assert.equal(result.status,0,result.stdout+result.stderr)}finally{fs.rmSync(dir,{recursive:true,force:true})}
});
