import {config,validate} from './engine.mjs';
import {inventoryModel} from './inventory-model.mjs';
import {auditCompleteSet} from './complete-set.mjs';
import {replayInventoryV1} from './inventory-v1.mjs';
export function inventoryConfig(settings={}){
 const c=config({inventoryVersion:2,capital:25,quantity:5,maxMarket:8,maxExposure:5,...settings});
 Object.assign(c,{entryEdge:settings.entryEdge??.06,maxAdds:settings.maxAdds??3,minPairEdge:settings.minPairEdge??.02,maxHoldSeconds:settings.maxHoldSeconds??120,maxHedgeLoss:settings.maxHedgeLoss??1,orderLifeSeconds:settings.orderLifeSeconds??30,participation:settings.participation??.25,minMergeShares:settings.minMergeShares??.01,latencyMs:settings.latencyMs??1000,maxStaleSettlementSeconds:settings.maxStaleSettlementSeconds??120});
 for(const k of ['entryEdge','maxAdds','minPairEdge','maxHoldSeconds','maxHedgeLoss','orderLifeSeconds','participation','minMergeShares','latencyMs','maxStaleSettlementSeconds'])if(!Number.isFinite(c[k])||c[k]<0)throw Error(k+'参数无效');
 if(![1,2].includes(c.inventoryVersion))throw Error('库存规则版本无效');
 if(c.capital>25||c.maxExposure>5||c.participation<=0||c.participation>1||!Number.isInteger(c.maxAdds)||c.maxAdds>10||c.entryEdge>1||c.minPairEdge>1)throw Error('库存研究模式最多25美元模拟资金、5美元单边风险；参数超限');
 return c;
}
function levels(value,bids=false){if(!Array.isArray(value))return [];return value.map(v=>{if(!Array.isArray(v)||v.length!==2||!v.every(Number.isFinite)||v[0]<=0||v[0]>=1||v[1]<0)throw Error('买盘数据无效');return [...v];}).sort((a,b)=>bids?b[0]-a[0]:a[0]-b[0]);}
export function replayInventory(input,settings={}){
 if((settings.inventoryVersion??1)===1)return {...replayInventoryV1(input,settings),inventoryVersion:1};
 const c=inventoryConfig(settings),snapshots=validate(input).sort((a,b)=>a.observedMs-b.observedMs),positions=new Map(),orders=[],events=[],usedBooks=new Set(),dailyRisk={},dailyPnl={},dailyLoss={};
 let cash=c.capital,realized=0,grossSpent=0,orderSeq=0,lastModel=null;
 const active=o=>o.status==='OPEN'||o.status==='PARTIAL';
 const reserved=()=>orders.filter(active).reduce((n,o)=>n+o.remaining*o.price*(1+c.feeBps/10000),0);
 const openRisk=()=>[...positions.values()].reduce((n,p)=>n+Math.max(0,p.cost-Math.min(p.up,p.down)),0);
 const planRisk=(p,side,quantity,cost)=>Math.max(0,p.cost+cost-Math.min(p.up+(side==='up'?quantity:0),p.down+(side==='down'?quantity:0)))-Math.max(0,p.cost-Math.min(p.up,p.down));
 const reservationRisk=()=>orders.filter(active).reduce((n,o)=>n+Math.max(0,planRisk(positions.get(o.market),o.side,o.remaining,o.remaining*o.price*(1+c.feeBps/10000))),0);
 const risk=()=>openRisk()+reservationRisk();
 const day=t=>new Date(t+8*3600000).toISOString().slice(0,10);
 function book(s,side,bids=false){return bids?levels(s[side+'Bids'],true):s[side];}
 function cancel(o,reason,s){if(!active(o))return;o.status='CANCELLED';events.push({time:s.observedAt,market:o.market,action:'模拟撤单',detail:reason,orderId:o.id});}
 function note(s,action,detail,extra={}){events.push({time:s.observedAt,market:s.market,action,detail,...extra});}
 for(const s of snapshots){if(s.slug&&!/^btc-updown-(5m|15m)-\d+$/.test(s.slug))throw Error('库存模式仅支持BTC短周期市场');let p=positions.get(s.market);if(!p){p={market:s.market,title:s.title||s.slug||s.market,end:s.endMs,up:0,down:0,upCost:0,downCost:0,cost:0,netCash:0,grossSpent:0,adds:0,direction:null,firstFill:null,settled:false,phase:'OBSERVE',realized:0};positions.set(s.market,p);}if(p.end!==s.endMs)throw Error('同市场结束时间不一致');
   for(const order of orders.filter(active))if(s.observedMs>=order.expires)cancel(order,'挂单期限已到',s);
   const myOrders=()=>orders.filter(o=>o.market===s.market&&active(o));
   const accountPnl=n=>{dailyLoss[day(s.observedMs)]=(dailyLoss[day(s.observedMs)]||0)+Math.max(0,-n);realized+=n;p.realized+=n;dailyPnl[day(s.observedMs)]=(dailyPnl[day(s.observedMs)]||0)+n;};
   if(s.winner!==undefined){if(s.observedMs<s.endMs)throw Error('不能提前结算');for(const o of myOrders())cancel(o,'市场结算',s);if(!p.settled){const payout=p[s.winner],pnl=payout-p.cost;cash+=payout;p.netCash+=payout;accountPnl(pnl);note(s,'模拟赎回',s.winner+'结算（可为零兑付）',{pnl,payout});p.up=p.down=p.upCost=p.downCost=p.cost=0;p.settled=true;p.phase='SETTLED';}continue;}
   for(const o of myOrders())if(s.observedMs>=o.expires||s.observedMs>=p.end)cancel(o,'挂单超时或市场结束',s);
   if(p.settled||s.observedMs>=p.end){note(s,'等待结算','停止开仓，等待官方确认赢家');continue;}
   if(s.observedMs-s.t>c.maxAgeSeconds*1000){for(const o of myOrders())cancel(o,'盘口过期，模拟取消未成交订单',s);note(s,'跳过','盘口过期');continue;}
   // Existing orders may have filled before this observation: process fills before reacting to new signals.
   for(const o of myOrders()){
     if(s.observedMs-o.created<c.latencyMs||s.t<=o.sourceTime)continue;
     const key=JSON.stringify([s.market,o.side,s[o.side+'Hash']||s.time]);if(usedBooks.has(key))continue;
     let remaining=o.remaining,quantity=0,cost=0;
     for(const [price,available] of book(s,o.side)){if(price>o.price+1e-9)break;const q=Math.min(remaining,available*c.participation);if(q<=0)continue;const execution=Math.min(o.price,price*(1+c.slippageBps/10000));quantity+=q;cost+=q*execution;remaining-=q;if(remaining<1e-8)break;}
     if(quantity>1e-8){usedBooks.add(key);const fee=cost*c.feeBps/10000,total=cost+fee;
       if(total>cash+1e-7)throw Error('模拟现金不足，账本不一致');
       if(o.role==='ENTRY'&&!o.counted){p.adds++;p.direction??=o.side;o.counted=true;}
       cash-=total;grossSpent+=total;p.grossSpent+=total;p.netCash-=total;p[o.side]+=quantity;p[o.side+'Cost']+=total;p.cost+=total;p.firstFill??=s.observedMs;o.remaining=Math.max(0,o.remaining-quantity);o.filled+=quantity;o.actualCost+=total;o.status=o.remaining<1e-7?'FILLED':'PARTIAL';
       note(s,'模拟成交',`${o.role==='ENTRY'?'分批建仓':'对侧补仓'} ${o.side}；仅按后续盘口及参与率假设成交`,{orderId:o.id,quantity,cost:total,fee});
     }
     if(o.role==='HEDGE'&&active(o))cancel(o,'补仓IOC剩余取消，保留未成交风险',s);
   }
   // Merge matched inventory only if its proportional cost is acceptable; weighted allocation is explicit.
   const matched=Math.min(p.up,p.down);
   if(matched>=c.minMergeShares){const allocated=matched*(p.upCost/p.up+p.downCost/p.down),pnl=matched-allocated;const timed=(s.observedMs-(p.firstFill??s.observedMs))/1000>=c.maxHoldSeconds||(s.endMs-s.observedMs)<=30000;
     if(pnl>=matched*c.minPairEdge-1e-8||(timed&&pnl>=-c.maxHedgeLoss)){
       const upAllocation=matched*p.upCost/p.up,downAllocation=matched*p.downCost/p.down;
       p.up-=matched;p.down-=matched;p.upCost=Math.max(0,p.upCost-upAllocation);p.downCost=Math.max(0,p.downCost-downAllocation);p.cost=p.upCost+p.downCost;p.netCash+=matched;cash+=matched;accountPnl(pnl);
       note(s,'模拟合并',pnl>=0?'完整份额配对回收模拟资金':'限时对冲，接受组合亏损',{quantity:matched,pnl,audit:auditCompleteSet({up:p.up,down:p.down,netCash:p.netCash})});
     }
   }
   const model=inventoryModel(s,c);lastModel={market:s.market,time:s.observedAt,...model};
   // Entry orders are cancelled if their original model edge disappears; hedges do not require a fresh directional model.
   for(const o of myOrders().filter(o=>o.role==='ENTRY'))if(!model.ready||(o.side==='up'?model.probabilityUp:model.probabilityDown)-o.price*(1+c.feeBps/10000)<c.entryEdge)cancel(o,'方向优势失效或行情不可用',s);
   const imbalance=p.up-p.down,audit=auditCompleteSet({up:p.up,down:p.down,netCash:p.netCash});p.audit=audit;
   p.phase=Math.abs(imbalance)>1e-7?(audit.residualCostCovered?'COVERED_RESIDUAL':'DIRECTIONAL_RISK'):p.adds?'RECOVERED':'OBSERVE';
   let plan=null;
   if(Math.abs(imbalance)>1e-7&&!myOrders().some(o=>o.role==='HEDGE')){
     const side=imbalance>0?'down':'up',held=imbalance>0?'up':'down',average=p[held+'Cost']/p[held],best=book(s,side)[0]?.[0];
     const timed=(s.observedMs-p.firstFill)/1000>=c.maxHoldSeconds||s.endMs-s.observedMs<=30000;
     const q=Math.min(Math.abs(imbalance),c.quantity),lossAllowance=timed?c.maxHedgeLoss/Math.max(q,1e-9):0;
     const cap=(1-average+(timed?lossAllowance:-c.minPairEdge))/(1+c.feeBps/10000);
     if(best!==undefined&&best<=cap&&q>0){plan={side,price:Math.min(cap,best*(1+c.slippageBps/10000)),size:q,role:'HEDGE',maxPrice:cap,reason:timed?'限时库存回收':'对侧价格达到配对成本条件'};for(const o of myOrders().filter(o=>o.role==='ENTRY'))cancel(o,'优先补仓回收资金',s);}
   }
   if(!plan&&p.adds<c.maxAdds&&!myOrders().some(o=>o.role==='ENTRY'||o.role==='HEDGE')&&s.endMs-s.observedMs>45000&&model.ready){
     const tick=Number(s.tickSize??.01);if(!Number.isFinite(tick)||tick<=0||tick>=1)throw Error('tickSize无效');
     const candidates=['up','down'].filter(side=>!p.direction||side===p.direction).map(side=>{const probability=side==='up'?model.probabilityUp:model.probabilityDown,bestAsk=book(s,side)[0]?.[0],bestBid=book(s,side,true)[0]?.[0];
       if(bestAsk===undefined||bestBid===undefined)return null;
       const ceiling=(probability-c.entryEdge)/(1+c.feeBps/10000),price=Math.floor(Math.min(bestBid+tick,bestAsk-tick,ceiling)/tick+1e-9)*tick;
       return price>0&&price<bestAsk?{side,price,size:c.quantity,role:'ENTRY',edge:probability-price*(1+c.feeBps/10000),reason:'偏离参考价、动量与波动率模型的候选优势'}:null;}).filter(Boolean).sort((a,b)=>b.edge-a.edge);
     plan=candidates[0]||null;
   }
   if(!plan){note(s,Math.abs(imbalance)>1e-7?'等待补仓':'跳过',!model.ready?model.reason:'没有符合成本条件的建仓或补仓报价');continue;}
   const tick=Number(s.tickSize??.01);if(!Number.isFinite(tick)||tick<=0||tick>=1)throw Error('tickSize无效');plan.price=plan.role==='ENTRY'?plan.price:Math.min(Math.floor(plan.maxPrice/tick+1e-9)*tick,Math.ceil(plan.price/tick-1e-9)*tick);
   if(plan.role==='HEDGE'&&plan.price<(book(s,plan.side)[0]?.[0]??1)){note(s,'等待补仓','价格步长无法满足配对成本上限');continue;}
   const minSize=Number(s.minOrderSize??5);if(!Number.isFinite(minSize)||minSize<=0)throw Error('minOrderSize无效');
   const perShare=plan.price*(1+c.feeBps/10000);plan.size=Math.floor(Math.min(plan.size,2/perShare)*100)/100;
   const reserve=plan.size*perShare,dayKey=day(s.observedMs),riskIncrease=Math.max(0,planRisk(p,plan.side,plan.size,reserve));
   const projectedOpenRisk=risk()+riskIncrease,projectedDailyRisk=(dailyLoss[dayKey]||0)+projectedOpenRisk;
   const stalled=[...positions.values()].filter(position=>!position.settled&&position.cost>1e-8&&s.observedMs-position.end>c.maxStaleSettlementSeconds*1000);
   const checks=[
     {code:'PRICE',failed:plan.price<=0||plan.price>=1,actual:plan.price,limit:1,label:'报价不在有效范围'},
     {code:'MIN_SIZE',failed:plan.size<minSize,actual:plan.size,limit:minSize,label:`平台最少${minSize}份，单笔2美元下只能买${plan.size.toFixed(2)}份`},
     {code:'ORDER_CAP',failed:reserve>2+1e-8,actual:reserve,limit:2,label:'单笔本金及费用预留超过2美元'},
     {code:'CASH',failed:reserve>cash-reserved()+1e-8,actual:reserve,limit:cash-reserved(),label:'可用现金不足（已扣未成交预留）'},
     {code:'MARKET_CAP',failed:p.grossSpent+myOrders().reduce((a,o)=>a+o.remaining*o.price*(1+c.feeBps/10000),0)+reserve>c.maxMarket+1e-8,actual:p.grossSpent+reserve,limit:c.maxMarket,label:'单市场累计买入与挂单额度不足'},
     {code:'TOTAL_CAP',failed:grossSpent+reserved()+reserve>25+1e-8,actual:grossSpent+reserved()+reserve,limit:25,label:'累计买入及挂单预留超过25美元'},
     {code:'DAILY_RISK',failed:projectedDailyRisk>5+1e-8,actual:projectedDailyRisk,limit:5,label:'当日已实现亏损＋未配对风险＋挂单新增风险超过5美元'},
     {code:'EXPOSURE',failed:projectedOpenRisk>c.maxExposure+1e-8,actual:projectedOpenRisk,limit:c.maxExposure,label:'未配对及挂单新增风险超过限制'},
     {code:'SETTLEMENT_PENDING',failed:plan.role==='ENTRY'&&stalled.length>0,actual:stalled.length,limit:0,label:'已有持仓到期超过两分钟仍未确认结算，暂停新建仓；已有库存可继续处理'}
   ].filter(check=>check.failed).map(({failed,...check})=>check);
   if(checks.length){note(s,'风控拒单',checks.map(check=>check.label).join('；'),{checks});continue;}
   dailyRisk[dayKey]=Math.max(dailyRisk[dayKey]||0,projectedDailyRisk);
   const o={id:'paper-'+ ++orderSeq,market:s.market,slug:s.slug||null,side:plan.side,role:plan.role,price:plan.price,size:plan.size,remaining:plan.size,filled:0,actualCost:0,created:s.observedMs,sourceTime:s.t,expires:Math.min(s.endMs,s.observedMs+(plan.role==='HEDGE'?15000:c.orderLifeSeconds*1000)),status:'OPEN',referenceSource:model.referenceSource||null};orders.push(o);
      note(s,'模拟挂单',`${plan.role==='ENTRY'?'方向限价':'对侧IOC'} ${plan.side}；${plan.reason}`,{orderId:o.id,quantity:o.size,price:o.price,reserve,model:plan.role==='ENTRY'?model:null});
 }
 const lastTime=snapshots.at(-1)?.observedMs??0;const lastDay=day(lastTime);
 for(const position of positions.values())if(!position.settled&&position.end<=lastTime&&position.cost>0)position.phase='PENDING_SETTLEMENT';
 const riskBudget={basis:'realized-loss-plus-open-worst-case',day:lastDay,realizedLoss:dailyLoss[lastDay]||0,openRisk:openRisk(),pendingRisk:reservationRisk(),used:(dailyLoss[lastDay]||0)+risk(),limit:5,pendingCash:reserved()};
 const list=[...positions.values()];const marketTrace=snapshots.filter(s=>Number.isFinite(s.underlying?.spot)).slice(-120).map(s=>({time:s.observedMs,value:s.underlying.spot}));return {inventoryVersion:2,riskBudget,marketTrace,mode:'inventory',config:c,cash,spent:grossSpent,realized,openCost:list.reduce((a,p)=>a+p.cost,0),pairedPayout:list.filter(p=>!p.settled).reduce((a,p)=>a+Math.min(p.up,p.down),0),unpairedRisk:risk(),conservativeEquity:cash+list.filter(p=>!p.settled).reduce((a,p)=>a+Math.min(p.up,p.down),0),positions:list,orders,events,dailyRisk,dailyRealized:dailyPnl,lastModel,reservedCash:reserved(),assumptions:'行为研究模拟，非bosona原代码。参考价默认Coinbase分钟代理，不是结算预言机；概率未校准。挂单仅由后续不同盘口、延迟与参与率假设成交，无法重建真实队列；限额可能使补仓失败。无自动真实交易。'};
}
