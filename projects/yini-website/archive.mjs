import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
export const root=path.dirname(fileURLToPath(import.meta.url));
export function loadArchive(){
 const manifest=JSON.parse(fs.readFileSync(path.join(root,'data/manifest.json'),'utf8'));
 const pages=new Map(),source=new URL(manifest.start);let available=0,music=0,mp3=0;
 for(const record of manifest.records){
  const url=new URL(record.url);if(url.hostname!==source.hostname&&url.hostname!=='yini.org')continue;
  const entry={...record,available:false};
  if(record.status===200&&record.file&&path.basename(record.file)===record.file){
   const file=path.join(root,'data/original',record.file);
   try{if(fs.statSync(file).size===record.bytes){entry.filePath=file;entry.available=true;available++;if(/^audio\//i.test(record.type||''))music++;if(record.type==='audio/mpeg')mp3++}}catch{}
  }
  pages.set(url.pathname+url.search,entry);
 }
 return{pages,manifest,stats:{known:manifest.records.filter(r=>r.status===200).length,available,music,mp3,importComplete:available===manifest.records.filter(r=>r.status===200).length,unavailable:manifest.records.filter(r=>r.status!==200).length,complete:false}};
}
export function localize(buffer,prefix=''){
 let text=buffer.toString('latin1').replace(/(?:https?:)?\/\/(?:www\.)?(?:yini\.org|lili\.cc)\//gi,prefix+'/');
 if(prefix){text=text.replace(/(\b(?:href|src|action|background|poster)\s*=\s*["']?)(\/(?!\/)[^\s"'<>]*)/gi,(_,before,value)=>before+(value.startsWith(prefix+'/')?value:prefix+value));text=text.replace(/url\((['"]?)(\/(?!\/)[^)'"\s]+)\1\)/gi,(_,q,value)=>`url(${q}${value.startsWith(prefix+'/')?value:prefix+value}${q})`)}
 // This original anti-frame block contains syntax errors; leave article scripts intact.
 text=text.replace(/<script\b[^>]*>([\s\S]*?)<\/script\s*>/gi,(tag,body)=>body.includes("getElementByTagName('iframe')")&&body.includes('var hostname=location.hostname,')?'':tag);
 return Buffer.from(text,'latin1');
}
