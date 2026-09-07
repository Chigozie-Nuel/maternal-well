import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
  LayoutDashboard, 
  PlusCircle, 
  FileText, 
  Users, 
  LogOut, 
  Menu, 
  X,
  TrendingUp,
  AlertCircle,
  CheckCircle,
  Clock
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useScreening } from '../context/ScreeningContext';

const Dashboard = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { screenings, getStats } = useScreening();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const stats = getStats();

  const statCards = [
    {
      title: 'Total Screenings',
      value: stats.total,
      icon: FileText,
      color: '#2E7D32',
      bgColor: '#E8F5E9'
    },
    {
      title: 'Urgent Referrals',
      value: stats.urgentReferrals,
      icon: AlertCircle,
      color: '#EF5350',
      bgColor: '#FFEBEE'
    },
    {
      title: 'Moderate Risk',
      value: stats.moderateRisk,
      icon: TrendingUp,
      color: '#FFA726',
      bgColor: '#FFF3E0'
    },
    {
      title: 'Low Risk',
      value: stats.lowRisk,
      icon: CheckCircle,
      color: '#66BB6A',
      bgColor: '#E8F5E9'
    }
  ];

  return (
    <div style={{ minHeight: '100vh', background: '#F8F9FA' }}>
      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div
          onClick={() => setSidebarOpen(false)}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0,0,0,0.5)',
            zIndex: 40,
            display: 'none' // Hidden on desktop
          }}
        />
      )}

      {/* Sidebar */}
      <motion.aside
        initial={false}
        animate={{ x: sidebarOpen ? 0 : '-100%' }}
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '280px',
          height: '100vh',
          background: 'white',
          boxShadow: '2px 0 8px rgba(0,0,0,0.1)',
          zIndex: 50,
          padding: '24px',
          display: 'flex',
          flexDirection: 'column'
        }}
      >
        <div style={{ marginBottom: '32px' }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            marginBottom: '8px'
          }}>
            <div style={{
              width: '40px',
              height: '40px',
              background: 'linear-gradient(135deg, #2E7D32, #4CAF50)',
              borderRadius: '10px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <FileText size={24} color="white" />
            </div>
            <div>
              <h1 style={{ fontSize: '18px', fontWeight: '700', color: '#212121' }}>
                Maternawell
              </h1>
              <p style={{ fontSize: '12px', color: '#757575' }}>Nigeria</p>
            </div>
          </div>
        </div>

        <nav style={{ flex: 1 }}>
          <button
            onClick={() => navigate('/dashboard')}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              padding: '12px 16px',
              background: '#E8F5E9',
              border: 'none',
              borderRadius: '12px',
              cursor: 'pointer',
              marginBottom: '8px',
              color: '#2E7D32',
              fontWeight: '600'
            }}
          >
            <LayoutDashboard size={20} />
            Dashboard
          </button>
          
          <button
            onClick={() => navigate('/new-screening')}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              padding: '12px 16px',
              background: 'transparent',
              border: 'none',
              borderRadius: '12px',
              cursor: 'pointer',
              marginBottom: '8px',
              color: '#757575',
              fontWeight: '500'
            }}
          >
            <PlusCircle size={20} />
            New Screening
          </button>
          
          <button
            onClick={() => navigate('/screenings')}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              padding: '12px 16px',
              background: 'transparent',
              border: 'none',
              borderRadius: '12px',
              cursor: 'pointer',
              marginBottom: '8px',
              color: '#757575',
              fontWeight: '500'
            }}
          >
            <Users size={20} />
            All Screenings
          </button>
        </nav>

        <div style={{ borderTop: '1px solid #E0E0E0', paddingTop: '24px' }}>
          <div style={{
            padding: '16px',
            background: '#F8F9FA',
            borderRadius: '12px',
            marginBottom: '16px'
          }}>
            <p style={{ fontSize: '13px', color: '#757575', marginBottom: '4px' }}>Logged in as</p>
            <p style={{ fontSize: '14px', fontWeight: '600', color: '#212121' }}>{user?.name}</p>
            <p style={{ fontSize: '12px', color: '#757575' }}>{user?.facility}</p>
          </div>
          
          <button
            onClick={() => {
              logout();
              navigate('/login');
            }}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              padding: '12px 16px',
              background: 'transparent',
              border: 'none',
              borderRadius: '12px',
              cursor: 'pointer',
              color: '#EF5350',
              fontWeight: '500'
            }}
          >
            <LogOut size={20} />
            Logout
          </button>
        </div>
      </motion.aside>

      {/* Main Content */}
      <main style={{ marginLeft: '0', paddingLeft: '0' }}>
        {/* Header */}
        <header style={{
          background: 'white',
          padding: '16px 24px',
          boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          position: 'sticky',
          top: 0,
          zIndex: 30
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: '8px',
                borderRadius: '8px',
                display: 'flex'
              }}
            >
              {sidebarOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
            <div>
              <h1 style={{ fontSize: '24px', fontWeight: '700', color: '#212121' }}>
                Dashboard
              </h1>
              <p style={{ fontSize: '14px', color: '#757575' }}>
                {new Date().toLocaleDateString('en-NG', { 
                  weekday: 'long', 
                  year: 'numeric', 
                  month: 'long', 
                  day: 'numeric' 
                })}
              </p>
            </div>
          </div>

          <button
            onClick={() => navigate('/new-screening')}
            className="btn btn-primary"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            <PlusCircle size={20} />
            New Screening
          </button>
        </header>

        {/* Dashboard Content */}
        <div style={{ padding: '24px' }}>
          {/* Stats Grid */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
            gap: '20px',
            marginBottom: '32px'
          }}>
            {statCards.map((stat, index) => {
              const Icon = stat.icon;
              return (
                <motion.div
                  key={stat.title}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className="card"
                  style={{ padding: '24px' }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                    <div>
                      <p style={{ fontSize: '14px', color: '#757575', marginBottom: '8px' }}>{stat.title}</p>
                      <p style={{ fontSize: '32px', fontWeight: '700', color: '#212121' }}>{stat.value}</p>
                    </div>
                    <div style={{
                      width: '50px',
                      height: '50px',
                      background: stat.bgColor,
                      borderRadius: '12px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}>
                      <Icon size={24} color={stat.color} />
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>

          {/* Recent Screenings */}
          <div className="card" style={{ padding: '24px' }}>
            <div style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center',
              marginBottom: '24px'
            }}>
              <h2 style={{ fontSize: '20px', fontWeight: '600', color: '#212121' }}>
                Recent Screenings
              </h2>
              <button
                onClick={() => navigate('/screenings')}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#2E7D32',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: '600'
                }}
              >
                View All →
              </button>
            </div>

            {screenings.length === 0 ? (
              <div style={{
                textAlign: 'center',
                padding: '40px 20px',
                color: '#757575'
              }}>
                <FileText size={48} color="#E0E0E0" style={{ marginBottom: '16px' }} />
                <p style={{ fontSize: '16px', marginBottom: '8px' }}>No screenings yet</p>
                <p style={{ fontSize: '14px' }}>Start your first screening to see results here</p>
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid #E0E0E0' }}>
                      <th style={{ textAlign: 'left', padding: '12px', fontSize: '13px', fontWeight: '600', color: '#757575' }}>Patient</th>
                      <th style={{ textAlign: 'left', padding: '12px', fontSize: '13px', fontWeight: '600', color: '#757575' }}>Date</th>
                      <th style={{ textAlign: 'left', padding: '12px', fontSize: '13px', fontWeight: '600', color: '#757575' }}>Score</th>
                      <th style={{ textAlign: 'left', padding: '12px', fontSize: '13px', fontWeight: '600', color: '#757575' }}>Risk Level</th>
                      <th style={{ textAlign: 'left', padding: '12px', fontSize: '13px', fontWeight: '600', color: '#757575' }}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {screenings.slice(0, 5).map((screening) => (
                      <tr 
                        key={screening.id}
                        style={{ borderBottom: '1px solid #E0E0E0', cursor: 'pointer' }}
                        onClick={() => navigate(`/results/${screening.id}`)}
                      >
                        <td style={{ padding: '16px 12px', fontSize: '14px', fontWeight: '500', color: '#212121' }}>
                          {screening.motherData.motherName}
                        </td>
                        <td style={{ padding: '16px 12px', fontSize: '14px', color: '#757575' }}>
                          {new Date(screening.completedAt).toLocaleDateString('en-NG')}
                        </td>
                        <td style={{ padding: '16px 12px', fontSize: '14px', fontWeight: '600', color: '#212121' }}>
                          {screening.score}/30
                        </td>
                        <td style={{ padding: '16px 12px' }}>
                          <span style={{
                            padding: '4px 12px',
                            background: screening.riskTier.color + '20',
                            color: screening.riskTier.color,
                            borderRadius: '12px',
                            fontSize: '12px',
                            fontWeight: '600'
                          }}>
                            {screening.riskTier.label}
                          </span>
                        </td>
                        <td style={{ padding: '16px 12px' }}>
                          {screening.hasSelfHarmRisk ? (
                            <span style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              padding: '4px 12px',
                              background: '#FFEBEE',
                              color: '#EF5350',
                              borderRadius: '12px',
                              fontSize: '12px',
                              fontWeight: '600'
                            }}>
                              <AlertCircle size={14} />
                              Urgent
                            </span>
                          ) : screening.status === 'referral_needed' ? (
                            <span style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              padding: '4px 12px',
                              background: '#FFF3E0',
                              color: '#F57C00',
                              borderRadius: '12px',
                              fontSize: '12px',
                              fontWeight: '600'
                            }}>
                              <Clock size={14} />
                              Referral
                            </span>
                          ) : (
                            <span style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              padding: '4px 12px',
                              background: '#E8F5E9',
                              color: '#2E7D32',
                              borderRadius: '12px',
                              fontSize: '12px',
                              fontWeight: '600'
                            }}>
                              <CheckCircle size={14} />
                              Complete
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

export default Dashboard;
