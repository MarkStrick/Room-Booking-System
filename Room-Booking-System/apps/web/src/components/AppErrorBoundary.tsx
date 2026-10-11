import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Brand } from './Brand';

export class AppErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(_error: Error, _info: ErrorInfo) {
    // Do not log user data, reset links, or server responses into the browser console.
    console.error('KKU Space: page rendering failed');
  }
  render() {
    if (this.state.failed) return <main className="session-page">
      <div className="session-content">
        <Brand /><h1>เปิดหน้านี้ไม่สำเร็จ</h1>
        <p role="alert">กรุณาโหลดหน้าใหม่ หากยังมีปัญหา ให้ติดต่อผู้ดูแลระบบ</p>
        <button className="btn" onClick={() => location.reload()}>โหลดหน้าใหม่</button>
      </div>
    </main>;
    return this.props.children;
  }
}
