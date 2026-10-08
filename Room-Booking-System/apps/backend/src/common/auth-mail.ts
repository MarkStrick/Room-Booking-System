import nodemailer from 'nodemailer';
import type { Config } from './config';
export type AuthMail=(to:string,subject:string,content:string)=>Promise<void>;
export function authMail(c:Config):AuthMail {
 return async(to,subject,text)=>{
  const transport=nodemailer.createTransport({host:c.smtpHost,port:c.smtpPort,secure:c.smtpSecure,requireTLS:!c.smtpSecure,auth:c.smtpUser?{user:c.smtpUser,pass:c.smtpPassword}:undefined,connectionTimeout:10000,greetingTimeout:10000,socketTimeout:30000});
  try{const result=await transport.sendMail({from:c.mailFrom,to,subject,text});if(!result.accepted.includes(to))throw new Error('Mail rejected');}
  finally{transport.close();}
 };
}
