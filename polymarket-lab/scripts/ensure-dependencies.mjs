import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {spawnSync} from 'node:child_process';
const root=fileURLToPath(new URL('../',import.meta.url));
const manifest=JSON.parse(await readFile(join(root,'package.json'),'utf8'));
async function ready(){
  for(const [name,version] of Object.entries(manifest.dependencies||{})){
    try{const installed=JSON.parse(await readFile(join(root,'node_modules',name,'package.json'),'utf8'));if(installed.version!==version)return false;}catch{return false;}
  }
  // A new process avoids caching a failed import before npm restores the dependency tree.
  const probe=spawnSync(process.execPath,['--input-type=module','--eval',"await import('@polymarket/client'); await import('@polymarket/client/viem'); await import('viem');"],{cwd:root,stdio:'ignore'});
  return probe.status===0;
}
if(!await ready()){
  console.log('检测到依赖缺失或版本不匹配，按锁文件安装后再运行测试。');
  if(!process.env.npm_execpath){console.error('请使用 npm test，或先运行 npm ci。');process.exit(1);}
  const result=spawnSync(process.execPath,[process.env.npm_execpath,'ci','--no-audit','--no-fund','--cache',process.env.npm_config_cache||join(tmpdir(),'polymarket-npm-cache')],{cwd:root,stdio:'inherit'});
  if(result.status!==0){console.error('依赖安装未成功，构建已停止。');process.exit(result.status||1);}
  if(!await ready()){console.error('依赖安装后仍无法载入官方SDK，构建已停止。');process.exit(1);}
  console.log('依赖安装与载入验证通过。');
}else console.log('依赖版本与载入检查通过。');
