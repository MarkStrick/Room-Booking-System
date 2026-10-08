import type { AppState, Command, User } from '../../../../packages/contracts/src/index';
export interface Session {user:User;csrfToken:string;state:AppState;hasPassword?:boolean}
export interface PublicConfig {googleReady:boolean;passwordReady:boolean;registrationReady:boolean;devLogin:boolean;allowedDomains:string[]}
export class ApiError extends Error {constructor(message:string,public status:number){super(message);}}
export async function request<T>(path:string,options:RequestInit={}):Promise<T> {
 let response:Response;
 try{response=await fetch(`/api${path}`,{...options,credentials:'same-origin',headers:{'content-type':'application/json',...options.headers}});}
 catch(e){if((e as Error).name==='AbortError')throw e;throw new ApiError('เชื่อมต่อระบบไม่ได้ กรุณาตรวจอินเทอร์เน็ตแล้วลองใหม่',0);}
 const body=await response.json().catch(()=>null);
 if(!response.ok)throw new ApiError(typeof body?.message==='string'?body.message:'ไม่สามารถทำรายการได้ในขณะนี้ กรุณาลองอีกครั้ง',response.status);
 return body as T;
}
export async function sendCommand(command:Command,csrf:string) {
 const key=crypto.randomUUID();
 const options={method:'POST',headers:{'x-csrf-token':csrf,'idempotency-key':key},body:JSON.stringify(command)};
 try{return await request<AppState>('/commands',options);}catch(e){
  // Retry only an uncertain transport failure, reusing the same idempotency key.
  if(e instanceof ApiError&&e.status===0)return request<AppState>('/commands',options);
  throw e;
 }
}
