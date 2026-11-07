import { Field } from './inputs';
import { Button } from '@/components/ui/button';
export function CustomSymbol({value,onChange,onAdd,onDelete}:{value:string;onChange:(value:string)=>void;onAdd:(value:string)=>void;onDelete?:(value:string)=>void}){
 return <div className="custom-symbol-editor"><Field label="自定义标的" inputMode="text" value={value} onChange={onChange} hint="例如 SQLUSDT；添加后会保留在标的列表中"/><div className="custom-symbol-actions"><Button variant="outline" onClick={()=>onAdd(value)}>添加标的</Button>{onDelete&&<Button variant="outline" onClick={()=>onDelete(value)}>删除标的</Button>}</div></div>;
}
