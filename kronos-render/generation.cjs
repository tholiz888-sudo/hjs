'use strict';
const crypto=require('node:crypto');
const REPO='tholiz888-sudo/hjs',WORKFLOW='kronos-forecast.yml',BRANCH='codex/kronos-render-free';
const SYMBOLS=['BTCUSDT','ETHUSDT','SOLUSDT','BNBUSDT','XRPUSDT'],INTERVALS=['15m','1h','4h','1d'],PATHS=[2,3,5];
const activeStates=new Set(['queued','in_progress','waiting','requested','pending']);
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
class ApiError extends Error{constructor(status,message){super(message);this.status=status;}}
function createGenerationApi({fetchImpl=global.fetch,env=process.env,now=Date.now}={}){
  const tasks=new Map(),attempts=new Map();let dispatching=false,lastDispatch=null;
  const configured=()=>Boolean(env.KRONOS_GITHUB_TOKEN?.trim()&&env.KRONOS_RUN_KEY?.length>=16&&env.KRONOS_RUN_KEY.length<=256);
  function respond(res,status,value){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(value));}
  function limit(req){const key=req.socket.remoteAddress||'unknown',time=now();let value=attempts.get(key);if(!value||time-value.start>60000){value={start:time,count:0};attempts.set(key,value);}if(++value.count>30)throw new ApiError(429,'请求过于频繁，请一分钟后重试。');if(attempts.size>1000)attempts.delete(attempts.keys().next().value);}
  async function github(suffix,options={}){
    let response;
    try{response=await fetchImpl(`https://api.github.com/repos/${REPO}${suffix}`,{...options,signal:AbortSignal.timeout(20000),headers:{'Accept':'application/vnd.github+json','Authorization':`Bearer ${env.KRONOS_GITHUB_TOKEN.trim()}`,'X-GitHub-Api-Version':'2022-11-28','User-Agent':'hjs-kronos',...(options.body?{'Content-Type':'application/json'}:{})}});}catch{throw new ApiError(502,'暂时无法连接生成服务，请稍后重试。');}
    if(!response.ok){if(response.status===401||response.status===403)throw new ApiError(502,'GitHub 连接权限不足或受限，请维护者检查连接配置。');if(response.status===404)throw new ApiError(502,'未找到预测工作流或仓库，请维护者检查连接配置。');throw new ApiError(502,'GitHub 暂时无法处理请求，请稍后重试。');}
    return response.status===204?null:response.json();
  }
  async function runs(){const data=await github(`/actions/workflows/${WORKFLOW}/runs?branch=main&per_page=30`);return Array.isArray(data.workflow_runs)?data.workflow_runs:[];}
  function store(id,value){if(tasks.size>=128&&!tasks.has(id))tasks.delete(tasks.keys().next().value);tasks.set(id,value);return value;}
  async function status(id){
    const cached=tasks.get(id);if(cached?.updated&&now()-cached.updated<8000)return cached.value;
    const list=await runs(),run=list.find(r=>typeof r.display_title==='string'&&r.display_title.includes(`[${id}]`));
    if(!run){const value={state:'queued',message:'任务已提交，正在等待 GitHub 分配运行资源。'};store(id,{updated:now(),value});return value;}
    if(!Number.isSafeInteger(run.id)||run.id<=0)throw new ApiError(502,'生成服务返回了无效任务。');
    const runUrl=`https://github.com/${REPO}/actions/runs/${run.id}`;
    let value;
    if(run.status!=='completed')value={state:run.status==='in_progress'?'running':'queued',run_url:runUrl,message:run.status==='in_progress'?'正在获取行情并生成预测，请保持页面打开；下方保留上一份结果。':'任务排队中，下方保留上一份结果。'};
    else if(run.conclusion!=='success')value={state:'failed',run_url:runUrl,message:run.conclusion==='cancelled'?'任务已取消，上一份预测保持不变。':'本次生成未成功，上一份预测保持不变。可查看任务详情。'};
    else{
      const file=await github(`/contents/kronos-render/results/forecast.json?ref=${encodeURIComponent(BRANCH)}`);
      if(file.encoding!=='base64'||typeof file.content!=='string'||file.size>2000000)throw new ApiError(502,'生成结果格式无效。');
      let result;try{result=JSON.parse(Buffer.from(file.content,'base64').toString('utf8'));}catch{throw new ApiError(502,'生成结果格式无效。');}
      if(result.metadata?.run_url!==runUrl)value={state:'publishing',run_url:runUrl,message:'计算已完成，等待最新结果发布。'};
      else if(result.history?.length!==512||!Array.isArray(result.paths)||result.paths.length<2||!result.paths.every(p=>Array.isArray(p)&&p.length===24))throw new ApiError(502,'生成结果不完整。');
      else value={state:'completed',run_url:runUrl,message:'预测已生成，已显示本次最新结果。',result};
    }
    store(id,{updated:now(),value});return value;
  }
  return async function handle(req,res,pathname){
    try{
      if(pathname==='/kronos/api/config'&&req.method==='GET')return respond(res,200,{configured:configured(),symbols:SYMBOLS,intervals:INTERVALS,paths:PATHS});
      if(!configured())throw new ApiError(503,'网站生成连接尚未配置。仍可通过备用 GitHub 入口生成。');
      limit(req);
      if(pathname==='/kronos/api/generate'&&req.method==='POST'){
        if(req.headers.origin){let origin;try{origin=new URL(req.headers.origin);}catch{throw new ApiError(403,'请求来源不匹配。');}if(origin.host!==req.headers.host)throw new ApiError(403,'请求来源不匹配。');}
        const supplied=String(req.headers.authorization||'').replace(/^Bearer /,'');
        const hash=value=>crypto.createHash('sha256').update(value).digest();
        if(!crypto.timingSafeEqual(hash(supplied),hash(env.KRONOS_RUN_KEY)))throw new ApiError(401,'生成口令不正确。');
        if(dispatching||(lastDispatch!==null&&now()-lastDispatch<60000))throw new ApiError(429,'刚刚提交过任务，请一分钟后重试。');
        let text='';for await(const chunk of req){text+=chunk;if(Buffer.byteLength(text)>2048)throw new ApiError(413,'请求过大。');}
        let input;try{input=JSON.parse(text);}catch{throw new ApiError(400,'生成参数无效。');}
        if(!input||!SYMBOLS.includes(input.symbol)||!INTERVALS.includes(input.interval)||!PATHS.includes(input.paths))throw new ApiError(400,'请选择有效的交易对、周期和路径数。');
        if(dispatching||(lastDispatch!==null&&now()-lastDispatch<60000))throw new ApiError(429,'刚刚提交过任务，请一分钟后重试。');
        dispatching=true;
        try{
          const repo=await github('');if(repo.private!==false)throw new ApiError(409,'此免费生成入口仅允许公开仓库运行。');
          if((await runs()).some(r=>activeStates.has(r.status)))throw new ApiError(409,'已有预测任务正在运行，请等待它完成后重试。');
          const id=crypto.randomUUID();
          await github(`/actions/workflows/${WORKFLOW}/dispatches`,{method:'POST',body:JSON.stringify({ref:'main',inputs:{symbol:input.symbol,interval:input.interval,paths:String(input.paths),request_id:id}})});
          lastDispatch=now();store(id,{updated:now(),value:{state:'queued',message:'任务已提交，正在等待 GitHub 分配运行资源。'}});
          return respond(res,202,{task_id:id,state:'queued',message:'任务已提交，稍后会自动显示最新结果。'});
        }finally{dispatching=false;}
      }
      const match=/^\/kronos\/api\/tasks\/([^/]+)$/.exec(pathname);
      if(match&&req.method==='GET'){if(!uuid.test(match[1]))throw new ApiError(400,'任务编号无效。');return respond(res,200,await status(match[1]));}
      throw new ApiError(404,'接口不存在。');
    }catch(error){return respond(res,error.status||502,{error:error.status?error.message:'生成服务暂时不可用，请稍后重试。'});}
  };
}
module.exports={createGenerationApi};
