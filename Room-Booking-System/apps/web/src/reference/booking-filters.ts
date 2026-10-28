import type { Room } from "../../../../packages/contracts/src/index";
import type { Booking } from "./types";

export function matchesRoom(
  room: Room,
  building: string,
  filters: {
    query: string;
    capacity: number;
    type: string;
    amenity: string;
    buildingId: string;
  },
) {
  const query = filters.query.trim().toLocaleLowerCase();
  return (
    (!query ||
      `${room.name} ${room.code} ${building}`
        .toLocaleLowerCase()
        .includes(query)) &&
    room.capacity >= filters.capacity &&
    (!filters.type || room.type === filters.type) &&
    (!filters.amenity || room.amenities.includes(filters.amenity)) &&
    (!filters.buildingId || String(room.buildingId) === filters.buildingId)
  );
}

export function matchesBooking(booking: Booking, query: string) {
  return `${booking.ref ?? ""} ${booking.roomName} ${booking.building} ${booking.userName} ${booking.userEmail}`
    .toLocaleLowerCase()
    .includes(query.trim().toLocaleLowerCase());
}

export function bookingDetailsError(
  purpose: string,
  participants: number,
  capacity: number,
) {
  if (!purpose.trim()) return "ระบุวัตถุประสงค์ของการจองก่อนตรวจสอบคำขอ";
  if (
    !Number.isInteger(participants) ||
    participants < 1 ||
    participants > capacity
  )
    return `ระบุจำนวนผู้เข้าร่วมตั้งแต่ 1–${capacity} คน`;
  return "";
}
