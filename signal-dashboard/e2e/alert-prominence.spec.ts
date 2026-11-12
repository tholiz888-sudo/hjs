import {test,expect} from './fixtures';
test('prominent alert stays until acknowledged, plays six louder tones and can be silenced',async({page})=>{
 await page.clock.install();
 await page.addInitScript(()=>{
  const stats={starts:0,stops:0,peaks:[] as number[]};Object.defineProperty(window,'alertAudioStats',{value:stats});
  class FakeAudioContext{
   state='running';currentTime=0;destination={};async resume(){this.state='running'}async close(){this.state='closed'}
   createOscillator(){return {type:'sine',frequency:{value:0},onended:null as null|(()=>void),connect(){},disconnect(){},start(){stats.starts++},stop(when?:number){if(when===undefined){stats.stops++;this.onended?.()}}};}
   createGain(){return {gain:{setValueAtTime(){},exponentialRampToValueAtTime(value:number){stats.peaks.push(value)}},connect(){},disconnect(){}};}
  }
  Object.defineProperty(window,'AudioContext',{value:FakeAudioContext,configurable:true});
 });
 await page.route('**/api/market?*',route=>route.fulfill({status:503,json:{error:'测试未连接行情'}}));
 await page.goto('/');await page.getByRole('button',{name:'开启声音',exact:true}).click();
 const stats=()=>page.evaluate(()=>(window as unknown as {alertAudioStats:{starts:number;stops:number;peaks:number[]}}).alertAudioStats);
 expect((await stats()).starts).toBe(6);expect(Math.max(...(await stats()).peaks)).toBeGreaterThan(.15);
 await page.getByRole('button',{name:'测试提醒',exact:true}).click();const modal=page.getByRole('alertdialog');await expect(modal).toBeVisible();await expect(modal).toHaveAttribute('aria-modal','true');
 await expect(modal.getByRole('heading')).toHaveText('测试提醒');expect((await stats()).starts).toBe(12);
 await page.clock.fastForward(15000);await expect(modal).toBeVisible();expect((await stats()).starts).toBe(12);await expect(page.getByTestId('alert-count')).toContainText('0 条新信号');
 await modal.getByRole('button',{name:'停止响铃',exact:true}).click();await expect(modal).toBeVisible();await expect(modal.getByRole('button',{name:'停止响铃',exact:true})).toBeDisabled();expect((await stats()).stops).toBeGreaterThan(0);
 await modal.getByRole('button',{name:'我已看到',exact:true}).click();await expect(modal).toHaveCount(0);
 await page.setViewportSize({width:390,height:844});await page.getByRole('button',{name:'测试提醒',exact:true}).click();const box=await modal.boundingBox();expect(box!.x).toBeGreaterThanOrEqual(0);expect(box!.width).toBeLessThanOrEqual(390);await page.keyboard.press('Escape');await expect(modal).toHaveCount(0);
});
