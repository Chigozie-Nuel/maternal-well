import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { LogIn, Shield, Heart, UserCheck, ShieldCheck, ArrowRight } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { FACILITIES } from '../utils/constants';
import { deriveKey, generateSalt, setSessionKey } from '../utils/crypto';

const Login = () => {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [formData, setFormData] = useState({
    staffId: '',
    password: '',
    facilityName: FACILITIES[0]?.name || '',
    role: 'health_worker'
  });
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.staffId || !formData.password || !formData.facilityName) {
      setError('Please fill in all credentials and facility selection');
      return;
    }

    try {
      // Derive session crypto key from password via PBKDF2 (>= 210,000 iterations)
      let salt = localStorage.getItem(`maternawell_salt_${formData.staffId}`);
      if (!salt) {
        salt = generateSalt();
        localStorage.setItem(`maternawell_salt_${formData.staffId}`, salt);
      }
      const cryptoKey = await deriveKey(formData.password, salt);
      setSessionKey(cryptoKey, salt);

      const user = {
        id: formData.staffId,
        staffId: formData.staffId,
        name: formData.role === 'supervisor' ? `Supervisor ${formData.staffId}` : `Health Worker ${formData.staffId}`,
        facility: formData.facilityName,
        role: formData.role,
        loginTime: new Date().toISOString()
      };

      login(user);
      if (formData.role === 'supervisor') {
        navigate('/supervisor');
      } else {
        navigate('/dashboard');
      }
    } catch (err) {
      setError('Key derivation failed: ' + err.message);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(135deg, #2E7D32 0%, #1B5E20 100%)',
      padding: '20px'
    }}>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="card"
        style={{
          width: '100%',
          maxWidth: '460px',
          padding: '36px'
        }}
      >
        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.15, type: 'spring', stiffness: 200 }}
            style={{
              width: '72px',
              height: '72px',
              background: 'linear-gradient(135deg, #2E7D32, #4CAF50)',
              borderRadius: '20px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 16px',
              boxShadow: '0 8px 16px rgba(46, 125, 50, 0.25)'
            }}
          >
            <Heart size={36} color="white" />
          </motion.div>
          
          <h1 style={{
            fontSize: '26px',
            fontWeight: '800',
            color: '#212121',
            marginBottom: '4px'
          }}>
            Maternawell Nigeria
          </h1>
          <p style={{ color: '#757575', fontSize: '13px' }}>
            Primary Health Centre EPDS Screening & Stepped-Care
          </p>
        </div>

        {/* Role Switcher */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '8px',
          padding: '4px',
          background: '#F1F3F4',
          borderRadius: '12px',
          marginBottom: '20px'
        }}>
          <button
            type="button"
            onClick={() => setFormData({ ...formData, role: 'health_worker' })}
            style={{
              padding: '10px',
              border: 'none',
              borderRadius: '10px',
              fontSize: '13px',
              fontWeight: '600',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              background: formData.role === 'health_worker' ? 'white' : 'transparent',
              color: formData.role === 'health_worker' ? '#2E7D32' : '#757575',
              boxShadow: formData.role === 'health_worker' ? '0 2px 4px rgba(0,0,0,0.08)' : 'none',
              transition: 'all 0.2s ease'
            }}
          >
            <UserCheck size={16} />
            Health Worker
          </button>
          <button
            type="button"
            onClick={() => setFormData({ ...formData, role: 'supervisor' })}
            style={{
              padding: '10px',
              border: 'none',
              borderRadius: '10px',
              fontSize: '13px',
              fontWeight: '600',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              background: formData.role === 'supervisor' ? 'white' : 'transparent',
              color: formData.role === 'supervisor' ? '#2E7D32' : '#757575',
              boxShadow: formData.role === 'supervisor' ? '0 2px 4px rgba(0,0,0,0.08)' : 'none',
              transition: 'all 0.2s ease'
            }}
          >
            <ShieldCheck size={16} />
            Supervisor
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="input-group">
            <label className="input-label">Primary Health Centre *</label>
            <select
              className="input-field"
              value={formData.facilityName}
              onChange={(e) => setFormData({ ...formData, facilityName: e.target.value })}
              style={{ cursor: 'pointer' }}
              required
            >
              {FACILITIES.map(fac => (
                <option key={fac.id} value={fac.name}>
                  {fac.name} ({fac.lga || fac.location})
                </option>
              ))}
            </select>
          </div>

          <div className="input-group">
            <label className="input-label">Staff ID *</label>
            <div style={{ position: 'relative' }}>
              <LogIn 
                size={18} 
                color="#757575" 
                style={{ 
                  position: 'absolute', 
                  left: '16px', 
                  top: '50%', 
                  transform: 'translateY(-50%)' 
                }} 
              />
              <input
                type="text"
                className="input-field"
                placeholder={formData.role === 'supervisor' ? 'e.g. SUP-01' : 'e.g. HW-01'}
                value={formData.staffId}
                onChange={(e) => setFormData({ ...formData, staffId: e.target.value })}
                style={{ paddingLeft: '46px' }}
                required
              />
            </div>
          </div>

          <div className="input-group">
            <label className="input-label">Password *</label>
            <div style={{ position: 'relative' }}>
              <Shield 
                size={18} 
                color="#757575" 
                style={{ 
                  position: 'absolute', 
                  left: '16px', 
                  top: '50%', 
                  transform: 'translateY(-50%)' 
                }} 
              />
              <input
                type="password"
                className="input-field"
                placeholder="Enter password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                style={{ paddingLeft: '46px' }}
                required
              />
            </div>
          </div>

          {error && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              style={{
                color: '#EF5350',
                fontSize: '13px',
                marginBottom: '16px',
                textAlign: 'center'
              }}
            >
              {error}
            </motion.p>
          )}

          <motion.button
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.99 }}
            type="submit"
            className="btn btn-primary btn-block"
            style={{
              padding: '14px',
              fontSize: '15px',
              fontWeight: '700'
            }}
          >
            Sign In to Facility Portal
          </motion.button>
        </form>

        {/* Anonymous Self-Referral Portal Link */}
        <div style={{
          marginTop: '24px',
          paddingTop: '20px',
          borderTop: '1px solid #EEEEEE',
          textAlign: 'center'
        }}>
          <p style={{ fontSize: '13px', color: '#616161', marginBottom: '10px' }}>
            Are you a new or expecting mother checking your own well-being?
          </p>
          <Link
            to="/self-referral"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              color: '#2E7D32',
              fontWeight: '700',
              fontSize: '14px',
              textDecoration: 'none'
            }}
          >
            <span>Take Private Anonymous Self-Check</span>
            <ArrowRight size={16} />
          </Link>
        </div>
      </motion.div>
    </div>
  );
};

export default Login;
