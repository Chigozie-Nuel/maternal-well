import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { UserPlus, ArrowRight, AlertCircle, ShieldCheck } from 'lucide-react';
import { useScreening } from '../context/ScreeningContext';

const MotherInfoForm = () => {
  const navigate = useNavigate();
  const { startScreening } = useScreening();

  const [formData, setFormData] = useState({
    name: '',
    motherName: '',
    fileNumber: `PHC-${Date.now().toString().slice(-6)}`,
    age: '',
    phone: '',
    phoneNumber: '',
    weeksPostpartum: '',
    numberOfChildren: '1',
    hasSupportSystem: 'yes',
    previousMentalHealthHistory: 'no',
    consentGiven: false
  });
  const [error, setError] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    
    const patientName = (formData.name || formData.motherName).trim();
    if (!patientName || !formData.age || formData.weeksPostpartum === '' || !formData.fileNumber.trim()) {
      setError('Please fill in all required patient fields and file number.');
      return;
    }

    const ageNum = parseInt(formData.age, 10);
    if (isNaN(ageNum) || ageNum < 15 || ageNum > 50) {
      setError('Please enter a valid age for maternal screening (15–50 years).');
      return;
    }

    const weeksNum = parseInt(formData.weeksPostpartum, 10);
    if (isNaN(weeksNum) || weeksNum < 0 || weeksNum > 52) {
      setError('Please enter valid weeks postpartum (0–52 weeks).');
      return;
    }

    if (!formData.consentGiven) {
      setError('In accordance with the Nigeria Data Protection Act (NDPA 2023), explicit patient consent must be recorded before proceeding.');
      return;
    }

    const payload = {
      ...formData,
      name: patientName,
      motherName: patientName,
      phone: formData.phone || formData.phoneNumber,
      phoneNumber: formData.phone || formData.phoneNumber,
      consentDate: new Date().toISOString()
    };

    const screening = startScreening(payload);
    navigate(`/screening/${screening.id}`);
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #F8F9FA 0%, #E8F5E9 100%)',
      padding: '20px'
    }}>
      <div className="container" style={{ maxWidth: '640px', paddingTop: '20px' }}>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '12px', 
            marginBottom: '20px' 
          }}>
            <button
              onClick={() => navigate('/dashboard')}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: '8px',
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center'
              }}
              title="Return to Dashboard"
            >
              <ArrowRight size={20} color="#757575" style={{ transform: 'rotate(180deg)' }} />
            </button>
            <h1 style={{ fontSize: '22px', fontWeight: '700', color: '#212121' }}>
              Initiate EPDS Screening
            </h1>
          </div>

          <div className="card" style={{ padding: '32px' }}>
            <div style={{ marginBottom: '24px' }}>
              <div style={{
                width: '56px',
                height: '56px',
                background: 'linear-gradient(135deg, #2E7D32, #4CAF50)',
                borderRadius: '16px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '16px'
              }}>
                <UserPlus size={28} color="white" />
              </div>
              <h2 style={{ fontSize: '20px', fontWeight: '700', color: '#212121', marginBottom: '6px' }}>
                Patient Clinical Intake
              </h2>
              <p style={{ color: '#757575', fontSize: '13px' }}>
                Primary Health Centre record capture prior to administering the 10-item Edinburgh Postnatal Depression Scale.
              </p>
            </div>

            <form onSubmit={handleSubmit}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div className="input-group">
                  <label htmlFor="patient-file-number" className="input-label">PHC File / ID Number *</label>
                  <input
                    id="patient-file-number"
                    type="text"
                    className="input-field"
                    placeholder="e.g. PHC-IKJ-001"
                    value={formData.fileNumber}
                    onChange={(e) => setFormData({ ...formData, fileNumber: e.target.value })}
                    required
                  />
                </div>

                <div className="input-group">
                  <label htmlFor="patient-name" className="input-label">Mother's Full Name *</label>
                  <input
                    id="patient-name"
                    type="text"
                    className="input-field"
                    placeholder="e.g. Amina Bello"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value, motherName: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div className="input-group">
                  <label htmlFor="patient-age" className="input-label">Age (Years) *</label>
                  <input
                    id="patient-age"
                    type="number"
                    className="input-field"
                    placeholder="Years (15–50)"
                    value={formData.age}
                    onChange={(e) => setFormData({ ...formData, age: e.target.value })}
                    min="15"
                    max="50"
                    required
                  />
                </div>

                <div className="input-group">
                  <label htmlFor="patient-weeks" className="input-label">Weeks Postpartum *</label>
                  <input
                    id="patient-weeks"
                    type="number"
                    className="input-field"
                    placeholder="Weeks (0–52)"
                    value={formData.weeksPostpartum}
                    onChange={(e) => setFormData({ ...formData, weeksPostpartum: e.target.value })}
                    min="0"
                    max="52"
                    required
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div className="input-group">
                  <label htmlFor="patient-phone" className="input-label">Contact Phone Number</label>
                  <input
                    id="patient-phone"
                    type="tel"
                    className="input-field"
                    placeholder="080X XXX XXXX"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value, phoneNumber: e.target.value })}
                  />
                </div>

                <div className="input-group">
                  <label htmlFor="patient-children" className="input-label">Number of Children</label>
                  <input
                    id="patient-children"
                    type="number"
                    className="input-field"
                    placeholder="Including newborn"
                    value={formData.numberOfChildren}
                    onChange={(e) => setFormData({ ...formData, numberOfChildren: e.target.value })}
                    min="1"
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div className="input-group">
                  <label htmlFor="patient-support" className="input-label">Family / Partner Support</label>
                  <select
                    id="patient-support"
                    className="input-field"
                    value={formData.hasSupportSystem}
                    onChange={(e) => setFormData({ ...formData, hasSupportSystem: e.target.value })}
                    style={{ cursor: 'pointer' }}
                  >
                    <option value="yes">Yes, strong support</option>
                    <option value="uncertain">Moderate / Uncertain</option>
                    <option value="no">No support system</option>
                  </select>
                </div>

                <div className="input-group">
                  <label htmlFor="patient-history" className="input-label">Previous Mental Health History</label>
                  <select
                    id="patient-history"
                    className="input-field"
                    value={formData.previousMentalHealthHistory}
                    onChange={(e) => setFormData({ ...formData, previousMentalHealthHistory: e.target.value })}
                    style={{ cursor: 'pointer' }}
                  >
                    <option value="no">No known history</option>
                    <option value="yes">Yes - Prior depression</option>
                    <option value="anxiety">Yes - Prior anxiety</option>
                    <option value="other">Yes - Other condition</option>
                  </select>
                </div>
              </div>

              {/* NDPA 2023 Explicit Consent Checkbox */}
              <div style={{
                background: '#F1F8F2',
                border: '1.5px solid #A5D6A7',
                borderRadius: '12px',
                padding: '16px',
                marginBottom: '20px'
              }}>
                <label style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={formData.consentGiven}
                    onChange={(e) => setFormData({ ...formData, consentGiven: e.target.checked })}
                    style={{ marginTop: '3px', width: '18px', height: '18px', cursor: 'pointer' }}
                  />
                  <div style={{ fontSize: '13px', color: '#1B5E20', lineHeight: '1.5' }}>
                    <strong>NDPA 2023 Section 30 Consent:</strong> Patient has been informed that screening responses are confidential health data processed solely for postnatal mental health assessment and referral under the MeHPriC stepped-care protocol.
                  </div>
                </label>
              </div>

              {error && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '12px',
                    background: '#FFEBEE',
                    borderRadius: '8px',
                    marginBottom: '16px',
                    color: '#C62828'
                  }}
                >
                  <AlertCircle size={20} />
                  <span style={{ fontSize: '13px', fontWeight: '500' }}>{error}</span>
                </motion.div>
              )}

              <motion.button
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.99 }}
                type="submit"
                className="btn btn-primary btn-block"
                style={{
                  padding: '16px',
                  fontSize: '15px',
                  fontWeight: '600'
                }}
              >
                Proceed to EPDS Questions
                <ArrowRight size={18} style={{ marginLeft: '8px' }} />
              </motion.button>
            </form>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default MotherInfoForm;
