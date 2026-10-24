import {localize} from './archive.mjs';
import {installEffects} from './effects.mjs';
export function decodeDocument(buffer,type=''){
 if(typeof buffer==='string')return buffer;
 const first=buffer.subarray(0,8192).toString('latin1'),encoding=type.match(/charset\s*=\s*["']?([\w-]+)/i)?.[1]||first.match(/charset\s*=\s*["']?([\w-]+)/i)?.[1];
 if(encoding){try{return new TextDecoder(encoding).decode(buffer)}catch{}}
 try{return new TextDecoder('utf-8',{fatal:true}).decode(buffer)}catch{return new TextDecoder('gb18030').decode(buffer)}
}
export function prepareDocument(buffer,{type='',prefix='',pagePath='/',title,musicPath,hiddenPaths=[],renames=[],extraHTML='',availablePaths}={}){
 let html=localize(Buffer.from(decodeDocument(buffer,type)),prefix).toString('utf8');
 const attribute=(attrs,key)=>attrs.match(new RegExp('\\b'+key+'\\s*=\\s*(?:"([^"]*)"|\'([^\']*)\'|([^\\s>]+))','i'))?.slice(1).find(x=>x!==undefined)||'';
 const external=value=>/^(?:https?:|\/\/|mailto:|ftp:|tel:)/i.test(value)||/https?:\/\//i.test(value);
 const hidden=new Set(hiddenPaths);
 html=html.replace(/<a\b([^>]*?)>([\s\S]*?)<\/a\s*>/gi,(tag,attrs,inner)=>{const href=attribute(attrs,'href');if(external(href))return inner;try{const u=new URL(href,'http://archive.local'+prefix+pagePath);const p=u.pathname.startsWith(prefix)?u.pathname.slice(prefix.length):u.pathname;if(hidden.has(p+u.search))return''}catch{}for(const rename of renames){inner=inner.split(/(<[^>]+>)/).map((part,i)=>i%2?part:part.split(rename.from).join(escapeHTML(rename.to))).join('')}return '<a'+attrs+'>'+inner+'</a>'});
 html=html.replace(/\s+(?:href|src|poster|background|action|data)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/gi,(tag,a,b,c)=>external(a??b??c)?'':tag);
 html=html.replace(/\s+on\w+\s*=\s*(?:"[^"]*https?:\/\/[^\"]*"|'[^']*https?:\/\/[^']*')/gi,'');
 html=html.replace(/<font\b[^>]*>\s*网站域名[\s\S]*?<\/font>\s*<font\b[^>]*>[\s\S]*?<\/font>/gi,'');
 html=html.replace(/(?:[\w.+-]+@)?(?:www\.)?(?:yini\.org|lili\.cc)\b/gi,'');
 html=html.replace(/(?:[\u4e00-\u9fff]{0,2}\s*)ICP\s*[备案证\s]*\d[\d\s-]*号?/gi,'');
 html=html.replace(/https?:\/\/[^\s"'<>`]+/gi,'');
 html=html.replace(/<meta\b[^>]*charset[^>]*>/gi,'').replace(/<base\b[^>]*>/gi,'');
 if(title)html=html.replace(/<title[^>]*>[\s\S]*?<\/title>/i,()=>'<title>'+escapeHTML(title)+'</title>');
 if(musicPath!==undefined){html=html.replace(/<(audio|video)\b[^>]*>[\s\S]*?<\/\1\s*>|<bgsound\b[^>]*>/gi,'');if(musicPath)extraHTML+=`<audio id="p-music" loop preload="metadata" src="${escapeHTML(musicPath)}"></audio><script>document.addEventListener('click',()=>document.getElementById('p-music').play().catch(()=>{}),{once:true})</script>`}
 if(extraHTML)html=/<\/body>/i.test(html)?html.replace(/<\/body>/i,()=>extraHTML+'</body>'):html+extraHTML;
 const directory=pagePath.split('?')[0].replace(/[^/]*$/,'');const base=`<meta charset="utf-8"><base href="${escapeHTML(prefix+directory)}">`;
 html=/<head\b[^>]*>/i.test(html)?html.replace(/<head\b[^>]*>/i,tag=>tag+base):base+html;
 html=installEffects(html,{prefix,pagePath,availablePaths});
 return Buffer.from(html);
}
function escapeHTML(s){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
