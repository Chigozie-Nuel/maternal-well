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
  const [sidebarOpen, setSidebarOpen] = useState(true);
  
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

  const navItems = [
    {
      label: 'Dashboard',
      icon: LayoutDashboard,
      active: true,
      onClick: () => navigate('/dashboard')
    },
    {
      label: 'New Screening',
      icon: PlusCircle,
      onClick: () => navigate('/new-screening')
    },
    {
      label: 'All Screenings',
      icon: Users,
      onClick: () => navigate('/screenings')
    }
  ];

  return (
    <div className={`dashboard-shell ${sidebarOpen ? 'sidebar-open' : 'sidebar-collapsed'}`}>
      {/* Sidebar */}
      <motion.aside
        initial={false}
        animate={{ width: sidebarOpen ? 280 : 88 }}
        transition={{ duration: 0.25, ease: 'easeInOut' }}
        className="dashboard-sidebar"
        aria-label="Dashboard navigation"
      >
        <div className="sidebar-brand-row">
          <div className="sidebar-brand">
            <div className="sidebar-brand-icon">
              <FileText size={24} color="white" />
            </div>
            {sidebarOpen && (
              <div className="sidebar-brand-copy">
                <h1>
                Maternawell
                </h1>
                <p>Nigeria</p>
              </div>
            )}
          </div>

          <button
            type="button"
            className="sidebar-toggle"
            onClick={() => setSidebarOpen(prev => !prev)}
            aria-label={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
            title={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
          >
            {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>

        <nav className="sidebar-nav" aria-label="Primary navigation">
          {navItems.map((item) => {
            const Icon = item.icon;

            return (
              <button
                key={item.label}
                onClick={item.onClick}
                className={`sidebar-nav-item ${item.active ? 'active' : ''}`}
                title={!sidebarOpen ? item.label : undefined}
                aria-label={item.label}
              >
                <Icon size={20} />
                {sidebarOpen && <span>{item.label}</span>}
              </button>
            );
          })}
        </nav>

        <div className="sidebar-footer">
          {sidebarOpen ? (
            <div className="sidebar-user-card">
              <p className="sidebar-user-kicker">Logged in as</p>
              <p className="sidebar-user-name">{user?.name}</p>
              <p className="sidebar-user-facility">{user?.facility}</p>
            </div>
          ) : (
            <div className="sidebar-user-compact" title={`${user?.name || 'Health worker'} - ${user?.facility || 'Facility'}`}>
              {user?.staffId?.slice(0, 2).toUpperCase() || 'HW'}
            </div>
          )}

          <button
            className="sidebar-logout"
            onClick={() => {
              logout();
              navigate('/login');
            }}
            title={!sidebarOpen ? 'Logout' : undefined}
            aria-label="Logout"
          >
            <LogOut size={20} />
            {sidebarOpen && <span>Logout</span>}
          </button>
        </div>
      </motion.aside>

      {/* Main Content */}
      <main className="dashboard-main">
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
              onClick={() => setSidebarOpen(prev => !prev)}
              aria-label={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
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
