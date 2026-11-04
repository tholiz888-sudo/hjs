import {mkdir,readFile,writeFile,rename,link} from 'node:fs/promises';
import {dirname,basename} from 'node:path';
import {randomUUID} from 'node:crypto';
import {config,replay} from './engine.mjs';
import {fetchBTC} from './signals.mjs';
import {replayFisher} from './fisher-paper.mjs';
import {diagnostics} from './diagnostics.mjs';
import {auditPortfolio} from './complete-set.mjs';
import {inventoryConfig,replayInventory} from './inventory-paper.mjs';
import {fetchSpot,currentBTCSlugs} from './inventory-model.mjs';
import {querySettlement} from './settlement.mjs';
const decode=x=>typeof x==='string'?JSON.parse(x):x;
export async function discover(remote,now=Date.now()) {
  const found=[];
  for(let page=0;page<3;page++) {
    const q=new URLSearchParams({active:'true',closed:'false',limit:'100',offset:String(page*100),order:'endDate',ascending:'true',end_date_min:new Date(now).toISOString(),end_date_max:new Date(now+3600000).toISOString()});
    const rows=await remote('https://gamma-api.polymarket.com/markets?'+q);
    if(!Array.isArray(rows))throw Error('市场发现接口格式异常');
    for(const m of rows) {
      const outcomes=decode(m.outcomes);
      if(/^(btc|eth|sol|xrp)-updown-(5m|15m)-\d+$/.test(m.slug||'') && Array.isArray(outcomes) && outcomes.length===2 && outcomes.some(x=>String(x).toLowerCase()==='up') && outcomes.some(x=>String(x).toLowerCase()==='down') && Date.parse(m.endDate)>now) found.push(m.slug);
    }
    if(rows.length<100)break;
  }
  return [...new Set(found)].slice(0,8);
}
export async function resolution(remote,slug,now=Date.now()) {
  const result=await querySettlement(remote,slug,now);return result.status==='resolved'?result.winner:null;
}
export class Automation {
  constructor({file,remote,collect,now=()=>Date.now(),initialMode='paired',initialInventoryVersion=2}) {
    Object.assign(this,{file,remote,collect,now});this.running=false;this.busy=false;this.timer=null;
    this.state={config:initialMode==='inventory'?inventoryConfig({inventoryVersion:initialInventoryVersion}):config(),mode:initialMode,candles:[],snapshots:[],markets:{},logs:[],lastRun:null};
    this.ready=this.load();
  }
  async load(){try{const s=JSON.parse(await readFile(this.file,'utf8'));if(s.mode==='inventory'&&s.config.inventoryVersion===undefined)s.config.inventoryVersion=1;if(s.mode==='inventory')replayInventory(s.snapshots,s.config);else if(s.mode==='fisher')replayFisher(s.snapshots,s.config,s.candles||[]);else replay(s.snapshots,s.config);this.state={mode:'paired',candles:[],...s};}catch(e){if(e.code!=='ENOENT')throw Error('自动记录读取失败，未覆盖原文件：'+e.message);}}
  log(message){this.state.logs.push({time:new Date(this.now()).toISOString(),message});this.state.logs=this.state.logs.slice(-100);}
  async save(){await mkdir(dirname(this.file),{recursive:true});await writeFile(this.file+'.tmp',JSON.stringify(this.state));await rename(this.file+'.tmp',this.file);}
  report(rows=this.state.snapshots){
    const cached=this.reportCache;if(cached&&cached.rows===rows&&cached.config===this.state.config&&cached.candles===this.state.candles)return cached.result;
    const result=this.state.mode==='inventory'?replayInventory(rows,this.state.config):this.state.mode==='fisher'?replayFisher(rows,this.state.config,this.state.candles):replay(rows,this.state.config);
    this.reportCache={rows,config:this.state.config,candles:this.state.candles,result};return result;
  }
  heldMarkets(){return new Set(this.report().positions.filter(p=>!p.settled&&(p.up>1e-8||p.down>1e-8||p.cost>1e-8)).map(p=>p.market));}
  async start(settings,mode=this.state.mode){await this.ready;if(!['paired','fisher','inventory'].includes(mode))throw Error('策略模式无效');if(this.state.snapshots.length&&mode!==this.state.mode)throw Error('已有记录不能切换策略，请使用独立数据目录');if(this.running||this.busy)throw Error('任务已运行或正在停止');if(this.state.snapshots.length && settings && JSON.stringify(config(settings))!==JSON.stringify(this.state.config))throw Error('已有记录不可更改资金与费率，请先导出并使用独立数据目录开启新实验');this.state.config=mode==='inventory'?inventoryConfig(settings||this.state.config):config(settings||this.state.config);this.state.mode=mode;this.running=true;this.log('启动持续模拟；无真实订单');try{await this.save();}catch(e){this.running=false;throw e;}this.tick();this.timer=setInterval(()=>this.tick(),mode==='inventory'?10000:30000);this.timer.unref();}
  stop(){this.running=false;clearInterval(this.timer);this.timer=null;}
  append(s){if(this.state.snapshots.some(x=>x.market===s.market&&x.time===s.time))return;const next=[...this.state.snapshots,s].sort((a,b)=>Date.parse(a.time)-Date.parse(b.time));this.report(next);this.state.snapshots=next;}
  async pollSettlements(force=false){
    const now=this.now(),held=this.heldMarkets();
    const due=Object.entries(this.state.markets).filter(([,m])=>!m.settled&&held.has(m.market)&&Date.parse(m.end)<=now&&(force||m.settlementLookupVersion!==2||!m.nextSettlementCheck||m.nextSettlementCheck<=now)).sort((a,b)=>(a[1].lastSettlementCheck||0)-(b[1].lastSettlementCheck||0));
    let checked=0,resolved=0;
    for(const [slug,m] of due.slice(0,4)){
      checked++;if(m.settlementLookupVersion!==2)m.settlementAttempts=0;m.settlementLookupVersion=2;m.lastSettlementCheck=this.now();m.settlementAttempts=(m.settlementAttempts||0)+1;
      try{const result=await querySettlement(this.remote,slug,this.now(),m.market);m.settlementObservation=result;
        if(result.status==='resolved'){const time=new Date(this.now()).toISOString();this.append({market:m.market,time,observedAt:time,end:m.end,up:[],down:[],winner:result.winner,settlementEvidence:result.evidence});m.settled=true;resolved++;this.log(slug+' 已确认结算 '+result.winner+'（'+result.evidence.field+'）');}
        else this.log('等待结算 '+slug+'：'+result.reason);
      }catch(error){m.settlementObservation={status:'unavailable',code:'REQUEST_FAILED',reason:error.message.slice(0,200),observedAt:new Date(this.now()).toISOString()};this.log('结算查询失败 '+slug+'：'+error.message.slice(0,200));}
      m.nextSettlementCheck=this.now()+Math.min(300000,30000*2**Math.min(m.settlementAttempts-1,4));
    }
    return {checked,resolved,pending:checked-resolved,remainingDue:Math.max(0,due.length-checked)};
  }
  async checkSettlements(){await this.ready;if(this.busy)throw Error('正在采集，请稍后再检查结算');this.busy=true;try{const result=await this.pollSettlements(true);await this.save();return result;}finally{this.busy=false;}}
  async newExperiment(confirmation){
    await this.ready;
    if(confirmation!=='确认开始新模拟实验')throw Error('需要确认归档并重置模拟账户');
    if(this.running||this.busy)throw Error('请先停止模拟任务，再开始新实验');
    this.busy=true;
    try{
      const report=this.report();if(this.heldMarkets().size||report.orders?.some(o=>['OPEN','PARTIAL'].includes(o.status)))throw Error('仍有未结算持仓或挂单，不能清空风险；先检查结算并导出记录');
      await this.save();
      const archive=this.file+'.archive-'+this.now()+'-'+randomUUID()+'.json';
      // Hard link is exclusive: preserve the complete old record before atomically replacing the active file.
      await link(this.file,archive);
      const previous=this.state;
      this.state={config:{...previous.config},mode:previous.mode,candles:[],snapshots:[],markets:{},logs:[],lastRun:null,experimentId:randomUUID(),previousArchive:basename(archive)};
      this.reportCache=null;this.log('新模拟实验：独立账户资金重置，旧结果已归档；不是真实入金或盈利。');
      try{await this.save();}catch(error){this.state=previous;this.reportCache=null;throw error;}
      return {archive:basename(archive),capital:this.state.config.capital,message:'旧记录已归档，新模拟账户已建立；需要手动启动，不影响实盘账户。'};
    }finally{this.busy=false;}
  }
  async tick(){if(this.busy||!this.running)return;this.busy=true;
    try{
      const before=this.state.snapshots.length;
      await this.pollSettlements();
      if(this.state.snapshots.length>=4990){
        this.state.lastSettlementRun=new Date(this.now()).toISOString();
        if(!this.state.collectionLimited){this.state.collectionLimited=true;this.log('已达采集上限，停止新行情与建仓，只核对已有持仓结算。');}
        if(this.heldMarkets().size===0){this.stop();this.log('采集已完成，当前没有未结算持仓。可导出记录并开始新模拟实验。');}
        return;
      }
      let spot=null;
      try{if(this.state.mode==='fisher'||this.state.mode==='inventory'){
        const feed=await fetchBTC(this.remote,this.now());
        const merged=new Map(this.state.candles.map(c=>[c.time,c]));
        // Keep historical prefix immutable: late backfilled candles must not rewrite earlier paper decisions.
        const lastStored=this.state.candles.at(-1)?.time??-Infinity;
        for(const candle of feed.candles)if(candle.time>lastStored)merged.set(candle.time,candle);
        if(merged.size>20000){this.stop();throw Error('BTC蜡烛存储达到上限，已停止并保留记录');}
        this.state.candles=[...merged.values()].sort((a,b)=>a.time-b.time);
        if(this.state.mode==='inventory')spot=await fetchSpot(this.remote,this.now());
      }}catch(error){if(this.state.mode!=='inventory')throw error;this.log('建仓行情不可用，仅尝试已有库存管理：'+error.message);}
      let slugs=this.state.mode==='inventory'?currentBTCSlugs(this.now()):await discover(this.remote,this.now());
      if(this.state.mode==='fisher')slugs=slugs.filter(slug=>slug.startsWith('btc-')&&Number(slug.split('-').at(-1))*1000<=this.now());
      if(!slugs.length)this.log('本次有限范围扫描未发现匹配市场；不表示全平台无机会');
      for(const slug of slugs){if(!this.running)break;try{const result=await this.collect(slug);if(this.state.mode==='inventory'){const start=Number(slug.split('-').at(-1))*1000;const anchor=this.state.candles.find(c=>c.time===start);result.snapshot.underlying=spot&&anchor?{spot:spot.price,spotTime:spot.time,reference:anchor.close,referenceTime:anchor.time,referenceSource:'coinbase-minute-proxy',candles:this.state.candles.slice(-32)}:null;}
        this.append(result.snapshot);this.state.markets[slug]={...this.state.markets[slug],market:result.snapshot.market,end:result.snapshot.end};}catch(e){this.log('采集失败 '+slug+'：'+e.message.slice(0,200));}}
      if(this.state.snapshots.length>before){const result=this.report();const event=result.events.at(-1);this.log(`本轮新增${this.state.snapshots.length-before}条；最近判断：${event?.action||'暂无'} · ${event?.detail||'暂无'}`);}
      this.state.lastRun=new Date(this.now()).toISOString();
    }catch(e){this.log(e.message.slice(0,400));}
    finally{try{await this.save();}catch(e){this.stop();this.log('保存失败，已停止：'+e.message);}this.busy=false;}
  }
  async status(){await this.ready;const report=this.report();const held=this.heldMarkets();return {collectionLimited:this.state.snapshots.length>=4990,collectionLimit:4990,unsettledHeldMarkets:held.size,lastSettlementRun:this.state.lastSettlementRun||null,experimentId:this.state.experimentId||null,settlementChecks:Object.entries(this.state.markets).filter(([,m])=>!m.settled&&held.has(m.market)&&Date.parse(m.end)<=this.now()).map(([slug,m])=>({slug,market:m.market,end:m.end,lastCheck:m.lastSettlementCheck||null,nextCheck:m.nextSettlementCheck||null,observation:m.settlementObservation||null})),inventoryVersion:this.state.mode==='inventory'?(this.state.config.inventoryVersion??1):null,intervalSeconds:this.state.mode==='inventory'?10:30,completeSetFloor:auditPortfolio({cash:report.cash,capital:report.config.capital,positions:report.positions}),diagnostics:diagnostics(this.state,report,this.now()),mode:this.state.mode,priceHistory:this.state.candles.slice(-60),latestCandle:this.state.candles?.at(-1)||null,running:this.running,busy:this.busy,lastRun:this.state.lastRun,count:this.state.snapshots.length,logs:this.state.logs,report};}
}
