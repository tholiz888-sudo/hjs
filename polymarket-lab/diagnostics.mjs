import {signals} from './signals.mjs';
export function diagnostics(state,report,now=Date.now()) {
  const actions={},reasons={};
  for(const event of report.events){actions[event.action]=(actions[event.action]||0)+1;if(['跳过','等待补仓'].includes(event.action))reasons[event.detail]=(reasons[event.detail]||0)+1;}
  const latest=state.mode==='fisher'?signals(state.candles||[],state.config).at(-1)||null:null;
  const snapshot=state.snapshots.filter(s=>!s.winner).at(-1);
  const latestDecision=report.events.at(-1)||null;
  const lastRunAgeSeconds=state.lastRun?Math.max(0,(now-Date.parse(state.lastRun))/1000):null;
  const candleAgeSeconds=latest?Math.max(0,(now-latest.time)/1000):null;
  return {actions,skipReasons:reasons,latestSignal:latest,latestDecision,recentDecisions:report.events.slice(-8),lastSnapshotTime:snapshot?.observedAt||null,lastRunAgeSeconds,candleAgeSeconds,warning:state.mode==='fisher'&&candleAgeSeconds!==null&&candleAgeSeconds>180?'BTC行情已过期，请检查采集日志。':lastRunAgeSeconds!==null&&lastRunAgeSeconds>120?'超过两分钟未完成一轮采集，请检查错误日志及Render状态。':null};
}
