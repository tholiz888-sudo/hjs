"""Convert the provided trade export into a validated, read-only site dataset."""
import sys,json,hashlib,math
from datetime import datetime,timezone,timedelta
from pathlib import Path
import openpyxl
src=Path(sys.argv[1]); out=Path(sys.argv[2] if len(sys.argv)>2 else 'data/trades.json')
book=openpyxl.load_workbook(src,read_only=True,data_only=True)
rows=list(book['实盘交易记录'].values)
expected=['序号','交易对','方向','杠杆','开仓时间','平仓时间','开仓均价','平仓均价','收益率（%）','收益（USDT）','持仓量最大时（个）','持仓价值最大时（USDT）','保证金最大时（USDT）','交易额（USD）','手续费（USD）','已实现累计收益（USDT）']
assert list(rows[0])==expected,'Unexpected workbook columns'
tz=timezone(timedelta(hours=8))
def time(s):return datetime.strptime(s,'%Y-%m-%d %H:%M').replace(tzinfo=tz).isoformat() if s else None
data=[]
for row in rows[1:]:
 if not any(v is not None for v in row):continue
 i,pair,direction,leverage,opened,closed,entry,exit,rate,gross,quantity,value,margin,turnover,fee,cumulative=row
 assert direction in ['多','空'] and pair.endswith('-USDT-SWAP')
 assert all(isinstance(v,(int,float)) and math.isfinite(v) for v in [i,leverage,entry,exit,rate,gross,quantity,value,margin,turnover,fee,cumulative])
 assert margin>0
 a,b=time(opened),time(closed)
 assert b is None or b>=a
 data.append(dict(id=i,pair=pair,direction=direction,leverage=leverage,opened=a,closed=b,entry_price=entry,exit_price=exit,return_rate=rate,gross_profit=gross,profit=round(gross+fee,8),net_return_rate=(gross+fee)/margin*100,quantity=quantity,position_value=value,margin=margin,turnover=turnover,fee=fee,original_cumulative=cumulative))
assert len({r['id'] for r in data})==len(data)
meta={'name':'Bit 浪浪实盘交易记录','count':len(data),'pairs':len({r['pair'] for r in data}),'start':min(r['opened'] for r in data),'end':max(r['closed'] or r['opened'] for r in data),'missing_close':sum(r['closed'] is None for r in data),'source':'用户提供的实盘交易记录.xlsx','sha256':hashlib.sha256(src.read_bytes()).hexdigest(),'timezone':'Asia/Shanghai','profit_convention':'profit = 收益（USDT） + 手续费（USD），按原站口径；gross_profit 保留原始收益，original_cumulative 保留表中累计值，报表独立重算。'}
out.parent.mkdir(parents=True,exist_ok=True);out.write_text(json.dumps({'metadata':meta,'records':data},ensure_ascii=False,separators=(',',':'))+'\n')
print(json.dumps(meta,ensure_ascii=False));print('Net profit:',sum(r['profit'] for r in data))
