import type { AppState, Room } from "../../contracts/src/index";
import { addDays, dateOf, ms, stamp } from "./domain";
export function reportData(
  s: AppState,
  rooms: Room[],
  from: string,
  to: string,
) {
  const valid =
    /^\d{4}-\d{2}-\d{2}$/.test(from) &&
    /^\d{4}-\d{2}-\d{2}$/.test(to) &&
    from <= to &&
    ms(stamp(to, "00:00")) - ms(stamp(from, "00:00")) <= 366 * 86400000;
  if (!valid)
    return {
      valid: false,
      rows: [],
      used: [],
      hours: 0,
      utilization: rooms.map((room) => ({
        room,
        openHours: null,
        usedHours: null,
        rate: null,
      })),
      assets: [] as {
        room: Room;
        id: number;
        name: string;
        total: number;
        damaged: number;
        inspectedAt?: string;
        source: string;
      }[],
      slaTotal: 0,
      slaOnTime: 0,
    };
  const rows = valid
    ? s.bookings.filter(
        (b) =>
          rooms.some((r) => r.id === b.roomId) &&
          dateOf(b.start) >= from &&
          dateOf(b.start) <= to,
      )
    : [];
  const begin = ms(stamp(from, "00:00")),
    end = Math.min(
      ms(stamp(addDays(to || dateOf(s.now), 1), "00:00")),
      ms(s.now),
    );
  const used = rows.filter((b) =>
    ["CHECKED_IN", "COMPLETED"].includes(b.status),
  );
  const hours = used.reduce(
    (sum, b) =>
      sum +
      Math.max(
        0,
        Math.min(ms(b.end), end) -
          Math.max(ms(b.checkedInAt ?? b.start), begin),
      ) /
        3600000,
    0,
  );
  const utilization = rooms.map((r) => {
    if (!valid || !r.hours)
      return { room: r, openHours: null, usedHours: null, rate: null };
    const intervals: { start: number; end: number }[] = [];
    for (let day = from; day <= to; day = addDays(day, 1)) {
      if (
        s.holidays.includes(day) ||
        !r.hours.weekdays.includes(
          new Date(`${day}T12:00:00+07:00`).getUTCDay(),
        )
      )
        continue;
      let slots = [
        {
          start: ms(stamp(day, r.hours.start)),
          end: Math.min(ms(stamp(day, r.hours.end)), end),
        },
      ].filter((i) => i.end > i.start);
      for (const closure of s.closures.filter((c) => c.roomId === r.id))
        slots = slots.flatMap((i) =>
          ms(closure.end) <= i.start || ms(closure.start) >= i.end
            ? [i]
            : [
                { start: i.start, end: Math.min(i.end, ms(closure.start)) },
                { start: Math.max(i.start, ms(closure.end)), end: i.end },
              ].filter((x) => x.end > x.start),
        );
      intervals.push(...slots);
    }
    const openHours =
      intervals.reduce((n, i) => n + i.end - i.start, 0) / 3600000;
    const usedHours =
      used
        .filter((b) => b.roomId === r.id)
        .reduce(
          (n, b) =>
            n +
            intervals.reduce(
              (a, i) =>
                a +
                Math.max(
                  0,
                  Math.min(ms(b.end), i.end, end) -
                    Math.max(ms(b.checkedInAt ?? b.start), i.start),
                ),
              0,
            ),
          0,
        ) / 3600000;
    return {
      room: r,
      openHours,
      usedHours,
      rate: openHours ? (usedHours / openHours) * 100 : 0,
    };
  });
  const assets = rooms.flatMap((r) => {
    const inspection = s.inspections
      .filter((i) => i.roomId === r.id && dateOf(i.at) <= to)
      .sort((a, b) => ms(b.at) - ms(a.at))[0];
    return (inspection?.items ?? r.inventory ?? []).map((item) => ({
      room: r,
      ...item,
      inspectedAt: inspection?.at,
      source: inspection?.items ? "ผลตรวจ" : "ข้อมูลตั้งต้น",
    }));
  });
  const decided = rows.filter((b) => b.decidedAt);
  return {
    valid,
    rows,
    used,
    hours,
    utilization,
    assets,
    slaTotal: decided.length,
    slaOnTime: decided.filter(
      (b) =>
        ms(b.decidedAt!) <=
        ms(
          b.approvalDeadline ??
            new Date(ms(b.createdAt) + 14400000).toISOString(),
        ),
    ).length,
  };
}
export const encodeCsv = (rows: unknown[][]) =>
  "\uFEFF" +
  rows
    .map((row) =>
      row
        .map((value) => {
          let text = String(value ?? "");
          if (/^[\s]*[=+@-]/.test(text)) text = "'" + text;
          return '"' + text.replace(/"/g, '""') + '"';
        })
        .join(","),
    )
    .join("\r\n");
