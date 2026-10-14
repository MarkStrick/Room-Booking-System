import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { readConfig } from '../apps/backend/src/common/config';
import { createStore } from '../apps/backend/src/infrastructure/create-store';
import { applyCommand } from '../apps/backend/src/modules/booking-service';

const catalog = JSON.parse(await readFile(new URL('../docs/data/sample-equipment.json', import.meta.url), 'utf8')) as { equipment: { name: string; total: number }[] };
const store = await createStore(readConfig());
try {
  if (!process.argv.includes('--apply')) {
    const { state } = await store.read();
    console.log(JSON.stringify({ mode: 'preview', equipment: catalog.equipment.map(e => ({ ...e, alreadyExists: state.equipment.some(x => x.name.trim() === e.name) })) }, null, 2));
  } else {
    const result = await store.transaction(data => {
      const admin = data.state.users.find(u => u.email === 'kittiphon.su@kkumail.com' && u.active && u.role === 'ADMIN');
      if (!admin) throw new Error('The requested administrator must be active before importing');
      const added: string[] = [], skipped: string[] = [];
      const now = new Date().toISOString();
      for (const entry of catalog.equipment) {
        if (data.state.equipment.some(e => e.name.trim() === entry.name)) { skipped.push(entry.name); continue; }
        const response = applyCommand(data, admin.id, { type: 'EQUIPMENT_SAVE', ...entry }, randomUUID(), now);
        if (response instanceof Error) throw response;
        added.push(entry.name);
      }
      return { added, skipped };
    });
    const { state } = await store.read();
    const verified = state.equipment.filter(e => catalog.equipment.some(x => x.name === e.name.trim()));
    if (verified.length !== catalog.equipment.length) throw new Error('Equipment import verification failed');
    console.log(JSON.stringify({ ...result, verified: verified.map(e => ({ id: e.id, name: e.name, total: e.total, remaining: e.remaining, active: e.active })) }, null, 2));
  }
} finally { await store.close(); }
