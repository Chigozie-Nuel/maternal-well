import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { LogIn, Shield, Heart } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const Login = () => {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [formData, setFormData] = useState({
    staffId: '',
    password: '',
    facilityName: ''
  });
  const [error, setError] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    
    if (!formData.staffId || !formData.password || !formData.facilityName) {
      setError('Please fill in all fields');
      return;
    }

    // Mock authentication - in production this would validate against backend
    const user = {
      staffId: formData.staffId,
      name: `Health Worker ${formData.staffId}`,
      facility: formData.facilityName,
      role: 'health_worker',
      loginTime: new Date().toISOString()
    };

    login(user);
    navigate('/dashboard');
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(135deg, #2E7D32 0%, #4CAF50 100%)',
      padding: '20px'
    }}>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="card"
        style={{
          width: '100%',
          maxWidth: '450px',
          padding: '40px'
        }}
      >
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
            style={{
              width: '80px',
              height: '80px',
              background: 'linear-gradient(135deg, #2E7D32, #4CAF50)',
              borderRadius: '20px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 20px'
            }}
          >
            <Heart size={40} color="white" />
          </motion.div>
          
          <h1 style={{
            fontSize: '28px',
            fontWeight: '700',
            color: '#212121',
            marginBottom: '8px'
          }}>
            Maternawell Nigeria
          </h1>
          <p style={{ color: '#757575', fontSize: '14px' }}>
            PPD Screening & Referral System
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="input-group">
            <label className="input-label">Facility Name</label>
            <select
              className="input-field"
              value={formData.facilityName}
              onChange={(e) => setFormData({ ...formData, facilityName: e.target.value })}
              style={{ cursor: 'pointer' }}
            >
              <option value="">Select Facility</option>
              <option value="Lagos University Teaching Hospital (LUTH)">Lagos University Teaching Hospital (LUTH)</option>
              <option value="Lagos State University Teaching Hospital (LASUTH)">Lagos State University Teaching Hospital (LASUTH)</option>
              <option value="Gbagada General Hospital">Gbagada General Hospital</option>
              <option value="Isolo General Hospital">Isolo General Hospital</option>
              <option value="Surulere General Hospital">Surulere General Hospital</option>
              <option value="Badagry General Hospital">Badagry General Hospital</option>
              <option value="Epe General Hospital">Epe General Hospital</option>
              <option value="Ikorodo General Hospital">Ikorodo General Hospital</option>
            </select>
          </div>

          <div className="input-group">
            <label className="input-label">Staff ID</label>
            <div style={{ position: 'relative' }}>
              <LogIn 
                size={20} 
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
                placeholder="Enter your Staff ID"
                value={formData.staffId}
                onChange={(e) => setFormData({ ...formData, staffId: e.target.value })}
                style={{ paddingLeft: '48px' }}
              />
            </div>
          </div>

          <div className="input-group">
            <label className="input-label">Password</label>
            <div style={{ position: 'relative' }}>
              <Shield 
                size={20} 
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
                placeholder="Enter your password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                style={{ paddingLeft: '48px' }}
              />
            </div>
          </div>

          {error && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              style={{
                color: '#EF5350',
                fontSize: '14px',
                marginBottom: '16px',
                textAlign: 'center'
              }}
            >
              {error}
            </motion.p>
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
            Sign In
          </motion.button>
        </form>

        <div style={{
          marginTop: '24px',
          paddingTop: '24px',
          borderTop: '1px solid #E0E0E0',
          textAlign: 'center'
        }}>
          <p style={{ fontSize: '12px', color: '#757575' }}>
            For anonymous self-referral, please speak to a health worker at your facility.
          </p>
        </div>
      </motion.div>
    </div>
  );
};

export default Login;
