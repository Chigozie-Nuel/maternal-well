import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, ClipboardList, ShieldAlert, UserRoundSearch } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { FOLLOW_UP_LABELS, FOLLOW_UP_STATUSES, useScreening } from '../context/ScreeningContext';
import { escalationDueBy, escalationState } from '../domain/escalation';
import { AcknowledgeModal } from './CaseDetail';
import { Countdown, FollowUpBadge, PageHeader, RiskBadge, StatCard, fileLabel, patientLabel } from '../components/ui';

const needsReferral = item => item.riskTier?.tier !== 'low' || item.hasSelfHarmRisk;
const daysSince = value => Math.floor((Date.now() - new Date(value)) / 86400000);

/**
 * Facility case dashboard (SRS FR-11, FR-15). Shows case status and follow-up across the
 * facility. Item-level EPDS answers are not shown here (business rule 2).
 */
export default function SupervisorDashboard() {
  const { user } = useAuth();
  const { cases, stats, loaded } = useScreening();
  const [now, setNow] = useState(() => new Date());
  const [acknowledging, setAcknowledging] = useState(null);

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(timer);
  }, []);

  const escalations = cases
    .filter(item => ['pending', 'overdue'].includes(escalationState(item, now)))
    .sort((a, b) => String(a.escalationDueBy).localeCompare(String(b.escalationDueBy)));
  const referrals = cases.filter(needsReferral);
  const active = referrals.filter(item => !['completed', 'lost_to_followup'].includes(item.referralOutcome || 'pending'));
  const overdue = escalations.filter(item => escalationState(item, now) === 'overdue').length;
  const today = cases.filter(item => new Date(item.completedAt).toDateString() === now.toDateString()).length;

  return (
    <>
      <PageHeader title="Facility case dashboard" subtitle={`${user.facility} · follow-up status of every referral and all same-day escalations`} />

      {overdue > 0 && (
        <p role="alert" className="mb-4 flex items-center gap-2 rounded-2xl bg-red-700 p-4 font-bold text-white">
          <ShieldAlert size={22} aria-hidden="true" /> {overdue} Item-10 escalation{overdue > 1 ? 's are' : ' is'} past the end of the clinic day. Act now.
        </p>
      )}

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Item-10 awaiting you" value={escalations.length} tone="red" icon={ShieldAlert} hint={overdue ? `${overdue} overdue` : 'Acknowledge today'} />
        <StatCard label="Active referrals" value={active.length} tone="amber" icon={ClipboardList} hint={`${referrals.length} referrals in total`} />
        <StatCard label="Screened today" value={today} tone="green" icon={UserRoundSearch} hint={`${stats.total} in total`} />
        <StatCard label="Self-referrals" value={stats.anonymous} tone="sky" icon={AlertTriangle} hint="Anonymous mothers routed to this PHC" />
      </div>

      <section className="card mb-6 overflow-hidden" aria-labelledby="escalation-heading">
        <h2 id="escalation-heading" className="flex items-center gap-2 border-b border-red-200 bg-red-50 px-5 py-3 text-lg font-bold text-red-900">
          <ShieldAlert size={20} aria-hidden="true" /> Same-day escalations
        </h2>
        {escalations.length === 0 ? <p className="p-5 text-sm text-slate-600">{loaded ? 'No Item-10 flags waiting. All escalations have been acknowledged.' : 'Loading…'}</p> : (
          <ul className="divide-y divide-slate-100">
            {escalations.map(item => {
              const state = escalationState(item, now);
              return (
                <li key={item.id} className={`flex flex-wrap items-center justify-between gap-3 p-4 ${state === 'overdue' ? 'bg-red-50' : ''}`}>
                  <div>
                    <Link to={`/cases/${item.id}`} className="font-bold text-slate-900 underline">{patientLabel(item)}</Link>
                    <p className="text-sm text-slate-600">{fileLabel(item)} · EPDS {item.score}/30 · Item 10 = {item.answers?.[10] ?? '>0'} · {new Date(item.completedAt).toLocaleTimeString('en-NG', { hour: '2-digit', minute: '2-digit' })}</p>
                    <p className="text-sm"><Countdown dueBy={item.escalationDueBy || escalationDueBy(item.completedAt)} now={now} /></p>
                    <p className="text-xs text-slate-600">{item.isAnonymous ? 'Self-referral: contact ' + (item.motherData?.contactInfo || 'not provided') : item.workerSafetyConfirmation ? 'Health worker confirmed the mother is accompanied.' : 'Health worker has not yet confirmed safety steps.'}</p>
                  </div>
                  <button type="button" className="btn btn-danger" onClick={() => setAcknowledging(item)}>Acknowledge</button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <div className="mb-6 grid gap-6 lg:grid-cols-3">
        <section className="card p-5" aria-labelledby="funnel-heading">
          <h2 id="funnel-heading" className="mb-4 text-lg font-bold">Referral follow-up</h2>
          <ul className="space-y-3">
            {FOLLOW_UP_STATUSES.map(status => {
              const count = referrals.filter(item => (item.referralOutcome || 'pending') === status).length;
              const pct = referrals.length ? Math.round((count / referrals.length) * 100) : 0;
              return (
                <li key={status}>
                  <div className="flex justify-between text-sm"><span className="font-semibold">{FOLLOW_UP_LABELS[status]}</span><span>{count}</span></div>
                  <div className="mt-1 h-2 rounded-full bg-slate-100"><div className="h-2 rounded-full bg-green-700" style={{ width: `${pct}%` }} /></div>
                </li>
              );
            })}
          </ul>
        </section>

        <section className="card overflow-x-auto lg:col-span-2" aria-labelledby="active-heading">
          <h2 id="active-heading" className="px-5 pt-5 text-lg font-bold">Active and pending referrals</h2>
          <table className="mt-3 w-full min-w-[560px] text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="p-3">Mother</th><th className="p-3">Risk</th><th className="p-3">Follow-up</th><th className="p-3">Days open</th></tr></thead>
            <tbody className="divide-y divide-slate-100">
              {active.map(item => (
                <tr key={item.id}>
                  <td className="p-3"><Link to={`/cases/${item.id}`} className="font-semibold text-green-900 underline">{patientLabel(item)}</Link><div className="text-xs text-slate-500">{fileLabel(item)}</div></td>
                  <td className="p-3"><RiskBadge record={item} /></td>
                  <td className="p-3"><FollowUpBadge status={item.referralOutcome} /></td>
                  <td className={`p-3 font-semibold ${daysSince(item.completedAt) > 7 ? 'text-red-700' : ''}`}>{daysSince(item.completedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {active.length === 0 && <p className="p-5 text-sm text-slate-600">No open referrals.</p>}
        </section>
      </div>

      {acknowledging && <AcknowledgeModal record={acknowledging} onClose={() => setAcknowledging(null)} />}
    </>
  );
}
