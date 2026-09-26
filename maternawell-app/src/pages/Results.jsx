import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { CheckCircle, AlertTriangle, AlertCircle, ArrowRight, Download, MapPin, ShieldAlert, Phone } from 'lucide-react';
import { useScreening } from '../context/ScreeningContext';
import { FACILITIES } from '../utils/constants';
import { CRISIS_CONTACTS, STATUTORY_DISCLAIMER } from '../config/crisisContacts';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';

const Results = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { screenings, currentScreening } = useScreening();

  const screening = screenings.find(s => s.id === id) || (currentScreening?.id === id ? currentScreening : null);

  if (!screening || !screening.completed) {
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

  const handleExportPDF = () => {
    const doc = new jsPDF();
    
    doc.setFillColor(46, 125, 50);
    doc.rect(0, 0, 210, 30, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(18);
    doc.text('Maternawell Nigeria - Clinical Screening Report', 105, 14, { align: 'center' });
    doc.setFontSize(11);
    doc.text('Edinburgh Postnatal Depression Scale (EPDS) • Nigerian Cutoff >= 9', 105, 23, { align: 'center' });
    
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(13);
    doc.text('Patient Demographics', 14, 42);
    
    const patientData = [
      ['File / ID Number:', fileNumber],
      ['Patient Name:', patientName],
      ['Age / Postpartum:', `${screening.motherData?.age || 'N/A'} yrs • ${screening.motherData?.weeksPostpartum || 'N/A'} weeks postpartum`],
      ['Phone Number:', screening.motherData?.phone || screening.motherData?.phoneNumber || 'N/A'],
      ['Screening Timestamp:', format(new Date(screening.completedAt || Date.now()), 'PPP p')]
    ];
    
    autoTable(doc, {
      startY: 46,
      body: patientData,
      theme: 'plain',
      styles: { fontSize: 10, cellPadding: 2 },
      columnStyles: { 0: { fontStyle: 'bold', cellWidth: 50 } }
    });
    
    const finalY = doc.lastAutoTable.finalY + 8;
    doc.setFontSize(13);
    doc.text('Assessment & Classification', 14, finalY);
    
    doc.setFontSize(11);
    doc.text(`EPDS Total Score: ${screening.score} / 30`, 14, finalY + 8);
    doc.text(`Risk Tier: ${screening.riskTier?.label || 'N/A'}`, 14, finalY + 15);
    
    if (screening.hasSelfHarmRisk) {
      doc.setTextColor(220, 38, 38);
      doc.setFont(undefined, 'bold');
      doc.text('CRITICAL: Item 10 Self-Harm Ideation Reported (Mandatory Same-Day Escalation)', 14, finalY + 22);
      doc.setFont(undefined, 'normal');
      doc.setTextColor(0, 0, 0);
    }
    
    const actionsY = finalY + (screening.hasSelfHarmRisk ? 32 : 24);
    doc.setFontSize(13);
    doc.text('Stepped-Care Referral Recommendations', 14, actionsY);
    
    doc.setFontSize(10);
    actions.forEach((action, index) => {
      doc.text(`• ${action}`, 14, actionsY + 7 + (index * 6.5));
    });
    
    doc.setFontSize(9);
    doc.setTextColor(198, 40, 40);
    doc.text(STATUTORY_DISCLAIMER, 105, 274, { align: 'center' });
    
    doc.setTextColor(128, 128, 128);
    doc.text(`Generated under MeHPriC Protocol • Confidential Health Record • ${format(new Date(), 'PPP p')}`, 105, 282, { align: 'center' });
    
    doc.save(`maternawell_${fileNumber}.pdf`);
  };

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
                  </div>
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
