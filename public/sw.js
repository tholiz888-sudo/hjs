// Installable web application. Never cache account APIs, user content or market
// responses: stale quotes must not be mistaken for live data while offline.
self.addEventListener('install',()=>self.skipWaiting());
self.addEventListener('activate',event=>event.waitUntil(self.clients.claim()));
self.addEventListener('fetch',event=>{
 if(event.request.mode!=='navigate')return;
 event.respondWith(fetch(event.request).catch(()=>new Response('<!doctype html><html lang="zh-CN"><meta charset="UTF-8"><meta name="viewport" content="width=device-width"><title>连接已断开</title><body style="background:#000;color:#fff;font-family:sans-serif;padding:32px"><h1>网络连接已断开</h1><p>无法更新行情，请恢复网络后重新打开页面。</p></body></html>',{status:503,headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'}})));
});
