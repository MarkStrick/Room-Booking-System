import { useEffect, useRef, useState, type RefObject } from "react";
import { DayPilot, DayPilotCalendar } from "@daypilot/daypilot-lite-react";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock3,
  RefreshCw,
  Eye,
  EyeOff,
  MapPin,
  Layers3,
  ArrowUpRight,
} from "lucide-react";
import { useDemo } from "../../app/DemoProvider";
import { useApp } from "../context/AppContext";
import type { Room } from "../types";
import {
  addDays,
  availability,
  dateOf,
  stamp,
  thaiDate,
  time,
} from "../../lib/domain";
import {
  roomScheduleEvents,
  scheduleFreeSlots,
  scheduleDisplayHours,
  scheduleDates,
  scheduleNavigate,
  scheduleSlotIssue,
  type ScheduleView,
} from "../../lib/room-schedule";
import { computingCatalog } from "../../../../../packages/core/src/space-scope";
import "./room-schedule.css";

export function RoomSchedule({
  rooms: inputRooms,
  buildingId,
  setBuildingId,
  dateInputRef,
}: {
  rooms: Room[];
  buildingId: string;
  setBuildingId: (id: string) => void;
  dateInputRef: RefObject<HTMLInputElement | null>;
}) {
  const { state, mode, showToast } = useDemo();
  const {
    searchSlot,
    setSearchSlot,
    setSelectedRoom,
    navigate,
    currentUser,
    refresh,
  } = useApp();
  const [roomId, setRoomId] = useState("");
  const [listView, setListView] = useState(
    () => window.matchMedia("(max-width: 767px)").matches,
  );
  const [refreshing, setRefreshing] = useState(false);
  const [view, setView] = useState<ScheduleView>("day");
  const [categories, setCategories] = useState<string[]>([]);
  const [showNow, setShowNow] = useState(true);
  const [now, setNow] = useState(() => new Date().toISOString());
  useEffect(() => {
    const tick = setInterval(() => setNow(new Date().toISOString()), 30000);
    return () => clearInterval(tick);
  }, []);
  const catalog = computingCatalog(state);
  const types = [...new Set(catalog.rooms.map((r) => r.type))];
  const rooms = inputRooms.filter(
    (r) =>
      !categories.length ||
      categories.includes(
        state.rooms.find((x) => x.id === Number(r.id))?.type ?? "",
      ),
  );
  const date = searchSlot.date;
  const days = date ? scheduleDates(date, view) : [];

  const calendar = useRef<DayPilot.Calendar | null>(null);
  const hours = scheduleDisplayHours(
    state,
    rooms.map((r) => Number(r.id)),
    view === "week" ? days : [date],
  );
  const selected = rooms.find((r) => r.id === roomId) ?? rooms[0];
  const events = date
    ? roomScheduleEvents(
        state,
        rooms.map((r) => Number(r.id)),
        date,
      )
    : [];
  const columns =
    view === "week" && selected
      ? days.map((day) => ({
          id: `${selected.id}|${day}`,
          name: new Intl.DateTimeFormat("th-TH", {
            weekday: "short",
            day: "numeric",
            month: "short",
          }).format(new Date(stamp(day, "12:00"))),
          start: day,
        }))
      : rooms.map((r) => ({
          id: `${r.id}|${date}`,
          name: `${r.name} · ${r.capacity} ที่นั่ง`,
          start: date,
        }));
  const calendarEvents =
    view === "week" && selected
      ? days.flatMap((day) =>
          roomScheduleEvents(state, [Number(selected.id)], day).map((e) => ({
            ...e,
            id: `${e.id}|${day}`,
            resource: `${e.resource}|${day}`,
          })),
        )
      : events.map((e) => ({ ...e, resource: `${e.resource}|${date}` }));
  const cellHeight = Math.max(20, hours.cellDuration * 1.2);
  const nowMinutes =
    Number(time(now).slice(0, 2)) * 60 + Number(time(now).slice(3));
  const nowVisible =
    showNow &&
    view === "day" &&
    date === dateOf(now) &&
    nowMinutes >= hours.startHour * 60 &&
    nowMinutes < hours.endHour * 60;
  const missingHours = rooms.some(
    (r) => !state.rooms.find((x) => x.id === Number(r.id))?.hours,
  );

  const freeSlots =
    selected && date ? scheduleFreeSlots(state, Number(selected.id), date) : [];
  function book(id: string, start: string, end: string, bookingDate = date) {
    const room = rooms.find((r) => r.id === id);
    if (!room) return;
    const issue = scheduleSlotIssue(state, Number(id), bookingDate, start, end);
    if (issue) {
      showToast(issue, "error");
      return;
    }
    // An explicit calendar selection replaces only saved dates/times, preserving the rest of the form.
    try {
      const prefix = `kku-draft:${mode}:${currentUser.id}:booking:${id}:`;
      for (const field of ["date", "start", "end"])
        sessionStorage.removeItem(prefix + field);
      if (currentUser.id === "0")
        sessionStorage.setItem(
          "kku-booking-intent",
          JSON.stringify({
            roomId: id,
            slot: {
              ...searchSlot,
              date: bookingDate,
              start,
              end,
              endDate: undefined,
            },
          }),
        );
    } catch {
      /* The form can still use the selected interval without browser storage. */
    }
    setSearchSlot({
      ...searchSlot,
      date: bookingDate,
      start,
      end,
      endDate: undefined,
    });
    setSelectedRoom(room);
    navigate(currentUser.id === "0" ? "login" : "booking");
  }
  const setDate = (date: string) => {
    if (date) setSearchSlot({ ...searchSlot, date, endDate: undefined });
  };
  const changeDay = (offset: number) =>
    setDate(scheduleNavigate(date, view, offset));
  if (!date)
    return (
      <p className="schedule-empty">เลือกวันที่ด้านบนเพื่อดูตารางคิวห้อง</p>
    );
  return (
    <section
      className={`room-schedule ${listView ? "schedule-show-list" : ""}`}
      aria-label="ตารางคิวแต่ละห้อง"
    >
      <header className="schedule-toolbar">
        <div>
          <h3>
            <CalendarDays size={23} strokeWidth={1.6} />
            ตารางคิวห้อง
          </h3>
          <p>ดูคิวรายวัน สัปดาห์ หรือเดือน และเลือกช่วงว่างเพื่อจอง</p>
        </div>
        <div className="schedule-header-actions">
          <span className="schedule-room-count">
            {rooms.length} ห้อง · เวลาไทย
          </span>
          <button
            type="button"
            disabled={refreshing}
            aria-label="อัปเดตตารางคิว"
            className="schedule-icon-button"
            onClick={async () => {
              setRefreshing(true);
              try {
                await refresh(true);
              } finally {
                setRefreshing(false);
              }
            }}
          >
            <RefreshCw size={17} className={refreshing ? "animate-spin" : ""} />
          </button>
        </div>
      </header>
      <div className="schedule-filters">
        <div className="schedule-filter-row">
          <span className="schedule-filter-label">
            <MapPin size={15} />
            อาคาร
          </span>
          <div className="schedule-chips" role="group" aria-label="กรองอาคาร">
            <button
              type="button"
              aria-pressed={!buildingId}
              onClick={() => setBuildingId("")}
            >
              ทั้งหมด
            </button>
            {catalog.buildings.map((b) => (
              <button
                type="button"
                key={b.id}
                aria-pressed={buildingId === String(b.id)}
                onClick={() => setBuildingId(String(b.id))}
              >
                {b.name.match(/SC\.\d+/)?.[0] ?? b.name}
              </button>
            ))}
          </div>
        </div>
        <div className="schedule-filter-row">
          <span className="schedule-filter-label">
            <Layers3 size={15} />
            ประเภท
          </span>
          <div
            className="schedule-chips schedule-category-chips"
            role="group"
            aria-label="กรองประเภทห้อง"
          >
            <button
              type="button"
              aria-pressed={!categories.length}
              onClick={() => setCategories([])}
            >
              ทั้งหมด
            </button>
            {types.map((type) => (
              <button
                type="button"
                key={type}
                aria-pressed={categories.includes(type)}
                onClick={() =>
                  setCategories((previous) =>
                    previous.includes(type)
                      ? previous.filter((t) => t !== type)
                      : [...previous, type],
                  )
                }
              >
                {type}
              </button>
            ))}
          </div>
        </div>
      </div>
      <div className="schedule-navigation">
        <div
          className="schedule-segment"
          role="group"
          aria-label="มุมมองปฏิทิน"
        >
          {(
            [
              ["day", "วัน"],
              ["week", "สัปดาห์"],
              ["month", "เดือน"],
            ] as const
          ).map(([value, label]) => (
            <button
              type="button"
              key={value}
              aria-pressed={view === value}
              onClick={() => {
                setView(value);
                setListView(false);
              }}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="schedule-day-navigation">
          <button
            type="button"
            aria-label="ช่วงก่อนหน้า"
            onClick={() => changeDay(-1)}
          >
            <ChevronLeft size={18} />
          </button>
          <button type="button" onClick={() => setDate(dateOf(now))}>
            วันนี้
          </button>
          <button
            type="button"
            aria-label="ช่วงถัดไป"
            onClick={() => changeDay(1)}
          >
            <ChevronRight size={18} />
          </button>
        </div>
        <label className="schedule-date-picker">
          <span className="sr-only">วันที่ตารางคิว</span>
          <input
            ref={dateInputRef}
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </label>
        <div className="schedule-secondary-tools">
          <span className="schedule-clock">
            <i />
            {time(now)} น.
          </span>
          <button
            type="button"
            className="schedule-icon-button"
            aria-label="แสดงเส้นเวลาปัจจุบัน"
            aria-pressed={showNow}
            onClick={() => setShowNow(!showNow)}
          >
            {showNow ? <Eye size={17} /> : <EyeOff size={17} />}
          </button>
          <button
            type="button"
            className="schedule-list-toggle"
            aria-pressed={listView}
            onClick={() => {
              setListView(!listView);
              if (!listView) setView("day");
            }}
          >
            {listView ? "ดูตาราง" : "ดูรายการ"}
          </button>
        </div>
      </div>
      <div className="schedule-date-heading">
        <h4>
          {view === "month"
            ? new Intl.DateTimeFormat("th-TH", {
                month: "long",
                year: "numeric",
              }).format(new Date(stamp(date, "12:00")))
            : view === "week"
              ? `${thaiDate(stamp(days[0], "12:00"))} – ${thaiDate(stamp(days[6], "12:00"))}`
              : thaiDate(stamp(date, "12:00"))}
        </h4>
        <span>
          {view === "week"
            ? "เลือกห้องเพื่อดูตลอดสัปดาห์"
            : view === "month"
              ? "เลือกวันเพื่อดูคิวแต่ละห้อง"
              : "เลื่อนซ้าย–ขวาเพื่อดูทุกห้อง"}
        </span>
      </div>
      <div className="schedule-legend">
        <span>
          <i className="legend-free" />
          ช่วงว่าง
        </span>
        <span>
          <i className="legend-pending" />
          รออนุมัติ
        </span>
        <span>
          <i className="legend-approved" />
          จองแล้ว
        </span>
        <span>
          <i className="legend-in-use" />
          กำลังใช้งาน
        </span>
        <span>
          <i className="legend-closed" />
          ยังจองไม่ได้
        </span>
      </div>
      {missingHours && (
        <p className="schedule-notice">
          <Clock3 size={16} />
          บางห้องยังไม่ระบุเวลาให้บริการ แสดงกรอบเวลาเพื่อดูคิวเท่านั้น
          และยังเลือกจองห้องนั้นไม่ได้
        </p>
      )}
      {rooms.length === 0 ? (
        <p className="schedule-empty">
          ไม่พบห้องที่ตรงกับตัวกรอง ลองเปลี่ยนอาคารหรือประเภทห้อง
        </p>
      ) : (
        <>
          {view === "week" && (
            <label className="schedule-room-picker">
              ห้องที่ต้องการดูตลอดสัปดาห์
              <select
                value={selected.id}
                onChange={(e) => setRoomId(e.target.value)}
              >
                {rooms.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name} · {r.building}
                  </option>
                ))}
              </select>
            </label>
          )}
          {view === "month" ? (
            <div className="schedule-month" aria-label="ปฏิทินรายเดือน">
              <div className="schedule-month-weekdays">
                {["จ.", "อ.", "พ.", "พฤ.", "ศ.", "ส.", "อา."].map((day) => (
                  <span key={day}>{day}</span>
                ))}
              </div>
              <div className="schedule-month-days">
                {days.map((day) => {
                  const count = roomScheduleEvents(
                    state,
                    rooms.map((r) => Number(r.id)),
                    day,
                  ).length;
                  const holiday = state.holidays.includes(day);
                  return (
                    <button
                      type="button"
                      key={day}
                      className={`${day.slice(0, 7) !== date.slice(0, 7) ? "outside-month" : ""} ${day === dateOf(now) ? "is-today" : ""}`}
                      aria-label={`${thaiDate(stamp(day, "12:00"))} ${count} คิว${holiday ? " วันหยุด" : ""}`}
                      onClick={() => {
                        setDate(day);
                        setView("day");
                      }}
                    >
                      <strong>{Number(day.slice(8))}</strong>
                      <span>
                        {holiday
                          ? "วันหยุด"
                          : count
                            ? `${count} คิว`
                            : "ไม่มีคิว"}
                      </span>
                      {count > 0 && <i />}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            <div
              className="schedule-grid"
              onScroll={(event) => {
                event.currentTarget.style.setProperty(
                  "--schedule-scroll-x",
                  `${event.currentTarget.scrollLeft}px`,
                );
                event.currentTarget.style.setProperty(
                  "--schedule-scroll-y",
                  `${event.currentTarget.scrollTop}px`,
                );
              }}
              tabIndex={0}
              role="region"
              aria-label="ตารางคิว เลื่อนแนวนอนเพื่อดูห้องเพิ่มเติม หรือเลือกดูรายการเพื่อจองด้วยคีย์บอร์ด"
            >
              <div
                className="schedule-calendar"
                style={{ minWidth: Math.max(540, columns.length * 150 + 64) }}
              >
                <DayPilotCalendar
                  controlRef={calendar}
                  startDate={date}
                  viewType="Resources"
                  cellDuration={hours.cellDuration}
                  cellHeight={cellHeight}
                  businessBeginsHour={hours.startHour}
                  businessEndsHour={hours.endHour}
                  heightSpec="BusinessHoursNoScroll"
                  timeFormat="Clock24Hours"
                  headerHeight={64}
                  hourWidth={64}
                  headerTextWrappingEnabled={true}
                  columns={columns}
                  events={calendarEvents.map((e) => ({
                    ...e,
                    text: `${e.text} · ${e.start.slice(11, 16)}–${e.end.slice(11, 16)}`,
                  }))}
                  eventMoveHandling="Disabled"
                  eventResizeHandling="Disabled"
                  eventDeleteHandling="Disabled"
                  onBeforeCellRender={(args) => {
                    const from = stamp(
                      args.cell.start.toString("yyyy-MM-dd"),
                      args.cell.start.toString("HH:mm"),
                    );
                    const to = stamp(
                      args.cell.end.toString("yyyy-MM-dd"),
                      args.cell.end.toString("HH:mm"),
                    );
                    const room = state.rooms.find(
                      (r) =>
                        r.id ===
                        Number(String(args.cell.resource).split("|")[0]),
                    );
                    const cellDate = args.cell.start.toString("yyyy-MM-dd");
                    if (
                      !room?.hours ||
                      Date.parse(from) <= Date.parse(state.now) ||
                      cellDate > addDays(dateOf(state.now), 15) ||
                      availability(state, room, from, to).kind !== "available"
                    )
                      args.cell.properties.backColor =
                        args.cell.start.toString("mm") === "00"
                          ? "#f1f5f9"
                          : "#eaf0f6";
                    else
                      args.cell.properties.backColor =
                        args.cell.start.toString("mm") === "00"
                          ? "#ffffff"
                          : "#f3f8fc";
                  }}
                  onTimeRangeSelected={(args) => {
                    calendar.current?.clearSelection();
                    const bookingDate = args.start.toString("yyyy-MM-dd");
                    if (args.end.toString("yyyy-MM-dd") !== bookingDate) {
                      showToast("กรุณาเลือกช่วงเวลาภายในวันเดียวกัน", "error");
                      return;
                    }
                    book(
                      String(args.resource).split("|")[0],
                      args.start.toString("HH:mm"),
                      args.end.toString("HH:mm"),
                      bookingDate,
                    );
                  }}
                  onEventClick={() =>
                    showToast(
                      "ช่วงเวลานี้มีคิวหรือปิดให้บริการแล้ว กรุณาเลือกช่วงว่าง",
                    )
                  }
                />
                <div className="schedule-axis-label" aria-hidden="true">
                  เวลา
                </div>
                <div className="schedule-time-labels" aria-label="เวลาในตาราง">
                  {Array.from(
                    {
                      length: Math.round(
                        ((hours.endHour - hours.startHour) * 60) /
                          hours.cellDuration,
                      ),
                    },
                    (_, i) => {
                      const minutes =
                        Math.round(hours.startHour * 60) +
                        i * hours.cellDuration;
                      return (
                        <span key={minutes} style={{ height: cellHeight }}>
                          {String(Math.floor(minutes / 60)).padStart(2, "0")}:
                          {String(minutes % 60).padStart(2, "0")}
                        </span>
                      );
                    },
                  )}
                </div>
                {nowVisible && (
                  <div
                    className="schedule-now-line"
                    style={{
                      top:
                        64 +
                        ((nowMinutes - hours.startHour * 60) /
                          hours.cellDuration) *
                          cellHeight,
                    }}
                  >
                    <span>{time(now)}</span>
                  </div>
                )}
              </div>
              <p className="schedule-range-end">
                สิ้นสุดกรอบเวลา{" "}
                {String(Math.floor(hours.endHour)).padStart(2, "0")}:
                {String(Math.round((hours.endHour % 1) * 60)).padStart(2, "0")}{" "}
                น.
              </p>
            </div>
          )}
          <div className="schedule-agenda">
            <label className="schedule-room-picker">
              เลือกห้อง
              <select
                value={selected.id}
                onChange={(e) => setRoomId(e.target.value)}
              >
                {rooms.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name} · {r.building}
                  </option>
                ))}
              </select>
            </label>
            <div className="schedule-agenda-heading">
              <h4>{selected.name}</h4>
              <span>
                {selected.openTime
                  ? `${selected.openTime}–${selected.closeTime} น.`
                  : "ยังไม่ระบุเวลาทำการ"}
              </span>
            </div>
            <div className="schedule-queue" aria-label="คิวของห้องที่เลือก">
              {events
                .filter((e) => e.resource === selected.id)
                .sort((a, b) => a.start.localeCompare(b.start))
                .map((e) => (
                  <div
                    key={e.id}
                    className="schedule-queue-item"
                    style={{ background: e.backColor }}
                  >
                    <Clock3 size={16} />
                    <strong>
                      {e.start.slice(0, 10) < date
                        ? "ต่อจากวันก่อน"
                        : e.start.slice(11, 16)}
                      –
                      {e.end.slice(0, 10) > date
                        ? "ถึงวันถัดไป"
                        : e.end.slice(11, 16)}
                    </strong>
                    <span>{e.text}</span>
                  </div>
                ))}
              {!events.some((e) => e.resource === selected.id) && (
                <p>ไม่มีคิวจองในวันนี้ ตรวจช่วงที่จองได้ด้านล่าง</p>
              )}
            </div>
            <p className="schedule-slots-label">
              ช่วงเวลาว่าง · เลือกครั้งละ 30 นาที แล้วปรับเพิ่มในฟอร์มได้
            </p>
            <div className="schedule-slots">
              {freeSlots.map(({ start, end }) => (
                <button
                  type="button"
                  key={start}
                  onClick={() => book(selected.id, start, end)}
                  aria-label={`จอง ${selected.name} ${start} ถึง ${end}`}
                >
                  {start}–{end}
                </button>
              ))}
            </div>
            {!freeSlots.length && (
              <p className="schedule-empty">
                ไม่มีช่วงที่จองได้ในวันนี้ ลองเลือกวันอื่น
              </p>
            )}
          </div>
        </>
      )}
      <footer className="schedule-footnote">
        <span>กดหรือลากช่วงว่างเพื่อจอง · แสดงเฉพาะเวลาและสถานะคิว</span>
        <span>
          ข้อมูลการจองภายใน CP SPACE · ไม่ซิงก์คิวภายนอก
          <ArrowUpRight size={13} />
        </span>
      </footer>
    </section>
  );
}
