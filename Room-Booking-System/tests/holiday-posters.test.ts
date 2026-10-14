import test from 'node:test';
import assert from 'node:assert/strict';
import { createSeed } from '../apps/web/src/lib/seed';
import { executeCommand } from '../packages/core/src/domain';
import { activeHolidayPosters } from '../packages/core/src/holiday-posters';
import { isHolidayPoster, holidayPosterMaxLength } from '../packages/core/src/media';

const poster = 'data:image/jpeg;base64,/9j/AAAA';
test('posters follow holiday edits, removals and admin permissions', () => {
  let state = createSeed();
  state.bookings = [];
  const command = { type: 'HOLIDAY_SAVE', date: '2026-10-20', poster } as const;
  assert.throws(() => executeCommand(state, 1, command));
  assert.throws(() => executeCommand(state, 3, { ...command, poster: 'data:image/svg+xml;base64,AAAA' }));
  state = executeCommand(state, 3, command);
  assert.equal(state.settings?.holidayPosters?.[command.date], poster);
  state = executeCommand(state, 3, { type: 'HOLIDAY_SAVE', date: '2026-10-21', previousDate: command.date });
  assert.deepEqual(state.settings?.holidayPosters, { '2026-10-21': poster });
  state = executeCommand(state, 3, { type: 'HOLIDAY_SAVE', date: '2026-10-21', previousDate: '2026-10-21', poster: '' });
  assert.deepEqual(state.settings?.holidayPosters, {});
  state = executeCommand(state, 3, { ...command, previousDate: '2026-10-21' });
  state = executeCommand(state, 3, { type: 'HOLIDAY_DELETE', date: command.date });
  assert.deepEqual(state.settings?.holidayPosters, {});
});

test('seven-day poster window includes holiday, using Bangkok midnight', () => {
  const state = createSeed();
  state.holidays = ['2026-10-20', '2026-10-19', '2026-10-22'];
  state.settings = { contactEmail: '', contactPhone: '', faqs: [], holidayPosters: { '2026-10-20': poster, '2026-10-19': poster } };
  for (const [now, expected] of [
    ['2026-10-12T16:59:59Z', ['2026-10-19']],
    ['2026-10-12T17:00:00Z', ['2026-10-19', '2026-10-20']],
    ['2026-10-20T16:59:59Z', ['2026-10-20']],
    ['2026-10-20T17:00:00Z', []],
  ] as const) {
    state.now = now;
    assert.deepEqual(activeHolidayPosters(state), expected);
  }
  assert.equal(isHolidayPoster(poster + 'A'.repeat(holidayPosterMaxLength)), false);
});
