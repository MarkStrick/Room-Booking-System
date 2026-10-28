import { lazy, Suspense, useRef, useState } from "react";
import {
  CalendarDays,
  ChevronRight,
  Clock,
  DoorOpen,
  MapPin,
  Search,
  SlidersHorizontal,
  Users,
} from "lucide-react";
import { computingCatalog } from "../../../../../packages/core/src/space-scope";
import { searchSlotError } from "../../../../../packages/core/src/search";
import { HolidayBookingWarning } from "../../components/HolidayBookingWarning";
import { useDemo } from "../../app/DemoProvider";
import { addDays, availability, dateOf, stamp } from "../../lib/domain";
import { useApp } from "../context/AppContext";
import { AppHeader } from "../components/PhoneFrame";
import { RoomImage } from "../components/RoomImage";
import { TimeSelect } from "../components/TimeSelect";
import { EmptyState } from "../components/ui";
import { matchesRoom } from "../booking-filters";
import "./search.css";
const RoomSchedule = lazy(() =>
  import("../components/RoomSchedule").then((module) => ({
    default: module.RoomSchedule,
  })),
);

export function SearchScreen() {
  const {
    rooms,
    navigate,
    setSelectedRoom,
    roomAvailable,
    searchSlot,
    setSearchSlot,
    currentUser,
  } = useApp();
  const { state, mode } = useDemo();
  const catalog = computingCatalog(state);
  const [buildingId, setBuildingId] = useState("");
  const [query, setQuery] = useState("");
  const [capacity, setCapacity] = useState(searchSlot.capacity ?? 0);
  const [type, setType] = useState("");
  const [amenity, setAmenity] = useState("");
  const [onlyAvailable, setOnlyAvailable] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [view, setView] = useState<"rooms" | "schedule">("rooms");
  const { date, start, end } = searchSlot;
  const dateInput = useRef<HTMLInputElement>(null);
  const isHoliday = state.holidays.includes(date);
  const slotError = searchSlotError(state, date, start, end);
  const filtersCount = [
    buildingId,
    capacity,
    type,
    amenity,
    onlyAvailable,
  ].filter(Boolean).length;
  const matching = rooms.filter((room) => {
    const source = catalog.rooms.find((r) => String(r.id) === room.id);
    return (
      source &&
      matchesRoom(source, room.building, {
        query,
        capacity,
        type,
        amenity,
        buildingId,
      })
    );
  });
  const availableCount = matching.filter((room) =>
    roomAvailable(room, date, start, end),
  ).length;
  // Availability is meaningful only for a complete, valid interval; calendar owns its own date selection.
  const filtered =
    view === "rooms" && onlyAvailable && !slotError
      ? matching.filter((room) => roomAvailable(room, date, start, end))
      : matching;
  const reset = () => {
    setQuery("");
    setCapacity(0);
    setType("");
    setAmenity("");
    setBuildingId("");
    setOnlyAvailable(false);
  };
  const chooseDate = () => {
    dateInput.current?.focus();
    try {
      dateInput.current?.showPicker();
    } catch {
      /* Native date field remains usable. */
    }
  };
  const statusFor = (id: string) => {
    const room = catalog.rooms.find((r) => String(r.id) === id)!;
    if (room.status !== "AVAILABLE")
      return {
        kind: "closed",
        label: room.status === "MAINTENANCE" ? "ปิดปรับปรุง" : "ปิดให้บริการ",
        reason: room.reason,
      };
    if (isHoliday)
      return {
        kind: "closed",
        label: "วันหยุดมหาวิทยาลัย",
        reason: "เลือกวันอื่นเพื่อจอง",
      };
    if (slotError)
      return {
        kind: "unknown",
        label: "เลือกเวลาเพื่อเช็คห้องว่าง",
        reason: "",
      };
    return availability(state, room, stamp(date, start), stamp(date, end));
  };
  function selectRoom(room: (typeof rooms)[number]) {
    const slot = {
      ...searchSlot,
      capacity: capacity || undefined,
      endDate: undefined,
    };
    setSearchSlot(slot);
    try {
      // A new search selection replaces saved times, while keeping purpose and equipment drafts.
      for (const field of ["date", "start", "end"])
        sessionStorage.removeItem(
          `kku-draft:${mode}:${currentUser.id}:booking:${room.id}:${field}`,
        );
      if (currentUser.id === "0")
        sessionStorage.setItem(
          "kku-booking-intent",
          JSON.stringify({ roomId: room.id, slot }),
        );
    } catch {
      /* Booking can continue when browser storage is unavailable. */
    }
    setSelectedRoom(room);
    navigate(currentUser.id === "0" ? "login" : "booking");
  }

  return (
    <div className="search-screen flex flex-col h-full bg-gray-50">
      <AppHeader showBack={false} />
      <div className="search-content flex-1 min-h-0 overflow-y-auto">
        <header className="search-overview">
          <div>
            <h1>ค้นหาห้อง</h1>
            <p>พื้นที่เรียน ประชุม และทำงานร่วมกันของวิทยาลัยการคอมพิวเตอร์</p>
          </div>
          <div
            className="room-view-switch"
            role="group"
            aria-label="รูปแบบการแสดงห้อง"
          >
            <button
              type="button"
              aria-pressed={view === "rooms"}
              onClick={() => setView("rooms")}
            >
              <DoorOpen size={17} />
              รายการห้อง
            </button>
            <button
              type="button"
              aria-pressed={view === "schedule"}
              onClick={() => setView("schedule")}
            >
              <CalendarDays size={17} />
              ตารางคิว
            </button>
          </div>
        </header>
        <section className="search-controls" aria-label="ค้นหาและกรองห้อง">
          <div className="search-query-row">
            <label className="search-query">
              <Search size={18} aria-hidden="true" />
              <input
                aria-label="ค้นหาชื่อห้อง รหัส หรืออาคาร"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="ค้นหาชื่อห้อง รหัส หรืออาคาร"
                type="search"
              />
            </label>
            <button
              type="button"
              className="search-filter-button"
              aria-expanded={showFilters}
              aria-controls="room-filters"
              onClick={() => setShowFilters(!showFilters)}
            >
              <SlidersHorizontal size={17} />
              ตัวกรอง{filtersCount > 0 && <span>{filtersCount}</span>}
            </button>
          </div>
          {view === "rooms" && (
            <div className="search-date-fields">
              <label>
                วันที่ใช้งาน
                <input
                  ref={dateInput}
                  type="date"
                  aria-label="วันที่ใช้งาน"
                  min={dateOf(state.now)}
                  max={addDays(dateOf(state.now), 15)}
                  value={date}
                  onChange={(e) =>
                    setSearchSlot({
                      ...searchSlot,
                      date: e.target.value,
                      endDate: undefined,
                    })
                  }
                  aria-describedby="search-time-feedback"
                />
              </label>
              <label>
                เวลาเริ่ม
                <TimeSelect
                  aria-label="เวลาเริ่ม"
                  value={start}
                  onChange={(e) =>
                    setSearchSlot({
                      ...searchSlot,
                      start: e.target.value,
                      endDate: undefined,
                    })
                  }
                  aria-describedby="search-time-feedback"
                />
              </label>
              <label>
                เวลาสิ้นสุด
                <TimeSelect
                  aria-label="เวลาสิ้นสุด"
                  value={end}
                  onChange={(e) =>
                    setSearchSlot({
                      ...searchSlot,
                      end: e.target.value,
                      endDate: undefined,
                    })
                  }
                  aria-describedby="search-time-feedback"
                />
              </label>
            </div>
          )}
          <div
            id="room-filters"
            className="search-extra-fields"
            hidden={!showFilters}
          >
            <label>
              อาคาร
              <select
                value={buildingId}
                onChange={(e) => setBuildingId(e.target.value)}
              >
                <option value="">ทุกอาคาร</option>
                {catalog.buildings
                  .filter((b) => b.active !== false)
                  .map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
              </select>
            </label>
            <label>
              จำนวนคนอย่างน้อย
              <input
                type="number"
                min={1}
                step={1}
                value={capacity || ""}
                placeholder="ไม่ระบุ"
                onChange={(e) =>
                  setCapacity(Math.max(0, Number(e.target.value)))
                }
              />
            </label>
            <label>
              ประเภทห้อง
              <select value={type} onChange={(e) => setType(e.target.value)}>
                <option value="">ทุกประเภท</option>
                {[...new Set(catalog.rooms.map((r) => r.type))].map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
            </label>
            <label>
              อุปกรณ์ประจำห้อง
              <select
                value={amenity}
                onChange={(e) => setAmenity(e.target.value)}
              >
                <option value="">ไม่ระบุ</option>
                {[...new Set(catalog.rooms.flatMap((r) => r.amenities))]
                  .sort()
                  .map((a) => (
                    <option key={a}>{a}</option>
                  ))}
              </select>
            </label>
          </div>
          {view === "rooms" && (
            <div className="search-filter-footer">
              <p id="search-time-feedback" role="status">
                {slotError ||
                  `ห้องว่าง ${availableCount} ห้อง · ${start}–${end} น.`}
              </p>
              <label className="search-available-toggle">
                <input
                  type="checkbox"
                  checked={onlyAvailable}
                  disabled={!!slotError}
                  onChange={(e) => setOnlyAvailable(e.target.checked)}
                />
                เฉพาะห้องว่าง
              </label>
            </div>
          )}
          {(filtersCount > 0 || query) && (
            <button type="button" className="search-reset" onClick={reset}>
              ล้างตัวกรองทั้งหมด
            </button>
          )}
          {isHoliday && (
            <HolidayBookingWarning date={date} onChooseDate={chooseDate} />
          )}
        </section>
        <section className="search-results" aria-label="ผลการค้นหา">
          {view === "schedule" ? (
            <Suspense
              fallback={
                <p role="status" className="schedule-loading">
                  กำลังโหลดตารางคิว…
                </p>
              }
            >
              <RoomSchedule
                rooms={matching}
                buildingId={buildingId}
                setBuildingId={setBuildingId}
                dateInputRef={dateInput}
              />
            </Suspense>
          ) : (
            <>
              <div className="search-results-heading">
                <h2 role="status" aria-live="polite">
                  พบ {filtered.length} ห้อง
                </h2>
                <span>เลือกห้องเพื่อดูรายละเอียดและเวลาที่จองได้</span>
              </div>
              <div className="search-room-grid">
                {filtered.map((room) => {
                  const status = statusFor(room.id);
                  return (
                    <article className="search-room-card" key={room.id}>
                      <div className="search-room-photo">
                        <RoomImage
                          src={room.imageUrl}
                          name={room.name}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="search-room-body">
                        <span
                          className={`room-availability status-${status.kind}`}
                        >
                          {status.label}
                        </span>
                        <h3>{room.name}</h3>
                        <p className="room-location">
                          <MapPin size={15} aria-hidden="true" />
                          {room.building} · {room.floor}
                        </p>
                        <div className="room-facts">
                          <span>
                            <Users size={15} />
                            {room.capacity} คน
                          </span>
                          <span>
                            <Clock size={15} />
                            {room.openTime
                              ? `${room.openTime}–${room.closeTime}`
                              : "ยังไม่ระบุเวลาเปิด"}
                          </span>
                        </div>
                        <p className="room-amenities">
                          {room.amenities.slice(0, 3).join(" · ") ||
                            "ดูอุปกรณ์ในรายละเอียดห้อง"}
                          {room.amenities.length > 3
                            ? ` · +${room.amenities.length - 3}`
                            : ""}
                        </p>
                        {status.reason && (
                          <p className="room-status-reason">{status.reason}</p>
                        )}
                        <button
                          className="room-detail-button"
                          type="button"
                          onClick={() => selectRoom(room)}
                          aria-label={`ดูรายละเอียดและจอง ${room.name}`}
                        >
                          ดูรายละเอียดและจอง
                          <ChevronRight size={17} />
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
              {filtered.length === 0 && (
                <EmptyState
                  icon={<Search size={28} />}
                  title="ไม่พบห้องที่ตรงกับเงื่อนไข"
                  subtitle="ลองเปลี่ยนช่วงเวลา ลดจำนวนคน หรือล้างตัวกรอง"
                  action={
                    <button className="search-reset" onClick={reset}>
                      ล้างตัวกรองและดูห้องทั้งหมด
                    </button>
                  }
                />
              )}
            </>
          )}
        </section>
      </div>
    </div>
  );
}
