import {test,expect} from './fixtures';
test('enhanced filters are individually configurable, persisted and compared with the baseline',async({page})=>{
 await page.route('**/api/market?*',route=>route.fulfill({status:503,json:{error:'测试未联网'}}));await page.goto('/rules');
 const adx=page.getByRole('switch',{name:'启用 ADX 趋势强度过滤'}),atr=page.getByRole('switch',{name:'启用 ATR 波动区间过滤'}),deviation=page.getByRole('switch',{name:'启用价格偏离过滤'});
 await expect(adx).not.toBeChecked();await expect(atr).not.toBeChecked();await expect(deviation).not.toBeChecked();await adx.check();await page.getByLabel('ADX 最低强度',{exact:true}).fill('25');await atr.check();await deviation.check();
 await expect.poll(()=>page.evaluate(()=>JSON.parse(localStorage.getItem('signal-params-v1')||'{}').adxMin)).toBe(25);
 await page.getByLabel('ATR 最低波动率（%）',{exact:true}).fill('2');await expect(page.getByRole('alert')).toContainText('ATR');await page.getByLabel('ATR 最低波动率（%）',{exact:true}).fill('0.02');
 await page.reload();await expect(adx).toBeChecked();await expect(atr).toBeChecked();await expect(deviation).toBeChecked();await expect(page.getByLabel('ADX 最低强度',{exact:true})).toHaveValue('25');
 await page.locator('.sidebar').getByRole('link',{name:'策略回测',exact:true}).click();await expect(page.getByRole('heading',{name:'增强过滤前后对照 · 十分钟方向结果'})).toBeVisible();
 const baseline=page.getByTestId('filter-comparison-baseline'),selected=page.getByTestId('filter-comparison-selected');await expect(baseline).toBeVisible();expect(Number(await selected.locator('td').nth(1).innerText())).toBeLessThanOrEqual(Number(await baseline.locator('td').nth(1).innerText()));
 await page.setViewportSize({width:390,height:844});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
