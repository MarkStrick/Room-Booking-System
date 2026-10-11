import { useState, type FormEvent } from "react";
import { useDemo } from "../app/DemoProvider";
import { canManage, faqs } from "../lib/domain";
import type { Booking } from "../../../../packages/contracts/src/index";
import { request } from "../lib/api";

export function EquipmentHandovers() {
  const { state, user } = useDemo();
  const bookings = state.bookings.filter(
    (b) =>
      canManage(state, user, b.roomId) &&
      b.equipment.some(
        (i) =>
          (b.status === "CHECKED_IN" && i.qty > (i.issued ?? 0)) ||
          (i.issued ?? 0) > (i.returned ?? 0),
      ),
  );
  return (
    <section className="panel spaced">
      <div className="section-heading">
        <h2>จ่ายและรับคืนอุปกรณ์</h2>
      </div>
      <p className="operations-note">
        จ่ายหลังเช็คอิน อุปกรณ์ที่ยังค้างคืนไม่เพิ่มยอดคงเหลือเมื่อจบรอบ
      </p>
      {bookings.length ? (
        bookings.map((b) => (
          <div className="list-row handover-row" key={b.id}>
            <strong>
              {b.ref} · {state.rooms.find((r) => r.id === b.roomId)?.name}
            </strong>
            {b.equipment.map((i) => (
              <Handover key={i.id} booking={b} item={i} />
            ))}
          </div>
        ))
      ) : (
        <p className="operations-note">ไม่มีรายการรอจ่ายหรือค้างคืน</p>
      )}
    </section>
  );
}
function Handover({
  booking,
  item,
}: {
  booking: Booking;
  item: Booking["equipment"][number];
}) {
  const { state, run } = useDemo();
  const [qty, setQty] = useState(1),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function act(action: "ISSUE" | "RETURN") {
    setBusy(true);
    setError("");
    try {
      await run({
        type: "EQUIPMENT_HANDOVER",
        bookingId: booking.id,
        equipmentId: item.id,
        qty,
        action,
      });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const outstanding = (item.issued ?? 0) - (item.returned ?? 0),
    unissued = item.qty - (item.issued ?? 0);
  return (
    <div className="handover-item">
      <span>
        {state.equipment.find((e) => e.id === item.id)?.name} · จ่าย{" "}
        {item.issued ?? 0}/{item.qty} · ค้างคืน {outstanding}
      </span>
      <label>
        จำนวน
        <input
          type="number"
          min={1}
          max={Math.max(outstanding, unissued)}
          value={qty}
          onChange={(e) => setQty(Number(e.target.value))}
        />
      </label>
      <div className="holiday-actions">
        <button
          className="btn ghost"
          disabled={
            busy || booking.status !== "CHECKED_IN" || qty < 1 || qty > unissued
          }
          onClick={() => void act("ISSUE")}
        >
          จ่ายอุปกรณ์
        </button>
        <button
          className="btn ghost"
          disabled={busy || qty < 1 || qty > outstanding}
          onClick={() => void act("RETURN")}
        >
          รับคืน
        </button>
      </div>
      {error ? (
        <p className="form-error" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
export function HelpSettings() {
  const { state, run } = useDemo();
  const [entries, setEntries] = useState(
    state.settings?.faqs.length ? state.settings.faqs : faqs,
  );
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    setBusy(true);
    setError("");
    try {
      await run({
        type: "SETTINGS_SAVE",
        contactEmail: String(data.get("contactEmail")),
        contactPhone: String(data.get("contactPhone")),
        faqs: entries.map(({ q, a, keys }) => ({
          q,
          a,
          keys: keys.map((k) => k.trim()).filter(Boolean),
        })),
      });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <details className="panel spaced help-settings">
      <summary>จัดการ FAQ และช่องทางติดต่อ</summary>
      <form onSubmit={save}>
        <div className="form-grid">
          <label>
            อีเมลผู้รับผิดชอบ
            <input
              name="contactEmail"
              type="email"
              defaultValue={state.settings?.contactEmail}
            />
          </label>
          <label>
            เบอร์ติดต่อ
            <input
              name="contactPhone"
              maxLength={30}
              defaultValue={state.settings?.contactPhone}
            />
          </label>
        </div>
        {entries.map((f, index) => (
          <fieldset key={index}>
            <legend>คำถาม {index + 1}</legend>
            <label>
              คำถาม
              <input
                value={f.q}
                maxLength={300}
                required
                onChange={(e) =>
                  setEntries((rows) =>
                    rows.map((r, i) =>
                      i === index ? { ...r, q: e.target.value } : r,
                    ),
                  )
                }
              />
            </label>
            <label>
              คำตอบ
              <textarea
                value={f.a}
                maxLength={2000}
                required
                onChange={(e) =>
                  setEntries((rows) =>
                    rows.map((r, i) =>
                      i === index ? { ...r, a: e.target.value } : r,
                    ),
                  )
                }
              />
            </label>
            <label>
              คำค้น แยกด้วยจุลภาค
              <input
                value={f.keys.join(",")}
                required
                onChange={(e) =>
                  setEntries((rows) =>
                    rows.map((r, i) =>
                      i === index
                        ? { ...r, keys: e.target.value.split(",") }
                        : r,
                    ),
                  )
                }
              />
            </label>
            <button
              className="btn ghost"
              type="button"
              disabled={entries.length <= 1 || busy}
              onClick={() =>
                setEntries((rows) => rows.filter((_, i) => i !== index))
              }
            >
              นำคำถามออก
            </button>
          </fieldset>
        ))}
        <div className="holiday-actions">
          <button
            type="button"
            className="btn ghost"
            disabled={busy || entries.length >= 100}
            onClick={() =>
              setEntries((rows) => [...rows, { q: "", a: "", keys: [""] }])
            }
          >
            เพิ่ม FAQ
          </button>
          <button className="btn" disabled={busy}>
            {busy ? "กำลังบันทึก…" : "บันทึก FAQ และช่องทางติดต่อ"}
          </button>
        </div>
        {error ? (
          <p className="form-error" role="alert">
            {error}
          </p>
        ) : null}
      </form>
    </details>
  );
}
export function WorkerStatus() {
  const { mode } = useDemo();
  const [status, setStatus] = useState(""),
    [busy, setBusy] = useState(false);
  if (mode !== "server") return null;
  return (
    <section className="panel spaced operations-note">
      <h2>งานอัตโนมัติและคิวแจ้งเตือน</h2>
      <button
        className="btn ghost"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          try {
            const result = await request<{
              workerHealthy: boolean;
              workerAt: string | null;
              queued: number;
              failed: number;
            }>("/admin/operations");
            setStatus(
              `${result.workerHealthy ? "Worker ทำงาน" : "Worker ยังไม่ทำงานหรือขาดการติดต่อ"} • รอส่ง ${result.queued} • ส่งล้มเหลว ${result.failed}${result.workerAt ? " • ล่าสุด " + new Date(result.workerAt).toLocaleString("th-TH") : ""}`,
            );
          } catch (e) {
            setStatus((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        {busy ? "กำลังตรวจ…" : "ตรวจสถานะงานอัตโนมัติ"}
      </button>
      <p role="status">{status}</p>
    </section>
  );
}

interface Readiness {
  checkedAt: string;
  ready: boolean;
  checks: { id: string; label: string; ready: boolean; detail: string }[];
}
export function AdminReadiness() {
  const { user, mode, openSandbox } = useDemo();
  const [result, setResult] = useState<Readiness | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  if (user.role !== 'ADMIN' || mode !== 'server') return null;
  return <section className="panel spaced readiness-panel">
    <h2>ความพร้อมของระบบ</h2>
    <p>ตรวจรายการตั้งค่าและงานอัตโนมัติก่อนเปิดให้ผู้ใช้จองห้อง</p>
    <div className="holiday-actions">
      <button className="btn ghost" disabled={busy} onClick={async () => {
        setBusy(true); setError('');
        try { setResult(await request<Readiness>('/admin/readiness')); }
        catch (e) { setError((e as Error).message); }
        finally { setBusy(false); }
      }}>{busy ? 'กำลังตรวจ…' : 'ตรวจความพร้อม'}</button>
      <button className="btn ghost" disabled={busy} onClick={async () => {
        setBusy(true); setError('');
        try { await openSandbox(); }
        catch (e) { setError((e as Error).message); }
        finally { setBusy(false); }
      }}>เปิดพื้นที่ทดสอบ</button>
    </div>
    <p className="password-help">พื้นที่ทดสอบใช้ข้อมูลจำลองแยกจากข้อมูลจริง และเปิดได้เฉพาะผู้ดูแลระบบ</p>
    {error ? <p className="form-error" role="alert">{error}</p> : null}
    {result ? <div aria-live="polite">
      <p>{result.ready ? 'รายการตั้งค่าครบแล้ว ตรวจขั้นตอนสมัครและจองกับบัญชีจริงก่อนเปิดบริการ' : 'ยังมีรายการที่ต้องเตรียมก่อนเปิดบริการ'}</p>
      <ul className="readiness-list">{result.checks.map(check => <li key={check.id}>
        <div><strong>{check.label}</strong><span className={`badge ${check.ready ? 'green' : 'warm'}`}>{check.ready ? 'พร้อม' : 'รอเตรียม'}</span></div>
        <p>{check.detail}</p>
      </li>)}</ul>
      <small>ตรวจล่าสุด {new Date(result.checkedAt).toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' })}</small>
    </div> : null}
  </section>;
}
