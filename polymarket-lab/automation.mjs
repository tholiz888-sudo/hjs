import {mkdir,readFile,writeFile,rename} from 'node:fs/promises';
import {dirname} from 'node:path';
import {config,replay} from './engine.mjs';
import {fetchBTC} from './signals.mjs';
import {replayFisher} from './fisher-paper.mjs';
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
  const rows=await remote('https://gamma-api.polymarket.com/markets?slug='+encodeURIComponent(slug));
  const m=Array.isArray(rows)&&rows.find(x=>x.slug===slug);
  // Require explicit final resolution, not merely a closed order book or a price near $1.
  if(!m || m.closed!==true || m.umaResolutionStatus!=='resolved' || Date.parse(m.endDate)>now)return null;
  const outcomes=decode(m.outcomes),prices=decode(m.outcomePrices);
  if(!Array.isArray(outcomes)||!Array.isArray(prices)||outcomes.length!==2||prices.length!==2)return null;
  const index=prices.findIndex(p=>Number(p)===1);
  if(index<0 || Number(prices[1-index])!==0)return null;
  const winner=String(outcomes[index]).toLowerCase();
  return ['up','down'].includes(winner)?winner:null;
}
export class Automation {
  constructor({file,remote,collect,now=()=>Date.now(),initialMode='paired'}) {
    Object.assign(this,{file,remote,collect,now});this.running=false;this.busy=false;this.timer=null;
    this.state={config:config(),mode:initialMode,candles:[],snapshots:[],markets:{},logs:[],lastRun:null};
    this.ready=this.load();
  }
  async load(){try{const s=JSON.parse(await readFile(this.file,'utf8'));if(s.mode==='fisher')replayFisher(s.snapshots,s.config,s.candles||[]);else replay(s.snapshots,s.config);this.state={mode:'paired',candles:[],...s};}catch(e){if(e.code!=='ENOENT')throw Error('自动记录读取失败，未覆盖原文件：'+e.message);}}
  log(message){this.state.logs.push({time:new Date(this.now()).toISOString(),message});this.state.logs=this.state.logs.slice(-100);}
  async save(){await mkdir(dirname(this.file),{recursive:true});await writeFile(this.file+'.tmp',JSON.stringify(this.state));await rename(this.file+'.tmp',this.file);}
  report(rows=this.state.snapshots){return this.state.mode==='fisher'?replayFisher(rows,this.state.config,this.state.candles):replay(rows,this.state.config);}
  async start(settings,mode=this.state.mode){await this.ready;if(!['paired','fisher'].includes(mode))throw Error('策略模式无效');if(this.state.snapshots.length&&mode!==this.state.mode)throw Error('已有记录不能切换策略，请使用独立数据目录');if(this.running||this.busy)throw Error('任务已运行或正在停止');if(this.state.snapshots.length && settings && JSON.stringify(config(settings))!==JSON.stringify(this.state.config))throw Error('已有记录不可更改资金与费率，请先导出并使用独立数据目录开启新实验');this.state.config=config(settings||this.state.config);this.state.mode=mode;this.running=true;this.log('启动持续模拟；无真实订单');try{await this.save();}catch(e){this.running=false;throw e;}this.tick();this.timer=setInterval(()=>this.tick(),30000);this.timer.unref();}
  stop(){this.running=false;clearInterval(this.timer);this.timer=null;}
  append(s){if(this.state.snapshots.some(x=>x.market===s.market&&x.time===s.time))return;const next=[...this.state.snapshots,s].sort((a,b)=>Date.parse(a.time)-Date.parse(b.time));this.report(next);this.state.snapshots=next;}
  async tick(){if(this.busy||!this.running)return;this.busy=true;
    try{
      if(this.state.snapshots.length>=4990){this.stop();throw Error('已达5000条安全上限，请导出记录；未删除任何历史仓位');}
      for(const [slug,m] of Object.entries(this.state.markets)) {
        if(!this.running)break;
        if(m.settled||Date.parse(m.end)>this.now())continue;
        try{const winner=await resolution(this.remote,slug,this.now());if(winner){const time=new Date(this.now()).toISOString();this.append({market:m.market,time,observedAt:time,end:m.end,up:[],down:[],winner});m.settled=true;this.log(slug+' 已确认结算 '+winner);}}catch(e){this.log('结算查询失败：'+e.message.slice(0,200));}
      }
      if(this.state.mode==='fisher'){
        const feed=await fetchBTC(this.remote,this.now());
        const merged=new Map(this.state.candles.map(c=>[c.time,c]));
        // Keep historical prefix immutable: late backfilled candles must not rewrite earlier paper decisions.
        const lastStored=this.state.candles.at(-1)?.time??-Infinity;
        for(const candle of feed.candles)if(candle.time>lastStored)merged.set(candle.time,candle);
        if(merged.size>20000){this.stop();throw Error('BTC蜡烛存储达到上限，已停止并保留记录');}
        this.state.candles=[...merged.values()].sort((a,b)=>a.time-b.time);
      }
      let slugs=await discover(this.remote,this.now());
      if(this.state.mode==='fisher')slugs=slugs.filter(slug=>slug.startsWith('btc-')&&Number(slug.split('-').at(-1))*1000<=this.now());
      if(!slugs.length)this.log('本次有限范围扫描未发现匹配市场；不表示全平台无机会');
      for(const slug of slugs){if(!this.running)break;try{const result=await this.collect(slug);this.append(result.snapshot);this.state.markets[slug]={...this.state.markets[slug],market:result.snapshot.market,end:result.snapshot.end};}catch(e){this.log('采集失败 '+slug+'：'+e.message.slice(0,200));}}
      this.state.lastRun=new Date(this.now()).toISOString();
    }catch(e){this.log(e.message.slice(0,400));}
    finally{try{await this.save();}catch(e){this.stop();this.log('保存失败，已停止：'+e.message);}this.busy=false;}
  }
  async status(){await this.ready;const report=this.report();return {mode:this.state.mode,latestCandle:this.state.candles?.at(-1)||null,running:this.running,busy:this.busy,lastRun:this.state.lastRun,count:this.state.snapshots.length,logs:this.state.logs,report};}
}
