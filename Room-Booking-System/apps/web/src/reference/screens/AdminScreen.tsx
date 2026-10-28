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
  Check,
  X,
  FileText,
  Mail,
  AlertCircle,
  ShieldCheck,
  ClipboardList,
} from "lucide-react";
import type { Booking } from "../types";
import { useAsyncAction } from "../useAsyncAction";

export function AdminScreen() {
  const {
    bookings: allBookings,
    approveBooking,
    rejectBooking,
    navigate,
    setSelectedBookingForChecklist,
    today,
  } = useApp();
  const bookings = allBookings.filter((b) => b.canManage);
  const { busy, error, perform } = useAsyncAction();
  const [rejectTarget, setRejectTarget] = useState<Booking | null>(null);
  const [approveTarget, setApproveTarget] = useState<Booking | null>(null);
  const [query, setQuery] = useState("");
  const [bookingDate, setBookingDate] = useState("");
  const [rejectReason, setRejectReason] = useState("");
  const [filter, setFilter] = useState<
    "pending" | "approved" | "rejected" | "all"
  >("pending");

  const visible = bookings
    .filter((b) => {
      if (!matchesBooking(b, query) || (bookingDate && b.date !== bookingDate))
        return false;
      if (filter === "all") return true;
      return b.status === filter;
    })
    .sort((a, b) =>
      filter === "pending"
        ? a.createdAt.localeCompare(b.createdAt)
        : b.date.localeCompare(a.date),
    );

  const pendingCount = bookings.filter((b) => b.status === "pending").length;

  const handleConfirmReject = () => {
    if (rejectTarget && rejectReason.trim()) {
      void perform(
        () => rejectBooking(rejectTarget.id, rejectReason.trim()),
        () => {
          setRejectTarget(null);
          setRejectReason("");
        },
      );
    }
  };

  const handleChecklist = (booking: Booking) => {
    setSelectedBookingForChecklist(booking);
    navigate("checklist");
  };

  const predefinedReasons = [
    "ห้องประชุมถูกจองโดยคณะกรรมการในช่วงเวลาดังกล่าว",
    "รายละเอียดการจองไม่ครบถ้วน กรุณาแก้ไขและยื่นใหม่",
    "วัตถุประสงค์ไม่สอดคล้องกับนโยบายการใช้ห้อง",
    "เกินเวลาที่กำหนดในการจองล่วงหน้า",
  ];

  return (
    <div className="flex flex-col h-full bg-gray-50">
      <AppHeader showBack={false} title="อนุมัติการจอง" />

      <div className="list-toolbar shrink-0">
        <h1>อนุมัติการจอง</h1>
        <p>
          รอพิจารณา {pendingCount} รายการ · แสดงเฉพาะห้องในความรับผิดชอบของคุณ
        </p>
        <div className="list-filter-row">
          <input
            type="search"
            aria-label="ค้นหาคำขอจอง"
            placeholder="ชื่อผู้จอง ห้อง หรือเลขที่จอง"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <input
            type="date"
            aria-label="กรองวันที่ใช้งาน"
            value={bookingDate}
            onChange={(e) => setBookingDate(e.target.value)}
          />
          {(query || bookingDate) && (
            <Button
              variant="ghost"
              onClick={() => {
                setQuery("");
                setBookingDate("");
              }}
            >
              ล้างการค้นหา
            </Button>
          )}
        </div>
      </div>

      {/* Filter tabs */}
      <div
        className="list-tabs px-4 py-2.5 bg-white border-b border-gray-100 shrink-0"
        role="group"
        aria-label="สถานะคำขอ"
      >
        {(
          [
            { key: "pending", label: "รออนุมัติ" },
            { key: "approved", label: "อนุมัติแล้ว" },
            { key: "rejected", label: "ปฏิเสธ" },
            { key: "all", label: "ทั้งหมด" },
          ] as const
        ).map((tab) => (
          <button
            key={tab.key}
            aria-pressed={filter === tab.key}
            onClick={() => setFilter(tab.key)}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors whitespace-nowrap ${
              filter === tab.key
                ? "bg-cp-blue text-white"
                : "bg-gray-100 text-gray-500"
            }`}
          >
            {tab.label} (
            {tab.key === "all"
              ? bookings.length
              : bookings.filter((booking) => booking.status === tab.key).length}
            )
          </button>
        ))}
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto scrollbar-hide px-4 py-3">
        {error && !rejectTarget && !approveTarget && (
          <p role="alert" className="text-sm text-red-600 mb-3">
            {error}
          </p>
        )}
        {visible.length === 0 ? (
          <EmptyState
            icon={<ShieldCheck size={28} />}
            title="ไม่มีคำขอในหมวดนี้"
            subtitle="ลองเปลี่ยนสถานะ วันที่ หรือข้อความค้นหา"
          />
        ) : (
          <div className="space-y-3">
            {visible.map((booking) => (
              <div key={booking.id} className="booking-record">
                <div className="booking-record-header">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-full bg-cp-blue flex items-center justify-center text-white font-bold text-xs shrink-0">
                      {booking.userName.charAt(0)}
                    </div>
                    <div>
                      <p className="font-semibold text-sm text-gray-900">
                        {booking.userName}
                      </p>
                      <p className="text-xs text-gray-400 flex items-center gap-1">
                        <Mail size={11} /> {booking.userEmail}
                      </p>
                    </div>
                  </div>
                  <StatusBadge status={booking.status} />
                </div>

                <div className="approval-details">
                  <p className="font-bold text-sm text-gray-900 mb-1">
                    {booking.roomName}
                  </p>
                  <p className="text-xs text-gray-400 flex items-center gap-1 mb-2">
                    <MapPin size={12} /> {booking.building}
                  </p>
                  <div className="booking-record-meta">
                    <span className="flex items-center gap-1">
                      <Calendar size={13} className="text-cp-blue" />
                      {booking.date}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock size={13} className="text-cp-blue" />
                      {booking.startTime}–
                      {booking.endDate && booking.endDate !== booking.date
                        ? booking.endDate + " "
                        : ""}
                      {booking.endTime}
                    </span>
                    <span className="flex items-center gap-1">
                      <Users size={13} className="text-cp-blue" />
                      {booking.participants} ท่าน
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 mt-2 flex items-start gap-1">
                    <FileText
                      size={13}
                      className="text-gray-400 mt-0.5 shrink-0"
                    />
                    {booking.purpose}
                  </p>
                </div>

                <p className="text-xs text-gray-500 mb-3">
                  {booking.ref} · อุปกรณ์:{" "}
                  {booking.equipment
                    ?.map((item) => `${item.name} × ${item.qty}`)
                    .join(" · ") || "ไม่ยืมเพิ่มเติม"}
                </p>
                {booking.status === "rejected" && booking.rejectionReason && (
                  <div className="flex items-start gap-2 bg-red-50 border border-red-100 rounded-lg px-3 py-2 mb-2">
                    <AlertCircle
                      size={15}
                      className="text-red-500 shrink-0 mt-0.5"
                    />
                    <p className="text-xs text-red-600">
                      {booking.rejectionReason}
                    </p>
                  </div>
                )}

                {booking.status === "pending" && (
                  <div className="record-actions">
                    <Button
                      variant="danger"
                      size="sm"
                      className="flex-1"
                      disabled={busy}
                      onClick={() => setRejectTarget(booking)}
                    >
                      <span className="flex items-center justify-center gap-1.5">
                        <X size={16} /> ปฏิเสธ
                      </span>
                    </Button>
                    <Button
                      variant="success"
                      size="sm"
                      className="flex-1"
                      disabled={busy}
                      onClick={() => setApproveTarget(booking)}
                    >
                      <span className="flex items-center justify-center gap-1.5">
                        <Check size={16} /> อนุมัติ
                      </span>
                    </Button>
                  </div>
                )}

                {["approved", "checked_in", "completed"].includes(
                  booking.status,
                ) &&
                  !booking.checklistCompleted &&
                  booking.date <= today && (
                    <button
                      onClick={() => handleChecklist(booking)}
                      className="mt-3 w-full py-2.5 bg-blue-50 border border-blue-200 rounded-xl text-sm font-semibold text-blue-700 flex items-center justify-center gap-2 hover:bg-blue-100 transition-colors"
                    >
                      <ClipboardList size={16} /> ตรวจสภาพห้อง
                    </button>
                  )}

                {booking.checklistCompleted && (
                  <div className="mt-2 flex items-center gap-1.5 text-xs text-green-600 font-semibold">
                    <ClipboardList size={14} /> ตรวจสภาพห้องเรียบร้อยแล้ว
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <Modal
        title="ยืนยันอนุมัติการจอง"
        open={!!approveTarget}
        busy={busy}
        onClose={() => setApproveTarget(null)}
      >
        {approveTarget && (
          <div className="space-y-4">
            <p className="font-semibold">
              {approveTarget.roomName} · {approveTarget.ref}
            </p>
            <p>
              {approveTarget.date} · {approveTarget.startTime}–
              {approveTarget.endTime} น.
            </p>
            <p>
              ผู้จอง: {approveTarget.userName} · {approveTarget.participants} คน
            </p>
            <p className="text-sm text-gray-600">
              ระบบจะตรวจความพร้อมของห้องอีกครั้งและแจ้งผลให้ผู้จองทราบ
            </p>
            {error && (
              <p role="alert" className="form-error">
                {error}
              </p>
            )}
            <div className="flex gap-3">
              <Button
                variant="secondary"
                disabled={busy}
                onClick={() => setApproveTarget(null)}
              >
                กลับไปตรวจสอบ
              </Button>
              <Button
                loading={busy}
                onClick={() =>
                  perform(
                    () => approveBooking(approveTarget.id),
                    () => setApproveTarget(null),
                  )
                }
              >
                {busy ? "กำลังอนุมัติ…" : "ยืนยันอนุมัติ"}
              </Button>
            </div>
          </div>
        )}
      </Modal>
      {/* Rejection reason modal */}
      <Modal
        busy={busy}
        open={!!rejectTarget}
        onClose={() => {
          setRejectTarget(null);
          setRejectReason("");
        }}
        title="ระบุเหตุผลในการปฏิเสธ"
      >
        <p className="text-sm text-gray-500 mb-3">
          คำขอจอง:{" "}
          <span className="font-semibold text-gray-700">
            {rejectTarget?.roomName}
          </span>
        </p>

        <div className="space-y-2 mb-3">
          {predefinedReasons.map((reason) => (
            <button
              key={reason}
              onClick={() => setRejectReason(reason)}
              className={`w-full text-left px-3.5 py-2.5 rounded-xl text-sm border transition-colors ${
                rejectReason === reason
                  ? "border-cp-blue bg-cp-blue/10 text-cp-blue font-semibold"
                  : "border-gray-200 text-gray-600 hover:border-gray-300"
              }`}
            >
              {reason}
            </button>
          ))}
        </div>

        <div className="mb-4">
          <textarea
            aria-label="เหตุผลในการปฏิเสธ"
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            placeholder="หรือระบุเหตุผลอื่นๆ..."
            rows={2}
            className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-cp-blue resize-none"
          />
        </div>

        <div className="flex gap-3">
          <Button
            variant="ghost"
            disabled={busy}
            className="flex-1"
            onClick={() => {
              setRejectTarget(null);
              setRejectReason("");
            }}
          >
            ยกเลิก
          </Button>
          <Button
            variant="danger"
            className="flex-1"
            disabled={busy || !rejectReason.trim()}
            onClick={handleConfirmReject}
          >
            ยืนยันปฏิเสธ
          </Button>
        </div>
        {error && (
          <p role="alert" className="text-sm text-red-600 mt-3">
            {error}
          </p>
        )}
      </Modal>
    </div>
  );
}
