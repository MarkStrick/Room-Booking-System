import { useState } from 'react';
import { Building2 } from 'lucide-react';
export function RoomImage({src,name,className}:{src:string;name:string;className:string}) {
  const [failed,setFailed]=useState(false);
  if(src.startsWith('/room-images/')&&src.includes('illustrative')&&!failed)return <div className={`relative ${className}`}><img src={src} alt={`ภาพประกอบสำหรับ ${name} ไม่ใช่ภาพสถานที่จริง`} className="w-full h-full object-cover" onError={()=>setFailed(true)}/><span className="absolute top-2 right-2 bg-white/95 text-gray-700 px-2 py-1 rounded-md text-[11px] font-medium">ภาพประกอบ</span></div>;
  return src&&!failed?<img src={src} alt={name} className={className} onError={()=>setFailed(true)}/>:<div role="img" aria-label={`${name} ยังไม่มีรูปห้อง`} className={`${className} bg-gray-200 flex flex-col items-center justify-center text-gray-500 gap-2`}><Building2 size={32}/><span className="text-xs">ยังไม่มีรูปห้อง</span></div>;
}
