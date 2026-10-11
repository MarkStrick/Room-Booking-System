import { useEffect, useState, type ReactNode } from "react";
import { DoorOpen } from "lucide-react";
import type { Room } from "../../../../packages/contracts/src/index";

/** Uses catalog photos when supplied; a missing photo never obscures room details. */
export function RoomCover({
  room,
  children,
}: {
  room: Room;
  children?: ReactNode;
}) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [room.imageUrl]);
  return (
    <div
      className={`room-cover ${room.imageUrl && !failed ? "has-photo" : ""}`}
    >
      {room.imageUrl && !failed ? (
        <img
          src={room.imageUrl}
          alt={room.name}
          loading="lazy"
          referrerPolicy="no-referrer"
          onError={() => setFailed(true)}
        />
      ) : (
        <div className="room-cover-placeholder">
          <DoorOpen size={36} strokeWidth={1.4} />
          <span>ยังไม่มีรูปห้อง</span>
        </div>
      )}
      <span className="room-cover-code">{room.code}</span>
      <span className="room-cover-capacity">{room.capacity} คน</span>
      {children ? <div className="room-cover-title">{children}</div> : null}
    </div>
  );
}
