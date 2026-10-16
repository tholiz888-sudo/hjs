export function createMarketEvents(){
 const clients=new Set();let revision=0,pending=null,timer=null,closed=false;
 const heartbeat=setInterval(()=>{for(const res of clients)if(!res.destroyed)res.write(': heartbeat\n\n')},20000);heartbeat.unref();
 function send(res,data){if(res.destroyed||res.writableLength>65536){res.destroy();clients.delete(res);return}res.write('event: market\ndata: '+JSON.stringify(data)+'\n\n')}
 return{connect(req,res){if(closed||clients.size>=100){res.writeHead(503);res.end();return}res.writeHead(200,{'Content-Type':'text/event-stream','Cache-Control':'no-cache, no-transform','Connection':'keep-alive','X-Accel-Buffering':'no'});res.write(': connected\n\n');clients.add(res);res.on('close',()=>clients.delete(res));},notify(info){if(closed)return;pending={source:info.source,reason:info.reason,revision:++revision};if(timer)return;timer=setTimeout(()=>{timer=null;const data=pending;pending=null;for(const res of clients)send(res,data)},750);timer.unref()},close(){closed=true;clearInterval(heartbeat);clearTimeout(timer);for(const res of clients)res.end();clients.clear()}};
}
