import {DatabaseSync} from 'node:sqlite';
import {mkdirSync} from 'node:fs';
import {dirname} from 'node:path';
import {randomUUID,createHash} from 'node:crypto';
import {createVenue,safeVenueError} from './live-sdk.mjs';
export class LiveInputError extends Error {constructor(message){super(message);this.name='LiveInputError';}}
export const LIVE_LIMITS=Object.freeze({total:25,perOrder:2,dailyWorstCase:5});
const units=n=>Math.ceil(n*1e6-1e-8);
export class LiveTrading {
  constructor({file,env=process.env,venueFactory=createVenue,now=()=>Date.now()}){
    Object.assign(this,{file,env,venueFactory,now});this.db=null;this.venuePromise=null;this.busy=false;
  }
  journal(){if(!this.db){mkdirSync(dirname(this.file),{recursive:true});this.db=new DatabaseSync(this.file);this.db.exec(`PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL;
    CREATE TABLE IF NOT EXISTS config (key TEXT PRIMARY KEY,value TEXT NOT NULL);
    INSERT OR IGNORE INTO config VALUES ('halted','0');
    CREATE TABLE IF NOT EXISTS intents (id TEXT PRIMARY KEY,payload TEXT NOT NULL,created INTEGER NOT NULL,expires INTEGER NOT NULL,status TEXT NOT NULL,reserve INTEGER NOT NULL,day TEXT NOT NULL,order_id TEXT,remote TEXT);
    UPDATE intents SET status='UNKNOWN' WHERE status='SUBMITTING';`);
    const wallet=this.env.POLY_FUNDER_ADDRESS?.toLowerCase();if(wallet){const prior=this.db.prepare("SELECT value FROM config WHERE key='wallet'").get();if(prior&&prior.value!==wallet){this.db.close();this.db=null;throw new LiveInputError('实盘账本已绑定其他资金账户');}this.db.prepare("INSERT OR IGNORE INTO config VALUES ('wallet',?)").run(wallet);}}return this.db;}
  checkConfigured(write=false){if(!this.env.LIVE_DATA_DIR)throw new LiveInputError('实盘需要LIVE_DATA_DIR指向保留记录的独立持久目录');
    if(!this.env.POLY_FUNDER_ADDRESS||!this.env.POLY_SIGNER_PRIVATE_KEY)throw new LiveInputError('尚未配置资金账户和安全签名授权；不要在网页或聊天中输入私钥');
    if(write&&this.env.LIVE_TRADING_ENABLED!=='1')throw new LiveInputError('真实提交未启用；LIVE_TRADING_ENABLED必须由账户持有人在环境设置中开启');}
  async venue(){if(!this.venuePromise)this.venuePromise=this.venueFactory(this.env).catch(e=>{this.venuePromise=null;throw e;});return this.venuePromise;}
  async lock(fn){if(this.busy)throw new LiveInputError('另一项实盘操作尚未完成，请勿重复提交');this.busy=true;try{return await fn();}finally{this.busy=false;}}
  day(){return new Date(this.now()+8*3600000).toISOString().slice(0,10);}
  budgets(){const db=this.journal(),charged="status IN ('SUBMITTING','UNKNOWN','ACCEPTED','CANCEL_PENDING','CANCELLED','FINAL')";return {totalReserved:Number(db.prepare(`SELECT COALESCE(SUM(reserve),0) AS n FROM intents WHERE ${charged}`).get().n)/1e6,dailyReserved:Number(db.prepare(`SELECT COALESCE(SUM(reserve),0) AS n FROM intents WHERE ${charged} AND day=?`).get(this.day()).n)/1e6};}
  status(){const configured={funder:Boolean(this.env.POLY_FUNDER_ADDRESS),signer:Boolean(this.env.POLY_SIGNER_PRIVATE_KEY),persistentDirectory:Boolean(this.env.LIVE_DATA_DIR),submissionEnabled:this.env.LIVE_TRADING_ENABLED==='1'};if(!configured.persistentDirectory)return {configured,limits:LIVE_LIMITS,halted:false,orders:[]};const db=this.journal();return {configured,limits:LIVE_LIMITS,budgets:this.budgets(),halted:db.prepare("SELECT value FROM config WHERE key='halted'").get().value==='1',orders:db.prepare('SELECT id,status,created,order_id,remote,payload FROM intents ORDER BY created DESC LIMIT 30').all().map(r=>({...r,payload:JSON.parse(r.payload),remote:r.remote?JSON.parse(r.remote):null}))};}
  async preflight(){this.checkConfigured();return (await this.venue()).preflight();}
  async build(input){
    const {slug,outcome,price,size}=input||{};
    const match=typeof slug==='string'&&slug.match(/^btc-updown-(5m|15m)-(\d+)$/);
    if(!match||!['up','down'].includes(outcome)||typeof price!=='number'||typeof size!=='number'||!Number.isFinite(price)||!Number.isFinite(size)||price<=0||price>=1||size<=0||size>100||Math.abs(size*100-Math.round(size*100))>1e-7)throw new LiveInputError('只支持BTC 5/15分钟市场、Up/Down和最多两位小数的正份额');
    const now=this.now(),start=Number(match[2])*1000,expectedEnd=start+(match[1]==='5m'?300000:900000);
    if(start>now||expectedEnd-now<210000)throw new LiveInputError('市场尚未开始或剩余时间不足210秒，不放置测试限价单');
    const m=await(await this.venue()).inspect(slug,outcome);
    if(m.slug!==slug||!m.active||Date.parse(m.end)!==expectedEnd||!Number.isFinite(m.timestamp)||now-m.timestamp>10000||m.timestamp-now>5000)throw new LiveInputError('市场状态、结束时间或盘口时间校验失败');
    if(!Number.isFinite(m.tick)||m.tick<=0||Math.abs(price/m.tick-Math.round(price/m.tick))>1e-7||price<m.tick||price>1-m.tick||!Number.isFinite(m.minSize)||size<m.minSize)throw new LiveInputError('价格步长或最小下单份额不满足平台要求；不会自动提高你的额度');
    if(m.bestAsk!==null&&(!Number.isFinite(m.bestAsk)||price>=m.bestAsk))throw new LiveInputError('首笔测试只允许post-only挂单，价格不能穿过当前卖一');
    if(!Number.isFinite(m.feeRate)||m.feeRate<0||m.feeRate>1||!Number.isFinite(m.feeExponent)||m.feeExponent<0||m.feeExponent>10)throw new LiveInputError('无法核验手续费参数');
    // Conservative platform taker-fee upper bound even though only maker post-only orders are permitted.
    const feeReserve=units(size*m.feeRate*(.25**m.feeExponent))/1e6;
    const reserve=units(size*price+feeReserve)/1e6;
    if(reserve>LIVE_LIMITS.perOrder)throw new LiveInputError('订单本金加手续费保守预留超过单笔2美元，不会自动提高限额');
    return {slug,outcome,price,size,title:m.title,conditionId:m.conditionId,assetId:m.assetId,reserve,feeReserve,postOnly:true,orderType:'GTD',expiration:Math.floor(now/1000)+190,marketEnd:m.end};
  }
  async preview(input){return this.lock(async()=>{this.checkConfigured();const p=await this.build(input),id=randomUUID(),now=this.now();this.journal().prepare('INSERT INTO intents(id,payload,created,expires,status,reserve,day) VALUES(?,?,?,?,?,?,?)').run(id,JSON.stringify(p),now,now+30000,'PREVIEW',units(p.reserve),this.day());return {previewId:id,expiresAt:new Date(now+30000).toISOString(),order:p,confirmation:'确认提交真实买单',limits:LIVE_LIMITS};});}
  async submit({previewId,confirmation}={}){return this.lock(async()=>{
    this.checkConfigured(true);if(confirmation!=='确认提交真实买单')throw new LiveInputError('需要逐笔确认真实订单');const db=this.journal();const row=db.prepare('SELECT * FROM intents WHERE id=?').get(previewId||'');
    if(!row||row.status!=='PREVIEW'||row.expires<this.now())throw new LiveInputError('预览已过期或已使用，不能重复提交');
    if(db.prepare("SELECT value FROM config WHERE key='halted'").get().value==='1')throw new LiveInputError('紧急停止已生效，禁止新单');
    if(db.prepare("SELECT COUNT(*) AS n FROM intents WHERE status IN ('UNKNOWN','SUBMITTING','ACCEPTED','CANCEL_PENDING')").get().n)throw new LiveInputError('已有未解决订单，先查询或撤单核对，禁止叠加风险');
    const original=JSON.parse(row.payload),fresh=await this.build(original);
    if(fresh.assetId!==original.assetId||fresh.reserve>original.reserve)throw new LiveInputError('合约或费用发生变化，请重新预览');
    const venue=await this.venue(),account=await venue.preflight();
    if(account.closedOnly)throw new LiveInputError('账户当前只允许平仓，拒绝买入');
    if(BigInt(account.balance)<BigInt(row.reserve))throw new LiveInputError('余额不足以覆盖本金与预留');
    const signed=await venue.sign({...original,expiration:fresh.expiration});
    if(String(signed.tokenId)!==String(original.assetId)||String(signed.maker).toLowerCase()!==this.env.POLY_FUNDER_ADDRESS.toLowerCase()||signed.side!=='BUY'||signed.postOnly!==true||signed.orderType!=='GTD'||signed.expiration!==fresh.expiration||BigInt(signed.makerAmount)>BigInt(units(original.price*original.size))||BigInt(signed.takerAmount)!==BigInt(units(original.size)))throw new LiveInputError('签名订单与预览不一致，未提交');
    const payload={...original,expiration:fresh.expiration,fingerprint:createHash('sha256').update(JSON.stringify({salt:signed.salt,timestamp:signed.timestamp,assetId:original.assetId})).digest('hex')};
    db.exec('BEGIN IMMEDIATE');try{if(row.expires<this.now())throw new LiveInputError('预览在验证期间过期，请重新核对');if(db.prepare("SELECT value FROM config WHERE key='halted'").get().value==='1')throw new LiveInputError('紧急停止已生效，未提交');const b=this.budgets();if(units(b.totalReserved)+row.reserve>units(LIVE_LIMITS.total)||units(b.dailyReserved)+row.reserve>units(LIVE_LIMITS.dailyWorstCase))throw new LiveInputError('累计25美元或北京时间每日5美元保守风险额度已达上限');
      const changed=db.prepare("UPDATE intents SET status='SUBMITTING',payload=?,day=? WHERE id=? AND status='PREVIEW'").run(JSON.stringify(payload),this.day(),previewId);if(changed.changes!==1)throw new LiveInputError('订单状态已改变');db.exec('COMMIT');}catch(e){db.exec('ROLLBACK');throw e;}
    try{const response=await venue.post(signed);
      if(response.ok===false){const rejected={code:String(response.code||'REJECTED')};db.prepare("UPDATE intents SET status='REJECTED',remote=? WHERE id=?").run(JSON.stringify(rejected),previewId);return {status:'REJECTED',...rejected};}
      if(response.ok!==true||typeof response.orderId!=='string'||!response.orderId)throw new LiveInputError('返回结果不确定');
      const result={orderId:response.orderId,status:response.status,makingAmount:response.makingAmount,takingAmount:response.takingAmount};db.prepare("UPDATE intents SET status='ACCEPTED',order_id=?,remote=? WHERE id=?").run(response.orderId,JSON.stringify(result),previewId);return {state:'ACCEPTED',...result};
    }catch(error){const safe=safeVenueError(error);db.prepare("UPDATE intents SET status='UNKNOWN',remote=? WHERE id=?").run(JSON.stringify(safe),previewId);return {status:'UNKNOWN',message:'发送结果不确定，可能已下单。已占用额度并阻止新单；不要重试，先在Polymarket核对。',error:safe};}
  });}
  async query(id){return this.lock(async()=>{this.checkConfigured();const db=this.journal(),row=db.prepare('SELECT * FROM intents WHERE id=?').get(id||'');if(!row?.order_id)throw new LiveInputError('没有可查询的订单ID；结果未知时请到平台核对');const result=await(await this.venue()).order(row.order_id);if(result.orderId!==row.order_id)throw new LiveInputError('订单身份校验失败');const final=['CANCELED','CANCELLED','EXPIRED'].includes(String(result.status).toUpperCase())||Number(result.sizeMatched)>=Number(result.originalSize)&&Number(result.originalSize)>0;db.prepare('UPDATE intents SET status=?,remote=? WHERE id=?').run(final?'FINAL':row.status==='CANCELLED'?'ACCEPTED':row.status,JSON.stringify(result),id);return result;});}
  async cancel(id){return this.lock(async()=>{this.checkConfigured();const db=this.journal(),row=db.prepare('SELECT * FROM intents WHERE id=?').get(id||'');if(!row?.order_id)throw new LiveInputError('只能撤销本程序已记录的订单');db.prepare("UPDATE intents SET status='CANCEL_PENDING' WHERE id=?").run(id);try{const result=await(await this.venue()).cancel(row.order_id);const confirmed=Array.isArray(result.canceled)&&result.canceled.includes(row.order_id);db.prepare('UPDATE intents SET status=?,remote=? WHERE id=?').run(confirmed?'CANCELLED':'CANCEL_PENDING',JSON.stringify({confirmed}),id);return {confirmed,message:confirmed?'平台已确认撤销，已成交部分仍然保留；预算不自动返还。':'撤销尚未确认，保留额度并阻止新单，请查询核对。'};}catch(error){return {confirmed:false,error:safeVenueError(error),message:'撤销结果未知，请查询或到平台核对，不能认为仓位已清空。'};}});}
  halt(){this.journal().prepare("UPDATE config SET value='1' WHERE key='halted'").run();return {halted:true,message:'已停止新单。不会自动卖出持仓，也不影响模拟任务；请逐单撤销并核对。'};}
  close(){this.db?.close();this.db=null;}
}
