import { useEffect, useRef } from 'react';
import { AlertTriangle, CheckCircle2, Clock, CloudOff, ShieldAlert } from 'lucide-react';
import { escalationState } from '../domain/escalation';
import { STATUTORY_DISCLAIMER } from '../config/crisisContacts';
import { FOLLOW_UP_LABELS } from '../context/ScreeningContext';

const pill = 'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold whitespace-nowrap';

// Risk is always conveyed by text and icon, never colour alone.
export function RiskBadge({ record }) {
  if (!record?.riskTier) return <span className={`${pill} bg-slate-100 text-slate-700`}>In progress</span>;
  const tier = record.riskTier.tier;
  const style = tier === 'high' ? 'bg-red-100 text-red-800' : tier === 'moderate' ? 'bg-amber-100 text-amber-900' : 'bg-green-100 text-green-800';
  const Icon = tier === 'low' ? CheckCircle2 : AlertTriangle;
  return <span className={`${pill} ${style}`}><Icon size={13} aria-hidden="true" />{record.riskTier.label}</span>;
}

export function FollowUpBadge({ status }) {
  const value = status || 'pending';
  const style = value === 'completed' ? 'bg-green-100 text-green-800' : value === 'contacted' ? 'bg-sky-100 text-sky-800' : value === 'lost_to_followup' ? 'bg-slate-200 text-slate-800' : 'bg-amber-50 text-amber-900';
  return <span className={`${pill} ${style}`}>{FOLLOW_UP_LABELS[value] || value}</span>;
}

export function EscalationBadge({ record }) {
  const state = escalationState(record);
  if (state === 'none') return null;
  if (state === 'acknowledged') return <span className={`${pill} bg-green-100 text-green-800`}><CheckCircle2 size={13} aria-hidden="true" />Item-10 acknowledged</span>;
  if (state === 'overdue') return <span className={`${pill} bg-red-700 text-white`}><ShieldAlert size={13} aria-hidden="true" />Item-10 OVERDUE</span>;
  return <span className={`${pill} bg-red-100 text-red-800`}><ShieldAlert size={13} aria-hidden="true" />Item-10 awaiting supervisor</span>;
}

export function SyncBadge({ record }) {
  if (record?.syncStatus === 'synced') return null;
  return <span className={`${pill} bg-slate-100 text-slate-700`} title="Saved on this device; waiting to reach the server"><CloudOff size={13} aria-hidden="true" />Not yet synced</span>;
}

export function Disclaimer({ className = '' }) {
  return (
    <p role="note" className={`flex items-start gap-2 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm font-semibold text-amber-900 ${className}`}>
      <ShieldAlert size={18} className="mt-0.5 shrink-0" aria-hidden="true" />
      {STATUTORY_DISCLAIMER}
    </p>
  );
}

export function PageHeader({ title, subtitle, actions }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-slate-600">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function StatCard({ label, value, tone = 'slate', icon: Icon, hint }) {
  const tones = { slate: 'border-slate-300', green: 'border-green-600', amber: 'border-amber-500', red: 'border-red-600', sky: 'border-sky-600' };
  return (
    <div className={`card border-l-4 ${tones[tone]} p-5`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-slate-600">{label}</p>
          <p className="mt-1 text-3xl font-bold text-slate-900">{value}</p>
          {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
        </div>
        {Icon && <Icon size={26} className="text-slate-400" aria-hidden="true" />}
      </div>
    </div>
  );
}

export function Countdown({ dueBy, now }) {
  const ms = new Date(dueBy) - now;
  if (ms <= 0) return <span className="font-bold text-red-700">Overdue by {formatDuration(-ms)}</span>;
  return <span className="inline-flex items-center gap-1 font-semibold text-red-800"><Clock size={14} aria-hidden="true" />{formatDuration(ms)} left today</span>;
}

export function formatDuration(ms) {
  const minutes = Math.floor(ms / 60000);
  const hours = Math.floor(minutes / 60);
  return hours ? `${hours}h ${minutes % 60}m` : `${minutes}m`;
}

/** Accessible modal. `dismissible=false` removes every way to close it except its own actions. */
export function Modal({ title, children, onClose, dismissible = true, tone = 'default', labelledBy = 'modal-title' }) {
  const ref = useRef(null);
  useEffect(() => {
    const previous = document.activeElement;
    ref.current?.querySelector('button, input, textarea, select')?.focus();
    return () => previous?.focus?.();
  }, []);
  const onKeyDown = event => {
    if (event.key === 'Escape' && dismissible) onClose?.();
    if (event.key !== 'Tab') return;
    const items = [...ref.current.querySelectorAll('button:not([disabled]), input, textarea, select, a[href]')];
    if (!items.length) return;
    const first = items[0];
    const last = items[items.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  };
  return (
    <div className="fixed inset-0 z-[900] grid place-items-center bg-slate-900/70 p-4" onMouseDown={event => { if (dismissible && event.target === event.currentTarget) onClose?.(); }}>
      <section ref={ref} role="dialog" aria-modal="true" aria-labelledby={labelledBy} onKeyDown={onKeyDown}
        className={`max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl ${tone === 'danger' ? 'border-t-8 border-red-600' : ''}`}>
        <h2 id={labelledBy} className="mb-4 text-xl font-bold text-slate-900">{title}</h2>
        {children}
      </section>
    </div>
  );
}

export function patientLabel(record) {
  if (record?.isAnonymous || record?.motherData?.isAnonymous) return `Self-referral ${record.anonymousCode || ''}`.trim();
  return record?.motherData?.name || 'Name restricted';
}

export function fileLabel(record) {
  return record?.anonymousCode || record?.motherData?.fileNumber || '—';
}
