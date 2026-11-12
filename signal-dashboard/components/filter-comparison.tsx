import {useMemo} from 'react';
import type {Candle,Params} from '@/lib/engine';
import {compareFilters} from '@/lib/filter-comparison';
import {Card,CardHeader,CardTitle,CardContent} from './ui/card';
export function FilterComparison({rows,params}:{rows:Candle[];params:Params}){
 const comparison=useMemo(()=>compareFilters(rows,params),[rows,params]);
 const rate=(value:number|null)=>value===null?'—':value.toFixed(1)+'%';
 return <Card className="mb-5"><CardHeader><CardTitle>增强过滤前后对照 · 十分钟方向结果</CardTitle></CardHeader><CardContent><p className="mb-4 text-[11px] leading-6 text-muted">同一份数据、原参数不变，分别测试每个增强过滤及当前组合。持平计非成功，未到期不计入成功率；窗口可以重叠，与下方不重叠交易回测不同。</p><div className="table-scroll"><table><thead><tr><th>配置</th><th>信号总数</th><th>已到期</th><th>成功</th><th>失败</th><th>持平</th><th>全样本成功率</th><th>后 30% 时间段</th></tr></thead><tbody>{comparison.map(row=><tr key={row.id} data-testid={'filter-comparison-'+row.id}><td>{row.name}</td><td>{row.total}</td><td>{row.settled}</td><td>{row.wins}</td><td>{row.losses}</td><td>{row.flats}</td><td>{rate(row.successRate)}</td><td>{rate(row.tailRate)} · {row.tailCount} 条</td></tr>)}</tbody></table></div><p className="mt-4 text-[10px] leading-6 text-muted">后 30% 仅是时间分段对照；若反复查看并调参，就不再是未见过的验证数据。请冻结参数后另取新数据检验。少量样本或信号减少不能证明优势，不自动推荐“最优”参数。</p></CardContent></Card>;
}
