import {existsSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {spawnSync,spawn} from 'node:child_process';

const root=fileURLToPath(new URL('../',import.meta.url));
if(!existsSync(new URL('../dist/index.html',import.meta.url))){
  console.log('首次启动：正在生成前端页面…');
  const build=spawnSync(process.execPath,[fileURLToPath(new URL('../node_modules/vite/bin/vite.js',import.meta.url)),'build'],{cwd:root,stdio:'inherit'});
  if(build.error||build.status!==0){
    console.error('前端构建失败，服务未启动。请确认依赖安装成功，并检查上方构建日志。');
    process.exit(build.status||1);
  }
}
const server=spawn(process.execPath,['server/index.mjs'],{cwd:root,stdio:'inherit',env:process.env});
server.on('error',error=>{console.error(error.message);process.exit(1)});
server.on('exit',code=>process.exit(code??1));
for(const signal of ['SIGTERM','SIGINT'])process.once(signal,()=>server.kill(signal));
