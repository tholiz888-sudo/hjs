import {config,validate,fill} from './engine.mjs';
import {signals} from './signals.mjs';
export function replayFisher(input,settings={},candles=[]) {
  const c=config(settings),rows=validate(input),indicator=signals(candles,settings),positions=new Map(),events=[];
  const maxEntry=settings.maxEntry??.65,maxHoldSeconds=settings.maxHoldSeconds??120,hedgeSeconds=settings.hedgeSeconds??30,maxHedgeLoss=settings.maxHedgeLoss??10,maxDailyLoss=settings.maxDailyLoss??25;
  for(const [k,v] of Object.entries({maxEntry,maxHoldSeconds,hedgeSeconds,maxHedgeLoss,maxDailyLoss}))if(!Number.isFinite(v)||v<0)throw Error(k+'无效');
  if(maxEntry>1)throw Error('maxEntry不能超过1');
  let cash=c.capital,realized=0,spent=0,index=-1;const daily={};
  const openRisk=()=>[...positions.values()].reduce((sum,p)=>sum+p.cost,0);
  for(const s of rows){let p=positions.get(s.market);if(!p){p={market:s.market,end:s.endMs,up:0,down:0,upCost:0,downCost:0,cost:0,spent:0,entered:false,settled:false,firstFill:null};positions.set(s.market,p);}
    if(p.end!==s.endMs)throw Error('同市场结束时间不一致');
    const day=s.observedAt.slice(0,10);const addPnl=n=>{realized+=n;daily[day]=(daily[day]||0)+n;};
    const note=(action,detail,extra={})=>events.push({time:s.observedAt,market:s.market,action,detail,...extra});
    if(s.winner!==undefined){if(s.observedMs<s.endMs)throw Error('提前结算');if(!p.settled){const payout=p[s.winner];cash+=payout;addPnl(payout-p.cost);note('结算',s.winner,{pnl:payout-p.cost});p.up=p.down=p.upCost=p.downCost=p.cost=0;p.settled=true;}continue;}
    if(p.settled||s.observedMs>=s.endMs||(s.observedMs-s.t)/1000>c.maxAgeSeconds){note('跳过','已结束或盘口过期');continue;}
    if(p.up!==p.down){const side=p.up>p.down?'down':'up',other=side==='up'?'down':'up',q=Math.abs(p.up-p.down),f=fill(s[side],q,c);
      if(f.quantity<q){note('等待补仓','第二边深度不足，仍持有方向风险');continue;}
      const pairCost=p[other+'Cost']+f.total,edge=1-pairCost/q;
      const timed=(s.observedMs-p.firstFill)/1000>=maxHoldSeconds||(s.endMs-s.observedMs)/1000<=hedgeSeconds;
      if(edge<c.minEdge&&(!timed||pairCost-q>maxHedgeLoss)){note('等待补仓','尚无配对优势或对冲亏损超限；可能继续亏损');continue;}
      if(f.total>cash||p.spent+f.total>c.maxMarket){note('等待补仓','补仓资金或单市场额度不足');continue;}
      cash-=f.total;spent+=f.total;p.spent+=f.total;p[side]+=q;p[side+'Cost']+=f.total;p.cost+=f.total;
      // Simulated merge releases one dollar for each paired share; costs already include fee/slippage assumptions.
      cash+=q;addPnl(q-p.cost);note('模拟合并',edge>=c.minEdge?'分时配对回收模拟资金':'限时对冲，接受模拟亏损',{quantity:q,pnl:q-p.cost,cost:p.cost});p.up=p.down=p.upCost=p.downCost=p.cost=0;continue;
    }
    if(p.entered){note('跳过','同一市场只做一轮，避免重复消耗盘口');continue;}
    while(index+1<indicator.length&&indicator[index+1].time<=s.t)index++;
    const sig=indicator[index];if(!sig?.side||s.t-sig.time>60000){note('跳过','没有新鲜的已收盘Fisher极端反转信号');continue;}
    if((daily[day]||0)<=-maxDailyLoss){note('跳过','当日已实现亏损达到限制；已有仓位仍可对冲');continue;}
    const f=fill(s[sig.side],c.quantity,c);
    if(f.quantity<c.quantity||f.total/c.quantity>maxEntry||f.total>cash||p.spent+f.total>c.maxMarket||openRisk()+f.total>c.maxExposure){note('跳过','信号出现，但价格、深度、资金或风险限制不允许');continue;}
    cash-=f.total;spent+=f.total;p.spent+=f.total;p[sig.side]+=f.quantity;p[sig.side+'Cost']+=f.total;p.cost+=f.total;p.entered=true;p.firstFill=s.observedMs;note('模拟方向买入',`Fisher ${sig.side}；信号不等于胜率`,{quantity:f.quantity,cost:f.total});
  }
  const list=[...positions.values()],openCost=list.reduce((n,p)=>n+p.cost,0);
  return {config:c,mode:'fisher',cash,spent,realized,openCost,pairedPayout:0,unpairedRisk:openRisk(),conservativeEquity:cash,positions:list,events,dailyRealized:daily,assumptions:'候选Fisher策略；已收盘Coinbase分钟行情不是结算预言机。先买一边，后续快照补仓并模拟合并；无真实订单。比例费率/滑点为假设，不能据此宣称盈利。'};
}
