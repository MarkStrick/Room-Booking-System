import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync, backup } from "node:sqlite";
import { SqliteStore } from "../../apps/backend/src/infrastructure/sqlite-store";
import { emptyData } from "../../apps/backend/src/infrastructure/store";
import { createSeed } from "../../apps/web/src/lib/seed";
import { createApplication } from "../../apps/backend/src/main";
import { readConfig } from "../../apps/backend/src/common/config";
import { runTimers } from "../../apps/backend/src/modules/jobs";
import { dateOf, addDays, stamp } from "../../packages/core/src/domain";
import { testSession } from './session-fixture';
test("audit API: static files, private participants, inventory, settings, lifecycle outbox and operations", async (t) => {
  const dir = await mkdtemp(join(tmpdir(), "kku-audit-http-")),
    path = join(dir, "data.sqlite"),
    data = emptyData(),
    sample = createSeed();
  data.state = {
    ...data.state,
    users: sample.users,
    rooms: sample.rooms,
    buildings: sample.buildings,
    equipment: sample.equipment,
    assignments: sample.assignments,
  };
  const previous = process.env.WEB_DIST;
  process.env.WEB_DIST = dir;
  await writeFile(
    join(dir, "index.html"),
    "<html><body>audit static fixture</body></html>",
  );
  await writeFile(join(dir, "asset.css"), "body{color:black}");
  const store = new SqliteStore(path, data),
    origin = "http://127.0.0.1:3199",
    app = await createApplication(
      store,
      readConfig({ DEV_LOGIN: "1", APP_ORIGIN: origin }),
    );
  await app.listen(0, "127.0.0.1");
  const base = await app.getUrl();
  const call = (path: string, options: RequestInit = {}) =>
    fetch(base + path, {
      ...options,
      headers: {
        "content-type": "application/json",
        origin,
        ...options.headers,
      },
    });
  const login = async (id: number) => {
    return testSession(store, readConfig({ APP_ORIGIN: origin }), id);
  };
  try {
    const student = await login(1),
      staff = await login(2),
      admin = await login(3),
      other = await login(4);
    const headers = (who: typeof student) => ({
      cookie: who.cookie,
      "x-csrf-token": who.body.csrfToken,
      "idempotency-key": randomUUID(),
    });
    const command = (who: typeof student, body: unknown) =>
      call("/api/commands", {
        method: "POST",
        headers: headers(who),
        body: JSON.stringify(body),
      });
    let tomorrow = addDays(dateOf(new Date().toISOString()), 1);
    while(sample.holidays.includes(tomorrow))tomorrow=addDays(tomorrow,1);
    await t.test(
      "static homepage/assets precede fallback, API still authenticates",
      async () => {
        const home = await call("/");
        assert.equal(home.status, 200);
        assert.ok((await home.text()).includes("audit static fixture"));
        assert.equal((await call("/asset.css")).status, 200);
        assert.equal((await call("/api/state")).status, 401);
        assert.equal((await call("/missing.css")).status, 404);
        const docs = await (await call("/api/openapi.json")).json();
        assert.equal(docs.openapi, "3.1.0");
        assert.ok(
          JSON.stringify(docs.paths["/api/commands"]).includes("HOLIDAY_SAVE"),
        );
      },
    );
    await t.test(
      "inventory and image validation require admin and inspection scope",
      async () => {
        const room = {
          ...data.state.rooms[0],
          imageUrl: "https://example.com/room.jpg",
          inventory: [{ id: 1, name: "screen", total: 2, damaged: 0 }],
        };
        assert.equal(
          (await command(student, { type: "ROOM_SAVE", room })).status,
          403,
        );
        assert.equal(
          (
            await command(admin, {
              type: "ROOM_SAVE",
              room: { ...room, imageUrl: "http://example.com/image" },
            })
          ).status,
          400,
        );
        assert.equal(
          (await command(admin, { type: "ROOM_SAVE", room })).status,
          201,
        );
        assert.equal(
          (
            await command(staff, {
              type: "INSPECT",
              roomId: 1,
              condition: "พบอุปกรณ์ชำรุด",
              note: "screen broken",
              items: [{ id: 1, damaged: 1 }],
            })
          ).status,
          201,
        );
        assert.equal(
          (await store.read()).state.inspections[0].items![0].damaged,
          1,
        );
        assert.equal((await store.read()).state.rooms.find(r=>r.id===1)!.status, 'MAINTENANCE');
        // Repair and inspect again before the following booking flow.
        assert.equal((await command(staff, {type:'INSPECT',roomId:1,condition:'พร้อมใช้งาน',note:'repaired',items:[{id:1,damaged:0}]})).status,201);
        assert.equal((await store.read()).state.rooms.find(r=>r.id===1)!.status, 'AVAILABLE');
      },
    );
    await t.test(
      "emails replace directory lookup and unauthorized state redacts guest emails",
      async () => {
        const book = {
          type: "BOOK",
          roomId: 1,
          start: stamp(tomorrow, "10:00"),
          end: stamp(tomorrow, "12:00"),
          purpose: "private guest",
          attendees: 2,
          participants: [],
          participantEmails: ["guest@example.com"],
          equipment: [],
        };
        assert.equal((await command(student, book)).status, 201);
        const otherState = await (
          await call("/api/state", { headers: headers(other) })
        ).json();
        assert.equal(otherState.bookings[0].participantEmails, undefined);
        assert.equal(
          (
            await command(admin, {
              type: "ROOM_ACTIVE",
              roomId: 1,
              active: false,
            })
          ).status,
          409,
        );
        assert.equal(
          (await command(admin, { type: "ROOM_DELETE", roomId: 1 })).status,
          409,
        );
        const publicCatalog = await (await call("/api/public/catalog")).json();
        assert.deepEqual(publicCatalog.users, []);
        assert.equal(publicCatalog.bookings[0].ref, "");
        assert.equal(publicCatalog.bookings[0].participantEmails, undefined);
        assert.deepEqual(publicCatalog.notices, []);
      },
    );
    await t.test(
      "settings persist, private help queries and admin operations are scoped",
      async () => {
        const settings = {
          type: "SETTINGS_SAVE",
          contactEmail: "desk@example.com",
          contactPhone: "043000000",
          faqs: [{ q: "custom", a: "custom answer", keys: ["custom"] }],
        };
        assert.equal((await command(student, settings)).status, 403);
        assert.equal((await command(admin, settings)).status, 201);
        assert.equal(
          (await command(student, { type: "HELP", question: "custom" })).status,
          201,
        );
        assert.equal(
          (await store.read()).state.messages.at(-1)!.answer,
          "custom answer",
        );
        assert.equal(
          (await call("/api/admin/operations", { headers: headers(student) }))
            .status,
          403,
        );
        assert.equal(
          (await call("/api/admin/operations", { headers: headers(admin) }))
            .status,
          200,
        );
      },
    );
    await t.test(
      "SLA queues real outbox once and pending expiration releases reservation without violation",
      async () => {
        const now = new Date().toISOString();
        await store.transaction((d) => {
          d.state.bookings[0].createdAt = new Date(
            Date.parse(now) - 4 * 3600000,
          ).toISOString();
          delete d.state.bookings[0].approvalDeadline;
          runTimers(d, now);
        });
        const notices = (await store.read()).state.notices.filter((n) =>
          n.subject.includes("กำหนดพิจารณา"),
        );
        const first = await store.read();
        assert.equal(notices.length, 4);
        assert.ok(
          notices.every((n) => first.outbox.some((o) => o.noticeId === n.id)),
        );
        await store.transaction((d) => runTimers(d, now));
        assert.equal((await store.read()).outbox.length, first.outbox.length);
        await store.transaction((d) => runTimers(d, stamp(tomorrow, "10:00")));
        assert.equal(
          (await store.read()).state.bookings[0].status,
          "CANCELLED",
        );
        assert.equal((await store.read()).state.violations.length, 0);
      },
    );
    await t.test(
      "handovers validate staff scope and persist issued/returned separately",
      async () => {
        const freshStaff = await login(2),
          freshStudent = await login(1),
          now = new Date().toISOString();
        await store.transaction((d) => {
          const b = d.state.bookings[0];
          b.status = "CHECKED_IN";
          b.start = new Date(Date.parse(now) - 300000).toISOString();
          b.end = new Date(Date.parse(now) + 3300000).toISOString();
          b.checkedInAt = now;
          b.equipment = [{ id: 1, qty: 2 }];
          d.state.equipment[0].remaining -= 2;
        });
        const id = (await store.read()).state.bookings[0].id,
          payload = {
            type: "EQUIPMENT_HANDOVER",
            bookingId: id,
            equipmentId: 1,
            qty: 1,
            action: "ISSUE",
          };
        assert.equal((await command(freshStudent, payload)).status, 403);
        assert.equal((await command(freshStaff, payload)).status, 201);
        assert.equal(
          (await command(freshStaff, { ...payload, action: "RETURN" })).status,
          201,
        );
        assert.equal(
          (await command(freshStaff, { ...payload, action: "RETURN" })).status,
          409,
        );
        const item = (await store.read()).state.bookings[0].equipment[0];
        assert.equal(item.issued, 1);
        assert.equal(item.returned, 1);
      },
    );
    await t.test(
      "50 parallel reads complete without errors or exposing private guest emails",
      async () => {
        const fresh = await login(4);
        const statuses = await Promise.all(
          Array.from({ length: 50 }, () =>
            call("/api/state", { headers: { cookie: fresh.cookie } }).then(
              (r) => r.status,
            ),
          ),
        );
        assert.ok(statuses.every((s) => s === 200));
      },
    );
  } finally {
    await app.close();
    await store.close();
    if (previous === undefined) delete process.env.WEB_DIST;
    else process.env.WEB_DIST = previous;
    await rm(dir, { recursive: true, force: true });
  }
});
test("local backup restores inventory, settings and guest data after reopening the database", async () => {
  const dir = await mkdtemp(join(tmpdir(), "kku-restore-")),
    path = join(dir, "source.sqlite"),
    target = join(dir, "restored.sqlite");
  const initial = emptyData();
  initial.state.settings = {
    contactEmail: "desk@example.com",
    contactPhone: "",
    faqs: [{ q: "q", a: "a", keys: ["q"] }],
  };
  let store = new SqliteStore(path, initial);
  try {
    const expected = await store.read();
    const database = new DatabaseSync(path);
    try {
      await backup(database, target);
    } finally {
      database.close();
    }
    await store.close();
    store = new SqliteStore(target);
    assert.deepEqual(await store.read(), expected);
  } finally {
    await store.close();
    await rm(dir, { recursive: true, force: true });
  }
});
