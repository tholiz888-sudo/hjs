import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {inflateSync} from 'node:zlib';
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
// Only reviewed, same-size lossless images may override immutable archive originals.
export function loadImageOverrides(dataRoot,{enabled=process.env.GARDEN_CLEAN_IMAGES!=='0'}={}){
 const result=new Map();if(!enabled)return result;
 let manifest;try{manifest=JSON.parse(fs.readFileSync(path.join(dataRoot,'cleaned/manifest.json'),'utf8'))}catch{return result}
 if(manifest.version!==1||!Array.isArray(manifest.images))return result;
 for(const item of manifest.images){try{
  if(!item.original||path.basename(item.original)!==item.original||!/^\w[\w.-]*\.png$/.test(item.file)||!Number.isSafeInteger(item.width)||!Number.isSafeInteger(item.height)||item.width<1||item.height<1||!item.reviewed)continue;
  const original=fs.readFileSync(path.join(dataRoot,'original',item.original)),filePath=path.join(dataRoot,'cleaned',item.file),bytes=fs.readFileSync(filePath);
  if(sha(original)!==item.originalSha256||sha(bytes)!==item.sha256||!bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))||bytes.readUInt32BE(16)!==item.width||bytes.readUInt32BE(20)!==item.height)continue;
  result.set(item.original,{filePath,bytes:bytes.length,type:'image/png',available:true});
 }catch{/* A missing or mismatched repair always falls back to its intact original. */}}
 for(const item of Array.isArray(manifest.animations)?manifest.animations:[]){try{
  if(!item.original||path.basename(item.original)!==item.original||!/^\w[\w.-]*\.swf$/.test(item.file)||!item.reviewed)continue;
  const original=fs.readFileSync(path.join(dataRoot,'original',item.original)),filePath=path.join(dataRoot,'cleaned',item.file),bytes=fs.readFileSync(filePath),signature=bytes.subarray(0,3).toString();
  if(sha(original)!==item.originalSha256||sha(bytes)!==item.sha256||!['FWS','CWS'].includes(signature)||bytes[3]!==original[3])continue;
  const body=signature==='CWS'?inflateSync(bytes.subarray(8),{maxOutputLength:128*1024*1024}):bytes.subarray(8);if(body.length+8!==bytes.readUInt32LE(4))continue;
  result.set(item.original,{filePath,bytes:bytes.length,type:'application/x-shockwave-flash',available:true});
 }catch{}}
 return result;
}
