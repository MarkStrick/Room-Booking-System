// Verify the exact compiled Vercel export in a separate process and temporary SQLite database.
// No .env files, cloud database, provider account, or deployment is touched.
import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
import { SqliteStore } from '../apps/backend/src/infrastructure/sqlite-store';
import { emptyData } from '../apps/backend/src/infrastructure/store';
import { digest } from '../apps/backend/src/modules/session';

const dir=await mkdtemp(join(tmpdir(),'kku-vercel-smoke-')),file=join(dir,'data.sqlite');
const data=emptyData();data.state.users=[{id:1,name:'Fixture admin',email:'fixture@example.com',role:'ADMIN',active:true,phone:'',affiliation:''}];
data.sessions=[{userId:1,hash:digest('compiled-handler-fixture-session'),csrf:'compiled-handler-fixture-csrf',expiresAt:new Date(Date.now()+600000).toISOString()}];
const store=new SqliteStore(file,data);await store.close();
const code=`
import { createServer } from 'node:http';
import assert from 'node:assert/strict';
import handler from ${JSON.stringify(pathToFileURL(resolve('api/index.mjs')).href)};
const server=createServer((req,res)=>{void handler(req,res)});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const base='http://127.0.0.1:'+server.address().port;
try {
 const config=await fetch(base+'/api/config');assert.equal(config.status,200);assert.equal((await config.json()).googleReady,false);
 const login=await fetch(base+'/api/auth/password/login',{method:'POST',headers:{origin:'http://127.0.0.1:5174','content-type':'application/json'},body:JSON.stringify({email:'fixture@example.com',password:'Fixture passphrase 2026'})});
 assert.equal(login.status,404);assert.equal(login.headers.get('set-cookie'),null);const cookie='kku_session=compiled-handler-fixture-session';
 assert.equal((await fetch(base+'/api/admin/test-tools',{headers:{cookie}})).status,200);
 assert.equal((await fetch(base+'/api/auth/development',{method:'POST'})).status,403);
 assert.equal((await fetch(base+'/api/no-such-route')).status,404);
 console.log('Compiled Vercel handler: Google-only configuration, disabled password/test login and ADMIN session authorization passed');
 await new Promise(resolve=>server.close(resolve));
} catch(error) {console.error('Compiled Vercel handler smoke test failed');process.exitCode=1;await new Promise(resolve=>server.close(resolve));}
`;
try {
 const child=spawn(process.execPath,['--input-type=module','-e',code],{stdio:'inherit',env:{...process.env,NODE_ENV:'development',VERCEL:'',DB_DRIVER:'sqlite',DEV_LOGIN:'0',SQLITE_PATH:file,APP_ORIGIN:'http://127.0.0.1:5174',GOOGLE_CLIENT_ID:'',GOOGLE_CLIENT_SECRET:'',SMTP_HOST:'',SMTP_PASSWORD:'',DATABASE_URL:'',DATABASE_CA_PATH:'',DATABASE_CA_PEM:''}});
 process.exitCode=await new Promise<number>((done,reject)=>{child.once('error',reject);child.once('exit',code=>done(code??1));});
}finally{
 if(!resolve(dir).startsWith(resolve(tmpdir())+sep))throw new Error('Unexpected temporary directory');
 await rm(dir,{recursive:true,force:true});
}
