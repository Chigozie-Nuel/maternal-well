import { Component, lazy, Suspense, useEffect } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ScreeningProvider } from './context/ScreeningContext';
import { LanguageProvider } from './context/LanguageContext';
import AppLayout from './components/AppLayout';
import ContextHelp from './components/ContextHelp';
import Onboarding from './components/Onboarding';
import { flushSelfReferrals } from './db/sync';
import Login, { homeFor } from './pages/Login';
import LockScreen from './pages/LockScreen';

const Dashboard = lazy(() => import('./pages/Dashboard'));
const MotherInfoForm = lazy(() => import('./pages/MotherInfoForm'));
const ScreeningQuestion = lazy(() => import('./pages/ScreeningQuestion'));
const Results = lazy(() => import('./pages/Results'));
const CaseList = lazy(() => import('./pages/CaseList'));
const CaseDetail = lazy(() => import('./pages/CaseDetail'));
const SupervisorDashboard = lazy(() => import('./pages/SupervisorDashboard'));
const AdminAudit = lazy(() => import('./pages/AdminAudit'));
const SelfReferralPage = lazy(() => import('./pages/SelfReferralPage'));
const Help = lazy(() => import('./pages/Help'));

const Loading = () => (
  <div className="grid min-h-screen place-items-center" role="status">
    <span className="text-sm font-medium text-slate-600">Loading Maternawell…</span>
  </div>
);

/** Keeps a rendering error from taking down a whole shift (NFR-3). Saved work is untouched. */
class ErrorBoundary extends Component {
  state = { error: null };
  static getDerivedStateFromError(error) { return { error }; }
  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="grid min-h-screen place-items-center p-6">
        <div className="card max-w-md p-6 text-center">
          <h1 className="mb-2 text-xl font-bold">Something went wrong on this screen</h1>
          <p className="mb-4 text-sm text-slate-600">Your saved screenings and answers are safe on this device. Reload to continue.</p>
          <button type="button" className="btn btn-primary" onClick={() => window.location.assign('/')}>Reload</button>
        </div>
      </div>
    );
  }
}

/** Requires an unlocked session and one of `roles`. */
function Protected({ roles, bare = false, children }) {
  const { status, user } = useAuth();
  if (status === 'signed_out') return <Navigate to="/login" replace />;
  if (status === 'locked') return <LockScreen />;
  if (roles && !roles.includes(user.role)) return <Navigate to={homeFor(user.role)} replace />;
  return bare ? children : <AppLayout>{children}</AppLayout>;
}

function PublicOnly({ children }) {
  const { status, user } = useAuth();
  if (status === 'ready') return <Navigate to={homeFor(user.role)} replace />;
  if (status === 'locked') return <LockScreen />;
  return children;
}

function Home() {
  const { status, user } = useAuth();
  return <Navigate to={status === 'signed_out' ? '/login' : homeFor(user.role)} replace />;
}

function Shell() {
  const { user, isAuthenticated } = useAuth();

  // Deliver self-referrals queued on this phone while it was offline, even if no staff member signs in.
  useEffect(() => {
    const send = () => flushSelfReferrals().catch(() => {});
    send();
    window.addEventListener('online', send);
    return () => window.removeEventListener('online', send);
  }, []);

  const HW = ['health_worker'];
  const STAFF = ['health_worker', 'supervisor'];
  return (
    <>
      <Suspense fallback={<Loading />}>
        <Routes>
          <Route path="/login" element={<PublicOnly><Login /></PublicOnly>} />
          <Route path="/self-referral" element={<SelfReferralPage />} />
          <Route path="/help" element={<Help />} />
          <Route path="/dashboard" element={<Protected roles={HW}><Dashboard /></Protected>} />
          <Route path="/new-screening" element={<Protected roles={HW}><MotherInfoForm /></Protected>} />
          <Route path="/screening/:id" element={<Protected roles={HW} bare><ScreeningQuestion /></Protected>} />
          <Route path="/results/:id" element={<Protected roles={STAFF} bare><Results /></Protected>} />
          <Route path="/screenings" element={<Protected roles={STAFF}><CaseList /></Protected>} />
          <Route path="/cases/:id" element={<Protected roles={STAFF}><CaseDetail /></Protected>} />
          <Route path="/supervisor" element={<Protected roles={['supervisor']}><SupervisorDashboard /></Protected>} />
          <Route path="/admin" element={<Protected roles={['admin']}><AdminAudit /></Protected>} />
          <Route path="*" element={<Home />} />
        </Routes>
      </Suspense>
      <ContextHelp />
      {isAuthenticated && <Onboarding user={user} />}
    </>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <LanguageProvider>
          <AuthProvider>
            <ScreeningProvider>
              <Shell />
            </ScreeningProvider>
          </AuthProvider>
        </LanguageProvider>
      </BrowserRouter>
    </ErrorBoundary>
  );
}
