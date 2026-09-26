import { useState } from 'react';
import { AlertTriangle, CheckCircle2, CloudOff, KeyRound, RefreshCw, WifiOff } from 'lucide-react';
import { useScreening } from '../context/ScreeningContext';
import { lockSession } from '../utils/crypto';
import { Modal } from './ui';

const time = value => (value ? new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'never');

/** Online/offline badge, pending count, last sync time and "Sync now" (FR-9, SRS FAQ "did my data sync?"). */
export default function SyncStatusChip() {
  const { isOnline, sync, performSync, retryFailedSync } = useScreening();
  const [showFailed, setShowFailed] = useState(false);
  const failed = sync.failed || [];

  let icon = <CheckCircle2 size={15} className="text-green-700" aria-hidden="true" />;
  let label = 'All work synced';
  if (!isOnline) { icon = <WifiOff size={15} className="text-slate-600" aria-hidden="true" />; label = 'Offline, saving on this device'; }
  else if (sync.authExpired) { icon = <KeyRound size={15} className="text-amber-700" aria-hidden="true" />; label = 'Sign in again to sync'; }
  else if (sync.serverReachable === false) { icon = <CloudOff size={15} className="text-amber-700" aria-hidden="true" />; label = 'Server unreachable'; }
  else if (sync.pending) { icon = <RefreshCw size={15} className="text-sky-700" aria-hidden="true" />; label = `${sync.pending} waiting to sync`; }

  return (
    <div className="flex flex-wrap items-center gap-2 text-xs" role="status" aria-live="polite">
      <span className="inline-flex min-h-[36px] items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 font-semibold text-slate-800">
        {icon}{label}
        {sync.pending > 0 && !label.includes('waiting') && <span className="text-slate-500">· {sync.pending} pending</span>}
      </span>
      <span className="text-slate-500">Last sync {time(sync.lastSyncAt)}</span>
      {sync.authExpired ? (
        <button type="button" className="btn btn-secondary !min-h-[36px] !px-3 !py-1 text-xs" onClick={lockSession}>Re-enter password</button>
      ) : (
        <button type="button" className="btn btn-secondary !min-h-[36px] !px-3 !py-1 text-xs" disabled={!isOnline || sync.running} onClick={performSync}>
          <RefreshCw size={14} className={sync.running ? 'animate-spin' : ''} aria-hidden="true" /> {sync.running ? 'Syncing…' : 'Sync now'}
        </button>
      )}
      {failed.length > 0 && (
        <button type="button" className="inline-flex min-h-[36px] items-center gap-1 rounded-full bg-red-100 px-3 font-semibold text-red-800" onClick={() => setShowFailed(true)}>
          <AlertTriangle size={14} aria-hidden="true" />{failed.length} rejected
        </button>
      )}
      {showFailed && (
        <Modal title="Changes the server rejected" onClose={() => setShowFailed(false)}>
          <p className="mb-3 text-sm text-slate-600">These changes are still saved on this device but the server refused them. Ask your supervisor if you are unsure why.</p>
          <ul className="mb-4 space-y-2 text-sm">
            {failed.map(item => <li key={item.id} className="rounded-lg bg-slate-50 p-2"><strong>{item.action}</strong> — {item.lastError}</li>)}
          </ul>
          <div className="flex gap-2">
            <button type="button" className="btn btn-primary" onClick={async () => { await retryFailedSync(); setShowFailed(false); }}>Retry all</button>
            <button type="button" className="btn btn-secondary" onClick={() => setShowFailed(false)}>Close</button>
          </div>
        </Modal>
      )}
    </div>
  );
}
