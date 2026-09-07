import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { UserPlus, ArrowRight, AlertCircle } from 'lucide-react';
import { useScreening } from '../context/ScreeningContext';

const MotherInfoForm = () => {
  const navigate = useNavigate();
  const { startScreening } = useScreening();
  const [formData, setFormData] = useState({
    motherName: '',
    age: '',
    phoneNumber: '',
    weeksPostpartum: '',
    numberOfChildren: '',
    hasSupportSystem: 'yes',
    previousMentalHealthHistory: 'no'
  });
  const [error, setError] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    
    if (!formData.motherName || !formData.age || !formData.weeksPostpartum) {
      setError('Please fill in all required fields');
      return;
    }

    if (parseInt(formData.age) < 15 || parseInt(formData.age) > 50) {
      setError('Please enter a valid age (15-50)');
      return;
    }

    const screening = startScreening(formData);
    navigate(`/screening/${screening.id}`);
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #F8F9FA 0%, #E8F5E9 100%)',
      padding: '20px'
    }}>
      <div className="container" style={{ maxWidth: '600px', paddingTop: '40px' }}>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '12px', 
            marginBottom: '24px' 
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
            >
              <ArrowRight size={20} color="#757575" style={{ transform: 'rotate(180deg)' }} />
            </button>
            <h1 style={{ fontSize: '24px', fontWeight: '700', color: '#212121' }}>
              New Screening
            </h1>
          </div>

          <div className="card" style={{ padding: '32px' }}>
            <div style={{ marginBottom: '24px' }}>
              <div style={{
                width: '60px',
                height: '60px',
                background: 'linear-gradient(135deg, #2E7D32, #4CAF50)',
                borderRadius: '16px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '16px'
              }}>
                <UserPlus size={28} color="white" />
              </div>
              <h2 style={{ fontSize: '20px', fontWeight: '600', color: '#212121', marginBottom: '8px' }}>
                Mother Information
              </h2>
              <p style={{ color: '#757575', fontSize: '14px' }}>
                Please provide the following information before starting the EPDS screening.
              </p>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="input-group">
                <label className="input-label">Mother's Name *</label>
                <input
                  type="text"
                  className="input-field"
                  placeholder="Enter full name"
                  value={formData.motherName}
                  onChange={(e) => setFormData({ ...formData, motherName: e.target.value })}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div className="input-group">
                  <label className="input-label">Age *</label>
                  <input
                    type="number"
                    className="input-field"
                    placeholder="Years"
                    value={formData.age}
                    onChange={(e) => setFormData({ ...formData, age: e.target.value })}
                    min="15"
                    max="50"
                  />
                </div>

                <div className="input-group">
                  <label className="input-label">Weeks Postpartum *</label>
                  <input
                    type="number"
                    className="input-field"
                    placeholder="Weeks"
                    value={formData.weeksPostpartum}
                    onChange={(e) => setFormData({ ...formData, weeksPostpartum: e.target.value })}
                    min="0"
                    max="52"
                  />
                </div>
              </div>

              <div className="input-group">
                <label className="input-label">Phone Number</label>
                <input
                  type="tel"
                  className="input-field"
                  placeholder="080X XXX XXXX"
                  value={formData.phoneNumber}
                  onChange={(e) => setFormData({ ...formData, phoneNumber: e.target.value })}
                />
              </div>

              <div className="input-group">
                <label className="input-label">Number of Children</label>
                <input
                  type="number"
                  className="input-field"
                  placeholder="Including this baby"
                  value={formData.numberOfChildren}
                  onChange={(e) => setFormData({ ...formData, numberOfChildren: e.target.value })}
                  min="1"
                />
              </div>

              <div className="input-group">
                <label className="input-label">Has Family Support System?</label>
                <select
                  className="input-field"
                  value={formData.hasSupportSystem}
                  onChange={(e) => setFormData({ ...formData, hasSupportSystem: e.target.value })}
                  style={{ cursor: 'pointer' }}
                >
                  <option value="yes">Yes</option>
                  <option value="no">No</option>
                  <option value="uncertain">Uncertain</option>
                </select>
              </div>

              <div className="input-group">
                <label className="input-label">Previous Mental Health History?</label>
                <select
                  className="input-field"
                  value={formData.previousMentalHealthHistory}
                  onChange={(e) => setFormData({ ...formData, previousMentalHealthHistory: e.target.value })}
                  style={{ cursor: 'pointer' }}
                >
                  <option value="no">No</option>
                  <option value="yes">Yes - Depression</option>
                  <option value="anxiety">Yes - Anxiety</option>
                  <option value="other">Yes - Other</option>
                </select>
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
                  <span style={{ fontSize: '14px' }}>{error}</span>
                </motion.div>
              )}

              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                type="submit"
                className="btn btn-primary btn-block"
                style={{
                  padding: '16px',
                  fontSize: '16px',
                  fontWeight: '600'
                }}
              >
                Start EPDS Screening
                <ArrowRight size={20} style={{ marginLeft: '8px' }} />
              </motion.button>
            </form>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default MotherInfoForm;
