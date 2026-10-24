const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function attrs(text){const result={};for(const m of text.matchAll(/([\w-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g))result[m[1].toLowerCase()]=m[2]??m[3]??m[4];return result}
export function installEffects(html,{prefix='',pagePath='/',availablePaths}={}){
 const config={applets:[],flash:[],snow:false,fireworks:false,missing:[]};
 const resolve=p=>{if(prefix&&p.startsWith(prefix+'/'))return p;const u=new URL(p,'http://archive.local'+pagePath);return prefix+u.pathname};
 const asset=p=>{const url=resolve(p),source=url.slice(prefix.length),available=!availablePaths||availablePaths.has(source);if(!available)config.missing.push(source);return{url,available}};
 html=html.replace(/<script\b[^>]*src\s*=\s*["']?[^"'\s>]*snow\.js["']?[^>]*>\s*<\/script>/gi,()=>{config.snow=true;return''});
 if(pagePath.split('?')[0]==='/welcome/java/yanhua/index.html'){
  config.fireworks=true;config.fireworkImage=asset('media/yanhua.jpg');config.fireworkSounds=['media/shoot.ogg','media/explode.ogg','media/xqx.ogg'].map(asset);
  if(config.fireworkImage.available&&config.fireworkSounds.every(a=>a.available))config.fireworks=false;
  if(config.fireworks)html=html.replace(/<script\b[^>]*src\s*=\s*["']?[^"'\s>]*game\.min\.js["']?[^>]*>\s*<\/script>/gi,'');
 }
 html=html.replace(/<applet\b([^>]*)>([\s\S]*?)<\/applet\s*>/gi,(tag,raw,body)=>{
  const a=attrs(raw),params={};for(const p of body.matchAll(/<param\b([^>]*)>/gi)){const v=attrs(p[1]);if(v.name)params[v.name.toLowerCase()]=v.value||''}
  const code=(a.code||params.code||'').toLowerCase(),kind=code.includes('lake')?'lake':code.includes('snow')?'snow':code.includes('fade')?'fade':'rain';
  const images=(kind==='fade'?[params.image1,params.image2]:[params.image||params.graphic||params.grph,params.overlay]).filter(Boolean).map(asset);
  const entry={kind,images,width:Math.min(1200,Math.max(100,Number(a.width||params.width)||480)),height:Math.min(900,Math.max(100,Number(a.height||params.height)||270))};
  const id='garden-applet-'+config.applets.length;config.applets.push({...entry,id});return`<div id="${id}" data-garden-effect="${kind}" style="display:inline-block;position:relative;max-width:100%;width:${entry.width}px"><canvas width="${entry.width}" height="${entry.height}" role="img" aria-label="${esc({lake:'湖面波纹',snow:'飘雪',fade:'图片渐变',rain:'细雨'}[kind])}" style="display:block;max-width:100%;height:auto"></canvas></div>`;
 });
 const flashMarkup=(raw,body='')=>{const outer=attrs(raw),embed=attrs(body.match(/<embed\b([^>]*)>/i)?.[1]||'');let movie=outer.data||outer.src||embed.src;for(const m of body.matchAll(/<param\b([^>]*)>/gi)){const p=attrs(m[1]);if(p.name?.toLowerCase()==='movie')movie=p.value}if(!movie||!movie.split('?')[0].toLowerCase().endsWith('.swf'))return null;const id='garden-flash-'+config.flash.length,width=outer.width||embed.width||'550',height=outer.height||embed.height||'400';const dimension=x=>/^\d+(?:\.\d+)?%?$/.test(x)?x+(x.endsWith('%')?'':'px'):'400px';config.flash.push({id,url:resolve(movie)});return`<span id="${id}" data-garden-flash style="display:inline-block;vertical-align:middle;width:${dimension(width)};height:${dimension(height)};max-width:100%"></span>`};
 html=html.replace(/<object\b([^>]*)>([\s\S]*?)<\/object\s*>/gi,(tag,raw,body)=>flashMarkup(raw,body)||tag).replace(/<embed\b([^>]*)>/gi,(tag,raw)=>flashMarkup(raw)||tag);
 const flash=config.flash.length>0;
 let scripts='';
 if(flash)scripts+=`<script>window.RufflePlayer=window.RufflePlayer||{};window.RufflePlayer.config={publicPath:${JSON.stringify(prefix+'/__compat/ruffle/')},autoplay:'on',unmuteOverlay:'visible',allowScriptAccess:false,allowNetworking:'internal',openUrlMode:'deny',showSwfDownload:false,splashScreen:false,contextMenu:'off'};</script><script defer src="${prefix}/__compat/ruffle/ruffle.js"></script>`;
 if(config.applets.length||config.snow||config.fireworks||flash)scripts+=`<script id="garden-effects-config" type="application/json">${JSON.stringify(config).replace(/</g,'\\u003c')}</script><script defer src="${prefix}/__compat/effects.js"></script>`;
 if(!scripts)return html;if(/<\/head>/i.test(html))return html.replace(/<\/head>/i,()=>scripts+'</head>');if(/<body\b/i.test(html))return html.replace(/<body\b/i,()=>scripts+'<body');return html+scripts;
}
