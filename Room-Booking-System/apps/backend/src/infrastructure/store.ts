import type { AppState } from '../../../../packages/contracts/src/index';
export interface SessionRecord {hash:string;userId:number;csrf:string;expiresAt:string}
export interface Identity {subject:string;userId:number}
export interface Attempt {key:string;actorId:number;hash:string;bookingId?:number;at:string}
export interface Outbox {noticeId:number;status:'QUEUED'|'SENDING'|'SENT'|'FAILED';attempts:number;nextAt:string;leaseUntil?:string;leaseToken?:string;sentAt?:string;error?:string}
export interface AuthFlow {hash:string;verifier:string;state:string;nonce:string;expiresAt:string}
export interface PasswordCredential {userId:number;passwordHash:string;updatedAt:string;failedAttempts:number;lockedUntil?:string}
export interface PasswordToken {tokenHash:string;kind:'register'|'reset';email:string;name?:string;passwordHash?:string;userId?:number;expiresAt:string}
export interface Data {
 state: AppState;
 identities: Identity[];
 sessions: SessionRecord[];
 attempts: Attempt[];
 outbox: Outbox[];
 flows: AuthFlow[];
 credentials: PasswordCredential[];
 passwordTokens: PasswordToken[];
}
// A transaction must serialize writers across API and worker processes, commit
// atomically, and rollback on any exception. Never expose auth rows to the browser.
export interface Store {
 read():Promise<Data>;
 transaction<T>(fn:(data:Data)=>T):Promise<T>;
 close():Promise<void>;
}
export function emptyData(now = new Date().toISOString()):Data {
 return {state:{schema:1,now,users:[],buildings:[],rooms:[],equipment:[],bookings:[],notices:[],violations:[],penalties:[],closures:[],inspections:[],messages:[],audit:[],holidays:[],assignments:[]},identities:[],sessions:[],attempts:[],outbox:[],flows:[],credentials:[],passwordTokens:[]};
}
