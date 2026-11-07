export const SYMBOLS_KEY='cpc:symbols:v1';
export function normalizeSymbol(value:string){return value.trim().toUpperCase();}
export function mergeSymbols(values:unknown[]):string[]{
 return [...new Set(values.filter((v):v is string=>typeof v==='string').map(normalizeSymbol).filter(v=>/^[A-Z0-9._/-]{2,30}$/.test(v)&&!['BTCUSDT','ETHUSDT','CUSTOM'].includes(v)))];
}
export function symbolSelection(symbol:string,customSymbol:string,symbols:string[]){const normalized=normalizeSymbol(customSymbol);return symbol==='CUSTOM'&&symbols.includes(normalized)?'saved:'+normalized:symbol;}
