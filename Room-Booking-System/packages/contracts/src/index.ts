export type Role = "USER" | "STAFF" | "ADMIN";
export type BookingStatus =
  | "PENDING"
  | "APPROVED"
  | "REJECTED"
  | "CANCELLED"
  | "CHECKED_IN"
  | "COMPLETED"
  | "NO_SHOW";
export interface User {
  id: number;
  name: string;
  email: string;
  phone: string;
  affiliation: string;
  role: Role;
  active: boolean;
}
export interface Building {
  id: number;
  name: string;
  floors: number;
  active?: boolean;
}
export interface Room {
  id: number;
  code: string;
  name: string;
  buildingId: number;
  floor: number;
  capacity: number;
  type: string;
  amenities: string[];
  status: "AVAILABLE" | "MAINTENANCE" | "CLOSED";
  reason: string;
  scene: number;
  active?: boolean;
  imageUrl?: string;
  inventory?: { id: number; name: string; total: number; damaged: number }[];
  hours?: {
    start: string;
    end: string;
    weekdays: number[];
    leadMinutes: number;
  };
}
export interface Equipment {
  id: number;
  name: string;
  total: number;
  remaining: number;
}
export interface Booking {
  id: number;
  ref: string;
  userId: number;
  roomId: number;
  start: string;
  end: string;
  purpose: string;
  attendees: number;
  participants: number[];
  equipment: { id: number; qty: number; issued?: number; returned?: number }[];
  status: BookingStatus;
  createdAt: string;
  decidedAt?: string;
  decidedBy?: number;
  checkedInAt?: string;
  reason?: string;
  participantEmails?: string[];
  approvalDeadline?: string;
  slaReminderAt?: string;
  slaEscalatedAt?: string;
  archivedAt?: string;
}
export interface Notice {
  id: number;
  userId: number;
  bookingId?: number;
  subject: string;
  content: string;
  status: "QUEUED" | "SENT" | "FAILED";
  createdAt: string;
  attempts: number;
  readAt?: string;
}
export interface Violation {
  id: number;
  userId: number;
  bookingId: number;
  type: "NO_SHOW" | "LATE_CANCEL";
  at: string;
}
export interface Penalty {
  id: number;
  userId: number;
  type: "WARNING" | "SUSPENSION";
  start: string;
  end: string;
  reason: string;
  at: string;
  actorId: number;
}
export interface Closure {
  id: number;
  roomId: number;
  start: string;
  end: string;
  reason: string;
}
export interface Inspection {
  id: number;
  roomId: number;
  at: string;
  condition: string;
  note: string;
  actorId: number;
  items?: { id: number; name: string; total: number; damaged: number }[];
}
export interface Message {
  id: number;
  userId: number;
  question: string;
  answer: string;
  at: string;
}
export interface Audit {
  id: number;
  at: string;
  actorId: number | null;
  text: string;
  bookingId?: number;
}
export interface AppState {
  schema: 1;
  now: string;
  users: User[];
  buildings: Building[];
  rooms: Room[];
  equipment: Equipment[];
  bookings: Booking[];
  notices: Notice[];
  violations: Violation[];
  penalties: Penalty[];
  closures: Closure[];
  inspections: Inspection[];
  messages: Message[];
  audit: Audit[];
  holidays: string[];
  assignments: {
    userId: number;
    roomIds: number[];
    start?: string;
    end?: string;
  }[];
  settings?: {
    contactEmail: string;
    contactPhone: string;
    faqs: { q: string; a: string; keys: string[] }[];
    workerAt?: string;
  };
}
export interface SearchFilter {
  date: string;
  start: string;
  end: string;
  building: string;
  capacity: number;
  type: string;
  query: string;
  amenity: string;
  floor?: string;
}
export type Command =
  | {
      type: "BOOK";
      roomId: number;
      start: string;
      end: string;
      purpose: string;
      attendees: number;
      participants: number[];
      participantEmails?: string[];
      equipment: { id: number; qty: number }[];
    }
  | { type: "CANCEL" | "CHECKIN"; bookingId: number }
  | { type: "DECIDE"; bookingId: number; approve: boolean; reason: string }
  | { type: "ROOM_SAVE"; room: Omit<Room, "id"> & { id?: number } }
  | {
      type: "CLOSE_ROOM";
      roomId: number;
      start: string;
      end: string;
      reason: string;
    }
  | {
      type: "INSPECT";
      roomId: number;
      condition: string;
      note: string;
      items?: { id: number; damaged: number }[];
    }
  | { type: "BUILDING_SAVE"; id?: number; name: string; floors: number }
  | { type: "HOLIDAY_SAVE"; date: string; previousDate?: string }
  | { type: "HOLIDAY_DELETE"; date: string }
  | { type: "ROOM_ACTIVE"; roomId: number; active: boolean }
  | { type: "BUILDING_ACTIVE"; buildingId: number; active: boolean }
  | { type: "ROOM_DELETE"; roomId: number }
  | { type: "BUILDING_DELETE"; buildingId: number }
  | {
      type: "EQUIPMENT_HANDOVER";
      bookingId: number;
      equipmentId: number;
      qty: number;
      action: "ISSUE" | "RETURN";
    }
  | {
      type: "SETTINGS_SAVE";
      contactEmail: string;
      contactPhone: string;
      faqs: { q: string; a: string; keys: string[] }[];
    }
  | { type: "EQUIPMENT_SAVE"; id?: number; name: string; total: number }
  | {
      type: "PENALTY";
      userId: number;
      penaltyType: "WARNING" | "SUSPENSION";
      start: string;
      end: string;
      reason: string;
    }
  | { type: "PROFILE"; name: string; phone: string }
  | { type: "HELP"; question: string }
  | { type: "SUPPORT_REQUEST"; question: string }
  | { type: "RETRY"; noticeId: number }
  | { type: "READ_NOTICE"; noticeId: number }
  | { type: "CLOCK"; now: string }
  | { type: "RUN_JOBS" };
