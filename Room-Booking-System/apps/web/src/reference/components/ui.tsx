import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { useEffect, useId, useRef, type ReactNode } from "react";
import type { BookingStatus } from "../types";

interface StatusBadgeProps {
  status: BookingStatus;
}

const statusConfig: Record<
  string,
  { label: string; bg: string; text: string; dot: string }
> = {
  pending: {
    label: "รออนุมัติ",
    bg: "bg-amber-100",
    text: "text-amber-700",
    dot: "bg-amber-500",
  },
  approved: {
    label: "อนุมัติแล้ว",
    bg: "bg-green-100",
    text: "text-green-700",
    dot: "bg-green-500",
  },
  rejected: {
    label: "ปฏิเสธ",
    bg: "bg-red-100",
    text: "text-red-700",
    dot: "bg-red-500",
  },
  cancelled: {
    label: "ยกเลิก",
    bg: "bg-gray-100",
    text: "text-gray-500",
    dot: "bg-gray-400",
  },
  completed: {
    label: "เสร็จสิ้น",
    bg: "bg-blue-100",
    text: "text-blue-700",
    dot: "bg-blue-500",
  },
  checked_in: {
    label: "เช็คอินแล้ว",
    bg: "bg-blue-100",
    text: "text-blue-700",
    dot: "bg-blue-500",
  },
  no_show: {
    label: "ไม่มาใช้งาน",
    bg: "bg-red-100",
    text: "text-red-700",
    dot: "bg-red-500",
  },
};

export function StatusBadge({ status }: StatusBadgeProps) {
  const cfg = statusConfig[status];
  return (
    <span
      className={`ui-status inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${cfg.bg} ${cfg.text}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  );
}

export function Button({
  children,
  onClick,
  variant = "primary",
  size = "md",
  className = "",
  disabled = false,
  loading = false,
  type = "button",
}: {
  children: ReactNode;
  onClick?: () => void | Promise<void>;
  variant?: "primary" | "secondary" | "ghost" | "danger" | "success";
  size?: "sm" | "md" | "lg";
  className?: string;
  disabled?: boolean;
  loading?: boolean;
  type?: "button" | "submit";
}) {
  const variants = {
    primary:
      "bg-cp-blue text-white hover:bg-cp-blue-dark shadow-sm shadow-cp-blue/20",
    secondary:
      "bg-white text-cp-blue border border-cp-blue/20 hover:bg-cp-blue/10",
    ghost: "bg-transparent text-gray-600 hover:bg-gray-100",
    danger: "bg-red-50 text-red-600 border border-red-200 hover:bg-red-100",
    success:
      "bg-green-50 text-green-700 border border-green-200 hover:bg-green-100",
  };
  const sizes = {
    sm: "px-3 py-1.5 text-sm rounded-lg",
    md: "px-4 py-2.5 text-sm rounded-xl",
    lg: "px-5 py-3.5 text-base rounded-xl",
  };
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={`ui-button ui-button-${variant} font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${variants[variant]} ${sizes[size]} ${className}`}
    >
      {children}
    </button>
  );
}

export function Modal({
  open,
  onClose,
  title = "ยืนยันรายการ",
  children,
  busy = false,
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  busy?: boolean;
}) {
  const panel = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const dialog = panel.current;
    if (!open || !dialog) return;
    dialog.showModal();
    return () => dialog.close();
  }, [open]);
  if (!open) return null;
  return createPortal(
    <div className="reference-ui">
      <dialog
        ref={panel}
        className="ui-modal"
        aria-labelledby={titleId}
        aria-busy={busy}
        onCancel={(event) => {
          event.preventDefault();
          if (!busy) onClose();
        }}
      >
        <header className="ui-modal-header">
          <h2 id={titleId}>{title}</h2>
          <button
            type="button"
            aria-label="ปิดหน้าต่าง"
            disabled={busy}
            onClick={onClose}
          >
            <X size={20} />
          </button>
        </header>
        <div className="ui-modal-body">{children}</div>
      </dialog>
    </div>,
    document.body,
  );
}

export function EmptyState({
  icon,
  title,
  subtitle,
  action,
}: {
  icon: ReactNode;
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <div className="ui-empty">
      <div className="ui-empty-icon" aria-hidden="true">
        {icon}
      </div>
      <h3>{title}</h3>
      {subtitle && <p>{subtitle}</p>}
      {action}
    </div>
  );
}
