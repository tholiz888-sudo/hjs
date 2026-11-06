'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowDownToLine, ArrowUpRight, BookOpen, Check, ChevronRight, Copy, History, Layers3, Moon, Plus, ShieldCheck, Sun, Trash2, TriangleAlert, X } from 'lucide-react';
import { SimpleCalculator } from '@/components/simple/simple-calculator';
import { simplePlan, simpleText } from '@/lib/simple';
import { Inputs } from '@/components/calculator/inputs';
import { CostBreakdown, Metrics, Targets } from '@/components/results/results';
import { PnlChart } from '@/components/charts/pnl-chart';
import { Button } from '@/components/ui/button';
import { calculate } from '@/lib/calculations';
import { DEFAULT_PLAN, symbolOf, type Plan, type SavedPlan, type ViewMode } from '@/lib/types';
import { parsePlan, PLANS_KEY, PREF_KEY, readPlans, THEME_KEY } from '@/lib/storage';
import { planText } from '@/lib/plan-text';
export default function Home() {
 const [plan,setPlan]=useState<Plan>(DEFAULT_PLAN),[ready,setReady]=useState(false),[theme,setTheme]=useState('dark'),[saved,setSaved]=useState<SavedPlan[]>([]),[toast,setToast]=useState('');
 const [view,setView]=useState<ViewMode>('simple');
 const historyRef=useRef<HTMLDialogElement>(null),guideRef=useRef<HTMLDialogElement>(null);
 const activePlan=useMemo(()=>view==='simple'?simplePlan(plan):plan,[plan,view]);
 const calc=useMemo(()=>calculate(activePlan,{includeTargets:view==='professional'}),[activePlan,view]);const result=calc.ok?calc.result:null;
 const chooseView=(next:ViewMode)=>{if(next==='simple'&&view!=='simple'){const c=calculate(plan,{includeTargets:false});if(c.ok)setPlan({...plan,solveMode:'stop',riskMode:'amount',maxLoss:c.result.budget.toFixed(),...(plan.solveMode==='margin'?{marginInput:c.result.margin.toDecimalPlaces(18,2).toFixed()}: {})});}if(next==='professional'&&view==='simple')setPlan({...plan,solveMode:'stop',riskMode:'amount'});setView(next)};
 useEffect(()=>{
  // Hydrate browser-only preferences after the server-rendered default page mounts.
  const frame=requestAnimationFrame(()=>{
  try{const raw=localStorage.getItem(PREF_KEY);if(raw){const data=parsePlan(JSON.parse(raw));if(data)setPlan(data);}setSaved(readPlans());const v=localStorage.getItem('cpc:view:v1');if(v==='professional')setView(v);const t=localStorage.getItem(THEME_KEY);if(t==='light')setTheme(t);}catch{setToast('本地存储无法读取，当前仍可计算。');}
  setReady(true);
  });
  return ()=>cancelAnimationFrame(frame);
 },[]);
 useEffect(()=>{document.documentElement.dataset.theme=theme;if(ready){try{localStorage.setItem(THEME_KEY,theme)}catch{/* Calculation remains available without persistence. */}}},[theme,ready]);
 useEffect(()=>{if(ready){try{localStorage.setItem('cpc:view:v1',view)}catch{}}},[view,ready]);
 useEffect(()=>{if(!ready)return;try{localStorage.setItem(PREF_KEY,JSON.stringify(plan))}catch{/* Explicit save action reports storage failures. */}},[plan,ready]);
 useEffect(()=>{if(!toast)return;const t=setTimeout(()=>setToast(''),4200);return()=>clearTimeout(t)},[toast]);
 const save=()=>{if(!result)return;try{const latest=readPlans();const next=[{id:crypto.randomUUID(),savedAt:new Date().toISOString(),view,plan:structuredClone(activePlan),quantity:result.quantity.toFixed(),targetPrices:result.targets.map(t=>t.price.toFixed())},...latest].slice(0,100);localStorage.setItem(PLANS_KEY,JSON.stringify(next));setSaved(next);setToast('交易计划已保存在此浏览器');}catch{setToast('保存失败：请检查浏览器存储权限或空间');}};
 const copy=async()=>{if(!result)return;try{await navigator.clipboard.writeText(view==='simple'?simpleText(activePlan,result):planText(activePlan,result));setToast('交易计划已复制');}catch{setToast('复制失败：请允许剪贴板访问，或使用 HTTPS');}};
 const remove=(id:string)=>{try{const next=readPlans().filter(s=>s.id!==id);localStorage.setItem(PLANS_KEY,JSON.stringify(next));setSaved(next);setToast('已删除该计划');}catch{setToast('删除失败：本地存储不可用');}};
 const showHistory=()=>{try{setSaved(readPlans())}catch{setToast('无法读取已保存计划')}historyRef.current?.showModal()};
 return <><header className="site-header"><div className="header-inner"><a className="brand" href="#"><span className="brand-mark"><Layers3 size={22}/></span><span>仓位实验室 <small>POSITION LAB</small></span></a><nav aria-label="主导航"><a href="#calculator" className="active">仓位计算器</a><button onClick={showHistory}>我的计划 <span className="nav-count">{saved.length}</span></button><button onClick={()=>guideRef.current?.showModal()}>使用指南 <ArrowUpRight size={13}/></button></nav><div className="header-tools"><span className="local-status"><i/>本地计算 · 隐私优先</span><button className="icon-button theme-toggle" aria-label={theme==='dark'?'切换浅色主题':'切换深色主题'} onClick={()=>setTheme(theme==='dark'?'light':'dark')}>{theme==='dark'?<Sun size={18}/>:<Moon size={18}/>}</button></div></div></header>
 <main id="calculator"><div className="breadcrumb">交易工具 <ChevronRight size={12}/><span>合约仓位计算器</span></div><section className="page-intro"><div><div className="eyebrow"><span/> BUILT AROUND YOUR RISK</div><h1>{view==='simple'?<>这笔最多亏多少，<span>止损该设在哪？</span></>:<>最多亏多少，<span>该投多少保证金？</span></>}</h1><p>{view==='simple'?'填好开仓价、杠杆、保证金和亏损预算，止损价立即算好。':'输入计划最多亏损金额、杠杆、入场价，按止损价算保证金，或按保证金反算止损价。'}</p></div><div className="intro-actions"><Button variant="outline" onClick={showHistory}><History size={15}/>已保存计划</Button><Button variant="outline" onClick={()=>{setPlan(structuredClone(DEFAULT_PLAN));setToast('已新建默认示例计划')}}><Plus size={15}/>新建计划</Button></div></section>
 <div className="view-toolbar"><div className="view-switch" role="group" aria-label="界面版本"><button aria-pressed={view==='simple'} onClick={()=>chooseView('simple')}>简易版</button><button aria-pressed={view==='professional'} onClick={()=>chooseView('professional')}>专业版</button></div><span>{view==='simple'?'只看关键结果':'完整的仓位、成本与止盈分析'}</span></div>
 {view==='simple'?<SimpleCalculator plan={activePlan} calculation={calc} onChange={setPlan} onCopy={copy} onSave={save} onProfessional={()=>chooseView('professional')}/>:<div className="workspace"><aside><Inputs plan={plan} onChange={setPlan}/><div className="sidebar-note"><ShieldCheck size={18}/><div><strong>你的交易计划，只属于你。</strong><p>所有计算在浏览器完成，无需登录、API Key 或私钥。偏好和计划仅保存在本地。</p></div></div></aside><div className="results-column"><div className="results-heading"><h2>保证金测算</h2><span><span className={plan.direction==='long'?'direction-tag long':'direction-tag short'}>{plan.direction==='long'?'↗ 做多':'↘ 做空'}</span><b>{symbolOf(plan)}</b></span></div>
 {result?<Metrics plan={plan} result={result}/>:<div className="validation-panel" role="alert"><TriangleAlert size={23}/><div><h3>请检查交易参数</h3><ul>{!calc.ok&&calc.errors.map((e,i)=><li key={i}>{e}</li>)}</ul><p>修正后将立即重新计算，不会自动更改你的输入。</p></div></div>}
 <Targets plan={plan} result={result} onChange={setPlan}/>
 {result&&<><PnlChart plan={plan} result={result}/><CostBreakdown result={result}/></>}
 <div className="plan-actions"><div><BookOpen size={19}/><div><strong>把风险计划带进下一笔交易</strong><span>先规划，再执行。每一步都有据可依。</span></div></div><div><Button variant="outline" disabled={!result} onClick={save}><ArrowDownToLine size={15}/>保存计划</Button><Button disabled={!result} onClick={copy}><Copy size={15}/>复制交易计划</Button></div></div>
 </div></div>}
 {view==='professional'&&<section className="risk-disclosure"><TriangleAlert size={17}/><div><h2>交易规划工具，不是投资建议</h2><p>保证金与计划风险预算不同。滑点及资金费为估算，止损不保证按预定价格成交，交易结果不构成盈利保证。强平价需要交易所实时维持保证金、仓位档位及账户状态等参数，本工具不提供虚假的精确强平价格。所有数量与价格规则均需自行核对。</p></div></section>}
 <footer><span>© {new Date().getFullYear()} 仓位实验室 <span className="footer-divider">/</span> Crypto Position Calculator</span><span><span className="footer-dot"/>精确计算，理性交易。</span></footer></main>
 <dialog ref={historyRef} className="modal"><div className="modal-header"><div><span className="eyebrow">YOUR TRADING PLAYBOOK</span><h2>已保存计划 <small>{saved.length} / 100</small></h2></div><button className="icon-button" aria-label="关闭已保存计划" onClick={()=>historyRef.current?.close()}><X size={20}/></button></div><p className="modal-note">仅存储在当前浏览器，最多保留最近 100 条。载入后可以调整并再次保存。</p><div className="saved-list">{saved.length?saved.map(s=><article key={s.id} className="saved-item"><div className="saved-item-title"><strong>{symbolOf(s.plan)}</strong><span className={s.plan.direction==='long'?'green':'red'}>{s.plan.direction==='long'?'做多':'做空'}</span><time>{new Date(s.savedAt).toLocaleString('zh-CN')}</time></div><dl><div><dt>入场 / 止损</dt><dd>{s.plan.entry} / {(() => {const c=calculate(s.plan,{includeTargets:s.view!=='simple'});return c.ok?c.result.stop.toFixed(Number(s.plan.priceDecimals)):'无效计划'})()}</dd></div><div><dt>风险 / 数量</dt><dd>{s.plan.riskMode==='amount'?`${s.plan.maxLoss} USDT`:`${s.plan.risk}%`} / {s.quantity}</dd></div><div><dt>TP1 / TP2</dt><dd>{s.view==='simple'?'简易计划 · 未设置止盈':s.targetPrices.join(' / ')}</dd></div></dl><div className="saved-actions"><Button size="sm" variant="outline" onClick={()=>{setPlan(structuredClone(s.plan));setView(s.view==='simple'?'simple':'professional');historyRef.current?.close();setToast('计划已载入')}}>载入计划</Button><Button size="sm" variant="ghost" aria-label={`删除 ${symbolOf(s.plan)} 计划`} onClick={()=>remove(s.id)}><Trash2 size={14}/>删除</Button></div></article>):<div className="empty-state"><History size={32}/><h3>还没有保存的计划</h3><p>完成参数设置后，点击「保存计划」即可在这里查看。</p></div>}</div></dialog>
 <dialog ref={guideRef} className="modal guide"><div className="modal-header"><h2>从风险出发，规划交易</h2><button className="icon-button" aria-label="关闭使用指南" onClick={()=>guideRef.current?.close()}><X size={20}/></button></div><ol><li><strong>定义风险预算</strong><p>默认直接填写计划最多亏损金额（如 100 USDT），也可切换为账户权益 × 单笔风险比例。选择「按止损算保证金」，填写入场和止损价格；选择「按保证金算止损价」，填写投入保证金和入场价即可反算止损价格。后者会固定按保证金取整的数量，多单止损向上、空单止损向下按价格步长取整，以保持估算亏损不超过预算。预算包含价格亏损与估算成本，但不保证实际亏损封顶。</p></li><li><strong>设置价格与成本</strong><p>多单止损低于入场，空单止损高于入场。滑点按往返总成本计一次，资金费按整个持仓期总成本计一次，均以入场名义价值为基数。所有费率是可修改的估算。</p></li><li><strong>审视仓位与保证金</strong><p>数量 = 风险预算 ÷ 每单位止损总亏损。先计算理论推荐量，再按数量步长向下取整；所有收益与成本均按取整数量计算。按止损算保证金时，杠杆只影响保证金；按保证金算止损时，固定保证金改变杠杆会改变仓位和止损价。若交易所规则未核验，本地检查不代表可以下单。</p></li><li><strong>模拟分批退出</strong><p>1R 为入场到止损的价格距离。每个目标的全仓收益单独展示，分批净利润按对应份额分配开仓及持仓成本。净盈亏比 = 净利润 ÷ 预估止损净亏损。图表为全仓在某假设价格退出的结果，不是分批收益曲线。</p></li><li><strong>保存与复核</strong><p>保存到当前浏览器，或复制完整交易计划。页面金额经显示精度四舍五入；复制计划包含未省略的取整数量。极小金额可能显示为 0.00，请提高价格精度并查看成本明细。上线执行前自行确认费用、数量规则与止损机制。</p></li></ol></dialog>
 {toast&&<div className="toast" role="status"><Check size={17}/>{toast}</div>}
 </>;
}
