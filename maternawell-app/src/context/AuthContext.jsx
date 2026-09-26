import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { apiRequest, ApiError, NetworkError } from '../config/api';
import { createKeyCheck, deriveKey, generateSalt, getSessionKey, setSessionKey, verifyKeyCheck, wipeSession } from '../utils/crypto';
import { getSyncState, markAuthRestored } from '../db/sync';

/**
 * Staff authentication (SRS FR-14).
 *
 * - Online: credentials are checked by the server, which returns the account's role and facility.
 * - Offline: a staff member who has signed in on this device before can sign in again; the
 *   password is verified by decrypting a key-check envelope (no password hash is stored).
 * - The encryption key only exists in memory. After a reload or 10 idle minutes the session is
 *   "locked" and the password must be re-entered; drafts and queued work are kept.
 */
const AuthContext = createContext(null);
const SESSION_KEY = 'maternawell_session';
const accountKey = staffId => `maternawell_account_${staffId.toUpperCase()}`;

const readJson = key => {
  try { return JSON.parse(localStorage.getItem(key) || 'null'); } catch { return null; }
};
const writeJson = (key, value) => {
  try { value === null ? localStorage.removeItem(key) : localStorage.setItem(key, JSON.stringify(value)); } catch { /* storage unavailable */ }
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};

async function unlockAccount(staffId, password) {
  const account = readJson(accountKey(staffId));
  if (!account) return null;
  const key = await deriveKey(password, account.salt);
  return (await verifyKeyCheck(account.check, key)) ? { key, account } : null;
}

export const AuthProvider = ({ children }) => {
  const [session, setSession] = useState(() => readJson(SESSION_KEY));
  const [status, setStatus] = useState(() => (readJson(SESSION_KEY) ? (getSessionKey() ? 'ready' : 'locked') : 'signed_out'));

  useEffect(() => {
    const onLocked = () => setStatus(current => (current === 'ready' ? 'locked' : current));
    window.addEventListener('maternawell:locked', onLocked);
    return () => window.removeEventListener('maternawell:locked', onLocked);
  }, []);

  const startSession = (user, token, expiresAt, key) => {
    const next = { user, token, expiresAt, offline: !token };
    writeJson(SESSION_KEY, next);
    setSessionKey(key);
    setSession(next);
    setStatus('ready');
    markAuthRestored();
    return next;
  };

  /** Returns the signed-in user; throws with a user-facing message on failure. */
  const login = useCallback(async (rawStaffId, password) => {
    const staffId = rawStaffId.trim().toUpperCase();
    if (!staffId || !password) throw new Error('Enter your staff ID and password.');
    try {
      const { user, token, expiresAt } = await apiRequest('/api/auth/login', { body: { staffId, password } });
      const existing = readJson(accountKey(staffId));
      let key;
      let account = existing;
      if (existing) key = (await unlockAccount(staffId, password))?.key;
      if (!key) {
        // First sign-in on this device, or the password changed on the server.
        const salt = generateSalt();
        key = await deriveKey(password, salt);
        account = { salt, check: await createKeyCheck(key) };
      }
      writeJson(accountKey(staffId), { ...account, user });
      return startSession(user, token, expiresAt, key).user;
    } catch (error) {
      if (!(error instanceof NetworkError)) {
        throw new Error(error instanceof ApiError && error.status === 401 ? 'Staff ID or password is incorrect.' : error.message);
      }
      const unlocked = await unlockAccount(staffId, password);
      if (!unlocked) {
        throw new Error(readJson(accountKey(staffId))
          ? 'Staff ID or password is incorrect.'
          : 'You are offline. The first sign-in on a device needs an internet connection.');
      }
      return startSession(unlocked.account.user, null, null, unlocked.key).user;
    }
  }, []);

  /** Re-enter the password after an idle lock or reload. Also refreshes an expired token when online. */
  const unlock = useCallback(async password => {
    const staffId = session?.user?.staffId;
    if (!staffId) throw new Error('Please sign in again.');
    const unlocked = await unlockAccount(staffId, password);
    if (!unlocked) throw new Error('Password is incorrect.');
    let { token, expiresAt } = session;
    if (!token || !expiresAt || expiresAt < Date.now() + 60 * 1000 || getSyncState().authExpired) {
      try { ({ token, expiresAt } = await apiRequest('/api/auth/login', { body: { staffId, password } })); }
      catch { /* stay offline-capable; sync resumes after the next online sign-in */ }
    }
    startSession(session.user, token, expiresAt, unlocked.key);
  }, [session]);

  const logout = useCallback(async () => {
    const token = session?.token;
    wipeSession();
    writeJson(SESSION_KEY, null);
    setSession(null);
    setStatus('signed_out');
    if (token) apiRequest('/api/auth/logout', { token, body: {} }).catch(() => {});
  }, [session]);

  const value = useMemo(() => ({
    user: session?.user || null,
    token: session?.token && session.expiresAt > Date.now() ? session.token : null,
    status,
    isAuthenticated: status === 'ready',
    login,
    unlock,
    logout
  }), [session, status, login, unlock, logout]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
