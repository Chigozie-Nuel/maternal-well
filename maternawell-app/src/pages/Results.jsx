import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { CheckCircle, AlertTriangle, AlertCircle, ArrowRight, Phone, MapPin, Calendar } from 'lucide-react';
import { useScreening } from '../context/ScreeningContext';
import { REFERRAL_ACTIONS, FACILITIES } from '../utils/constants';

const Results = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { screenings, currentScreening } = useScreening();

  const screening = screenings.find(s => s.id === id) || currentScreening;

  if (!screening || !screening.completed) {
    return (
      <div style={{ padding: '40px', textAlign: 'center' }}>
        <h2>No results found</h2>
        <button onClick={() => navigate('/dashboard')} className="btn btn-primary">
          Go to Dashboard
        </button>
      </div>
    );
  }

  const isUrgent = screening.hasSelfHarmRisk || screening.score >= 13;
  const isModerate = screening.score >= 9 && screening.score < 13;
  const isLow = screening.score < 9;

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
  const actions = isUrgent ? REFERRAL_ACTIONS.HIGH : isModerate ? REFERRAL_ACTIONS.MEDIUM : REFERRAL_ACTIONS.LOW;

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
          transition={{ duration: 0.5 }}
        >
          {/* Result Header */}
          <div className="card" style={{ 
            padding: '32px', 
            marginBottom: '24px',
            border: `3px solid ${riskColor}`,
            background: `${riskColor}10`
          }}>
            <div style={{ textAlign: 'center', marginBottom: '24px' }}>
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
                style={{
                  width: '80px',
                  height: '80px',
                  background: riskColor,
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 20px'
                }}
              >
                <RiskIcon size={40} color="white" />
              </motion.div>

              <h1 style={{ fontSize: '28px', fontWeight: '700', color: '#212121', marginBottom: '8px' }}>
                Screening Complete
              </h1>
              
              <div style={{
                display: 'inline-block',
                padding: '8px 24px',
                background: riskColor,
                borderRadius: '20px',
                marginTop: '16px'
              }}>
                <span style={{ color: 'white', fontWeight: '600', fontSize: '16px' }}>
                  {screening.riskTier.label}
                </span>
              </div>
            </div>

            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: '16px',
              marginTop: '24px',
              padding: '24px',
              background: 'white',
              borderRadius: '16px'
            }}>
              <div style={{ textAlign: 'center' }}>
                <p style={{ fontSize: '14px', color: '#757575', marginBottom: '8px' }}>EPDS Score</p>
                <p style={{ fontSize: '36px', fontWeight: '700', color: riskColor }}>{screening.score}</p>
                <p style={{ fontSize: '12px', color: '#757575' }}>out of 30</p>
              </div>
              <div style={{ textAlign: 'center', borderLeft: '2px solid #E0E0E0', borderRight: '2px solid #E0E0E0' }}>
                <p style={{ fontSize: '14px', color: '#757575', marginBottom: '8px' }}>Risk Level</p>
                <p style={{ fontSize: '18px', fontWeight: '600', color: '#212121' }}>{screening.riskTier.label}</p>
                <p style={{ fontSize: '12px', color: '#757575' }}>Nigeria cutoff ≥9</p>
              </div>
              <div style={{ textAlign: 'center' }}>
                <p style={{ fontSize: '14px', color: '#757575', marginBottom: '8px' }}>Self-Harm Risk</p>
                <p style={{ 
                  fontSize: '18px', 
                  fontWeight: '600', 
                  color: screening.hasSelfHarmRisk ? '#EF5350' : '#66BB6A' 
                }}>
                  {screening.hasSelfHarmRisk ? 'YES' : 'NO'}
                </p>
                <p style={{ fontSize: '12px', color: '#757575' }}>Item-10 response</p>
              </div>
            </div>
          </div>

          {/* Recommended Actions */}
          <div className="card" style={{ padding: '32px', marginBottom: '24px' }}>
            <h2 style={{ fontSize: '20px', fontWeight: '600', color: '#212121', marginBottom: '24px' }}>
              Recommended Actions
            </h2>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {actions.map((action, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.1 }}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '12px',
                    padding: '16px',
                    background: index === 0 && isUrgent ? '#FFEBEE' : '#F8F9FA',
                    borderRadius: '12px',
                    border: index === 0 && isUrgent ? '2px solid #EF5350' : 'none'
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
                    marginTop: '2px'
                  }}>
                    <span style={{ color: 'white', fontSize: '12px', fontWeight: '700' }}>{index + 1}</span>
                  </div>
                  <p style={{ 
                    fontSize: '15px', 
                    color: '#212121',
                    lineHeight: '1.5',
                    fontWeight: index === 0 && isUrgent ? '600' : '400'
                  }}>
                    {action}
                  </p>
                </motion.div>
              ))}
            </div>
          </div>

          {/* Referral Facilities */}
          {(isUrgent || isModerate) && (
            <div className="card" style={{ padding: '32px', marginBottom: '24px' }}>
              <h2 style={{ fontSize: '20px', fontWeight: '600', color: '#212121', marginBottom: '8px' }}>
                Nearby Referral Facilities
              </h2>
              <p style={{ color: '#757575', fontSize: '14px', marginBottom: '24px' }}>
                Based on Lagos State PHC network
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {FACILITIES.slice(0, 4).map((facility, index) => (
                  <motion.div
                    key={facility.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.1 }}
                    style={{
                      padding: '16px',
                      border: '2px solid #E0E0E0',
                      borderRadius: '12px',
                      transition: 'all 0.3s ease'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = '#2E7D32';
                      e.currentTarget.style.background = '#E8F5E9';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = '#E0E0E0';
                      e.currentTarget.style.background = 'white';
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                      <h3 style={{ fontSize: '16px', fontWeight: '600', color: '#212121' }}>
                        {facility.name}
                      </h3>
                      <span style={{
                        padding: '4px 12px',
                        background: facility.type === 'Tertiary' ? '#E3F2FD' : '#FFF3E0',
                        color: facility.type === 'Tertiary' ? '#1976D2' : '#F57C00',
                        borderRadius: '12px',
                        fontSize: '12px',
                        fontWeight: '600'
                      }}>
                        {facility.type}
                      </span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#757575', fontSize: '14px', marginBottom: '4px' }}>
                      <MapPin size={16} />
                      {facility.location}
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          )}

          {/* Patient Info Summary */}
          <div className="card" style={{ padding: '32px', marginBottom: '24px' }}>
            <h2 style={{ fontSize: '20px', fontWeight: '600', color: '#212121', marginBottom: '16px' }}>
              Patient Information
            </h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px' }}>
              <div>
                <p style={{ fontSize: '13px', color: '#757575', marginBottom: '4px' }}>Name</p>
                <p style={{ fontSize: '16px', fontWeight: '600', color: '#212121' }}>{screening.motherData.motherName}</p>
              </div>
              <div>
                <p style={{ fontSize: '13px', color: '#757575', marginBottom: '4px' }}>Age</p>
                <p style={{ fontSize: '16px', fontWeight: '600', color: '#212121' }}>{screening.motherData.age} years</p>
              </div>
              <div>
                <p style={{ fontSize: '13px', color: '#757575', marginBottom: '4px' }}>Weeks Postpartum</p>
                <p style={{ fontSize: '16px', fontWeight: '600', color: '#212121' }}>{screening.motherData.weeksPostpartum} weeks</p>
              </div>
              <div>
                <p style={{ fontSize: '13px', color: '#757575', marginBottom: '4px' }}>Screening Date</p>
                <p style={{ fontSize: '16px', fontWeight: '600', color: '#212121' }}>
                  {new Date(screening.completedAt).toLocaleDateString('en-NG', { 
                    day: 'numeric', 
                    month: 'long', 
                    year: 'numeric' 
                  })}
                </p>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => {
                window.print();
              }}
              className="btn btn-secondary"
              style={{ flex: 1 }}
            >
              Print Report
            </motion.button>
            
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => navigate('/dashboard')}
              className="btn btn-primary"
              style={{ flex: 2 }}
            >
              Return to Dashboard
              <ArrowRight size={20} style={{ marginLeft: '8px' }} />
            </motion.button>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default Results;
