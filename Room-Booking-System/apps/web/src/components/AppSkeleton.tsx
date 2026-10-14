import './skeleton.css';

function Bone({ className = '' }: { className?: string }) {
  return <div className={`skeleton-bone ${className}`} />;
}

export function AppSkeleton({ variant = 'workspace' }: { variant?: 'workspace' | 'login' | 'home' }) {
  return <div className={`app-skeleton skeleton-${variant}`} role="status" aria-live="polite" aria-busy="true">
    <span className="skeleton-status">กำลังโหลดข้อมูล กรุณารอสักครู่</span>
    <div className="skeleton-layout" aria-hidden="true">
      {variant === 'workspace' && <aside className="skeleton-sidebar"><Bone className="skeleton-brand"/><Bone/><Bone/><Bone/><Bone className="skeleton-short"/></aside>}
      <div className="skeleton-main">
        <header className="skeleton-header"><Bone className="skeleton-brand"/><Bone className="skeleton-account"/></header>
        {variant === 'login' ? <div className="skeleton-login-content"><div className="skeleton-login-heading"><Bone className="skeleton-logo"/><Bone className="skeleton-heading"/><Bone/><Bone className="skeleton-short"/></div><div className="skeleton-panel skeleton-login-form"><Bone className="skeleton-heading"/><Bone/><Bone className="skeleton-input"/><Bone className="skeleton-short"/></div></div>
        : variant === 'home' ? <div className="skeleton-home-content"><div className="skeleton-home-heading"><Bone className="skeleton-heading"/><Bone className="skeleton-heading"/><Bone className="skeleton-heading skeleton-short"/><Bone/><Bone/><Bone className="skeleton-input skeleton-short"/></div><div className="skeleton-panel"><Bone className="skeleton-photo"/><Bone className="skeleton-heading"/><Bone/><Bone className="skeleton-input"/></div></div>
        : <div className="skeleton-workspace-content"><Bone className="skeleton-heading"/><Bone className="skeleton-short"/><div className="skeleton-panel skeleton-filters"><Bone className="skeleton-input"/><Bone className="skeleton-input"/><Bone className="skeleton-input"/></div><div className="skeleton-card-grid">{[0,1,2,3].map(i=><div key={i} className="skeleton-panel"><Bone className="skeleton-photo"/><Bone className="skeleton-heading"/><Bone/><Bone className="skeleton-short"/></div>)}</div></div>}
      </div>
    </div>
  </div>;
}
