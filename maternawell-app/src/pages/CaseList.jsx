import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Search } from 'lucide-react';
import { useScreening, FOLLOW_UP_LABELS } from '../context/ScreeningContext';
import { escalationState } from '../domain/escalation';
import { EscalationBadge, FollowUpBadge, PageHeader, RiskBadge, SyncBadge, fileLabel, patientLabel } from '../components/ui';

const needsReferral = item => item.riskTier?.tier !== 'low' || item.hasSelfHarmRisk;

export default function CaseList() {
  const { cases, loaded } = useScreening();
  const [query, setQuery] = useState('');
  const [risk, setRisk] = useState('all');
  const [followUp, setFollowUp] = useState('all');
  const [source, setSource] = useState('all');
  const [syncFilter, setSyncFilter] = useState('all');

  const filtered = useMemo(() => {
    const text = query.trim().toLowerCase();
    return cases.filter(item => {
      if (text && ![item.motherData?.name, item.motherData?.fileNumber, item.anonymousCode].some(value => (value || '').toLowerCase().includes(text))) return false;
      if (risk === 'escalated' && escalationState(item) === 'none') return false;
      if (['low', 'moderate', 'high'].includes(risk) && item.riskTier?.tier !== risk) return false;
      if (followUp !== 'all' && (!needsReferral(item) || (item.referralOutcome || 'pending') !== followUp)) return false;
      if (source === 'self' && !item.isAnonymous) return false;
      if (source === 'staff' && item.isAnonymous) return false;
      if (syncFilter === 'unsynced' && item.syncStatus === 'synced') return false;
      return true;
    });
  }, [cases, query, risk, followUp, source, syncFilter]);

  const select = (id, label, value, onChange, options) => (
    <label className="flex flex-col text-xs font-semibold text-slate-600" htmlFor={id}>
      {label}
      <select id={id} className="input-field !mt-1 !py-2" value={value} onChange={event => onChange(event.target.value)}>
        {options.map(([optionValue, optionLabel]) => <option key={optionValue} value={optionValue}>{optionLabel}</option>)}
      </select>
    </label>
  );

  return (
    <>
      <PageHeader title="Cases" subtitle="All screenings and self-referrals for your facility, including those saved on this device but not yet synced." />
      <div className="card mb-4 grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-5">
        <label className="flex flex-col text-xs font-semibold text-slate-600 lg:col-span-1" htmlFor="case-search">
          Search
          <span className="relative mt-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden="true" />
            <input id="case-search" className="input-field !py-2 !pl-9" placeholder="Name, file no. or MW- code" value={query} onChange={event => setQuery(event.target.value)} />
          </span>
        </label>
        {select('risk', 'Risk', risk, setRisk, [['all', 'All'], ['escalated', 'Item-10 flags'], ['high', 'High'], ['moderate', 'Moderate'], ['low', 'Low']])}
        {select('followUp', 'Follow-up', followUp, setFollowUp, [['all', 'All'], ...Object.entries(FOLLOW_UP_LABELS)])}
        {select('source', 'Source', source, setSource, [['all', 'All'], ['staff', 'Screened by staff'], ['self', 'Self-referral']])}
        {select('sync', 'Sync', syncFilter, setSyncFilter, [['all', 'All'], ['unsynced', 'Not yet synced']])}
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500">
            <tr><th className="p-3">Mother</th><th className="p-3">Date</th><th className="p-3">Score</th><th className="p-3">Risk</th><th className="p-3">Follow-up</th><th className="p-3">Status</th></tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filtered.map(item => (
              <tr key={item.id} className="hover:bg-slate-50">
                <td className="p-3">
                  <Link to={`/cases/${item.id}`} className="font-semibold text-green-900 underline">{patientLabel(item)}</Link>
                  <div className="text-xs text-slate-500">{fileLabel(item)}</div>
                </td>
                <td className="p-3 text-slate-600">{new Date(item.completedAt || item.createdAt).toLocaleDateString('en-NG')}</td>
                <td className="p-3 font-bold">{item.score}/30</td>
                <td className="p-3"><RiskBadge record={item} /></td>
                <td className="p-3">{needsReferral(item) ? <FollowUpBadge status={item.referralOutcome} /> : <span className="text-xs text-slate-500">Routine care</span>}</td>
                <td className="p-3"><div className="flex flex-wrap gap-1"><EscalationBadge record={item} /><SyncBadge record={item} /></div></td>
              </tr>
            ))}
          </tbody>
        </table>
        {loaded && filtered.length === 0 && <p className="p-8 text-center text-slate-500">No cases match these filters.</p>}
      </div>
    </>
  );
}
