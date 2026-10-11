import type { Express, Request, Response } from 'express';
import { readConfig } from './common/config';
import { createStore } from './infrastructure/create-store';
import { createApplication } from './main';

// Reuse the app and database pool within one warm function; never listen on a port.
let initialization: Promise<Express> | undefined;
async function initialize() {
 const c = readConfig();
 const store = await createStore(c);
 try {
  const app = await createApplication(store, c);
  return app.getHttpAdapter().getInstance() as Express;
 } catch (error) { await store.close(); throw error; }
}
export async function handler(req: Request, res: Response) {
 try {
  initialization ??= initialize().catch(error => { initialization = undefined; throw error; });
  const app = await initialization;
  app(req, res);
 } catch {
  console.error(JSON.stringify({ event: 'function_initialization_failed' }));
  res.status(503).json({ message: 'ระบบยังไม่พร้อมให้บริการ กรุณาลองอีกครั้งภายหลัง' });
 }
}
