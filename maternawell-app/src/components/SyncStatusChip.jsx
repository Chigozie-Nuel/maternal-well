import { useState, useEffect } from 'react';
import { Wifi, WifiOff, RefreshCw, CheckCircle2, Clock, CloudOff } from 'lucide-react';
import { useScreening } from '../context/ScreeningContext';
import { isServerReachable } from '../db/sync';

export default function SyncStatusChip() {
  const { isOnline, pendingSyncCount, lastSyncTime, performSync, isSyncing } = useScreening();
  const [justSynced, setJustSynced] = useState(false);
  const serverUp = isServerReachable();

  const handleSyncClick = async (e) => {
    e.stopPropagation();
    if (!isOnline || isSyncing) return;
    await performSync();
    setJustSynced(true);
    setTimeout(() => setJustSynced(false), 3000);
  };

  const formatLastSync = (timestamp) => {
    if (!timestamp) return 'Never';
    try {
      const d = new Date(timestamp);
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return 'Recent';
    }
  };

  return (
    <div className="flex items-center gap-2 bg-white/90 backdrop-blur-sm border border-slate-200/80 shadow-sm rounded-full px-3 py-1.5 text-xs text-slate-700">
      {/* Online / Offline badge */}
      <div className="flex items-center gap-1.5 font-medium">
        {isOnline && serverUp ? (
          <>
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <Wifi size={13} className="text-emerald-600" />
            <span className="text-emerald-700 font-semibold">Online</span>
          </>
        ) : isOnline && !serverUp ? (
          <>
            <span className="inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
            <CloudOff size={13} className="text-amber-600" />
            <span className="text-amber-700 font-semibold">Offline / server unreachable</span>
          </>
        ) : (
          <>
            <span className="inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
            <WifiOff size={13} className="text-amber-600" />
            <span className="text-amber-700 font-semibold">Offline (Local)</span>
          </>
        )}
      </div>

      <span className="text-slate-300">|</span>

      {/* Pending Outbox Count */}
      <div className="flex items-center gap-1">
        {pendingSyncCount > 0 ? (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800">
            <Clock size={11} />
            {pendingSyncCount} pending
          </span>
        ) : justSynced ? (
          <span className="inline-flex items-center gap-1 text-emerald-700 font-medium">
            <CheckCircle2 size={12} />
            All synced
          </span>
        ) : (
          <span className="text-slate-500">
            Synced {formatLastSync(lastSyncTime)}
          </span>
        )}
      </div>

      {/* Manual Sync Button */}
      {isOnline && (
        <button
          onClick={handleSyncClick}
          disabled={isSyncing}
          title="Flush outbox and synchronize"
          className="ml-1 p-1 text-slate-500 hover:text-emerald-700 hover:bg-emerald-50 rounded-full transition-colors disabled:opacity-50"
        >
          <RefreshCw size={12} className={isSyncing ? 'animate-spin text-emerald-600' : ''} />
        </button>
      )}
    </div>
  );
}
