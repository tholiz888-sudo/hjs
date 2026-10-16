import {spawn} from 'node:child_process';
const processes=[spawn(process.execPath,['server/index.mjs'],{stdio:'inherit',env:{...process.env,PORT:process.env.API_PORT||'3020'}}),spawn(process.execPath,['node_modules/vite/bin/vite.js','--host','0.0.0.0',...process.argv.slice(2)],{stdio:'inherit'})];
let closing=false;function close(code=0){if(closing)return;closing=true;for(const p of processes)p.kill('SIGTERM');setTimeout(()=>process.exit(code),200).unref()}
for(const p of processes){p.on('error',()=>close(1));p.on('exit',code=>close(code||0))}process.on('SIGINT',()=>close());process.on('SIGTERM',()=>close());
