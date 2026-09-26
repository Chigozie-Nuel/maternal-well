import { useEffect, useState } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { CheckCircle, AlertTriangle, AlertCircle, ArrowRight, Download, MapPin, ShieldAlert, Phone, ClipboardList } from 'lucide-react';
import { useScreening } from '../context/ScreeningContext';
import { useAuth } from '../context/AuthContext';
import { FACILITIES } from '../utils/constants';
import { CRISIS_CONTACTS, STATUTORY_DISCLAIMER } from '../config/crisisContacts';
import { exportCasePdf } from '../utils/pdf';
import { Modal } from '../components/ui';

/**
 * Item-10 safety modal (NFR-4). It has no close button and no escape route: the health worker
 * must confirm both safety steps. The flag itself stays open until a supervisor acknowledges it.
 */
function SafetyConfirmModal({ screening, onConfirm }) {
  const [notLeftAlone, setNotLeftAlone] = useState(false);
  const [supervisorInformed, setSupervisorInformed] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const confirm = async () => {
    setBusy(true);
    try { await onConfirm(); }
    catch (err) { setError(err.message); setBusy(false); }
  };
  return (
    <Modal title="Same-day escalation: the mother reported thoughts of self-harm" dismissible={false} tone="danger" labelledBy="safety-title">
      <p className="mb-3 text-sm text-slate-700">
        Item 10 was answered “{['Never', 'Hardly ever', 'Sometimes', 'Yes, quite often'][screening.answers?.[10]] || 'above zero'}”.
        This needs action today regardless of the total score of {screening.score}.
      </p>
      <ol className="mb-4 list-decimal space-y-1 pl-5 text-sm text-slate-800">
        <li>Stay with the mother, or make sure a colleague or trusted relative stays with her.</li>
        <li>Inform the facility supervisor now, in person or by phone.</li>
        <li>Follow the facility's emergency pathway for an immediate psychiatric referral.</li>
      </ol>
      <label className="mb-2 flex min-h-[44px] items-start gap-3 text-sm font-semibold"><input type="checkbox" className="mt-1 h-5 w-5" checked={notLeftAlone} onChange={event => setNotLeftAlone(event.target.checked)} /> The mother is not alone and will not leave the facility alone.</label>
      <label className="mb-4 flex min-h-[44px] items-start gap-3 text-sm font-semibold"><input type="checkbox" className="mt-1 h-5 w-5" checked={supervisorInformed} onChange={event => setSupervisorInformed(event.target.checked)} /> I have informed the facility supervisor.</label>
      <p className="mb-4 text-xs text-slate-600">The case is already in the supervisor's queue. It stays flagged until the supervisor acknowledges it in the app.</p>
      {error && <p role="alert" className="mb-3 rounded-lg bg-red-50 p-2 text-sm text-red-800">{error}</p>}
      <button type="button" className="btn btn-danger btn-block" disabled={!notLeftAlone || !supervisorInformed || busy} onClick={confirm}>Confirm safety steps</button>
    </Modal>
  );
}

const Results = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { getScreeningById, confirmSafety, loaded } = useScreening();
  const { user } = useAuth();
  const screening = getScreeningById(id);
  const safetyPending = Boolean(screening?.hasSelfHarmRisk && !screening.workerSafetyConfirmation && user?.role === 'health_worker');

  useEffect(() => {
    if (!safetyPending) return undefined;
    const warn = event => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [safetyPending]);

  if (!screening || !screening.completed) {
    if (!loaded) return <p className="p-10 text-center text-slate-600">Loading…</p>;
    return (
      <div style={{ padding: '40px', textAlign: 'center' }}>
        <h2>No completed screening record found</h2>
        <button onClick={() => navigate('/dashboard')} className="btn btn-primary" style={{ marginTop: '16px' }}>
          Go to Dashboard
        </button>
      </div>
    );
  }

  const isUrgent = screening.hasSelfHarmRisk || (screening.score !== null && screening.score >= 13);
  const isModerate = !isUrgent && screening.score !== null && screening.score >= 9;
  const isLow = !isUrgent && !isModerate;

  const getRiskColor = () => {
    if (isUrgent) return '#EF5350';
    if (isModerate) return '#FFA726';
    return '#66BB6A';
  };

  const getRiskIcon = () => {
    if (isUrgent) return AlertCircle;
    if (isModerate) return AlertTriangle;
    return CheckCircle;
  };

  const RiskIcon = getRiskIcon();
  const riskColor = getRiskColor();

  // Defect B8 Fix: Render the actual plan stored on the screening rather than re-deriving
  const actions = screening.referralPlan?.actions || screening.referralActions || [];
  const patientName = screening.motherData?.isAnonymous 
    ? 'Anonymous Mother' 
    : (screening.motherData?.name || screening.motherData?.motherName || 'Unnamed Patient');
  const fileNumber = screening.motherData?.fileNumber || screening.id;

  const handleExportPDF = () => exportCasePdf(screening);

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #F8F9FA 0%, #E8F5E9 100%)',
      padding: '20px'
    }}>
      <div className="container" style={{ maxWidth: '800px', paddingTop: '20px' }}>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          {safetyPending && <SafetyConfirmModal screening={screening} onConfirm={() => confirmSafety(screening.id)} />}
          {/* Statutory Disclaimer Banner (NFR-5) */}
          <div style={{
            background: '#FFF8E1',
            border: '1.5px solid #FFE082',
            borderRadius: '12px',
            padding: '12px 16px',
            marginBottom: '20px',
            display: 'flex',
            alignItems: 'center',
            gap: '10px'
          }}>
            <ShieldAlert size={20} color="#F57F17" />
            <span style={{ fontSize: '13px', fontWeight: '600', color: '#E65100' }}>
              {STATUTORY_DISCLAIMER}
            </span>
          </div>

          {/* Result Header */}
          <div className="card" style={{ 
            padding: '32px', 
            marginBottom: '24px',
            border: `3px solid ${riskColor}`,
            background: `${riskColor}0A`
          }}>
            <div style={{ textAlign: 'center', marginBottom: '24px' }}>
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.15, type: 'spring', stiffness: 200 }}
                style={{
                  width: '76px',
                  height: '76px',
                  background: riskColor,
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 16px',
                  boxShadow: `0 8px 16px ${riskColor}40`
                }}
              >
                <RiskIcon size={38} color="white" />
              </motion.div>

              <h1 style={{ fontSize: '26px', fontWeight: '800', color: '#212121', marginBottom: '6px' }}>
                EPDS Screening Complete
              </h1>
              <p style={{ color: '#616161', fontSize: '14px' }}>
                Patient: <strong>{patientName}</strong> • File: <strong>{fileNumber}</strong>
              </p>
              
              <div style={{
                display: 'inline-block',
                padding: '6px 20px',
                background: riskColor,
                borderRadius: '20px',
                marginTop: '12px'
              }}>
                <span style={{ color: 'white', fontWeight: '700', fontSize: '15px' }}>
                  {screening.riskTier?.label || 'Clinical Risk Tier'}
                </span>
              </div>
            </div>

            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: '16px',
              marginTop: '20px',
              padding: '20px',
              background: 'white',
              borderRadius: '16px',
              border: '1px solid #E0E0E0'
            }}>
              <div style={{ textAlign: 'center' }}>
                <p style={{ fontSize: '13px', color: '#757575', marginBottom: '6px', fontWeight: '500' }}>EPDS Score</p>
                <p style={{ fontSize: '34px', fontWeight: '800', color: riskColor }}>{screening.score}</p>
                <p style={{ fontSize: '11px', color: '#757575' }}>out of 30</p>
              </div>
              <div style={{ textAlign: 'center', borderLeft: '1.5px solid #EEEEEE', borderRight: '1.5px solid #EEEEEE' }}>
                <p style={{ fontSize: '13px', color: '#757575', marginBottom: '6px', fontWeight: '500' }}>Risk Tier</p>
                <p style={{ fontSize: '17px', fontWeight: '700', color: '#212121' }}>{screening.riskTier?.label}</p>
                <p style={{ fontSize: '11px', color: '#757575' }}>Nigerian Cutoff ≥ 9</p>
              </div>
              <div style={{ textAlign: 'center' }}>
                <p style={{ fontSize: '13px', color: '#757575', marginBottom: '6px', fontWeight: '500' }}>Item-10 Self-Harm</p>
                <p style={{ 
                  fontSize: '17px', 
                  fontWeight: '700', 
                  color: screening.hasSelfHarmRisk ? '#EF5350' : '#2E7D32' 
                }}>
                  {screening.hasSelfHarmRisk ? 'POSITIVE (ESCALATE)' : 'Negative (0)'}
                </p>
                <p style={{ fontSize: '11px', color: '#757575' }}>Same-day protocol</p>
              </div>
            </div>
          </div>

          {/* Self-Harm Urgent Alert if Positive */}
          {screening.hasSelfHarmRisk && (
            <div className="card" style={{
              padding: '24px',
              marginBottom: '24px',
              border: '2px solid #EF5350',
              background: '#FFEBEE'
            }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '14px' }}>
                <AlertTriangle size={28} color="#C62828" style={{ flexShrink: 0, marginTop: '2px' }} />
                <div>
                  <h3 style={{ fontSize: '17px', fontWeight: '700', color: '#B71C1C', marginBottom: '4px' }}>
                    MANDATORY ESCALATION: Item 10 Self-Harm Ideation Reported
                  </h3>
                  <p style={{ fontSize: '13px', color: '#5D4037', lineHeight: '1.5', marginBottom: '12px' }}>
                    In accordance with the Lagos State PHC MeHPriC protocol: ensure the mother is accompanied by staff or trusted family, do not leave her alone, and inform the Facility Supervisor before the patient leaves the health centre.
                  </p>
                  <div style={{ fontSize: '12px', color: '#C62828', fontWeight: '600' }}>
                    Status: {screening.selfHarmAcknowledged ? '✓ Acknowledged by Supervisor' : '⚠ Action required by Facility Supervisor today'}
                    {screening.escalationDueBy && !screening.selfHarmAcknowledged && ` (due by ${new Date(screening.escalationDueBy).toLocaleTimeString('en-NG', { hour: '2-digit', minute: '2-digit' })})`}
                  </div>
                  <ul className="mt-3 space-y-1 text-sm text-red-950">
                    {CRISIS_CONTACTS.map(contact => (
                      <li key={contact.id} className="flex flex-wrap items-center gap-2">
                        <Phone size={14} aria-hidden="true" /> <strong>{contact.name}:</strong>
                        {contact.verified ? <a href={`tel:${contact.phone}`} className="underline">{contact.phone}</a> : <span className="italic">number pending verification</span>}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          )}

          {/* Recommended Stepped-Care Actions */}
          <div className="card" style={{ padding: '28px', marginBottom: '24px' }}>
            <h2 style={{ fontSize: '18px', fontWeight: '700', color: '#212121', marginBottom: '18px' }}>
              Stepped-Care Referral Protocol (MeHPriC Lagos)
            </h2>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {actions.map((action, index) => (
                <div
                  key={index}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '12px',
                    padding: '14px',
                    background: index === 0 && isUrgent ? '#FFEBEE' : '#F9FBF9',
                    borderRadius: '10px',
                    border: index === 0 && isUrgent ? '1.5px solid #EF5350' : '1px solid #E8F5E9'
                  }}
                >
                  <div style={{
                    width: '24px',
                    height: '24px',
                    background: index === 0 && isUrgent ? '#EF5350' : '#2E7D32',
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    marginTop: '1px'
                  }}>
                    <span style={{ color: 'white', fontSize: '12px', fontWeight: '700' }}>{index + 1}</span>
                  </div>
                  <p style={{ 
                    fontSize: '14px', 
                    color: '#212121',
                    lineHeight: '1.5',
                    fontWeight: index === 0 && isUrgent ? '600' : '400'
                  }}>
                    {action}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Referral Facilities */}
          {(isUrgent || isModerate) && (
            <div className="card" style={{ padding: '28px', marginBottom: '24px' }}>
              <h2 style={{ fontSize: '18px', fontWeight: '700', color: '#212121', marginBottom: '6px' }}>
                Primary Health Centres & Referral Points
              </h2>
              <p style={{ color: '#757575', fontSize: '13px', marginBottom: '18px' }}>
                Lagos State Primary Health Care Board Network
              </p>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '14px' }}>
                {FACILITIES.slice(0, 4).map((facility) => (
                  <div
                    key={facility.id}
                    style={{
                      padding: '14px',
                      border: '1.5px solid #E0E0E0',
                      borderRadius: '12px',
                      background: 'white'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '6px' }}>
                      <h3 style={{ fontSize: '15px', fontWeight: '700', color: '#212121' }}>
                        {facility.name}
                      </h3>
                      <span style={{
                        padding: '2px 8px',
                        background: '#E8F5E9',
                        color: '#2E7D32',
                        borderRadius: '8px',
                        fontSize: '11px',
                        fontWeight: '700'
                      }}>
                        PHC
                      </span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#757575', fontSize: '12px' }}>
                      <MapPin size={14} />
                      {facility.location || facility.lga}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            <motion.button
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
              onClick={handleExportPDF}
              className="btn btn-secondary"
              style={{ flex: 1, minWidth: '160px' }}
            >
              <Download size={18} />
              Export Medical PDF
            </motion.button>
            
            <Link to={`/cases/${screening.id}`} className="btn btn-secondary" style={{ flex: 1, minWidth: '180px' }}>
              <ClipboardList size={18} aria-hidden="true" /> Record referral follow-up
            </Link>
            <motion.button
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
              onClick={() => navigate('/dashboard')}
              className="btn btn-primary"
              style={{ flex: 2, minWidth: '200px' }}
            >
              Return to Case Dashboard
              <ArrowRight size={18} style={{ marginLeft: '6px' }} />
            </motion.button>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default Results;
