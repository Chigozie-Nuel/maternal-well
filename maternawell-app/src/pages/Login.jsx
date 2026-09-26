import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, Heart, KeyRound, Loader2, UserRound, WifiOff } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { LanguageSelector, useLanguage } from '../context/LanguageContext';

export const homeFor = role => (role === 'supervisor' ? '/supervisor' : role === 'admin' ? '/admin' : '/dashboard');

// Seeded prototype accounts (server/README.md). Remove this list for a real deployment.
const DEMO_ACCOUNTS = [
  ['HW-01', 'Worker01!2026', 'Health worker · Ikeja PHC'],
  ['SUP-01', 'Supervisor01!2026', 'Supervisor · Ikeja PHC'],
  ['ADMIN-01', 'Admin01!2026', 'Administrator · Ikeja PHC'],
  ['HW-02', 'Worker02!2026', 'Health worker · Surulere PHC']
];

export function AuthCard({ title, subtitle, children }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-green-800 to-green-950 p-4">
      <div className="card w-full max-w-md p-6 sm:p-9">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-4 grid h-16 w-16 place-items-center rounded-2xl bg-gradient-to-br from-green-700 to-green-500 shadow-lg">
            <Heart size={32} color="white" aria-hidden="true" />
          </div>
          <h1 className="text-2xl font-extrabold text-slate-900">{title}</h1>
          <p className="mt-1 text-sm text-slate-600">{subtitle}</p>
        </div>
        {children}
      </div>
    </div>
  );
}

const Login = () => {
  const navigate = useNavigate();
  const { login } = useAuth();
  const { t } = useLanguage();
  const [staffId, setStaffId] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const offline = typeof navigator !== 'undefined' && navigator.onLine === false;

  const handleSubmit = async event => {
    event.preventDefault();
    setError('');
    setBusy(true);
    try {
      const user = await login(staffId, password);
      navigate(homeFor(user.role), { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthCard title="Maternawell Nigeria" subtitle="Postnatal depression screening and referral for Primary Health Centres">
      {offline && (
        <p className="mb-4 flex items-center gap-2 rounded-xl bg-slate-100 p-3 text-sm text-slate-700">
          <WifiOff size={16} aria-hidden="true" /> You are offline. You can sign in if you have signed in on this device before.
        </p>
      )}
      <form onSubmit={handleSubmit} noValidate>
        <div className="input-group">
          <label className="input-label" htmlFor="staffId">Staff ID</label>
          <div className="relative">
            <UserRound size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" aria-hidden="true" />
            <input id="staffId" className="input-field !pl-11" autoComplete="username" autoCapitalize="characters" placeholder="e.g. HW-01"
              value={staffId} onChange={event => setStaffId(event.target.value)} required />
          </div>
        </div>
        <div className="input-group">
          <label className="input-label" htmlFor="password">Password</label>
          <div className="relative">
            <KeyRound size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" aria-hidden="true" />
            <input id="password" type="password" className="input-field !pl-11" autoComplete="current-password"
              value={password} onChange={event => setPassword(event.target.value)} required />
          </div>
        </div>
        {error && <p role="alert" className="mb-4 rounded-xl bg-red-50 p-3 text-center text-sm font-semibold text-red-800">{error}</p>}
        <button type="submit" className="btn btn-primary btn-block" disabled={busy}>
          {busy ? <><Loader2 size={18} className="animate-spin" aria-hidden="true" /> Signing in…</> : t('signIn')}
        </button>
      </form>

      <details className="mt-5 rounded-xl bg-slate-50 p-3 text-sm text-slate-700">
        <summary className="cursor-pointer font-semibold">Prototype demo accounts</summary>
        <table className="mt-2 w-full text-left text-xs">
          <tbody>
            {DEMO_ACCOUNTS.map(([id, pass, role]) => (
              <tr key={id}>
                <td className="py-1 pr-2"><button type="button" className="font-mono font-bold text-green-800 underline" onClick={() => { setStaffId(id); setPassword(pass); }}>{id}</button></td>
                <td className="py-1 pr-2 font-mono">{pass}</td>
                <td className="py-1">{role}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>

      <div className="mt-6 border-t border-slate-200 pt-5 text-center">
        <p className="mb-2 text-sm text-slate-600">Are you a new mother? Check privately how you have been feeling.</p>
        <Link to="/self-referral" className="inline-flex min-h-[44px] items-center gap-2 font-bold text-green-800">
          {t('selfCheck')} <ArrowRight size={16} aria-hidden="true" />
        </Link>
        <div className="mt-3 flex items-center justify-center gap-4">
          <LanguageSelector />
          <Link to="/help" className="font-semibold text-green-800 underline">{t('help')}</Link>
        </div>
      </div>
    </AuthCard>
  );
};

export default Login;
