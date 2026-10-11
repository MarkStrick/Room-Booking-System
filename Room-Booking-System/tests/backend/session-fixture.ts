import type { Request, Response } from 'express';
import type { Config } from '../../apps/backend/src/common/config';
import type { Store } from '../../apps/backend/src/infrastructure/store';
import { issueSession } from '../../apps/backend/src/modules/session';
import { projectState } from '../../apps/backend/src/common/projection';

// Fixtures create a session directly in an isolated test store, never via a login bypass.
export async function testSession(store: Store, c: Config, userId: number) {
 let cookie = '';
 const body = await store.transaction(data => {
  const user = data.state.users.find(u => u.id === userId)!;
  const now = new Date().toISOString();
  const csrfToken = issueSession(data, userId, now, { cookies: {} } as Request,
   { cookie: (name: string, value: string) => { cookie = `${name}=${value}`; } } as unknown as Response, c);
  return { user, csrfToken, state: projectState({ ...data.state, now }, user) };
 });
 return { body, cookie };
}
