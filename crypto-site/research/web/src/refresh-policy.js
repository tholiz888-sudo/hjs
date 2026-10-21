export const isMarketRoute=path=>['/strategy','/ai-strategy','/data/smart-money-v1','/data/volume-monitor','/data/three-indicator-resonance'].includes(path);
export function coalesceRequest(load){let active=null;return (...args)=>{if(active)return active;active=Promise.resolve().then(()=>load(...args)).finally(()=>{active=null});return active}}
