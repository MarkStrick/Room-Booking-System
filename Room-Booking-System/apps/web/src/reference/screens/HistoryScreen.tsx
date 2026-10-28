import { matchesBooking } from "../booking-filters";
import { useState } from "react";
import { useApp } from "../context/AppContext";
import { AppHeader } from "../components/PhoneFrame";
import { StatusBadge, Button, Modal, EmptyState } from "../components/ui";
import {
  MapPin,
  Clock,
  Users,
  Calendar,
  AlertCircle,
  History as HistoryIcon,
  CheckCircle2,
} from "lucide-react";
import type { Booking } from "../types";
import { useAsyncAction } from "../useAsyncAction";

export function HistoryScreen() {
  const { bookings, currentUser, cancelBooking, checkIn, today, navigate } =
    useApp();
  const { busy, error, perform } = useAsyncAction();
  const [detail, setDetail] = useState<Booking | null>(null);
  const [cancelTarget, setCancelTarget] = useState<Booking | null>(null);
  const [filter, setFilter] = useState<"all" | "upcoming" | "completed">(
    "upcoming",
  );

  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const myBookings = bookings.filter((b) => b.userId === currentUser?.id);

  const visible = myBookings.filter((b) => {
    if (!matchesBooking(b, query) || (status !== "all" && b.status !== status))
      return false;
    const terminal = ["cancelled", "rejected", "completed", "no_show"].includes(
      b.status,
    );
    if (filter === "upcoming")
      return (b.endDate ?? b.date) >= today && !terminal;
    if (filter === "completed")
      return (b.endDate ?? b.date) < today || terminal;
    return true;
  });

  const sorted = [...visible].sort((a, b) =>
    filter === "upcoming"
      ? a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime)
      : b.date.localeCompare(a.date) || b.startTime.localeCompare(a.startTime),
  );

  return (
    <div className="flex flex-col h-full bg-gray-50">
      <AppHeader showBack={false} />

      {/* Filter tabs */}
      <div className="list-toolbar shrink-0">
        <h1>การจองของฉัน</h1>
        <p>ติดตามคำขอ ดูรายละเอียด และเช็คอินก่อนใช้งานห้อง</p>
        <div className="list-filter-row">
          <input
            type="search"
            aria-label="ค้นหาการจองของฉัน"
            placeholder="ค้นหาห้องหรือเลขที่จอง"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <select
            aria-label="สถานะการจอง"
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setFilter("all");
            }}
          >
            <option value="all">ทุกสถานะ</option>
            <option value="pending">รออนุมัติ</option>
            <option value="approved">อนุมัติแล้ว</option>
            <option value="checked_in">เช็คอินแล้ว</option>
            <option value="completed">เสร็จสิ้น</option>
            <option value="rejected">ปฏิเสธ</option>
            <option value="cancelled">ยกเลิก</option>
            <option value="no_show">ไม่มาใช้งาน</option>
          </select>
        </div>
        <div className="list-tabs" role="group" aria-label="ช่วงเวลาการจอง">
          {(
            [
              { key: "all", label: "การจองทั้งหมด" },
              { key: "upcoming", label: "การจองปัจจุบัน" },
              { key: "completed", label: "ประวัติการจอง" },
            ] as const
          ).map((tab) => (
            <button
              key={tab.key}
              aria-pressed={filter === tab.key}
              onClick={() => setFilter(tab.key)}
              className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                filter === tab.key
                  ? "bg-cp-blue text-white"
                  : "bg-gray-100 text-gray-500"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <p className="mt-2 text-xs text-gray-600">
          {filter === "all"
            ? "รายการจองห้องของคุณทุกสถานะ"
            : filter === "upcoming"
              ? "รายการวันนี้และวันถัดไปที่รออนุมัติ อนุมัติแล้ว หรือกำลังใช้ห้อง"
              : "รายการที่ผ่านวันใช้งานแล้ว รวมถึงรายการที่เสร็จสิ้น ยกเลิก ถูกปฏิเสธ หรือไม่มาตามนัด"}
        </p>
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-hide px-4 py-3">
        {error && !cancelTarget && (
          <p role="alert" className="text-sm text-red-600 mb-3">
            {error}
          </p>
        )}
        {sorted.length === 0 ? (
          <EmptyState
            icon={<HistoryIcon size={28} />}
            title="ไม่มีการจองในรายการนี้"
            subtitle="ลองเปลี่ยนหมวดหรือสถานะ หรือค้นหาห้องเพื่อเริ่มจอง"
            action={
              <>
                <Button
                  variant="secondary"
                  onClick={() => {
                    setQuery("");
                    setStatus("all");
                    setFilter("all");
                  }}
                >
                  ดูการจองทั้งหมด
                </Button>
                <Button onClick={() => navigate("search")}>ค้นหาห้อง</Button>
              </>
            }
          />
        ) : (
          <div className="space-y-3">
            {sorted.map((booking) => (
              <div key={booking.id} className="booking-record">
                <div>
                  <div className="booking-record-header">
                    <div>
                      <h3 className="font-bold text-gray-900 text-sm">
                        {booking.roomName}
                      </h3>
                      <p className="text-xs text-gray-400 flex items-center gap-1 mt-0.5">
                        <MapPin size={12} /> {booking.building}
                      </p>
                    </div>
                    <StatusBadge status={booking.status} />
                  </div>

                  <div className="booking-record-meta">
                    <div className="flex items-center gap-1.5 text-gray-600">
                      <Calendar size={14} className="text-cp-blue" />
                      <span>{booking.date}</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-gray-600">
                      <Clock size={14} className="text-cp-blue" />
                      <span>
                        {booking.startTime}–
                        {booking.endDate && booking.endDate !== booking.date
                          ? booking.endDate + " "
                          : ""}
                        {booking.endTime}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 text-gray-600">
                      <Users size={14} className="text-cp-blue" />
                      <span>{booking.participants} ท่าน</span>
                    </div>
                  </div>

                  <p className="text-xs text-gray-500 mt-2.5 line-clamp-2 bg-gray-50 rounded-lg px-3 py-2">
                    {booking.purpose}
                  </p>

                  {booking.status === "rejected" && booking.rejectionReason && (
                    <div className="mt-2.5 flex items-start gap-2 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
                      <AlertCircle
                        size={16}
                        className="text-red-500 shrink-0 mt-0.5"
                      />
                      <p className="text-xs text-red-600">
                        {booking.rejectionReason}
                      </p>
                    </div>
                  )}

                  {booking.checklistCompleted && (
                    <div className="mt-2.5 flex items-center gap-1.5 text-xs text-green-600 font-semibold">
                      <CheckCircle2 size={14} /> ตรวจสภาพห้องเรียบร้อยแล้ว
                    </div>
                  )}

                  {booking.status === "pending" && (
                    <p className="record-pending-note">
                      รอเจ้าหน้าที่อนุมัติ จึงจะเข้าใช้งานห้องได้
                    </p>
                  )}
                  <div className="record-actions">
                    <button
                      className="text-sm font-semibold text-cp-blue"
                      onClick={() => setDetail(booking)}
                    >
                      ดูรายละเอียด · {booking.ref}
                    </button>
                    {booking.archivedAt && (
                      <p className="text-xs text-gray-500 mt-2">
                        ประวัติที่จัดเก็บแล้ว
                      </p>
                    )}
                    {booking.status === "approved" &&
                      (booking.date === today || booking.endDate === today) && (
                        <Button
                          disabled={busy}
                          className=""
                          onClick={() => perform(() => checkIn(booking.id))}
                        >
                          เช็คอินเข้าห้อง
                        </Button>
                      )}
                    {["approved", "pending"].includes(booking.status) &&
                      booking.date >= today && (
                        <button
                          onClick={() => setCancelTarget(booking)}
                          className="cancel-link"
                        >
                          ยกเลิกการจอง
                        </button>
                      )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <Modal
        title="รายละเอียดการจอง"
        open={!!detail}
        onClose={() => setDetail(null)}
      >
        {detail && (
          <div className="space-y-3 text-sm text-gray-700">
            <h2 className="text-lg font-bold text-gray-900">
              รายละเอียดการจอง {detail.ref}
            </h2>
            <StatusBadge status={detail.status} />
            <p>
              {detail.roomName} · {detail.building}
            </p>
            <p>
              {detail.date} · {detail.startTime}–
              {detail.endDate && detail.endDate !== detail.date
                ? detail.endDate + " "
                : ""}
              {detail.endTime} น.
            </p>
            <p>
              ผู้จอง: {detail.userName} · {detail.userEmail}
            </p>
            <p>ผู้เข้าร่วม {detail.participants} ท่าน</p>
            <p className="whitespace-pre-wrap">
              วัตถุประสงค์: {detail.purpose}
            </p>
            <p>
              อีเมลผู้เข้าร่วม:{" "}
              {detail.participantEmails?.join(", ") || "ไม่ได้ระบุ"}
            </p>
            <p>
              อุปกรณ์เพิ่มเติม:{" "}
              {detail.equipment
                ?.map((e) => `${e.name} ${e.qty} ชิ้น`)
                .join(", ") || "ไม่มี"}
            </p>
            {detail.rejectionReason && <p>เหตุผล: {detail.rejectionReason}</p>}
            <p>
              สร้างเมื่อ {new Date(detail.createdAt).toLocaleString("th-TH")}
            </p>
            <Button onClick={() => setDetail(null)} className="w-full">
              ปิดรายละเอียด
            </Button>
          </div>
        )}
      </Modal>
      {/* Cancel confirmation modal */}
      <Modal
        title="ยกเลิกการจอง"
        busy={busy}
        open={!!cancelTarget}
        onClose={() => setCancelTarget(null)}
      >
        <div className="text-center">
          <div className="w-14 h-14 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-3">
            <AlertCircle size={28} className="text-red-500" />
          </div>
          <h3 className="font-bold text-gray-900 text-lg mb-1">
            ยืนยันการยกเลิก
          </h3>
          <p className="text-sm text-gray-500 mb-1">
            คุณต้องการยกเลิกการจอง
            <br />
            <span className="font-semibold text-gray-700">
              {cancelTarget?.roomName}
            </span>
          </p>
          <p className="text-sm text-gray-500 mb-5">
            วันที่ {cancelTarget?.date} เวลา {cancelTarget?.startTime}–
            {cancelTarget?.endTime} น. ใช่หรือไม่?
          </p>
          <p className="text-sm text-amber-700 mb-5">
            ต้องยกเลิกก่อนเริ่มอย่างน้อย 2 ชั่วโมง หากส่งคำขอช้ากว่านี้
            ระบบจะไม่ยกเลิกและบันทึกความผิดตามกติกาการใช้ห้อง
          </p>
          <div className="flex gap-3">
            <Button
              variant="ghost"
              disabled={busy}
              className="flex-1"
              onClick={() => setCancelTarget(null)}
            >
              เก็บการจองไว้
            </Button>
            <Button
              variant="danger"
              className="flex-1"
              disabled={busy}
              onClick={() => {
                if (cancelTarget)
                  void perform(
                    () => cancelBooking(cancelTarget.id),
                    () => setCancelTarget(null),
                  );
              }}
            >
              ยืนยันยกเลิก
            </Button>
          </div>
          {error && (
            <p role="alert" className="text-sm text-red-600 mt-3">
              {error}
            </p>
          )}
        </div>
      </Modal>
    </div>
  );
}
