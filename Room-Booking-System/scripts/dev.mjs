import { spawn } from 'node:child_process';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const children = [];
let stopping = false;

function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  for (const child of children) {
    if (!child.pid || child.exitCode !== null) continue;
    // tsx watch owns another Node process; stop the whole owned tree on Windows.
    if (process.platform === 'win32') {
      spawn('taskkill', ['/PID', String(child.pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' });
    } else child.kill('SIGTERM');
  }
  process.exitCode = code;
}
process.once('SIGINT', () => stop());
process.once('SIGTERM', () => stop());

async function responds(url, predicate) {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(1500) });
    return response.ok && await predicate(response);
  } catch { return false; }
}

function launch(cli, args, cwd, env = {}) {
  const child = spawn(process.execPath, [resolve(root, cli), ...args], {
    cwd: resolve(root, cwd), stdio: 'inherit', windowsHide: true,
    env: { ...process.env, ...env },
  });
  children.push(child);
  child.once('error', error => { console.error(error.message); stop(1); });
  child.once('exit', code => { if (!stopping) stop(code || 1); });
  return child;
}

const apiUrl = 'http://127.0.0.1:3001/api/health/live';
const isApi = response => response.json().then(body => body.status === 'ok');
if (!await responds(apiUrl, isApi)) {
  const api = launch('node_modules/tsx/dist/cli.mjs', ['watch', '--env-file-if-exists=../../.env', 'src/main.ts'], 'apps/backend', { PORT: '3001', HOST: '127.0.0.1' });
  const deadline = Date.now() + 30000;
  while (!stopping && api.exitCode === null && Date.now() < deadline) {
    if (await responds(apiUrl, isApi)) break;
    await new Promise(resolve => setTimeout(resolve, 300));
  }
  if (!stopping && !await responds(apiUrl, isApi)) {
    console.error('API ไม่พร้อมที่พอร์ต 3001 กรุณาตรวจข้อความ startup และการเชื่อมต่อฐานข้อมูลด้านบน');
    stop(1);
  }
} else console.log('API พร้อมแล้วที่ http://127.0.0.1:3001');

if (!stopping) {
  const webUrl = 'http://127.0.0.1:5173';
  if (!await responds(`${webUrl}/@vite/client`, async () => true)) {
    launch('node_modules/vite/bin/vite.js', ['--host', '127.0.0.1', '--port', '5173', '--strictPort'], 'apps/web');
  } else console.log(`เว็บเปิดอยู่แล้วที่ ${webUrl}`);
}
