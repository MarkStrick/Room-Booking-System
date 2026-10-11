import { useState } from 'react';
import { Building2 } from 'lucide-react';
export function RoomImage({src,name,className}:{src:string;name:string;className:string}) {
  const [failed,setFailed]=useState(false);
  return src&&!failed?<img src={src} alt={name} className={className} onError={()=>setFailed(true)}/>:<div role="img" aria-label={`${name} ยังไม่มีรูปห้อง`} className={`${className} bg-gray-200 flex flex-col items-center justify-center text-gray-500 gap-2`}><Building2 size={32}/><span className="text-xs">ยังไม่มีรูปห้อง</span></div>;
}
