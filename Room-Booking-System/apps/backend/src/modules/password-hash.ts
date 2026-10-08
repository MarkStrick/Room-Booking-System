import argon2 from 'argon2';
import { ServiceUnavailableException } from '@nestjs/common';

export const passwordOptions={type:argon2.argon2id,memoryCost:65536,timeCost:3,parallelism:1,hashLength:32} as const;
let active=0;
async function bounded<T>(operation:()=>Promise<T>):Promise<T> {
 if(active>=4)throw new ServiceUnavailableException('มีผู้เข้าสู่ระบบจำนวนมาก กรุณาลองใหม่อีกสักครู่');
 active++;
 try{return await operation();}finally{active--;}
}
export const hashPassword=(password:string)=>bounded(()=>argon2.hash(password,passwordOptions));
export const verifyPassword=(passwordHash:string,password:string)=>bounded(async()=>{
 if(!passwordHash.startsWith('$argon2id$')||passwordHash.length>300)return false;
 try{return await argon2.verify(passwordHash,password);}catch{return false;}
});
