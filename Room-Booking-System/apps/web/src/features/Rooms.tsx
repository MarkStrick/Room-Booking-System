import { useState } from "react";
import {
  ArrowRight,
  CalendarDays,
  Check,
  ChevronDown,
  DoorOpen,
  Search,
  SlidersHorizontal,
  Users,
} from "lucide-react";
import type { SearchFilter } from "../../../../packages/contracts/src/index";
import { useDemo } from "../app/DemoProvider";
import {
  addDays,
  availability,
  dateOf,
  ms,
  searchRooms,
  stamp,
  suspended,
  thaiDate,
  time,
} from "../lib/domain";
import { RoomLocation, type OpenDialog } from "../components/ui";

function defaultFilter(now: string): SearchFilter {
  const minutes =
    Number(time(now).slice(0, 2)) * 60 + Number(time(now).slice(3));
  const next = Math.ceil((minutes + 1) / 30) * 30;
  const format = (n: number) =>
    `${String(Math.floor(n / 60)).padStart(2, "0")}:${String(n % 60).padStart(2, "0")}`;
  return {
    date: next <= 1260 ? dateOf(now) : addDays(dateOf(now), 1),
    start: next <= 1260 ? format(next) : "10:00",
    end: next <= 1260 ? format(next + 120) : "12:00",
    capacity: 4,
    building: "",
    type: "",
    query: "",
    amenity: "",
  };
}

export function Rooms({ open }: { open: OpenDialog }) {
  const { state, user } = useDemo();
  const today = dateOf(state.now);
  const [filter, setFilter] = useState<SearchFilter>(() =>
    defaultFilter(state.now),
  );
  const [onlyAvailable, setOnlyAvailable] = useState(true);
  const update = <K extends keyof SearchFilter>(
    key: K,
    value: SearchFilter[K],
  ) => setFilter((f) => ({ ...f, [key]: value }));
  const start = stamp(filter.date, filter.start),
    end = stamp(filter.date, filter.end);
  const duration = (ms(end) - ms(start)) / 60000;
  const issue =
    !filter.date || !filter.start || !filter.end || !Number.isFinite(duration)
      ? "เลือกวันที่ เวลาเริ่ม และเวลาสิ้นสุดให้ครบ เพื่อดูห้องว่าง"
      : ms(start) <= ms(state.now)
        ? "เวลาเริ่มผ่านไปแล้ว เลือกเวลาหลังเวลาปัจจุบัน หรือเปลี่ยนเป็นวันพรุ่งนี้"
        : filter.date > addDays(today, 15)
          ? "เลือกวันภายใน 15 วันนับจากวันนี้"
          : duration < 30 || duration > 240
            ? "เลือกเวลาใช้งานตั้งแต่ 30 นาทีถึง 4 ชั่วโมง โดยเวลาสิ้นสุดต้องหลังเวลาเริ่ม"
            : !Number.isInteger(filter.capacity) || filter.capacity < 1
              ? "ระบุจำนวนผู้ใช้งานอย่างน้อย 1 คน"
              : "";
  const blocked = suspended(state, user.id);
  const pending = state.bookings.filter(
    (b) => b.userId === user.id && b.status === "PENDING",
  ).length;
  const extraCount = [
    filter.building,
    filter.type,
    filter.amenity,
    filter.query.trim(),
  ].filter(Boolean).length;
  const matching = issue ? [] : searchRooms(state, filter);
  const readyCount = matching.filter(
    (r) => availability(state, r, start, end).kind === "available",
  ).length;
  const rooms = matching
    .filter(
      (r) =>
        !onlyAvailable ||
        availability(state, r, start, end).kind === "available",
    )
    .sort(
      (a, b) =>
        Number(availability(state, b, start, end).kind === "available") -
          Number(availability(state, a, start, end).kind === "available") ||
        a.capacity - b.capacity,
    );
  function clearExtra() {
    setFilter((f) => ({
      ...f,
      building: "",
      type: "",
      amenity: "",
      query: "",
    }));
  }
  function chooseDate(date: string) {
    setFilter((f) => ({
      ...f,
      date,
      ...(date === today && ms(stamp(date, f.start)) <= ms(state.now)
        ? {
            start: defaultFilter(state.now).start,
            end: defaultFilter(state.now).end,
          }
        : {}),
    }));
  }

  return (
    <div className="student-search">
      <div className="student-page-heading">
        <h1>ค้นหาห้องว่าง</h1>
        <p>เลือกวัน เวลา และจำนวนคน แล้วเลือกห้องที่เหมาะกับคุณ</p>
      </div>
      {blocked || pending >= 3 ? (
        <div className="student-warning" role="status">
          <div>
            <strong>
              {blocked
                ? "บัญชีของคุณอยู่ระหว่างระงับสิทธิ์"
                : "คุณมีคำขอรออนุมัติครบ 3 รายการแล้ว"}
            </strong>
            <p>
              {blocked
                ? "ยังดูห้องได้ ตรวจช่วงวันที่และเหตุผลในข้อมูลส่วนตัว"
                : "ตรวจคำขอเดิมก่อนส่งคำขอใหม่"}
            </p>
          </div>
          <a href={blocked ? "#/profile" : "#/bookings"}>
            {blocked ? "ดูข้อมูลสิทธิ์" : "ดูการจองของฉัน"}
            <ArrowRight size={16} />
          </a>
        </div>
      ) : null}
      <section className="rooms-controls" aria-label="เลือกช่วงเวลาและจำนวนคน">
        <div className="rooms-main-fields">
          <label>
            วันที่ใช้งาน
            <input
              type="date"
              value={filter.date}
              min={today}
              max={addDays(today, 15)}
              onChange={(e) => update("date", e.target.value)}
              aria-describedby="selection-feedback"
            />
          </label>
          <label>
            เวลาเริ่ม
            <input
              type="time"
              step={1800}
              value={filter.start}
              onChange={(e) => update("start", e.target.value)}
              aria-describedby="selection-feedback"
            />
          </label>
          <label>
            เวลาสิ้นสุด
            <input
              type="time"
              step={1800}
              value={filter.end}
              onChange={(e) => update("end", e.target.value)}
              aria-describedby="selection-feedback"
            />
          </label>
          <label>
            จำนวนผู้ใช้งาน
            <div className="people-input">
              <Users size={18} />
              <input
                type="number"
                min={1}
                max={200}
                value={filter.capacity || ""}
                aria-label="จำนวนผู้ใช้งาน"
                onChange={(e) => update("capacity", Number(e.target.value))}
              />
              <span>คน</span>
            </div>
          </label>
        </div>
        <div className="rooms-search-meta">
          <div className="quick-days">
            <span>เลือกวันเร็ว ๆ</span>
            <button
              className={filter.date === today ? "selected" : ""}
              aria-pressed={filter.date === today}
              onClick={() => chooseDate(today)}
            >
              วันนี้
            </button>
            <button
              className={filter.date === addDays(today, 1) ? "selected" : ""}
              aria-pressed={filter.date === addDays(today, 1)}
              onClick={() => chooseDate(addDays(today, 1))}
            >
              พรุ่งนี้
            </button>
          </div>
          <p
            id="selection-feedback"
            className={issue ? "selection-error" : "selection-hint"}
            role={issue ? "alert" : undefined}
          >
            {issue || "ห้องว่างอัปเดตทันทีเมื่อเปลี่ยนวัน เวลา หรือจำนวนคน"}
          </p>
        </div>
        <details className="rooms-extra-filters">
          <summary>
            <SlidersHorizontal size={17} />
            ตัวกรองเพิ่มเติม
            {extraCount ? (
              <span className="filter-count">{extraCount}</span>
            ) : (
              <span className="optional-copy">อาคาร ประเภท และอุปกรณ์</span>
            )}
            <ChevronDown size={17} />
          </summary>
          <div className="rooms-extra-fields">
            <label>
              อาคาร
              <select
                value={filter.building}
                onChange={(e) => update("building", e.target.value)}
              >
                <option value="">ทุกอาคาร</option>
                {state.buildings.map((b) => (
                  <option value={b.id} key={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              ประเภทห้อง
              <select
                value={filter.type}
                onChange={(e) => update("type", e.target.value)}
              >
                <option value="">ทุกประเภท</option>
                {["ห้องศึกษากลุ่ม", "ห้องประชุม", "ห้องเรียน"].map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
            </label>
            <label>
              อุปกรณ์ประจำห้อง
              <select
                value={filter.amenity}
                onChange={(e) => update("amenity", e.target.value)}
              >
                <option value="">ไม่ระบุ</option>
                {["Wi-Fi", "โปรเจกเตอร์", "กระดานไวท์บอร์ด", "จอแสดงผล"].map(
                  (a) => (
                    <option key={a}>{a}</option>
                  ),
                )}
              </select>
            </label>
            <label>
              ชื่อหรือรหัสห้อง
              <div className="room-name-input">
                <Search size={17} />
                <input
                  value={filter.query}
                  placeholder="เช่น LIB-201"
                  aria-label="ชื่อหรือรหัสห้อง"
                  onChange={(e) => update("query", e.target.value)}
                />
              </div>
            </label>
          </div>
          {extraCount ? (
            <button className="text-button" onClick={clearExtra}>
              ล้างตัวกรองเพิ่มเติม
            </button>
          ) : null}
        </details>
      </section>
      <div className="rooms-results-heading">
        <div>
          <h2>
            {issue ? "เลือกช่วงเวลาเพื่อดูห้อง" : `ห้องว่าง ${readyCount} ห้อง`}
          </h2>
          {!issue ? (
            <p>
              <CalendarDays size={16} />
              {thaiDate(start, true)} · {filter.start}–{filter.end} น. ·{" "}
              {filter.capacity} คน
            </p>
          ) : null}
        </div>
        <label className="availability-toggle">
          <input
            type="checkbox"
            checked={onlyAvailable}
            onChange={(e) => setOnlyAvailable(e.target.checked)}
          />
          แสดงเฉพาะห้องว่าง
        </label>
      </div>
      {!issue && !onlyAvailable ? (
        <p className="all-rooms-hint">
          แสดงห้องที่ตรงเงื่อนไขทั้งหมด {rooms.length} ห้อง
          ห้องที่ไม่ว่างมีเหตุผลระบุไว้
        </p>
      ) : null}
      {rooms.length ? (
        <div className="student-room-grid">
          {rooms.map((r) => {
            const a = availability(state, r, start, end);
            const ready = a.kind === "available";
            return (
              <article className="student-room-card" key={r.id}>
                <div className="student-room-top">
                  <span className="room-kind-icon">
                    <DoorOpen size={23} />
                  </span>
                  <span className={`student-availability ${a.kind}`}>
                    {ready ? <Check size={16} /> : null}
                    {ready ? "ว่างในช่วงที่เลือก" : a.label}
                  </span>
                </div>
                <h3>{r.name}</h3>
                <RoomLocation room={r} />
                <div className="student-room-facts">
                  <span>
                    <Users size={17} />
                    รองรับ {r.capacity} คน
                  </span>
                  <span>{r.type}</span>
                  <span className="room-reference">{r.code}</span>
                </div>
                <ul
                  className="student-room-amenities"
                  aria-label="อุปกรณ์ประจำห้อง"
                >
                  {r.amenities.map((a) => (
                    <li key={a}>{a}</li>
                  ))}
                </ul>
                {!ready ? (
                  <p className="room-unavailable-reason">{a.reason}</p>
                ) : null}
                <div className="student-room-action">
                  <button
                    className="btn"
                    disabled={!ready || blocked || pending >= 3}
                    onClick={() =>
                      open({
                        kind: "book",
                        id: r.id,
                        date: filter.date,
                        start: filter.start,
                        end: filter.end,
                        attendees: filter.capacity,
                      })
                    }
                  >
                    {ready ? "เลือกห้องนี้" : "ไม่ว่างในช่วงนี้"}
                    {ready ? <ArrowRight size={17} /> : null}
                  </button>
                  {ready ? (
                    <small>ส่งคำขอแล้วรอเจ้าหน้าที่อนุมัติ</small>
                  ) : null}
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="student-empty">
          <Search size={28} />
          <h3>
            {issue
              ? "เริ่มจากเลือกวันและเวลา"
              : "ยังไม่มีห้องว่างตามเงื่อนไขนี้"}
          </h3>
          <p>
            {issue
              ? "เมื่อเลือกครบแล้ว ห้องที่จองได้จะแสดงที่นี่"
              : "ลองเปลี่ยนช่วงเวลา ลดจำนวนคน หรือล้างตัวกรองเพิ่มเติม"}
          </p>
          {!issue ? (
            <div>
              {extraCount ? (
                <button className="btn ghost" onClick={clearExtra}>
                  ล้างตัวกรองเพิ่มเติม
                </button>
              ) : null}
              <button
                className="btn ghost"
                onClick={() =>
                  chooseDate(
                    addDays(filter.date, 1) > addDays(today, 15)
                      ? today
                      : addDays(filter.date, 1),
                  )
                }
              >
                ลองวันถัดไป
              </button>
            </div>
          ) : null}
        </div>
      )}
      <div className="student-booking-guide">
        <strong>จองง่ายใน 3 ขั้นตอน</strong>
        <ol>
          <li>เลือกช่วงเวลาและห้อง</li>
          <li>ส่งคำขอและรออนุมัติ</li>
          <li>เช็คอินเมื่อถึงเวลา</li>
        </ol>
        <a href="#/help">
          ดูเงื่อนไขการจอง
          <ArrowRight size={15} />
        </a>
      </div>
    </div>
  );
}
