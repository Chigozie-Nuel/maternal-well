import { useState } from 'react';
import { Loader2, Lock } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { AuthCard } from './Login';

/** Shown after a reload or 10 idle minutes: the encryption key is gone until the password is re-entered. */
export default function LockScreen() {
  const { user, unlock, logout } = useAuth();
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async event => {
    event.preventDefault();
    setBusy(true);
    setError('');
    try { await unlock(password); }
    catch (err) { setError(err.message); }
    finally { setBusy(false); }
  };

  return (
    <AuthCard title="Session locked" subtitle={`${user?.name} (${user?.staffId}) · ${user?.facility}`}>
      <p className="mb-4 flex items-start gap-2 rounded-xl bg-green-50 p-3 text-sm text-green-900">
        <Lock size={18} className="mt-0.5 shrink-0" aria-hidden="true" />
        Records on this device are encrypted. Enter your password to unlock them. Unsaved screening answers are kept.
      </p>
      <form onSubmit={submit}>
        <div className="input-group">
          <label className="input-label" htmlFor="unlock-password">Password</label>
          <input id="unlock-password" type="password" className="input-field" autoComplete="current-password" autoFocus
            value={password} onChange={event => setPassword(event.target.value)} required />
        </div>
        {error && <p role="alert" className="mb-4 rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-800">{error}</p>}
        <button className="btn btn-primary btn-block" type="submit" disabled={busy}>
          {busy ? <><Loader2 size={18} className="animate-spin" aria-hidden="true" /> Unlocking…</> : 'Unlock'}
        </button>
      </form>
      <button type="button" className="mt-4 w-full min-h-[44px] text-sm font-semibold text-slate-600 underline" onClick={logout}>
        Not you? Sign in as someone else
      </button>
    </AuthCard>
  );
}
