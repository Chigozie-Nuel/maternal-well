import { useCallback, useEffect, useMemo, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { apiRequest } from '../config/api';
import { useAuth } from '../context/AuthContext';
import { useScreening } from '../context/ScreeningContext';
import { PageHeader } from '../components/ui';

/** Audit trail viewer for the system administrator (SRS NFR-7, class model: SystemAdmin, AuditLogEntry). */
export default function AdminAudit() {
  const { token } = useAuth();
  const { auditLogs } = useScreening();
  const [server, setServer] = useState(null);
  const [error, setError] = useState('');
  const [staff, setStaff] = useState('');
  const [action, setAction] = useState('all');

  const load = useCallback(async () => {
    setError('');
    try { setServer(await apiRequest('/api/admin/audit', { token })); }
    catch (err) { setError(`Showing entries saved on this device. Server audit unavailable: ${err.message}`); }
  }, [token]);
  useEffect(() => { load(); }, [load]);

  const entries = server?.auditLogs || auditLogs;
  const actions = useMemo(() => [...new Set(entries.map(entry => entry.action))].sort(), [entries]);
  const filtered = entries.filter(entry => (!staff || (entry.userId || '').toLowerCase().includes(staff.toLowerCase())) && (action === 'all' || entry.action === action));

  return (
    <>
      <PageHeader title="Audit trail" subtitle="Every screening, referral, escalation and sign-in with the staff ID and time (NDPA accountability)."
        actions={<button type="button" className="btn btn-secondary" onClick={load}><RefreshCw size={16} aria-hidden="true" /> Refresh</button>} />
      {error && <p role="status" className="mb-4 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">{error}</p>}
      <div className="card mb-4 grid gap-3 p-4 sm:grid-cols-2">
        <label className="text-xs font-semibold text-slate-600" htmlFor="audit-staff">Staff ID
          <input id="audit-staff" className="input-field !mt-1 !py-2" value={staff} onChange={event => setStaff(event.target.value)} placeholder="e.g. HW-01" />
        </label>
        <label className="text-xs font-semibold text-slate-600" htmlFor="audit-action">Action
          <select id="audit-action" className="input-field !mt-1 !py-2" value={action} onChange={event => setAction(event.target.value)}>
            <option value="all">All actions</option>
            {actions.map(value => <option key={value} value={value}>{value}</option>)}
          </select>
        </label>
      </div>
      <div className="card mb-6 overflow-x-auto">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="p-3">Time</th><th className="p-3">Staff ID</th><th className="p-3">Action</th><th className="p-3">Record</th></tr></thead>
          <tbody className="divide-y divide-slate-100">
            {filtered.slice(0, 500).map(entry => (
              <tr key={entry.id}>
                <td className="p-3 whitespace-nowrap text-slate-600">{new Date(entry.timestamp).toLocaleString('en-NG')}</td>
                <td className="p-3 font-mono">{entry.userId}</td>
                <td className="p-3 font-semibold">{entry.action}</td>
                <td className="p-3 font-mono text-xs text-slate-500">{entry.entityId}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && <p className="p-6 text-center text-slate-500">No audit entries match.</p>}
      </div>
      {server?.notifications && (
        <section className="card p-5">
          <h2 className="mb-2 text-lg font-bold">Escalation notifications</h2>
          <p className="mb-3 text-sm text-slate-600">The SMS/push gateway is simulated in this prototype: notifications are recorded, not sent.</p>
          <ul className="space-y-1 text-sm">
            {server.notifications.map(item => <li key={item.id} className="font-mono text-xs">{new Date(item.created_at).toLocaleString('en-NG')} · {item.channel} · {item.delivery_status} · {item.screening_id}</li>)}
          </ul>
        </section>
      )}
    </>
  );
}
