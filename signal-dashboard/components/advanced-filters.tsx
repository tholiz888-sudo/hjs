import type {Params} from '@/lib/engine';
import {Switch} from './ui/switch';
import {Input} from './ui/input';
type NumberKey='adxPeriod'|'adxMin'|'atrPeriod'|'atrMinPercent'|'atrMaxPercent'|'deviationMaxAtr';
export function AdvancedFilters({params:p,onChange}:{params:Params;onChange:(key:keyof Params,value:number|boolean)=>void}){
 const numeric=(key:NumberKey,label:string,min:number,max:number,step:number)=> <label key={key} className="flex items-center justify-between gap-3 text-xs"><span>{label}</span><Input aria-label={label} type="number" min={min} max={max} step={step} value={Number.isNaN(p[key])?'':p[key]} className="w-24" onChange={event=>onChange(key,event.target.value===''?NaN:Number(event.target.value))}/></label>;
 const groups=[
  {key:'adxEnabled' as const,title:'启用 ADX 趋势强度过滤',note:'1 分钟 Wilder ADX，强度不代表方向；预热不足不触发。',fields:[numeric('adxPeriod','ADX 周期',2,100,1),numeric('adxMin','ADX 最低强度',0,100,1)]},
  {key:'atrEnabled' as const,title:'启用 ATR 波动区间过滤',note:'ATR ÷ 收盘价 × 100。0.02 表示 0.02%；排除过低或过高波动。',fields:[numeric('atrPeriod','ATR 周期',2,100,1),numeric('atrMinPercent','ATR 最低波动率（%）',0,100,.01),numeric('atrMaxPercent','ATR 最高波动率（%）',.01,100,.01)]},
  {key:'deviationEnabled' as const,title:'启用价格偏离过滤',note:`限制价格偏离 1 分钟 EMA${p.slow} 的距离，以 ATR${p.atrPeriod} 为单位；ATR 为零时不触发。`,fields:[numeric('deviationMaxAtr','最大价格偏离（ATR 倍）',.1,20,.1)]},
 ];
 return <section aria-label="增强过滤设置" className="mt-7 space-y-4 border-t border-border pt-6"><div><h2 className="text-sm font-semibold">增强过滤 · 分别验证</h2><p className="mt-2 text-[11px] leading-6 text-muted">默认关闭以保留原规则。建议一次只开启一个，在回测页比较信号数量和十分钟方向成功率；减少信号不等于提高胜率。</p></div>{groups.map(group=><div key={group.key} className="rounded-lg border border-border bg-background p-4"><div className="flex items-center justify-between gap-4"><label htmlFor={group.key} className="text-xs">{group.title}</label><Switch id={group.key} checked={p[group.key]} onCheckedChange={value=>onChange(group.key,value)}/></div><p className="my-3 text-[10px] leading-5 text-muted">{group.note}</p><div className="space-y-3">{group.fields}</div></div>)}</section>;
}
