import {createHash} from 'node:crypto';
import {auditCompleteSet} from './complete-set.mjs';
import {createReadStream} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {StringDecoder} from 'node:string_decoder';

// Streaming RFC-style CSV reader: quoted commas/newlines and escaped quotes survive chunk boundaries.
export async function* csvRows(chunks) {
  const decoder=new StringDecoder('utf8');let field='',row=[],quoted=false,afterQuote=false,start=true,first=true;
  function* consume(text){for(let ch of text){if(first){first=false;if(ch==='\uFEFF')continue;}
    if(quoted){if(ch==='"'){quoted=false;afterQuote=true;}else field+=ch;continue;}
    if(afterQuote){if(ch==='"'){field+='"';quoted=true;afterQuote=false;continue;}if(![',','\r','\n'].includes(ch))throw Error('CSV引号后出现非法字符');afterQuote=false;}
    if(ch==='"'){if(!start)throw Error('CSV引号位置无效');quoted=true;start=false;}
    else if(ch===','){row.push(field);field='';start=true;}
    else if(ch==='\n'){row.push(field);if(row.some(x=>x!==''))yield row;row=[];field='';start=true;}
    else if(ch!=='\r'){field+=ch;start=false;}
    if(field.length>1024*1024||row.length>100)throw Error('CSV单元格或列数超限');
  }}
  for await(const chunk of chunks)yield* consume(typeof chunk==='string'?chunk:decoder.write(chunk));
  yield* consume(decoder.end());if(quoted)throw Error('CSV引号未闭合');
  if(field!==''||row.length){row.push(field);yield row;}
}
const supported=new Set(['TRADE','MERGE','REDEEM','SPLIT','DEPOSIT','WITHDRAWAL','MAKER_REBATE','TAKER_REBATE','REWARD']);
function number(value,name){const n=Number(value);if(value===''||!Number.isFinite(n)||n<0)throw Error(name+'无效');return n;}
export async function analyzeCSV(chunks) {
  let headers,raw=0,duplicates=0,duplicateMoney=0,minTime=Infinity,maxTime=-Infinity;
  const seen=new Set(),events=[],types={},money={},wallets=new Set();
  for await(const cells of csvRows(chunks)){
    if(!headers){headers=cells;if(!['timestamp','type','size','usdc_size','condition_id'].every(k=>headers.includes(k)))throw Error('请导入全部活动CSV，需timestamp/type/size/usdc_size/condition_id列');continue;}
    if(cells.length!==headers.length)throw Error(`CSV第${raw+2}行列数不一致`);
    if(++raw>500000)throw Error('最多支持50万行，请分段导入');
    const r=Object.fromEntries(headers.map((h,i)=>[h,cells[i]]));
    const hash=createHash('sha256').update(JSON.stringify(cells)).digest('hex');
    if(seen.has(hash)){duplicates++;duplicateMoney+=number(r.usdc_size,'金额');continue;}seen.add(hash);
    const t=number(r.timestamp,'时间'),q=number(r.size,'份额'),c=number(r.usdc_size,'金额');
    if(!supported.has(r.type))throw Error('未支持的活动类型：'+r.type+'，未自动猜测资金方向');
    if(r.type==='TRADE'&&!['BUY','SELL'].includes(r.side))throw Error('交易方向无效');
    if(['TRADE','REDEEM'].includes(r.type)&&!['Up','Down'].includes(r.outcome))throw Error('目前账本仅支持Up/Down结果');
    if(['TRADE','MERGE','REDEEM','SPLIT'].includes(r.type)&&!r.condition_id)throw Error('市场活动缺少condition_id');
    minTime=Math.min(minTime,t);maxTime=Math.max(maxTime,t);types[r.type]=(types[r.type]||0)+1;money[r.type]=(money[r.type]||0)+c;
    if(r.proxy_wallet)wallets.add(r.proxy_wallet);
    events.push({t,q,c,type:r.type,side:r.side,outcome:r.outcome,id:r.condition_id,slug:r.slug,title:r.title,hash:r.transaction_hash});
  }
  if(!raw)throw Error('没有活动记录');
  if(wallets.size>1)throw Error('包含多个钱包，请分开分析');
  events.sort((a,b)=>a.t-b.t);
  const markets=new Map();let buy=0,sell=0;
  for(const e of events){if(e.type==='TRADE'){if(e.side==='BUY')buy+=e.c;else sell+=e.c;}if(!e.id)continue;
    let p=markets.get(e.id);if(!p){p={id:e.id,slug:e.slug,title:e.title,up:0,down:0,buy:0,returned:0,cashPnl:0,first:e.t,last:e.t,firstBuy:{},types:{},minBalance:0,hasBuy:false,hasRedeem:false,preRedemptionAudit:null};markets.set(e.id,p);}
    p.last=e.t;p.types[e.type]=(p.types[e.type]||0)+1;
    const side=e.outcome?.toLowerCase();
    if(e.type==='TRADE'&&e.side==='BUY'){p[side]+=e.q;p.buy+=e.c;p.hasBuy=true;if(p.firstBuy[side]===undefined)p.firstBuy[side]=e.t;}
    if(e.type==='TRADE'&&e.side==='SELL'){p[side]-=e.q;p.returned+=e.c;}
    if(e.type==='SPLIT'){p.up+=e.q;p.down+=e.q;p.buy+=e.c;p.hasBuy=true;}
    if(e.type==='MERGE'){p.up-=e.q;p.down-=e.q;p.returned+=e.c;}
    if(e.type==='REDEEM'){p[side]-=e.q;p.returned+=e.c;p.hasRedeem=true;}
    p.cashPnl=p.returned-p.buy;
    if(!p.hasRedeem&&['TRADE','MERGE','SPLIT'].includes(e.type))p.preRedemptionAudit={time:new Date(e.t*1000).toISOString(),...auditCompleteSet({up:p.up,down:p.down,netCash:p.cashPnl})};
    p.minBalance=Math.min(p.minBalance,p.up,p.down);
  }
  const all=[...markets.values()];
  for(const p of all){const m=p.slug?.match(/-(5m|15m)-(\d+)$/);p.windowInside=Boolean(m&&Number(m[2])>=minTime&&Number(m[2])+({'5m':300,'15m':900}[m[1]])<=maxTime);p.reconciled=p.hasBuy&&Math.abs(p.up)<.02&&Math.abs(p.down)<.02;p.both=p.firstBuy.up!==undefined&&p.firstBuy.down!==undefined;p.lag=p.both?Math.abs(p.firstBuy.up-p.firstBuy.down):null;}
  const subset=all.filter(p=>p.windowInside&&p.reconciled&&p.minBalance>=-.02),wins=subset.filter(p=>p.cashPnl>1e-6),losses=subset.filter(p=>p.cashPnl< -1e-6);
  const sum=a=>a.reduce((v,p)=>v+p.cashPnl,0),lags=all.filter(p=>p.both).map(p=>p.lag).sort((a,b)=>a-b),mid=Math.floor(lags.length/2);
  const splitCost=money.SPLIT||0;
  const audited=all.filter(p=>p.both&&p.minBalance>=-.02&&p.preRedemptionAudit?.valid),residual=audited.filter(p=>p.preRedemptionAudit.residualShares>.02);
  const completeSetAudit={materialResidualThresholdShares:.02,auditedBothMarkets:audited.length,residualMarkets:residual.length,residualCostCovered:residual.filter(p=>p.preRedemptionAudit.residualCostCovered).length,residualStillAtRisk:residual.filter(p=>!p.preRedemptionAudit.covered).length,scope:'每市场首次赎回之前最后一条交易/合并后的样本内账本；残余统计仅计超过0.02份且未见显著负份额的市场；成本覆盖是正常结算假设下的下限，不是实际收益或永久无风险。'};
  return {completeSetAudit,rawRows:raw,uniqueRows:events.length,duplicates,duplicateMoney,types,money,wallets:[...wallets],from:new Date(minTime*1000).toISOString(),to:new Date(maxTime*1000).toISOString(),marketCount:all.length,buy,sell,netTradingCash:(money.MERGE||0)+(money.REDEEM||0)+sell-buy-splitCost,rebates:(money.MAKER_REBATE||0)+(money.TAKER_REBATE||0)+(money.REWARD||0),negativeInventoryMarkets:all.filter(p=>p.minBalance<-.02).length,bothMarkets:lags.length,medianFirstLegGapSeconds:lags.length?(lags.length%2?lags[mid]:(lags[mid-1]+lags[mid])/2):null,subset:{count:subset.length,wins:wins.length,losses:losses.length,flat:subset.length-wins.length-losses.length,winRate:subset.length?wins.length/subset.length:null,cashPnl:sum(subset),averageWin:wins.length?sum(wins)/wins.length:null,averageLoss:losses.length?sum(losses)/losses.length:null,best:subset.length?subset.reduce((v,p)=>Math.max(v,p.cashPnl),-Infinity):null,worst:subset.length?subset.reduce((v,p)=>Math.min(v,p.cashPnl),Infinity):null},markets:all,warnings:['全字段完全重复行保留一次；缺少log_index，不能排除真实同值事件。','净交易现金流不是账户净利润；近似闭合子样本不代表全量账户。','零回款赎回计入账本；不补造缺失活动或最终赢家。','逐时负份额可能源于期初仓位、同秒顺序或遗漏活动，已从严格子样本排除。']};
}
if(process.argv[1]===fileURLToPath(import.meta.url)){
  if(!process.argv[2])throw Error('用法：node ledger.mjs 全部活动.csv');
  console.log(JSON.stringify(await analyzeCSV(createReadStream(process.argv[2])),null,2));
}
