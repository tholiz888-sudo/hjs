export const defaults = { capital: 1000, quantity: 20, minEdge: .02, feeBps: 100, slippageBps: 20, maxMarket: 100, maxExposure: 25, maxAgeSeconds: 10 };
const finite = (v, name, min, max) => { if (typeof v !== 'number' || !Number.isFinite(v) || v < min || v > max) throw Error(`${name} 数值无效`); return v; };
export function config(input = {}) {
  const c = { ...defaults, ...input };
  for (const k of Object.keys(defaults)) finite(c[k], k, k === 'capital' || k === 'quantity' ? .01 : 0, 1e7);
  finite(c.feeBps, 'feeBps', 0, 10000); finite(c.slippageBps, 'slippageBps', 0, 10000);
  return c;
}
export function validate(rows) {
  if (!Array.isArray(rows) || rows.length > 10000) throw Error('需要最多10000条盘口快照的数组');
  let previous = -Infinity;
  const seen = new Set();
  return rows.map((s) => {
    if (!s || typeof s.market !== 'string' || !s.market.trim() || s.market.length > 200) throw Error('缺少 market');
    const t = Date.parse(s.time), end = Date.parse(s.end), observed = Date.parse(s.observedAt);
    if (![t, end, observed].every(Number.isFinite) || t < previous || observed < t) throw Error('时间无效、非顺序，或 observedAt 早于 time');
    previous = t;
    const key = JSON.stringify([s.market, t]);
    if (seen.has(key)) throw Error('重复的市场时间戳，不能重复消费同一盘口');
    seen.add(key);
    const books = {};
    for (const side of ['up', 'down']) {
      if (!Array.isArray(s[side]) || s[side].length > 1000) throw Error('盘口必须为 [价格,数量] 数组');
      books[side] = s[side].map(level => {
        if (!Array.isArray(level) || level.length !== 2) throw Error('盘口层级格式无效');
        return [finite(level[0], '价格', .000001, .999999), finite(level[1], '数量', .000001, 1e9)];
      }).sort((a,b) => a[0]-b[0]);
    }
    if (s.winner !== undefined && !['up', 'down'].includes(s.winner)) throw Error('winner 只能是 up 或 down');
    return { ...s, ...books, t, endMs: end, observedMs: observed };
  });
}
export function fill(book, requested, c) {
  let quantity = 0, cost = 0;
  for (const [price, available] of book) {
    const q = Math.min(requested - quantity, available);
    if (q <= 0) break;
    quantity += q; cost += q * Math.min(1, price * (1 + c.slippageBps / 10000));
  }
  const fee = cost * c.feeBps / 10000;
  return { quantity, cost, fee, total: cost + fee };
}
export function replay(input, settings = {}) {
  const c = config(settings), rows = validate(input), positions = new Map(), events = [];
  let cash = c.capital, spent = 0, realized = 0;
  const exposure = () => [...positions.values()].reduce((a,p) => a + (p.settled ? 0 : Math.max(0, p.cost - Math.min(p.up,p.down))), 0);
  for (const s of rows) {
    let p = positions.get(s.market);
    if (!p) { p = { market:s.market, up:0, down:0, cost:0, settled:false, end:s.endMs }; positions.set(s.market,p); }
    if (p.end !== s.endMs) throw Error('同一市场的结束时间必须一致');
    if (s.winner !== undefined) {
      if (s.observedMs < s.endMs) throw Error('不能在到期前提供结算结果');
      if (!p.settled) {
        const payout = p[s.winner]; cash += payout; realized += payout - p.cost; p.settled = true;
        events.push({ time:s.observedAt, market:s.market, action:'结算', detail:s.winner, pnl:payout-p.cost });
      }
      continue;
    }
    const reject = detail => events.push({ time:s.observedAt, market:s.market, action:'跳过', detail });
    if (p.settled || s.observedMs >= s.endMs) { reject('市场已结束'); continue; }
    if ((s.observedMs-s.t)/1000 > c.maxAgeSeconds) { reject('盘口过期'); continue; }
    // Evaluate full depth, then simulate buying UP first. No atomic two-leg fill is assumed.
    const u = fill(s.up,c.quantity,c), d = fill(s.down,c.quantity,c);
    if (u.quantity < c.quantity || d.quantity < c.quantity) { reject('双边深度不足'); continue; }
    const total = u.total+d.total, edge = 1-total/c.quantity;
    if (edge < c.minEdge) { reject('扣除费用与滑点后优势不足'); continue; }
    if (total > cash || p.cost+total > c.maxMarket) { reject('余额或单市场额度不足'); continue; }
    const temporary = Math.max(0,p.cost+u.total-Math.min(p.up+u.quantity,p.down));
    const old = Math.max(0,p.cost-Math.min(p.up,p.down));
    if (exposure()-old+temporary > c.maxExposure) { reject('第一边成交后的风险超过限额'); continue; }
    p.up += u.quantity; p.cost += u.total; cash -= u.total; spent += u.total;
    // Explicit adverse execution scenario: DOWN liquidity vanishes after the first fill.
    if (s.secondLegFails === true) { events.push({ time:s.observedAt,market:s.market,action:'单边暴露',detail:'第二边未成交；保留 Up 仓位，等待结算',cost:u.total,quantity:u.quantity }); continue; }
    p.down += d.quantity; p.cost += d.total; cash -= d.total; spent += d.total;
    events.push({ time:s.observedAt,market:s.market,action:'模拟配对',quantity:c.quantity,cost:total,edge,detail:'假设按快照深度成交；非实盘收益' });
  }
  const list = [...positions.values()], open = list.filter(p=>!p.settled);
  const openCost = open.reduce((a,p)=>a+p.cost,0), pairedPayout = open.reduce((a,p)=>a+Math.min(p.up,p.down),0);
  return { config:c, cash, spent, realized, openCost, pairedPayout, unpairedRisk:exposure(), conservativeEquity:cash+pairedPayout, positions:list, events, assumptions:'用户配置的费用按成交金额比例估算；非平台实际费率模型。未结算仅计双边配对兑付下限，不按最新价估值。' };
}
export function fisher(prices, period = 10) {
  if (!Array.isArray(prices) || !Number.isInteger(period) || period < 2) throw Error('指标参数无效');
  prices.forEach(p=>finite(p,'BTC价格',.000001,1e12));
  let x=0, prior=0;
  return prices.map((price,i)=> {
    if (i < period-1) return null;
    const window=prices.slice(i-period+1,i+1), high=Math.max(...window), low=Math.min(...window);
    const normalized=high===low?0:2*(price-low)/(high-low)-1;
    x=Math.max(-.999,Math.min(.999,.33*normalized+.67*x));
    const value=.5*Math.log((1+x)/(1-x))+.5*prior;
    const result={value,trigger:prior}; prior=value; return result;
  });
}
