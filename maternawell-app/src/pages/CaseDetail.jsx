import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Download, Lock, ShieldAlert, Trash2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { FOLLOW_UP_LABELS, FOLLOW_UP_STATUSES, useScreening } from '../context/ScreeningContext';
import { escalationState, isUrgent } from '../domain/escalation';
import { EPDS_QUESTIONS, FACILITIES } from '../utils/constants';
import { exportCasePdf } from '../utils/pdf';
import { Countdown, Disclaimer, EscalationBadge, FollowUpBadge, Modal, RiskBadge, SyncBadge, fileLabel, patientLabel } from '../components/ui';

const PATHWAYS = { community_peer: 'Community / peer support', phc_counselling: 'PHC counselling within 1 week', urgent_psychiatric: 'Immediate psychiatric referral (same day)' };
const when = value => (value ? new Date(value).toLocaleString('en-NG') : '—');

export function AcknowledgeModal({ record, onClose }) {
  const { acknowledgeEscalation } = useScreening();
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');
  const submit = async () => {
    try { await acknowledgeEscalation(record.id, notes); onClose(); }
    catch (err) { setError(err.message); }
  };
  return (
    <Modal title="Acknowledge Item-10 escalation" onClose={onClose} tone="danger">
      <p className="mb-3 rounded-lg bg-red-50 p-3 text-sm text-red-900">
        <strong>{patientLabel(record)}</strong> · {fileLabel(record)} · EPDS {record.score}/30 · screened {when(record.completedAt)}
      </p>
      <label className="input-label" htmlFor="ack-notes">Action taken and plan (required)</label>
      <textarea id="ack-notes" className="input-field" rows={4} value={notes} onChange={event => setNotes(event.target.value)}
        placeholder="e.g. Spoke with mother and husband; psychiatric review booked at LUTH today 3pm; mother accompanied." />
      {error && <p role="alert" className="mt-2 text-sm font-semibold text-red-800">{error}</p>}
      <div className="mt-4 flex gap-2">
        <button type="button" className="btn btn-danger flex-1" disabled={!notes.trim()} onClick={submit}>Acknowledge</button>
        <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
      </div>
    </Modal>
  );
}

function FollowUpForm({ record }) {
  const { recordFollowUp } = useScreening();
  const current = record.referralOutcome || 'pending';
  const [status, setStatus] = useState(current === 'pending' ? 'contacted' : current);
  const [notes, setNotes] = useState('');
  const [message, setMessage] = useState(null);
  const submit = async event => {
    event.preventDefault();
    try {
      await recordFollowUp(record.id, status, notes);
      setNotes('');
      setMessage({ ok: true, text: 'Follow-up saved on this device and queued for sync.' });
    } catch (err) {
      setMessage({ ok: false, text: err.message });
    }
  };
  return (
    <form onSubmit={submit} className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
      <h3 className="mb-3 font-bold text-slate-900">Update follow-up</h3>
      <fieldset className="mb-3 flex flex-wrap gap-2">
        <legend className="sr-only">Follow-up status</legend>
        {FOLLOW_UP_STATUSES.map(value => (
          <label key={value} className={`inline-flex min-h-[44px] cursor-pointer items-center gap-2 rounded-full border px-4 text-sm font-semibold ${status === value ? 'border-green-700 bg-green-50 text-green-900' : 'border-slate-300 bg-white'}`}>
            <input type="radio" name="follow-up" value={value} checked={status === value} onChange={() => setStatus(value)} className="sr-only" />
            {FOLLOW_UP_LABELS[value]}
          </label>
        ))}
      </fieldset>
      <label className="input-label" htmlFor="follow-up-notes">Note {status !== 'pending' && '(required)'}</label>
      <textarea id="follow-up-notes" className="input-field" rows={3} value={notes} onChange={event => setNotes(event.target.value)}
        placeholder={status === 'contacted' ? 'e.g. Phoned mother; counselling session booked for Thursday.' : status === 'completed' ? 'e.g. Attended counselling at PHC on 12 Oct.' : ''} />
      {message && <p role={message.ok ? 'status' : 'alert'} className={`mt-2 text-sm font-semibold ${message.ok ? 'text-green-800' : 'text-red-800'}`}>{message.text}</p>}
      <button type="submit" className="btn btn-primary mt-3">Save follow-up</button>
    </form>
  );
}

export default function CaseDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { getScreeningById, loaded, softDeleteCase, addAuditLog } = useScreening();
  const [acknowledging, setAcknowledging] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const record = getScreeningById(id);

  if (!record) {
    return loaded
      ? <div className="card p-8 text-center"><p className="mb-4">This case is not on this device yet. Sync and try again.</p><Link className="btn btn-primary" to="/screenings">Back to cases</Link></div>
      : <p className="p-8 text-center text-slate-600">Loading…</p>;
  }

  const escalation = escalationState(record);
  const referral = record.riskTier?.tier !== 'low' || record.hasSelfHarmRisk;
  const facility = FACILITIES.find(item => item.id === record.facilityId)?.name;
  const answersVisible = record.answers && Object.keys(record.answers).length === 10;

  return (
    <div className="mx-auto max-w-4xl">
      <button type="button" onClick={() => navigate(-1)} className="mb-4 inline-flex min-h-[44px] items-center gap-2 font-semibold text-slate-700"><ArrowLeft size={18} aria-hidden="true" /> Back</button>
      <Disclaimer className="mb-4" />

      <section className="card mb-4 p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">{patientLabel(record)}</h1>
            <p className="text-sm text-slate-600">{fileLabel(record)} · {facility} · screened {when(record.completedAt)}</p>
            {!record.isAnonymous && record.motherData?.age && <p className="text-sm text-slate-600">{record.motherData.age} years · {record.motherData.weeksPostpartum} weeks since delivery{record.motherData.phone ? ` · ${record.motherData.phone}` : ''}</p>}
            {record.isAnonymous && <p className="text-sm text-slate-600">Anonymous self-referral · contact: {record.motherData?.contactInfo || 'not provided (mother may present the code in person)'}</p>}
          </div>
          <div className="text-right">
            <p className="text-4xl font-extrabold text-slate-900">{record.score}<span className="text-lg text-slate-500">/30</span></p>
            <div className="mt-1 flex flex-wrap justify-end gap-1"><RiskBadge record={record} /><EscalationBadge record={record} /><SyncBadge record={record} /></div>
          </div>
        </div>
      </section>

      {record.hasSelfHarmRisk && (
        <section className={`card mb-4 border-2 p-5 ${escalation === 'acknowledged' ? 'border-green-600' : 'border-red-600'}`}>
          <h2 className="mb-2 flex items-center gap-2 text-lg font-bold text-red-900"><ShieldAlert size={20} aria-hidden="true" /> Item-10 same-day escalation</h2>
          <dl className="grid gap-2 text-sm sm:grid-cols-2">
            <div><dt className="font-semibold text-slate-600">Due by</dt><dd>{when(record.escalationDueBy)} {escalation !== 'acknowledged' && record.escalationDueBy && <Countdown dueBy={record.escalationDueBy} now={new Date()} />}</dd></div>
            <div><dt className="font-semibold text-slate-600">Health worker safety steps</dt><dd>{record.workerSafetyConfirmation ? `Confirmed ${when(record.workerSafetyConfirmation.confirmedAt)} by ${record.workerSafetyConfirmation.confirmedBy}` : record.isAnonymous ? 'Self-referral: no health worker present' : 'Not yet confirmed'}</dd></div>
            <div className="sm:col-span-2"><dt className="font-semibold text-slate-600">Supervisor acknowledgement</dt><dd>{record.selfHarmAcknowledged ? `${when(record.selfHarmAcknowledgedAt)} by ${record.acknowledgedBy}: ${record.supervisorNotes || ''}` : 'Waiting for the facility supervisor'}</dd></div>
          </dl>
          {user.role === 'supervisor' && !record.selfHarmAcknowledged && <button type="button" className="btn btn-danger mt-4" onClick={() => setAcknowledging(true)}>Acknowledge escalation</button>}
          {user.role === 'health_worker' && !record.workerSafetyConfirmation && !record.isAnonymous && <Link className="btn btn-danger mt-4" to={`/results/${record.id}`}>Confirm safety steps</Link>}
        </section>
      )}

      <section className="card mb-4 p-5">
        <h2 className="mb-1 text-lg font-bold">Referral recommendation</h2>
        <p className="mb-3 font-semibold text-green-900">{PATHWAYS[record.referralPlan?.pathway]}</p>
        <ol className="list-decimal space-y-1 pl-5 text-sm">{(record.referralPlan?.actions || []).map(action => <li key={action}>{action}</li>)}</ol>
      </section>

      <section className="card mb-4 p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-bold">Follow-up</h2>
          {referral ? <FollowUpBadge status={record.referralOutcome} /> : <span className="text-sm text-slate-600">Routine care; re-screen in 4–6 weeks</span>}
        </div>
        {record.followUps?.length > 0 ? (
          <ol className="mt-3 space-y-2 border-l-2 border-green-200 pl-4 text-sm">
            {record.followUps.map(item => <li key={item.id}><FollowUpBadge status={item.outcome} /> <span className="text-slate-500">{when(item.timestamp)} · {item.workerId}</span><p className="text-slate-800">{item.notes}</p></li>)}
          </ol>
        ) : <p className="mt-2 text-sm text-slate-600">No follow-up recorded yet.</p>}
        {user.role !== 'admin' && <FollowUpForm record={record} />}
      </section>

      <section className="card mb-4 p-5">
        <h2 className="mb-3 text-lg font-bold">EPDS answers</h2>
        {answersVisible ? (
          <table className="w-full text-sm">
            <tbody className="divide-y divide-slate-100">
              {EPDS_QUESTIONS.map(question => {
                const value = record.answers[question.id];
                return <tr key={question.id}><td className="py-2 pr-3 text-slate-500">{question.id}</td><td className="py-2 pr-3">{question.text}</td><td className="py-2 pr-3 text-slate-600">{question.options.find(option => option.value === value)?.label}</td><td className="py-2 text-right font-bold">{value}</td></tr>;
              })}
            </tbody>
          </table>
        ) : (
          <p className="flex items-center gap-2 text-sm text-slate-600"><Lock size={16} aria-hidden="true" /> Item-level answers are only visible to supervisors when a case is escalated (SRS business rule 2).</p>
        )}
      </section>

      <div className="flex flex-wrap gap-2">
        <button type="button" className="btn btn-secondary" onClick={() => { exportCasePdf(record, { includeAnswers: answersVisible }); addAuditLog('CASE_EXPORTED', { screeningId: record.id }, record.id); }}>
          <Download size={18} aria-hidden="true" /> Export referral PDF
        </button>
        {user.role === 'supervisor' && <button type="button" className="btn btn-secondary !text-red-800" onClick={() => setDeleting(true)}><Trash2 size={18} aria-hidden="true" /> Remove record</button>}
      </div>

      {acknowledging && <AcknowledgeModal record={record} onClose={() => setAcknowledging(false)} />}
      {deleting && (
        <Modal title="Remove this record?" onClose={() => setDeleting(false)}>
          <p className="mb-3 text-sm text-slate-700">The record is hidden from the facility but kept on the server with your reason for audit purposes.</p>
          <label className="input-label" htmlFor="delete-reason">Reason (required)</label>
          <input id="delete-reason" className="input-field" value={reason} onChange={event => setReason(event.target.value)} placeholder="e.g. Duplicate registration of IKJ/2026/0412" />
          {error && <p role="alert" className="mt-2 text-sm font-semibold text-red-800">{error}</p>}
          <div className="mt-4 flex gap-2">
            <button type="button" className="btn btn-danger" disabled={!reason.trim()} onClick={async () => {
              try { await softDeleteCase(record.id, reason); navigate('/screenings'); }
              catch (err) { setError(err.message); }
            }}>Remove</button>
            <button type="button" className="btn btn-secondary" onClick={() => setDeleting(false)}>Cancel</button>
          </div>
        </Modal>
      )}
      {isUrgent(record) && !record.hasSelfHarmRisk && <p className="mt-4 text-sm text-slate-600">High score without an Item-10 flag: urgent referral, no supervisor acknowledgement required.</p>}
    </div>
  );
}
