import { useEffect, useRef, type ReactNode } from 'react';
import type { BookingStatus } from '../types';

interface StatusBadgeProps {
  status: BookingStatus;
}

const statusConfig: Record<string, { label: string; bg: string; text: string; dot: string }> = {
  pending: { label: 'รออนุมัติ', bg: 'bg-amber-100', text: 'text-amber-700', dot: 'bg-amber-500' },
  approved: { label: 'อนุมัติแล้ว', bg: 'bg-green-100', text: 'text-green-700', dot: 'bg-green-500' },
  rejected: { label: 'ปฏิเสธ', bg: 'bg-red-100', text: 'text-red-700', dot: 'bg-red-500' },
  cancelled: { label: 'ยกเลิก', bg: 'bg-gray-100', text: 'text-gray-500', dot: 'bg-gray-400' },
  completed: { label: 'เสร็จสิ้น', bg: 'bg-blue-100', text: 'text-blue-700', dot: 'bg-blue-500' },
  checked_in: { label: 'เช็คอินแล้ว', bg: 'bg-blue-100', text: 'text-blue-700', dot: 'bg-blue-500' },
  no_show: { label: 'ไม่มาใช้งาน', bg: 'bg-red-100', text: 'text-red-700', dot: 'bg-red-500' },
};

export function StatusBadge({ status }: StatusBadgeProps) {
  const cfg = statusConfig[status];
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${cfg.bg} ${cfg.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  );
}

export function Button({
  children,
  onClick,
  variant = 'primary',
  size = 'md',
  className = '',
  disabled = false,
}: {
  children: ReactNode;
  onClick?: () => void | Promise<void>;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'success';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  disabled?: boolean;
}) {
  const variants = {
    primary: 'bg-kku-red text-white hover:bg-kku-red-dark shadow-sm shadow-red-900/20',
    secondary: 'bg-white text-kku-red border border-kku-red/20 hover:bg-red-50',
    ghost: 'bg-transparent text-gray-600 hover:bg-gray-100',
    danger: 'bg-red-50 text-red-600 border border-red-200 hover:bg-red-100',
    success: 'bg-green-50 text-green-700 border border-green-200 hover:bg-green-100',
  };
  const sizes = {
    sm: 'px-3 py-1.5 text-sm rounded-lg',
    md: 'px-4 py-2.5 text-sm rounded-xl',
    lg: 'px-5 py-3.5 text-base rounded-xl',
  };
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`font-semibold transition-all active:scale-[0.97] disabled:opacity-40 disabled:cursor-not-allowed ${variants[variant]} ${sizes[size]} ${className}`}
    >
      {children}
    </button>
  );
}

export function Modal({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
}) {
  const panel=useRef<HTMLDivElement>(null);
  const dismiss=useRef(onClose);dismiss.current=onClose;
  useEffect(()=>{if(!open)return;const previous=document.activeElement as HTMLElement|null;panel.current?.querySelector<HTMLElement>('button,input,textarea')?.focus();return()=>previous?.focus();},[open]);
  if (!open) return null;
  return (
    <div className="absolute inset-0 z-50 flex items-end sm:items-center justify-center animate-fade-in">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div ref={panel} role="dialog" aria-modal="true" aria-label={title ?? 'ยืนยันรายการ'} onKeyDown={e=>{if(e.key==='Escape')dismiss.current();if(e.key==='Tab'){const controls=panel.current?.querySelectorAll<HTMLElement>('button:not([disabled]),input,textarea');const first=controls?.[0],last=controls?.[controls.length-1];if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();}}}} className="relative bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl p-5 max-h-[85%] overflow-y-auto scrollbar-hide animate-slide-up sm:animate-scale-in">
        {title && (
          <h3 className="text-lg font-bold text-gray-900 mb-3">{title}</h3>
        )}
        {children}
      </div>
    </div>
  );
}

export function EmptyState({ icon, title, subtitle }: { icon: ReactNode; title: string; subtitle?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center px-6">
      <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center text-gray-400 mb-3">
        {icon}
      </div>
      <p className="text-gray-600 font-semibold">{title}</p>
      {subtitle && <p className="text-sm text-gray-400 mt-1">{subtitle}</p>}
    </div>
  );
}
