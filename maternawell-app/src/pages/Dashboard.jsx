import { Link, useNavigate } from 'react-router-dom';
import { AlertCircle, CheckCircle, ClipboardList, FileText, PlayCircle, PlusCircle, ShieldAlert, Trash2, TrendingUp } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useScreening } from '../context/ScreeningContext';
import { EscalationBadge, FollowUpBadge, PageHeader, RiskBadge, StatCard, SyncBadge, fileLabel, patientLabel } from '../components/ui';

const Dashboard = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { cases, drafts, stats, resumeDraft, discardDraft, loaded } = useScreening();

  const needsSafetyConfirmation = cases.filter(item => item.hasSelfHarmRisk && item.workerId === user.id && !item.workerSafetyConfirmation);
  const awaitingSupervisor = cases.filter(item => item.hasSelfHarmRisk && !item.selfHarmAcknowledged);
  const openReferrals = cases.filter(item => (item.riskTier?.tier !== 'low' || item.hasSelfHarmRisk) && !['completed', 'lost_to_followup'].includes(item.referralOutcome));

  const resume = async draft => {
    const resumed = await resumeDraft(draft);
    navigate(`/screening/${resumed.id}`);
  };

  return (
    <>
      <PageHeader
        title={`Welcome, ${user.name}`}
        subtitle={new Date().toLocaleDateString('en-NG', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
        actions={<button type="button" className="btn btn-primary" onClick={() => navigate('/new-screening')}><PlusCircle size={18} aria-hidden="true" /> New screening</button>}
      />

      {needsSafetyConfirmation.map(item => (
        <div key={item.id} role="alert" className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border-2 border-red-600 bg-red-50 p-4">
          <p className="flex items-center gap-2 font-semibold text-red-900"><ShieldAlert size={20} aria-hidden="true" /> Safety steps not yet confirmed for {patientLabel(item)}. Do not let her leave alone.</p>
          <Link className="btn btn-danger" to={`/results/${item.id}`}>Confirm safety steps</Link>
        </div>
      ))}

      {drafts.map(draft => (
        <div key={draft.id} className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-sky-300 bg-sky-50 p-4">
          <div>
            <p className="font-bold text-sky-950">Resume screening for {draft.motherData?.name}</p>
            <p className="text-sm text-sky-900">File {draft.motherData?.fileNumber} · {Object.keys(draft.answers || {}).length} of 10 answered · saved on this device</p>
          </div>
          <div className="flex gap-2">
            <button type="button" className="btn btn-primary" onClick={() => resume(draft)}><PlayCircle size={18} aria-hidden="true" /> Resume</button>
            <button type="button" className="btn btn-secondary" onClick={() => { if (window.confirm('Discard this unfinished screening? The answers will be deleted.')) discardDraft(draft.id); }}>
              <Trash2 size={16} aria-hidden="true" /> Discard
            </button>
          </div>
        </div>
      ))}

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Screenings (facility)" value={stats.total} icon={FileText} tone="green" />
        <StatCard label="Urgent referrals" value={stats.urgentReferrals} icon={AlertCircle} tone="red" hint={`${awaitingSupervisor.length} Item-10 flag(s) awaiting supervisor`} />
        <StatCard label="Moderate risk (9–12)" value={stats.moderateRisk} icon={TrendingUp} tone="amber" />
        <StatCard label="Open referrals to follow up" value={openReferrals.length} icon={ClipboardList} tone="sky" hint={`${stats.followUp.contacted} contacted · ${stats.followUp.completed} completed`} />
      </div>

      <section className="card p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-900">Recent cases</h2>
          <Link to="/screenings" className="font-semibold text-green-800 underline">All cases</Link>
        </div>
        {!loaded ? <p className="text-slate-500">Loading…</p> : cases.length === 0 ? (
          <div className="py-10 text-center text-slate-500">
            <CheckCircle size={40} className="mx-auto mb-3 text-slate-300" aria-hidden="true" />
            <p>No screenings yet. Start your first screening to see it here.</p>
          </div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {cases.slice(0, 8).map(item => (
              <li key={item.id}>
                <Link to={`/cases/${item.id}`} className="flex flex-wrap items-center justify-between gap-3 py-3 hover:bg-slate-50">
                  <span>
                    <span className="block font-semibold text-slate-900">{patientLabel(item)}</span>
                    <span className="text-xs text-slate-500">{fileLabel(item)} · {new Date(item.completedAt || item.createdAt).toLocaleString('en-NG')}</span>
                  </span>
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="font-bold text-slate-800">{item.score}/30</span>
                    <RiskBadge record={item} />
                    <EscalationBadge record={item} />
                    {item.riskTier?.tier !== 'low' && <FollowUpBadge status={item.referralOutcome} />}
                    <SyncBadge record={item} />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
};

export default Dashboard;
