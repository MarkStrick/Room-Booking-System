import { useState } from 'react';
import { Pencil, Plus, Save, X } from 'lucide-react';
import type { Building } from '../../../../packages/contracts/src/index';
import { useDemo } from '../app/DemoProvider';

export function FloorManager({building}:{building:Building}) {
  const {state,run}=useDemo();
  const [editing,setEditing]=useState<{number:number;name:string}|null>(null);
  const [busy,setBusy]=useState(false),[error,setError]=useState('');
  const floors=Array.from({length:building.floors},(_,i)=>building.levels?.find(f=>f.number===i+1)??{number:i+1,name:`ชั้น ${i+1}`});
  return <section aria-label={`ชั้นของ ${building.name}`}>
    <div className="floors">{floors.map(f=><div key={f.number}><span>{f.name}</span><strong>{state.rooms.filter(r=>r.buildingId===building.id&&r.floor===f.number).length} ห้อง</strong><button className="floor-edit" disabled={building.active===false} aria-label={`แก้ไข ${f.name}`} onClick={()=>{setEditing(f);setError('');}}><Pencil size={15}/></button></div>)}</div>
    {!editing ? <button className="btn ghost" disabled={building.active===false} onClick={()=>setEditing({number:building.floors+1,name:''})}><Plus size={16}/>เพิ่มชั้น</button> : <form className="floor-form" onSubmit={async e=>{e.preventDefault();if(busy)return;setBusy(true);setError('');try{await run({type:'FLOOR_SAVE',buildingId:building.id,...editing},'บันทึกชั้นแล้ว');setEditing(null);}catch(e){setError((e as Error).message);}finally{setBusy(false);}}}>
      <label>ชื่อชั้น {editing.number}<input aria-label={`ชื่อชั้น ${editing.number}`} required maxLength={120} value={editing.name} onChange={e=>setEditing({...editing,name:e.target.value})}/></label>
      {error&&<p role="alert" className="form-error">{error}</p>}
      <div className="holiday-actions"><button className="btn" disabled={busy}><Save size={16}/>{busy?'กำลังบันทึก…':'บันทึกชั้น'}</button><button type="button" className="btn ghost" disabled={busy} onClick={()=>setEditing(null)}><X size={16}/>ยกเลิก</button></div>
    </form>}
  </section>;
}
