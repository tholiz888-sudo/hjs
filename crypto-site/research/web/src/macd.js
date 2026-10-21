export const crossLabels={golden_above:'0轴上金叉',death_above:'0轴上死叉',golden_below:'0轴下金叉',death_below:'0轴下死叉'};
export function crossDetails(row,now,observedAt){
 const label=crossLabels[row.cross];if(!label)return{label:'暂无金叉/死叉记录',minutes:null,elapsed:''};
 const timestamp=Date.parse(row.crossAt);let minutes=Number.isFinite(timestamp)?Math.max(0,Math.floor((now-timestamp)/60000)):null;
 if(minutes===null&&row.crossMinutes!=null&&Number.isFinite(Number(row.crossMinutes))&&Number(row.crossMinutes)>=0){const anchor=Date.parse(row.checkedAt||observedAt);minutes=Math.floor(Number(row.crossMinutes)+(Number.isFinite(anchor)?Math.max(0,now-anchor)/60000:0))}
 const elapsed=minutes===null?'发生时间未知':minutes>=60?`已过 ${Math.floor(minutes/60)}小时${minutes%60}分`:`已过 ${minutes}分`;
 return{label,minutes,elapsed};
}
