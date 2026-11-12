import {test,expect} from './fixtures';
import {analyze,defaults,simulate} from '../lib/engine';
import {signalOutcome,outcomeLabels} from '../lib/signal-outcome';
test('recent signals show exact ten-minute directional results and prices',async({page})=>{
 await page.route('**/api/market?*',route=>route.fulfill({status:503,json:{error:'测试未联网'}}));await page.goto('/');await page.getByLabel('数据源',{exact:true}).selectOption('simulated');
 await expect(page.getByRole('columnheader',{name:'十分钟后价格',exact:true})).toBeVisible();await expect(page.getByRole('columnheader',{name:'结果',exact:true})).toBeVisible();
 const rows=simulate(42,1440),recent=analyze(rows,defaults).map((signal,index)=>({signal,index})).filter(r=>r.signal.direction!=='neutral').slice(-20).reverse();
 await expect(page.getByTestId('signal-outcome')).toHaveCount(recent.length);
 for(let i=0;i<recent.length;i++){const r=recent[i],outcome=signalOutcome(rows,r.index,r.signal.direction);await expect(page.getByTestId('signal-outcome').nth(i)).toHaveText(outcomeLabels[outcome.status]);}
 await page.setViewportSize({width:390,height:844});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
