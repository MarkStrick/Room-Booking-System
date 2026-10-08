import nodemailer from 'nodemailer';
import { setTimeout as delay } from 'node:timers/promises';
import { readConfig } from './common/config';
import { createStore } from './infrastructure/create-store';
import { claimMail, finishMail, runTimers } from './modules/jobs';
const c=readConfig(),store=await createStore(c);
const transport=c.smtpHost?nodemailer.createTransport({host:c.smtpHost,port:c.smtpPort,secure:c.smtpSecure,requireTLS:!c.smtpSecure,auth:c.smtpUser?{user:c.smtpUser,pass:c.smtpPassword}:undefined,connectionTimeout:10000,greetingTimeout:10000,socketTimeout:30000}):null;
let stopping=false;
const controller=new AbortController();
const stop=()=>{stopping=true;controller.abort();};
process.once('SIGTERM',stop);process.once('SIGINT',stop);
while(!stopping) {
 try {
  await store.transaction(d=>runTimers(d,new Date().toISOString()));
  if(transport&&c.mailFrom)for(let i=0;i<20&&!stopping;i++) {
   const mail=await store.transaction(d=>claimMail(d,new Date().toISOString()));if(!mail)break;
   let success=false;
   try{const result=await transport.sendMail({from:c.mailFrom,to:mail.to,subject:mail.notice.subject,text:mail.notice.content,messageId:`<kku-notice-${mail.notice.id}@${new URL(c.origin).hostname}>`});success=result.accepted.includes(mail.to);}
   catch{console.error(JSON.stringify({event:'mail_attempt_failed',noticeId:mail.notice.id}));}
   await store.transaction(d=>finishMail(d,mail.notice.id,mail.token,new Date().toISOString(),success));
  }
 }catch{console.error(JSON.stringify({event:'worker_cycle_failed'}));}
 await delay(30000,undefined,{signal:controller.signal}).catch(()=>{});
}
transport?.close();await store.close();
