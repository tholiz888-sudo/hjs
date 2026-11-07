import { Field } from './inputs';
import { Button } from '@/components/ui/button';
export function CustomSymbol({value,onChange,onAdd}:{value:string;onChange:(value:string)=>void;onAdd:(value:string)=>void}){
 return <div className="custom-symbol-editor"><Field label="自定义标的" inputMode="text" value={value} onChange={onChange} hint="例如 SQLUSDT；添加后会保留在标的列表中"/><Button variant="outline" onClick={()=>onAdd(value)}>添加标的</Button></div>;
}
