import {MarketError} from './market-error.mjs';
// Use upstream retry guidance even when the response body is HTML rather than JSON.
export function parseBinanceResponse({status,body,headers='',now=Date.now()}){
 let data;try{data=JSON.parse(body)}catch{}
 if(status===451)throw new MarketError('Binance拒绝当前部署地区访问（HTTP 451），需要在交易所允许的运行地区接入。','REGION_RESTRICTED',3600000);
 if(status===429||status===418){const retry=String(headers).match(/^retry-after:\s*(.+)$/im)?.[1]?.trim();const numeric=retry!=null&&/^\d+(?:\.\d+)?$/.test(retry)?Number(retry)*1000:NaN;const headerMs=Number.isFinite(numeric)?numeric:Date.parse(retry)-now;const bannedUntil=String(data?.msg||body||'').match(/banned\s+until\s+(\d{10,13})/i)?.[1];const banMs=bannedUntil?(Number(bannedUntil)*(bannedUntil.length===10?1000:1)-now):0;const fallback=status===418?1800000:300000;const guidance=Math.max(Number.isFinite(headerMs)?headerMs:0,banMs);const delay=guidance>0?Math.max(1000,guidance+5000):fallback;throw new MarketError(`Binance限流（HTTP ${status}），暂停请求，最早于 ${new Date(now+delay).toISOString()} 重试。`,'RATE_LIMITED',delay)}
 if(data===undefined)throw new MarketError(`Binance响应格式异常（HTTP ${status}）`,'INVALID_RESPONSE');
 if(status<200||status>=300||data?.code<0)throw new MarketError(`Binance请求失败（HTTP ${status}）`,'UPSTREAM_ERROR');return data;
}

export function binanceResponseMetadata({path,status,headers='',now=Date.now()}){const weights={};for(const match of String(headers).matchAll(/^x-mbx-used-weight(?:-(\d+[smhd]))?:\s*(\d+)\s*$/gim))weights[match[1]?.toLowerCase()||'unspecified']=Number(match[2]);return{at:new Date(now).toISOString(),endpoint:new URL(path,'https://internal.invalid').pathname,httpStatus:status,usedWeight:weights}}
