import { D } from './calculations';
import { DEFAULT_PLAN, type Plan, type SavedPlan } from './types';
export const PREF_KEY='cpc:preferences:v1', PLANS_KEY='cpc:plans:v1', THEME_KEY='cpc:theme:v1';
export function isPlan(value:unknown):value is Plan {
  if(!value||typeof value!=='object') return false;
  const p=value as Record<string,unknown>;
  return Object.keys(DEFAULT_PLAN).filter(k=>k!=='targets').every(k=>typeof p[k]==='string') && ['price','total'].includes(p.costMode as string) && ['margin','stop'].includes(p.solveMode as string) && ['amount','percent'].includes(p.riskMode as string) && ['long','short'].includes(p.direction as string) && Array.isArray(p.targets)&&p.targets.length===2&&p.targets.every(t=>t&&['r','price'].includes(t.mode)&&typeof t.value==='string'&&typeof t.share==='string');
}
export function parsePlan(value:unknown,legacyCostMode:Plan['costMode']='price'):Plan|null {
  if(value&&typeof value==='object'&&!('costMode' in value))value={...value,costMode:legacyCostMode};
  if(isPlan(value))return value;
  if(value&&typeof value==='object'){const p=value as Record<string,unknown>;if(p.solveMode===undefined&&p.marginInput===undefined){value={...p,solveMode:'margin',marginInput:'100'};if(isPlan(value))return value;}}
  if(!value||typeof value!=='object')return null;
  const legacy=value as Record<string,unknown>;
  if(legacy.riskMode!==undefined||legacy.maxLoss!==undefined)return null;
  try{
    const migrated={...legacy,riskMode:'amount',maxLoss:new D(legacy.equity as string).mul(legacy.risk as string).div(100).toFixed()};
    return isPlan(migrated)?migrated:null;
  }catch{return null;}
}
export function parseSavedPlans(raw:unknown): SavedPlan[] {
  return Array.isArray(raw)?raw.filter(p=>p&&typeof p.id==='string'&&typeof p.savedAt==='string'&&Number.isFinite(Date.parse(p.savedAt))&&typeof p.quantity==='string'&&Array.isArray(p.targetPrices)&&p.targetPrices.every((v:unknown)=>typeof v==='string')&&parsePlan(p.plan,'total')).map(p=>({...p,plan:parsePlan(p.plan,'total')!})):[];
}
export function readPlans(): SavedPlan[] {
  return parseSavedPlans(JSON.parse(localStorage.getItem(PLANS_KEY)||'[]'));
}
export function parsePlanBackup(text:string): SavedPlan[] {
  if(text.length>2_000_000)throw Error('备份文件不能超过 2 MB');
  const data=JSON.parse(text);
  const rows=Array.isArray(data)?data:data?.version===1?data.plans:null;
  if(!Array.isArray(rows)||rows.length>100)throw Error('请选择有效的计划备份，最多 100 条');
  const plans=parseSavedPlans(rows);
  if(plans.length!==rows.length||new Set(plans.map(p=>p.id)).size!==plans.length)throw Error('备份包含无效或重复计划，未导入');
  return plans;
}

export const SIMPLE_PREF_KEY='cpc:preferences:simple:v1', PRO_PREF_KEY='cpc:preferences:professional:v1';
