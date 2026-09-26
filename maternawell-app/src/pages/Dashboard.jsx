import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
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
  Clock,
  ShieldCheck,
  Search,
  Wifi,
  WifiOff,
  RefreshCw,
  Heart,
  ShieldAlert
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useScreening } from '../context/ScreeningContext';
import ScreeningCard from '../components/ScreeningCard';
import SyncStatusChip from '../components/SyncStatusChip';
import { STATUTORY_DISCLAIMER } from '../config/crisisContacts';

const Dashboard = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { 
    screenings, 
    getStats, 
    activeDraft,
    resumeDraft,
    discardDraft,
    deleteScreening, 
    saveReferralOutcome 
  } = useScreening();

  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [selectedScreening, setSelectedScreening] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterRisk, setFilterRisk] = useState('ALL');
  const [isSyncing, setIsSyncing] = useState(false);

  const stats = getStats();
  const pendingSyncCount = screenings.filter(s => s.syncStatus === 'pending').length;

  const handleSyncClick = async () => {
    setIsSyncing(true);
    await performSync();
    setIsSyncing(false);
  };

  const handleViewScreening = (screening) => {
    setSelectedScreening(screening);
    setShowModal(true);
  };

  const handleDelete = (id) => {
    if (window.confirm('Are you sure you want to delete this screening record? This action is logged for clinical auditing.')) {
      deleteScreening(id);
    }
  };

  const filteredScreenings = screenings.filter(s => {
    const nameMatch = (s.motherData?.name || s.motherData?.motherName || '').toLowerCase().includes(searchTerm.toLowerCase());
    const fileMatch = (s.motherData?.fileNumber || s.anonymousCode || s.id || '').toLowerCase().includes(searchTerm.toLowerCase());
    const matchesSearch = nameMatch || fileMatch;

    if (!matchesSearch) return false;

    if (filterRisk === 'ALL') return true;
    if (filterRisk === 'URGENT') return s.hasSelfHarmRisk || (s.score !== null && s.score >= 13);
    if (filterRisk === 'HIGH') return s.riskTier?.tier === 'high' || s.riskTier?.label === 'High Risk';
    if (filterRisk === 'MODERATE') return s.riskTier?.tier === 'moderate' || s.riskTier?.label === 'Moderate Risk';
    if (filterRisk === 'LOW') return s.riskTier?.tier === 'low' || s.riskTier?.label === 'Low Risk';
    return true;
  });

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
      label: 'Supervisor Queue',
      icon: ShieldCheck,
      onClick: () => navigate('/supervisor')
    },
    {
      label: 'Self-Check Portal',
      icon: Heart,
      onClick: () => navigate('/self-referral')
    }
  ];

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
      title: 'Moderate Risk (≥9)',
      value: stats.moderateRisk,
      icon: TrendingUp,
      color: '#FFA726',
      bgColor: '#FFF3E0'
    },
    {
      title: 'Low Risk (0–8)',
      value: stats.lowRisk,
      icon: CheckCircle,
      color: '#66BB6A',
      bgColor: '#E8F5E9'
    }
  ];

  return (
    <div className={`dashboard-shell ${sidebarOpen ? 'sidebar-open' : 'sidebar-collapsed'}`}>
      {/* Sidebar - Preserved layout from Phase 0 commit e3ce41f */}
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
                <h1>Maternawell</h1>
                <p>Nigeria • PHC</p>
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
              <p className="sidebar-user-name">{user?.name || 'Health Worker'}</p>
              <p className="sidebar-user-facility">{user?.facility || 'Primary Health Centre'}</p>
            </div>
          ) : (
            <div className="sidebar-user-compact" title={`${user?.name || 'Worker'} - ${user?.facility || 'Facility'}`}>
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

      {/* Main Content Area */}
      <main className="dashboard-main">
        {/* Top Header */}
        <header style={{
          background: 'white',
          padding: '16px 28px',
          borderBottom: '1px solid #E0E0E0',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          position: 'sticky',
          top: 0,
          zIndex: 10
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div>
              <h1 style={{ fontSize: '20px', fontWeight: '800', color: '#212121', lineHeight: '1.2' }}>
                Primary Health Centre Dashboard
              </h1>
              <p style={{ fontSize: '12px', color: '#757575' }}>
                {user?.facility || 'Lagos State Primary Health Care Board'} • Cutoff ≥ 9 validated
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <SyncStatusChip />

            <button
              onClick={() => navigate('/new-screening')}
              className="btn btn-primary"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '10px 18px',
                fontSize: '13px'
              }}
            >
              <PlusCircle size={18} />
              <span>New Screening</span>
            </button>
          </div>
        </header>

        {/* Dashboard Body */}
        <div style={{ padding: '28px' }}>
          {/* Active Screening Draft Banner (Defect B9) */}
          {activeDraft && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              style={{
                background: '#F0FDF4',
                border: '2px solid #22C55E',
                borderRadius: '12px',
                padding: '16px 20px',
                marginBottom: '24px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '16px',
                boxShadow: '0 2px 8px rgba(34, 197, 94, 0.12)'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                <div style={{
                  background: '#15803D',
                  color: 'white',
                  borderRadius: '10px',
                  padding: '10px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <Clock size={22} />
                </div>
                <div>
                  <h3 style={{ fontSize: '15px', fontWeight: '700', color: '#14532D', margin: 0 }}>
                    Resume screening for {activeDraft.motherData?.name || 'In-Progress Patient'}
                  </h3>
                  <p style={{ fontSize: '13px', color: '#166534', margin: '4px 0 0 0' }}>
                    File No: <strong>{activeDraft.motherData?.fileNumber || 'N/A'}</strong> • Progress: Question {activeDraft.currentQuestion || 1} of 10 • Answers saved locally
                  </p>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <button
                  onClick={() => {
                    resumeDraft(activeDraft);
                    navigate(`/screening/${activeDraft.id}`);
                  }}
                  style={{
                    background: '#15803D',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    padding: '8px 16px',
                    fontSize: '13px',
                    fontWeight: '600',
                    cursor: 'pointer'
                  }}
                >
                  Resume Screening
                </button>
                <button
                  onClick={() => {
                    if (window.confirm('Are you sure you want to discard this in-progress screening draft?')) {
                      discardDraft(activeDraft.id);
                    }
                  }}
                  style={{
                    background: 'white',
                    color: '#4B5563',
                    border: '1px solid #D1D5DB',
                    borderRadius: '8px',
                    padding: '8px 14px',
                    fontSize: '13px',
                    fontWeight: '500',
                    cursor: 'pointer'
                  }}
                >
                  Discard
                </button>
              </div>
            </motion.div>
          )}

          {/* Statutory Disclaimer Reminder */}
          <div style={{
            background: '#FFF8E1',
            border: '1px solid #FFE082',
            borderRadius: '10px',
            padding: '10px 16px',
            marginBottom: '24px',
            fontSize: '12px',
            color: '#E65100',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <ShieldAlert size={16} />
            <span>{STATUTORY_DISCLAIMER}</span>
          </div>

          {/* Stats KPI Cards */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: '18px',
            marginBottom: '28px'
          }}>
            {statCards.map((stat, index) => {
              const Icon = stat.icon;
              return (
                <motion.div
                  key={stat.title}
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="card"
                  style={{ padding: '20px' }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <p style={{ fontSize: '13px', color: '#757575', marginBottom: '4px', fontWeight: '500' }}>{stat.title}</p>
                      <p style={{ fontSize: '28px', fontWeight: '800', color: '#212121' }}>{stat.value}</p>
                    </div>
                    <div style={{
                      width: '46px',
                      height: '46px',
                      background: stat.bgColor,
                      borderRadius: '12px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}>
                      <Icon size={22} color={stat.color} />
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>

          {/* Screening Management Section */}
          <div className="card" style={{ padding: '24px' }}>
            <div style={{
              display: 'flex',
              flexWrap: 'wrap',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: '16px',
              marginBottom: '20px'
            }}>
              <div>
                <h2 style={{ fontSize: '18px', fontWeight: '700', color: '#212121' }}>
                  Facility Screening Cases
                </h2>
                <p style={{ fontSize: '12px', color: '#757575' }}>
                  {filteredScreenings.length} of {screenings.length} recorded patient screenings
                </p>
              </div>

              {/* Search and Filters */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                <div style={{ position: 'relative', width: '240px' }}>
                  <Search size={16} color="#9E9E9E" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Search name or file #"
                    style={{
                      width: '100%',
                      padding: '8px 12px 8px 36px',
                      fontSize: '13px',
                      border: '1.5px solid #E0E0E0',
                      borderRadius: '8px',
                      outline: 'none'
                    }}
                  />
                  {searchTerm && (
                    <button
                      onClick={() => setSearchTerm('')}
                      style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#9E9E9E' }}
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>

                <div style={{ display: 'flex', gap: '4px', background: '#F1F3F4', padding: '3px', borderRadius: '8px' }}>
                  {['ALL', 'URGENT', 'HIGH', 'MODERATE', 'LOW'].map((risk) => (
                    <button
                      key={risk}
                      onClick={() => setFilterRisk(risk)}
                      style={{
                        padding: '4px 10px',
                        border: 'none',
                        borderRadius: '6px',
                        fontSize: '11px',
                        fontWeight: '700',
                        cursor: 'pointer',
                        background: filterRisk === risk ? 'white' : 'transparent',
                        color: filterRisk === risk ? '#2E7D32' : '#616161',
                        boxShadow: filterRisk === risk ? '0 1px 3px rgba(0,0,0,0.1)' : 'none'
                      }}
                    >
                      {risk}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Screening Cards Grid */}
            {filteredScreenings.length === 0 ? (
              <div style={{
                textAlign: 'center',
                padding: '48px 20px',
                color: '#757575',
                border: '2px dashed #E0E0E0',
                borderRadius: '12px'
              }}>
                <FileText size={42} color="#BDBDBD" style={{ margin: '0 auto 12px' }} />
                <p style={{ fontSize: '15px', fontWeight: '600', color: '#424242', marginBottom: '4px' }}>
                  {screenings.length === 0 ? 'No screenings recorded yet' : 'No screenings match your search filters'}
                </p>
                <p style={{ fontSize: '13px', color: '#757575', marginBottom: '16px' }}>
                  Administer an EPDS questionnaire to begin patient tracking.
                </p>
                <button onClick={() => navigate('/new-screening')} className="btn btn-primary" style={{ padding: '8px 18px', fontSize: '13px' }}>
                  <PlusCircle size={16} />
                  Start First Screening
                </button>
              </div>
            ) : (
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
                gap: '16px'
              }}>
                {filteredScreenings.map((screening) => (
                  <ScreeningCard
                    key={screening.id}
                    screening={screening}
                    onView={handleViewScreening}
                    onDelete={handleDelete}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Patient Detail Modal */}
      <AnimatePresence>
        {showModal && selectedScreening && (
          <div style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.5)',
            zIndex: 60,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px'
          }}>
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="card"
              style={{
                width: '100%',
                maxWidth: '560px',
                maxHeight: '90vh',
                overflowY: 'auto',
                padding: '28px'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                <div>
                  <h3 style={{ fontSize: '18px', fontWeight: '800', color: '#212121' }}>
                    {selectedScreening.motherData?.isAnonymous ? 'Anonymous Mother' : (selectedScreening.motherData?.name || selectedScreening.motherData?.motherName || 'Patient Record')}
                  </h3>
                  <p style={{ fontSize: '12px', color: '#757575' }}>
                    File Number: <strong>{selectedScreening.motherData?.fileNumber || selectedScreening.id}</strong>
                  </p>
                </div>
                <button
                  onClick={() => setShowModal(false)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#757575' }}
                >
                  <X size={20} />
                </button>
              </div>

              <div style={{
                padding: '14px',
                borderRadius: '10px',
                background: selectedScreening.hasSelfHarmRisk ? '#FFEBEE' : '#F9FBF9',
                border: `1.5px solid ${selectedScreening.hasSelfHarmRisk ? '#EF5350' : '#E0E0E0'}`,
                marginBottom: '16px'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <span style={{ fontSize: '13px', color: '#616161' }}>EPDS Score:</span>
                  <span style={{ fontSize: '15px', fontWeight: '800', color: '#212121' }}>{selectedScreening.score} / 30</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <span style={{ fontSize: '13px', color: '#616161' }}>Risk Classification:</span>
                  <span style={{ fontSize: '13px', fontWeight: '700', color: selectedScreening.riskTier?.color || '#2E7D32' }}>
                    {selectedScreening.riskTier?.label}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '13px', color: '#616161' }}>Item-10 Self-Harm:</span>
                  <span style={{ fontSize: '13px', fontWeight: '700', color: selectedScreening.hasSelfHarmRisk ? '#EF5350' : '#2E7D32' }}>
                    {selectedScreening.hasSelfHarmRisk ? 'POSITIVE (ESCALATED)' : 'Negative (0)'}
                  </span>
                </div>
              </div>

              {/* Referral Actions */}
              <div style={{ marginBottom: '18px' }}>
                <h4 style={{ fontSize: '14px', fontWeight: '700', color: '#212121', marginBottom: '8px' }}>
                  Stepped-Care Action Plan
                </h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {(selectedScreening.referralPlan?.actions || selectedScreening.referralActions || []).map((action, i) => (
                    <div key={i} style={{ fontSize: '12px', color: '#424242', padding: '6px 10px', background: '#F5F5F5', borderRadius: '6px' }}>
                      • {action}
                    </div>
                  ))}
                </div>
              </div>

              {/* Update Follow-up Status */}
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', color: '#212121', marginBottom: '6px' }}>
                  Update Referral Follow-Up Status (FR-10)
                </label>
                <select
                  value={selectedScreening.referralOutcome || 'pending'}
                  onChange={(e) => {
                    saveReferralOutcome(selectedScreening.id, e.target.value);
                    setSelectedScreening(prev => ({ ...prev, referralOutcome: e.target.value }));
                  }}
                  className="input-field"
                  style={{ padding: '10px 14px', fontSize: '13px' }}
                >
                  <option value="pending">Pending Follow-up</option>
                  <option value="contacted">Patient Contacted</option>
                  <option value="completed">Referral Completed</option>
                  <option value="lost_to_follow_up">Lost to Follow-up</option>
                </select>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button
                  onClick={() => setShowModal(false)}
                  className="btn btn-secondary"
                  style={{ padding: '8px 16px', fontSize: '13px' }}
                >
                  Close
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Dashboard;
