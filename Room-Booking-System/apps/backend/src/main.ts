import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ExpressAdapter } from '@nestjs/platform-express';
import express from 'express';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';
import { randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readConfig, type Config } from './common/config';
import type { Store } from './infrastructure/store';
import { createStore } from './infrastructure/create-store';
import { apiModule } from './modules/api';
import { authClientAddress, consumeAuthLimit } from './common/shared-auth-limit';
export async function createApplication(store:Store,c:Config) {
 const server=express();
 server.disable('x-powered-by');
 server.set('trust proxy',c.trustProxy.length?c.trustProxy:false);
 server.use(helmet({contentSecurityPolicy:{directives:{defaultSrc:["'self'"],scriptSrc:["'self'"],styleSrc:["'self'","'unsafe-inline'",'https://fonts.googleapis.com'],fontSrc:["'self'",'https://fonts.gstatic.com'],imgSrc:["'self'",'data:','https:'],connectSrc:["'self'"],objectSrc:["'none'"],frameAncestors:["'none'"],...(c.production?{}:{upgradeInsecureRequests:null})}},strictTransportSecurity:c.production?undefined:false}));
 server.use('/api',(req,res,next)=>{const id=randomUUID(),start=Date.now();res.setHeader('x-request-id',id);res.setHeader('Cache-Control','no-store');res.on('finish',()=>console.log(JSON.stringify({requestId:id,method:req.method,path:req.path,status:res.statusCode,durationMs:Date.now()-start})));next();});
 server.use('/api',rateLimit({windowMs:60000,limit:240,standardHeaders:'draft-8',legacyHeaders:false,keyGenerator:req=>authClientAddress(req,c),skip:req=>req.path==='/internal/jobs',message:{message:'ทำรายการถี่เกินไป กรุณารอสักครู่แล้วลองใหม่'}}));
 if(c.serverless)server.use('/api/auth',async(req,res,next)=>{
  try {
   const result=await consumeAuthLimit(store,authClientAddress(req,c),c.rateLimitSecret);
   if(!result.allowed){res.setHeader('Retry-After',result.retryAfter);res.status(429).json({message:'ทำรายการถี่เกินไป กรุณารอสักครู่แล้วลองใหม่'});return;}
   next();
  }catch{res.status(503).json({message:'ระบบเข้าสู่ระบบยังไม่พร้อม กรุณาลองอีกครั้ง'});}
 });
 else server.use('/api/auth',rateLimit({windowMs:60000,limit:20,standardHeaders:'draft-8',legacyHeaders:false,message:{message:'ทำรายการถี่เกินไป กรุณารอสักครู่แล้วลองใหม่'}}));
 server.use(cookieParser());server.use(express.json({limit:'512kb'}));
 const app=await NestFactory.create(apiModule(store,c),new ExpressAdapter(server),{bodyParser:false,logger:['error','warn','log']});
 const webRoot=process.env.WEB_DIST?resolve(process.env.WEB_DIST):fileURLToPath(new URL('../../web/dist/',import.meta.url));
 if(existsSync(webRoot))server.use(express.static(webRoot,{index:'index.html',maxAge:0}));
 await app.init();
 return app;
}
export async function startServer() {
 const c=readConfig(),store=await createStore(c),app=await createApplication(store,c);
 await app.listen(c.port,c.host);
 console.log(JSON.stringify({event:'server_ready',host:c.host,port:c.port,mode:c.production?'production':'development',database:c.store}));
 const stop=async()=>{await app.close();await store.close();process.exit(0);};
 process.once('SIGTERM',stop);process.once('SIGINT',stop);
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))startServer().catch(e=>{console.error(JSON.stringify({event:'startup_failed',message:readSafeError(e)}));process.exit(1);});
export function readSafeError(e:unknown){return e instanceof Error&&/^(Missing production|Production APP_ORIGIN|Set verified|DEV_LOGIN|SQLite is|Unsupported DB_DRIVER|APP_ORIGIN|DATABASE_URL)/.test(e.message)?e.message:'Check database connection, migration and environment configuration';}
