import { useState, type FormEvent } from "react";
import {
  Bell,
  BookOpen,
  Check,
  HelpCircle,
  Mail,
  Send,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import { useDemo } from "../app/DemoProvider";
import { faqs, roleLabels, suspended, thaiDate, time } from "../lib/domain";
import { Empty, PageHeading } from "../components/ui";
import { PasswordSettings } from '../components/PasswordSettings';
export function Help() {
  const { state, user, run } = useDemo();
  const [question, setQuestion] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function send(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await run({ type: "HELP", question }, "");
      setQuestion("");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const messages = state.messages.filter((m) => m.userId === user.id);
  return (
    <>
      <PageHeading
        eyebrow="A LITTLE HELP GOES A LONG WAY"
        title="คำแนะนำและความช่วยเหลือ"
        description="เริ่มใช้งานได้ง่ายขึ้น ค้นหาคำตอบเกี่ยวกับการจองและการใช้งานห้อง"
      />
      <div className="tutorial">
        <div>
          <span>01</span>
          <strong>ค้นหาพื้นที่</strong>
          <small>เลือกวัน เวลา และจำนวนคน</small>
        </div>
        <i>→</i>
        <div>
          <span>02</span>
          <strong>ส่งคำขอ</strong>
          <small>กรอกวัตถุประสงค์และรออนุมัติ</small>
        </div>
        <i>→</i>
        <div>
          <span>03</span>
          <strong>เช็คอินแล้วเข้าใช้</strong>
          <small>ยืนยันภายใน 30 นาทีหลังเริ่ม</small>
        </div>
      </div>
      <div className="help-grid">
        <section className="panel faq-panel">
          <div className="section-heading">
            <h2>
              <BookOpen size={18} />
              คำถามที่พบบ่อย
            </h2>
          </div>
          {faqs.map((f) => (
            <details key={f.q}>
              <summary>
                {f.q}
                <span>+</span>
              </summary>
              <p>{f.a}</p>
              <button className="text-button" onClick={() => setQuestion(f.q)}>
                ถามในหน้าต่างช่วยเหลือ
              </button>
            </details>
          ))}
        </section>
        <section className="panel chat-panel">
          <div className="chat-header">
            <div className="chat-icon">
              <HelpCircle size={21} />
            </div>
            <div>
              <strong>KKU Space Assistant</strong>
              <small>ค้นหาคำตอบจากคำถามที่พบบ่อย</small>
            </div>
            <span className="online-dot" />
          </div>
          <div className="chat-messages">
            <div className="bubble bot">
              สวัสดีค่ะ มีเรื่องการจองห้องที่อยากสอบถามไหมคะ? ลองถามว่า
              “จองล่วงหน้าได้กี่วัน” หรือ “เช็คอินเมื่อไหร่”
            </div>
            {messages.map((m) => (
              <div className="message-pair" key={m.id}>
                <div className="bubble user">{m.question}</div>
                <div className="bubble bot">
                  {m.answer}
                  <small>{time(m.at)} น.</small>
                </div>
              </div>
            ))}
          </div>
          {error ? <p className="form-error">{error}</p> : null}
          <form className="chat-form" onSubmit={send}>
            <input
              aria-label="คำถามช่วยเหลือ"
              placeholder="พิมพ์คำถามของคุณ…"
              maxLength={1000}
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              required
            />
            <button
              className="btn icon-only"
              disabled={busy}
              aria-label="ส่งคำถาม"
            >
              <Send size={19} />
            </button>
          </form>
        </section>
      </div>
    </>
  );
}
export function Profile() {
  const { state, user, run, mode } = useDemo();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    setBusy(true);
    setError("");
    setSuccess(false);
    try {
      await run({
        type: "PROFILE",
        name: String(data.get("name")),
        phone: String(data.get("phone")),
      });
      setSuccess(true);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <PageHeading
        eyebrow="YOUR CAMPUS IDENTITY"
        title="ข้อมูลส่วนตัว"
        description="ข้อมูลบัญชีและสถานะสิทธิ์ของคุณในระบบจองห้อง"
      />
      <div className="profile-grid">
        <section className="panel profile-card">
          <div className="profile-avatar">{user.name[0]}</div>
          <h2>{user.name}</h2>
          <p>{user.email}</p>
          <span className="badge warm">{roleLabels[user.role]}</span>
          <div className="profile-status">
            <ShieldCheck size={20} />
            <div>
              <strong>
                {suspended(state, user.id)
                  ? "อยู่ระหว่างระงับสิทธิ์"
                  : "บัญชีพร้อมใช้งาน"}
              </strong>
              <small>{user.affiliation}</small>
            </div>
          </div>
          <small className="subtle">
            {mode === 'demo' ? 'บัญชีสาธิต • ไม่ใช่การเข้าสู่ระบบ Google จริง' : 'ข้อมูลบัญชีที่ยืนยันจากระบบเข้าสู่ระบบ'}
          </small>
        </section>
        <section className="panel profile-form">
          <h2>
            <UserRound size={19} />
            แก้ไขข้อมูลติดต่อ
          </h2>
          <form onSubmit={save} key={user.id}>
            <label>
              ชื่อและนามสกุล
              <input
                name="name"
                defaultValue={user.name}
                required
                maxLength={100}
              />
            </label>
            <label>
              อีเมล
              <input value={user.email} readOnly />
            </label>
            <label>
              สังกัด
              <input value={user.affiliation} readOnly />
            </label>
            <label>
              เบอร์โทรศัพท์
              <input
                name="phone"
                defaultValue={user.phone}
                type="tel"
                required
                pattern="[0-9+ \-]{8,20}"
              />
            </label>
            {error ? <p className="form-error">{error}</p> : null}
            {success ? (
              <p className="success-text">
                <Check size={16} />
                ข้อมูลติดต่อเป็นปัจจุบันแล้ว
              </p>
            ) : null}
            <button className="btn" disabled={busy}>
              {busy ? "กำลังบันทึก…" : "บันทึกข้อมูล"}
            </button>
          </form>
        </section>
      </div>
      {mode==='server'?<PasswordSettings/>:null}
      {state.penalties.filter((p) => p.userId === user.id).length ? (
        <section className="panel spaced">
          <div className="section-heading">
            <h2>ผลการพิจารณาสิทธิ์ของคุณ</h2>
          </div>
          {state.penalties
            .filter((p) => p.userId === user.id)
            .map((p) => (
              <div className="list-row" key={p.id}>
                <div>
                  <strong>
                    {p.type === "WARNING" ? "ตักเตือน" : "ระงับสิทธิ์"}
                  </strong>
                  <small>{p.reason}</small>
                </div>
                <span>
                  {p.type === "WARNING"
                    ? thaiDate(p.at, true)
                    : `${p.start} – ${p.end}`}
                </span>
              </div>
            ))}
        </section>
      ) : null}
    </>
  );
}
export function Notifications() {
  const { state, user, run, showToast, mode } = useDemo();
  const [filter, setFilter] = useState("ALL");
  const rows = state.notices.filter(
    (n) =>
      (user.role === "ADMIN" || n.userId === user.id) &&
      (filter === "ALL" || n.status === filter),
  );
  async function retry(id: number) {
    try {
      await run({ type: "RETRY", noticeId: id }, "นำกลับเข้าคิวแล้ว");
    } catch (e) {
      showToast((e as Error).message);
    }
  }
  return (
    <>
      <PageHeading
        eyebrow="STAY IN THE LOOP"
        title="การแจ้งเตือน"
        description="ติดตามคำขอและผลการพิจารณา พร้อมประวัติการแจ้งเตือน"
      />
      <div className="filter-tabs spaced-bottom">
        {[
          ["ALL", "ทั้งหมด"],
          ["QUEUED", "รอส่ง"],
          ["SENT", "ส่งแล้ว"],
          ["FAILED", "ส่งไม่สำเร็จ"],
        ].map(([s, label]) => (
          <button
            key={s}
            className={filter === s ? "filter-tab selected" : "filter-tab"}
            onClick={() => setFilter(s)}
          >
            {label}
          </button>
        ))}
      </div>
      <section className="panel">
        {rows.length ? (
          rows.map((n) => (
            <article className="notification-row" key={n.id}>
              <div className={`notice-icon ${n.status.toLowerCase()}`}>
                <Bell size={20} />
              </div>
              <div className="notification-body">
                <div className="row-between">
                  <h3>{n.subject}</h3>
                  <small>
                    {thaiDate(n.createdAt, true)} {time(n.createdAt)}
                  </small>
                </div>
                <p>{n.content}</p>
                <div className="notice-meta">
                  <span
                    className={`badge ${n.status === "SENT" ? "green" : n.status === "FAILED" ? "red" : "warm"}`}
                  >
                    {n.status === "SENT"
                      ? (mode === 'demo' ? "ส่งแล้ว (จำลอง)" : 'ส่งให้บริการอีเมลแล้ว')
                      : n.status === "FAILED"
                        ? "ส่งไม่สำเร็จ"
                        : "รอส่ง"}
                  </span>
                  <span>
                    <Mail size={13} />
                    {state.users.find((u) => u.id === n.userId)?.email}
                  </span>
                  {user.role === "ADMIN" && n.status === "FAILED" ? (
                    <button className="text-button" onClick={() => retry(n.id)}>
                      ลองส่งอีกครั้ง
                    </button>
                  ) : null}
                  {mode === 'server' && n.userId===user.id && !n.readAt ? <button className="text-button" onClick={()=>void run({type:'READ_NOTICE',noticeId:n.id},'อ่านการแจ้งเตือนแล้ว').catch(e=>showToast((e as Error).message))}>ทำเครื่องหมายว่าอ่านแล้ว</button> : null}
                </div>
              </div>
            </article>
          ))
        ) : (
          <Empty title="ไม่มีการแจ้งเตือนในหมวดนี้" />
        )}
      </section>
      <div className="info-strip">
        <Mail size={18} />
        {mode === 'demo' ? 'การแจ้งเตือนในต้นแบบเป็นข้อมูลสาธิต ไม่มีการส่งอีเมลจริง' : 'สถานะอีเมลแสดงผลการส่งไปยังผู้ให้บริการ แยกจากการอ่านการแจ้งเตือนในเว็บ'}
      </div>
    </>
  );
}
