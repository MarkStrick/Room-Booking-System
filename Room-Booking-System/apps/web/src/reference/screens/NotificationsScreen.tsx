import { useApp } from '../context/AppContext';
import { AppHeader } from '../components/PhoneFrame';
import { EmptyState } from '../components/ui';
import { MapPin, Calendar, Clock, Users, X, BellOff, CheckCheck, FileText, Ban } from 'lucide-react';
import type { Notification } from '../types';
import { useAsyncAction } from '../useAsyncAction';

export function NotificationsScreen() {
  const { notifications, markNotificationRead, markAllNotificationsRead } = useApp();
  const {busy,error,perform}=useAsyncAction();

  const sorted = [...notifications].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
  const unreadCount = notifications.filter((n) => !n.read).length;

  const formatTime = (iso: string) => {
    const d = new Date(iso);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'เมื่อสักครู่';
    if (mins < 60) return `${mins} นาทีที่แล้ว`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours} ชม.ที่แล้ว`;
    const days = Math.floor(hours / 24);
    return `${days} วันที่แล้ว`;
  };

  const formatDateTime = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleString('th-TH', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="flex flex-col h-full bg-gray-50">
      <AppHeader title="การแจ้งเตือน" />

      {unreadCount > 0 && (
        <div className="px-4 py-2.5 bg-white border-b border-gray-100 flex items-center justify-between shrink-0">
          <span className="text-xs font-semibold text-gray-600">
            ยังไม่อ่าน {unreadCount} รายการ
          </span>
          <button
            disabled={busy}
            onClick={()=>void perform(markAllNotificationsRead)}
            className="text-xs font-semibold text-kku-red flex items-center gap-1 hover:opacity-70 transition-opacity"
          >
            <CheckCheck size={14} /> อ่านทั้งหมด
          </button>
        </div>
      )}

      <div className="flex-1 overflow-y-auto scrollbar-hide px-4 py-3">
        {error && <p role="alert" className="text-sm text-red-600 mb-3">{error}</p>}
        {sorted.length === 0 ? (
          <EmptyState
            icon={<BellOff size={28} />}
            title="ไม่มีการแจ้งเตือน"
            subtitle="ผลการพิจารณาและการเปลี่ยนแปลงการจองจะแสดงที่นี่"
          />
        ) : (
          <div className="space-y-3">
            {sorted.map((notif) => (
              <NotificationCard
                key={notif.id}
                notif={notif}
                formatTime={formatTime}
                formatDateTime={formatDateTime}
                onMarkRead={() => {if(!busy)void perform(()=>markNotificationRead(notif.id));}}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function NotificationCard({
  notif,
  formatTime,
  formatDateTime,
  onMarkRead,
}: {
  notif: Notification;
  formatTime: (iso: string) => string;
  formatDateTime: (iso: string) => string;
  onMarkRead: () => void;
}) {
  const isRejection = notif.type === 'rejection';
  const Icon = isRejection ? X : notif.type==='cancellation'?Ban:FileText;
  const title = notif.subject;

  return (
    <div
      className={`rounded-2xl border p-4 animate-slide-up transition-colors ${
        notif.read
          ? 'bg-white border-gray-100'
          : isRejection
            ? 'bg-red-50/50 border-red-200'
            : 'bg-amber-50/50 border-amber-200'
      }`}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2.5">
          <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${
            notif.read ? 'bg-gray-100' : isRejection ? 'bg-red-100' : 'bg-amber-100'
          }`}>
            <Icon size={18} className={notif.read ? 'text-gray-400' : isRejection ? 'text-red-500' : 'text-amber-600'} />
          </div>
          <div>
            <p className="font-semibold text-sm text-gray-900">{title}</p>
            <p className="text-xs text-gray-400 flex items-center gap-1">
              <Clock size={11} /> {formatTime(notif.createdAt)}
            </p>
          </div>
        </div>
        {!notif.read && (
          <span className={`w-2.5 h-2.5 rounded-full shrink-0 mt-1.5 ${
            isRejection ? 'bg-red-500' : 'bg-amber-500'
          }`} />
        )}
      </div>
      <p className="text-sm text-gray-600 mb-3">{notif.content}</p>
      <div className="bg-white/80 rounded-xl p-3 mb-2">
        <p className="font-bold text-sm text-gray-900 mb-1.5">{notif.roomName}</p>
        <div className="space-y-1 text-xs text-gray-500">
          <p className="flex items-center gap-1.5">
            <MapPin size={12} className="text-gray-400" />
            {notif.building}
          </p>
          <p className="flex items-center gap-1.5">
            <span className="text-gray-400 font-medium">ผู้จอง:</span>
            {notif.requesterName}
          </p>
          <p className="flex items-center gap-1.5">
            <Calendar size={12} className="text-gray-400" />
            {notif.bookingDate} · {notif.startTime}–{notif.endTime} น.
          </p>
          <p className="flex items-center gap-1.5">
            <Users size={12} className="text-gray-400" />
            {notif.participants} ท่าน
          </p>
          <p className="flex items-start gap-1.5">
            <FileText size={12} className="text-gray-400 mt-0.5 shrink-0" />
            {notif.purpose}
          </p>
        </div>
      </div>

      {isRejection && notif.rejectionReason && (
        <div className="flex items-start gap-2 bg-red-50 border border-red-100 rounded-lg px-3 py-2 mb-2">
          <X size={14} className="text-red-500 shrink-0 mt-0.5" />
          <p className="text-xs text-red-600">{notif.rejectionReason}</p>
        </div>
      )}

      {notif.type==='cancellation' && (
        <div className="flex items-center gap-2 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2 mb-2">
          <Clock size={14} className="text-amber-600 shrink-0" />
          <p className="text-xs text-amber-700">
            ยกเลิกเมื่อ {formatDateTime(notif.createdAt)} น.
          </p>
        </div>
      )}

      {!notif.read && (
        <button
          onClick={onMarkRead}
          className="mt-2.5 w-full py-2 bg-gray-100 rounded-lg text-xs font-semibold text-gray-600 hover:bg-gray-200 transition-colors"
        >
          ทำเครื่องหมายว่าอ่านแล้ว
        </button>
      )}
    </div>
  );
}
