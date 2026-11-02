import http from 'node:http';
import { timingSafeEqual } from 'node:crypto';
import { resolve } from 'node:path';
import { Automation } from './automation.mjs';
import { readFile } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { replay } from './engine.mjs';
const exec = promisify(execFile), root = fileURLToPath(new URL('./public/',import.meta.url));
export async function remote(url) {
  const {stdout} = await exec('curl',['--fail-with-body','--silent','--show-error','--max-time','15','--proto','=https',url],{maxBuffer:2*1024*1024});
  return JSON.parse(stdout);
}
export async function collect(slug) {
  if (typeof slug !== 'string' || !/^[a-z0-9-]{1,180}$/.test(slug)) throw Error('请输入市场 slug，例如市场网址最后一段；不是账户名');
  const markets = await remote(`https://gamma-api.polymarket.com/markets?slug=${encodeURIComponent(slug)}`);
  const market = Array.isArray(markets) && markets.find(m=>m.slug===slug);
  if (!market || market.closed || market.active === false) throw Error('未找到开放市场');
  const decode=v=>typeof v==='string'?JSON.parse(v):v;
  const outcomes=decode(market.outcomes), tokens=decode(market.clobTokenIds);
  if (!Array.isArray(outcomes) || outcomes.length!==2 || !Array.isArray(tokens) || tokens.length!==2) throw Error('仅支持二元 Up/Down 市场');
  const up=outcomes.findIndex(x=>String(x).toLowerCase()==='up'), down=outcomes.findIndex(x=>String(x).toLowerCase()==='down');
  if (up<0 || down<0 || !tokens.every(x=>/^\d+$/.test(String(x)))) throw Error('市场结果必须为 Up 和 Down');
  const books=await Promise.all([up,down].map(i=>remote(`https://clob.polymarket.com/book?token_id=${tokens[i]}`)));
  for (let i=0;i<2;i++) if (String(books[i].asset_id)!==String(tokens[[up,down][i]])) throw Error('盘口资产与市场不匹配');
  const times=books.map(b=>Number(b.timestamp));
  if (!times.every(Number.isFinite)) throw Error('上游盘口缺少时间戳');
  const snapshot={market:market.conditionId || slug,time:new Date(Math.min(...times)).toISOString(),observedAt:new Date().toISOString(),end:market.endDate,up:books[0].asks.map(x=>[Number(x.price),Number(x.size)]),down:books[1].asks.map(x=>[Number(x.price),Number(x.size)])};
  return {title:market.question,slug,snapshot};
}
export function createServer(options = {}) {
  const auto = new Automation({file:options.stateFile || resolve(process.env.LAB_DATA_DIR || fileURLToPath(new URL('./.local/',import.meta.url)), 'paper.json'),remote,collect});
  auto.ready.catch(error=>console.error(error.message));
  const server = http.createServer(async(req,res)=> {
    const send=(status,value)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(value));};
    try {
      const url=new URL(req.url,'http://localhost');
      if(req.method==='GET' && url.pathname==='/healthz') return send(200,{status:'ok',mode:'paper-only'});
      if(url.pathname.startsWith('/api/auto/')) {
        if(req.method==='GET' && url.pathname==='/api/auto/status') return send(200,await auto.status());
        const expected=process.env.LAB_ADMIN_TOKEN;
        const supplied=req.headers.authorization?.replace(/^Bearer /,'') || '';
        if(!expected || Buffer.byteLength(expected)!==Buffer.byteLength(supplied) || !timingSafeEqual(Buffer.from(expected),Buffer.from(supplied))) return send(401,{error:'请在 Render Environment 设置 LAB_ADMIN_TOKEN，再在页面输入同一管理口令；不是钱包密钥。'});
        if(req.method==='GET' && url.pathname==='/api/auto/export') {await auto.ready;return send(200,auto.state);}
        if(req.method==='POST' && url.pathname==='/api/auto/start') {await auto.start();return send(200,{running:true});}
        if(req.method==='POST' && url.pathname==='/api/auto/stop') {auto.stop();return send(200,{running:false});}
        return send(404,{error:'未找到'});
      }
      if(req.method==='POST' && url.pathname==='/api/replay') {
        if(req.headers.origin) {
          const origin = new URL(req.headers.origin);
          if (!['http:', 'https:'].includes(origin.protocol) || origin.host !== req.headers.host) return send(403,{error:'不接受跨站请求'});
        }
        let body=''; for await(const chunk of req) {body+=chunk;if(Buffer.byteLength(body)>2*1024*1024) return send(413,{error:'文件不能超过2MB'});}
        const input=JSON.parse(body);return send(200,replay(input.snapshots,input.config));
      }
      if(req.method==='GET' && url.pathname==='/api/collect') {
        try {return send(200,await collect(url.searchParams.get('slug')));} catch(error) {return send(502,{error:`公开盘口采集失败：${error.message.slice(0,500)}。请检查网络权限或市场 slug；未生成替代行情。`});}
      }
      if(req.method!=='GET') return send(405,{error:'方法不支持'});
      const files={'/':'index.html','/app.js':'app.js','/style.css':'style.css','/demo.json':'demo.json'};
      const file=files[url.pathname];if(!file)return send(404,{error:'未找到'});
      res.writeHead(200,{'Content-Type':file.endsWith('.html')?'text/html; charset=utf-8':file.endsWith('.css')?'text/css':file.endsWith('.js')?'text/javascript':'application/json','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'self'; style-src 'self'; script-src 'self'; connect-src 'self'; object-src 'none'; frame-ancestors 'none'"});res.end(await readFile(root+file));
    }catch(error){send(400,{error:error.message});}
  });
  server.on('close',()=>auto.stop());
  return server;
}
export function listenOptions(env = process.env) {
  const render = env.RENDER === 'true' || Boolean(env.RENDER_SERVICE_ID);
  return { port: Number(env.PORT || 3080), host: render ? '0.0.0.0' : (env.HOST || '127.0.0.1') };
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { port, host } = listenOptions();
  const server = createServer();
  server.on('error', error => { console.error('启动失败：', error.message); process.exitCode = 1; });
  server.listen(port, host, () => console.log(`Polymarket 模拟研究台已启动，监听 ${host}:${server.address().port}`));
}
