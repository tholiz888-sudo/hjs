'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {DatabaseSync}=require('node:sqlite');
const DEFAULTS={title:'观察未来的多种可能',description:'512 根已收盘 K 线 → 未来 24 根。独立采样保留每条走势，帮助你比较模型生成的不同情景。',defaultSymbol:'BTCUSDT',defaultInterval:'1h',defaultPaths:3,defaultView:'future',showBand:true,showMedian:true,showComparison:true,showTable:true,autoLatest:true};
const steps={'15m':900000,'1h':3600000,'4h':14400000,'1d':86400000},features=['open','high','low','close','volume','amount'];
const error=message=>{throw Error(message);};
function timestamp(value){if(typeof value!=='string'||value.length>40)return error('时间格式无效');const normalized=value.replace(' ','T'),time=Date.parse(/Z$|[+-]\d\d:\d\d$/.test(normalized)?normalized:normalized+'Z');if(!Number.isFinite(time))return error('时间格式无效');return time;}
function settings(input){if(!input||typeof input!=='object'||Array.isArray(input))return error('设置格式无效');const result={};for(const key of Object.keys(DEFAULTS)){const v=input[key];if(typeof DEFAULTS[key]==='boolean'){if(typeof v!=='boolean')return error('显示设置需要是开关值');result[key]=v;}else result[key]=v;}
 if(typeof result.title!=='string'||!result.title.trim()||result.title.length>80)return error('标题需为 1–80 字');if(typeof result.description!=='string'||result.description.length>500)return error('说明最多 500 字');
 if(!['BTCUSDT','ETHUSDT','SOLUSDT','BNBUSDT','XRPUSDT'].includes(result.defaultSymbol)||!Object.hasOwn(steps,result.defaultInterval)||![2,3,5].includes(result.defaultPaths)||!['future','history'].includes(result.defaultView))return error('推荐参数无效');return result;}
function forecast(input){
 if(!input||typeof input!=='object')return error('预测文件格式无效');const m=input.metadata;
 if(!m||m.context!==512||m.horizon!==24||m.model!=='NeoQuasar/Kronos-small'||!Object.hasOwn(steps,m.interval)||!Array.isArray(input.history)||input.history.length!==512||!Array.isArray(input.paths)||input.paths.length<2||input.paths.length>20||m.paths!==input.paths.length)return error('需要 512 根历史和 2–20 条、每条 24 根的 Kronos-small 预测');
 if(typeof m.symbol!=='string'||!/^[A-Z0-9]{3,20}$/.test(m.symbol))return error('交易对无效');
 function series(rows,size){if(!Array.isArray(rows)||rows.length!==size)return error('K 线数量无效');let previous=null;return rows.map(row=>{if(!row||typeof row!=='object')return error('K 线格式无效');const time=timestamp(row.timestamps);if(previous!==null&&time-previous!==steps[m.interval])return error('K 线时间必须连续且无重复');previous=time;const result={timestamps:new Date(time).toISOString()};for(const key of features){if(typeof row[key]!=='number'||!Number.isFinite(row[key]))return error('价格或成交量包含无效数值');result[key]=row[key];}return result;});}
 const history=series(input.history,512),paths=input.paths.map(p=>series(p,24)),end=timestamp(history.at(-1).timestamps);
 if(history.some(r=>r.close<=0))return error('历史收盘价必须大于零');for(const p of paths)if(timestamp(p[0].timestamps)!==end+steps[m.interval])return error('预测时间必须紧接历史行情');
 if(new Set(paths.map(p=>p.map(r=>r.close).join(','))).size<2)return error('预测路径完全相同');
 const metadata={symbol:m.symbol,interval:m.interval,paths:paths.length,context:512,horizon:24,model:m.model,source:typeof m.source==='string'?m.source.slice(0,500):'管理员导入',generated_at_utc:new Date(timestamp(m.generated_at_utc)).toISOString(),last_closed_open_time_utc:new Date(end).toISOString(),time_basis:'UTC'};
 for(const key of ['model_revision','tokenizer_revision','warning'])if(typeof m[key]==='string')metadata[key]=m[key].slice(0,500);
 if(Number.isSafeInteger(m.seed))metadata.seed=m.seed;
 if(typeof m.run_url==='string'&&/^https:\/\/github\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+\/actions\/runs\/\d+$/.test(m.run_url))metadata.run_url=m.run_url;
 return {metadata,history,paths};
}
function createStore({dbPath=process.env.KRONOS_DB_PATH||path.join(process.env.DATA_DIR||path.join(__dirname,'..','.local'),'kronos.sqlite'),seedDir=path.join(__dirname,'results')}={}){
 if(dbPath!==':memory:')fs.mkdirSync(path.dirname(dbPath),{recursive:true,mode:0o700});const db=new DatabaseSync(dbPath),issues=[];
 db.exec('PRAGMA journal_mode=WAL; CREATE TABLE IF NOT EXISTS config(key TEXT PRIMARY KEY,value TEXT NOT NULL); CREATE TABLE IF NOT EXISTS forecasts(id TEXT PRIMARY KEY,payload TEXT,generated INTEGER NOT NULL,symbol TEXT NOT NULL,interval TEXT NOT NULL,paths INTEGER NOT NULL,deleted INTEGER NOT NULL DEFAULT 0);');
 db.prepare('INSERT OR IGNORE INTO config VALUES(?,?)').run('settings',JSON.stringify(DEFAULTS));
 const getSettings=()=>JSON.parse(db.prepare('SELECT value FROM config WHERE key=?').get('settings').value);
 const currentId=()=>{const list=db.prepare('SELECT id FROM forecasts WHERE deleted=0 ORDER BY generated DESC,id DESC').all();if(getSettings().autoLatest)return list[0]?.id||null;const selected=db.prepare('SELECT value FROM config WHERE key=?').get('current')?.value;return list.some(r=>r.id===selected)?selected:list[0]?.id||null;};
 function add(value,{seed=false}={}){const data=forecast(value),payload=JSON.stringify(data),id=crypto.createHash('sha256').update(payload).digest('hex').slice(0,24),existing=db.prepare('SELECT deleted FROM forecasts WHERE id=?').get(id);if(existing&&seed)return id;
  const m=data.metadata;db.prepare('INSERT INTO forecasts VALUES(?,?,?,?,?,?,0) ON CONFLICT(id) DO UPDATE SET payload=excluded.payload,deleted=0').run(id,payload,timestamp(m.generated_at_utc),m.symbol,m.interval,m.paths);
  const selected=currentId(),rows=db.prepare('SELECT id FROM forecasts WHERE deleted=0 ORDER BY generated DESC,id DESC').all();let excess=rows.length-50;for(const row of [...rows].reverse()){if(excess<=0)break;if(row.id!==selected&&(seed||row.id!==id)){db.prepare('UPDATE forecasts SET deleted=1,payload=NULL WHERE id=?').run(row.id);excess--;}}return id;
 }
 function saveSettings(value){const valid=settings(value);db.prepare('UPDATE config SET value=? WHERE key=?').run(JSON.stringify(valid),'settings');return valid;}
 function get(id=currentId()){if(!id)return null;if(!/^[a-f0-9]{24}$/.test(id))return error('记录编号无效');const row=db.prepare('SELECT payload FROM forecasts WHERE id=? AND deleted=0').get(id);return row?JSON.parse(row.payload):null;}
 function list(){const active=currentId();return db.prepare('SELECT id,symbol,interval,paths,generated FROM forecasts WHERE deleted=0 ORDER BY generated DESC,id DESC').all().map(r=>({...r,generated_at_utc:new Date(r.generated).toISOString(),current:r.id===active}));}
 const seedFiles=[];if(fs.existsSync(path.join(seedDir,'history')))for(const file of fs.readdirSync(path.join(seedDir,'history')).sort())if(/^forecast-[a-f0-9]{24}\.json$/.test(file))seedFiles.push(path.join(seedDir,'history',file));if(fs.existsSync(path.join(seedDir,'forecast.json')))seedFiles.push(path.join(seedDir,'forecast.json'));
 for(const file of seedFiles){try{add(JSON.parse(fs.readFileSync(file,'utf8')),{seed:true});}catch(e){issues.push({file:path.basename(file),error:e.message});}}
 return {settings:getSettings,saveSettings,add,get,list,currentId,issues,
  select(id){if(!get(id))return error('记录不存在');saveSettings({...getSettings(),autoLatest:false});db.prepare('INSERT INTO config VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').run('current',id);},
  remove(id){if(id===currentId())return error('当前展示记录不能删除，请先切换到另一条记录');if(!get(id))return error('记录不存在');db.prepare('UPDATE forecasts SET deleted=1,payload=NULL WHERE id=?').run(id);},
  backup(){return {format:'kronos-admin-backup',version:1,exported_at:new Date().toISOString(),settings:getSettings(),currentId:currentId(),forecasts:list().map(r=>get(r.id))};},
  restore(value){if(value?.format!=='kronos-admin-backup'||value.version!==1||!Array.isArray(value.forecasts)||value.forecasts.length>50)return error('备份格式无效或超过 50 条');const replacing=value.restoreMode==='replace',config=settings(value.settings),records=value.forecasts.map(forecast),ids=new Set(replacing?[]:list().map(r=>r.id));for(const record of records)ids.add(crypto.createHash('sha256').update(JSON.stringify(record)).digest('hex').slice(0,24));if(ids.size>50)return error('合并后超过 50 条，请先备份并清理历史');if(value.currentId&&!records.some(r=>crypto.createHash('sha256').update(JSON.stringify(r)).digest('hex').slice(0,24)===value.currentId))return error('备份中的展示记录不存在');db.exec('BEGIN');try{if(replacing)db.exec('UPDATE forecasts SET deleted=1,payload=NULL');const ids=records.map(r=>add(r));saveSettings(config);if(value.currentId&&ids.includes(value.currentId))db.prepare('INSERT INTO config VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').run('current',value.currentId);db.exec('COMMIT');}catch(e){db.exec('ROLLBACK');throw e;}},close:()=>db.close()};
}
let singleton;function getStore(){return singleton||(singleton=createStore());}
module.exports={createStore,getStore,DEFAULTS,forecast,settings};
