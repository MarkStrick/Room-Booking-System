import { Search } from "lucide-react";
import { useState } from "react";
import type { Role, User } from "../../../../packages/contracts/src/index";
import { Button, Modal, EmptyState } from "../reference/components/ui";
import { useDemo } from "../app/DemoProvider";
export function UserAccess() {
  const { state } = useDemo();
  const [query, setQuery] = useState("");
  const users = state.users.filter((user) =>
    `${user.name} ${user.email}`
      .toLocaleLowerCase()
      .includes(query.trim().toLocaleLowerCase()),
  );
  return (
    <div className="user-access">
      <div className="student-page-heading">
        <h1>บัญชีและสิทธิ์</h1>
        <p>กำหนดบทบาท ห้องที่เจ้าหน้าที่ดูแล และการเข้าใช้ระบบ</p>
      </div>
      <div className="management-filters">
        <label>
          ค้นหาบัญชี
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="ชื่อหรืออีเมล"
          />
        </label>
        <span role="status">{users.length} บัญชี</span>
      </div>
      {!users.length && (
        <EmptyState
          icon={<Search size={28} />}
          title="ไม่พบบัญชีที่ตรงกับการค้นหา"
          subtitle="ลองเปลี่ยนชื่อหรืออีเมลที่ใช้ค้นหา"
        />
      )}
      <div className="user-access-list">
        {users.map((user) => (
          <AccessRow
            key={`${user.id}-${user.role}-${user.active}-${state.assignments.find((a) => a.userId === user.id)?.roomIds.join(",")}`}
            target={user}
          />
        ))}
      </div>
    </div>
  );
}
function AccessRow({ target }: { target: User }) {
  const { state, user, manageAccess } = useDemo();
  const [role, setRole] = useState<Role>(target.role),
    [active, setActive] = useState(target.active);
  const [rooms, setRooms] = useState(
    state.assignments.find((a) => a.userId === target.id)?.roomIds ?? [],
  );
  const [start, setStart] = useState(
      state.assignments.find((a) => a.userId === target.id)?.start ?? "",
    ),
    [end, setEnd] = useState(
      state.assignments.find((a) => a.userId === target.id)?.end ?? "",
    );
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const self = target.id === user.id;
  async function save() {
    setBusy(true);
    setError("");
    try {
      await manageAccess(
        target.id,
        role,
        role === "STAFF" ? rooms : [],
        active,
        role === "STAFF" && start ? start : undefined,
        role === "STAFF" && end ? end : undefined,
      );
      setConfirming(false);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="access-row">
      <div>
        <h2>{target.name}</h2>
        <p>{target.email}</p>
      </div>
      <div className="access-fields">
        <label>
          บทบาท
          <select
            value={role}
            disabled={self || busy}
            onChange={(e) => setRole(e.target.value as Role)}
          >
            <option value="USER">ผู้จอง</option>
            <option value="STAFF">เจ้าหน้าที่</option>
            <option value="ADMIN">ผู้ดูแลระบบ</option>
          </select>
        </label>
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={active}
            disabled={self || busy}
            onChange={(e) => setActive(e.target.checked)}
          />
          อนุญาตให้เข้าสู่ระบบ
        </label>
      </div>
      {role === "STAFF" ? (
        <fieldset>
          <legend>ห้องที่ได้รับมอบหมาย</legend>
          <div className="access-room-options">
            {state.rooms.map((room) => (
              <label key={room.id} className="checkbox-label">
                <input
                  type="checkbox"
                  checked={rooms.includes(room.id)}
                  disabled={busy}
                  onChange={(e) =>
                    setRooms((ids) =>
                      e.target.checked
                        ? [...ids, room.id]
                        : ids.filter((id) => id !== room.id),
                    )
                  }
                />
                {room.code} · {room.name}
              </label>
            ))}
          </div>
        </fieldset>
      ) : null}
      {self ? (
        <p className="subtle">
          บัญชีที่กำลังใช้งาน เปลี่ยนสิทธิ์โดยผู้ดูแลอีกบัญชี
        </p>
      ) : (
        <button
          className="btn"
          disabled={busy}
          onClick={() => {
            setError("");
            setConfirming(true);
          }}
        >
          {busy ? "กำลังบันทึก…" : "บันทึกสิทธิ์"}
        </button>
      )}
      {role === "STAFF" ? (
        <div className="form-grid">
          <label>
            เริ่มมอบหมาย (ไม่บังคับ)
            <input
              type="date"
              value={start}
              onChange={(e) => setStart(e.target.value)}
            />
          </label>
          <label>
            สิ้นสุดมอบหมาย (ไม่บังคับ)
            <input
              type="date"
              value={end}
              min={start}
              onChange={(e) => setEnd(e.target.value)}
            />
          </label>
        </div>
      ) : null}
      <Modal
        open={confirming}
        onClose={() => setConfirming(false)}
        title="ยืนยันการเปลี่ยนสิทธิ์"
        busy={busy}
      >
        <p>
          เปลี่ยนสิทธิ์ของ <strong>{target.name}</strong> ({target.email})
        </p>
        <p className="mt-3">
          บทบาท:{" "}
          {role === "ADMIN"
            ? "ผู้ดูแลระบบ"
            : role === "STAFF"
              ? "เจ้าหน้าที่"
              : "ผู้จอง"}{" "}
          · {active ? "เข้าใช้ระบบได้" : "ระงับการเข้าใช้ระบบ"}
        </p>
        {role === "STAFF" && (
          <p className="mt-2">
            ดูแล {rooms.length} ห้อง{start ? ` ตั้งแต่ ${start}` : ""}
            {end ? ` ถึง ${end}` : ""}
          </p>
        )}
        {error && (
          <p role="alert" className="form-error">
            {error}
          </p>
        )}
        <div className="flex gap-3 mt-6">
          <Button
            variant="secondary"
            disabled={busy}
            onClick={() => setConfirming(false)}
          >
            กลับไปแก้ไข
          </Button>
          <Button loading={busy} onClick={() => void save()}>
            {busy ? "กำลังบันทึก…" : "ยืนยันการเปลี่ยนสิทธิ์"}
          </Button>
        </div>
      </Modal>
      {error && !confirming ? (
        <p className="form-error" role="alert">
          {error}
        </p>
      ) : null}
    </section>
  );
}
