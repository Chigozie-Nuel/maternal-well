import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { apiRequest, ApiError, getApiBase, NetworkError } from '../config/api';
import { createKeyCheck, decryptData, deriveKey, encryptData, generateSalt, getSessionKey, setSessionKey, verifyKeyCheck, wipeSession } from '../utils/crypto';
import { getSyncState, markAuthRestored } from '../db/sync';
import { migrateLegacyForUser } from '../db/db';

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
  const [session, setSession] = useState(() => {
    const saved = readJson(SESSION_KEY);
    if (saved?.token) writeJson(SESSION_KEY, { user: saved.user });
    try { localStorage.removeItem('maternawell_token'); } catch { /* storage unavailable */ }
    return saved?.user ? { user: saved.user } : null;
  });
  const [access, setAccess] = useState(null);
  const [migrationWarning, setMigrationWarning] = useState(null);
  const [status, setStatus] = useState(() => (readJson(SESSION_KEY) ? (getSessionKey() ? 'ready' : 'locked') : 'signed_out'));

  useEffect(() => {
    const onLocked = () => setStatus(current => (current === 'ready' ? 'locked' : current));
    window.addEventListener('maternawell:locked', onLocked);
    return () => window.removeEventListener('maternawell:locked', onLocked);
  }, []);

  const startSession = (user, token, expiresAt, key) => {
    const next = { user };
    writeJson(SESSION_KEY, next);
    setSessionKey(key);
    setSession(next);
    setAccess(token ? { token, expiresAt } : null);
    setStatus('ready');
    if (token) markAuthRestored();
    return next;
  };

  const saveRefresh = async (staffId, key, credentials) => {
    if (!credentials.refreshToken) return;
    const account = readJson(accountKey(staffId));
    writeJson(accountKey(staffId), {
      ...account,
      refresh: await encryptData({ token: credentials.refreshToken, expiresAt: credentials.refreshExpiresAt, server: getApiBase() }, key)
    });
  };

  const recoverLegacy = async (user, password, key) => {
    try {
      const { retained } = await migrateLegacyForUser(user, password, key);
      setMigrationWarning(retained ? `${retained} older record(s) could not be assigned or decrypted and remain on this device for recovery.` : null);
    } catch (error) {
      setMigrationWarning(`Older records remain on this device because import failed: ${error.message}`);
    }
  };

  const renew = useCallback(async () => {
    const staffId = session?.user?.staffId;
    const key = getSessionKey();
    const account = staffId && readJson(accountKey(staffId));
    if (!key || !account?.refresh) throw new Error('Sign in online to restore synchronization. Saved work is still on this device.');
    const stored = await decryptData(account.refresh, key);
    if (stored.server !== undefined && stored.server !== getApiBase()) throw new Error('Facility server changed. Sign in online before synchronizing saved work.');
    if (stored.expiresAt <= Date.now()) throw new Error('Offline session expired. Sign in online to synchronize saved work.');
    try {
      const credentials = await apiRequest('/api/auth/refresh', { body: { refreshToken: stored.token } });
      await saveRefresh(staffId, key, credentials);
      setSession({ user: credentials.user });
      setAccess({ token: credentials.token, expiresAt: credentials.expiresAt });
      markAuthRestored();
      return credentials.token;
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        writeJson(accountKey(staffId), { ...account, refresh: null });
        throw new Error('Session was revoked or expired. Sign in online to synchronize saved work.');
      }
      throw error;
    }
  }, [session]);

  /** Returns the signed-in user; throws with a user-facing message on failure. */
  const login = useCallback(async (rawStaffId, password) => {
    const staffId = rawStaffId.trim().toUpperCase();
    if (!staffId || !password) throw new Error('Enter your staff ID and password.');
    try {
      const credentials = await apiRequest('/api/auth/login', { body: { staffId, password } });
      const { user, token, expiresAt } = credentials;
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
      await saveRefresh(staffId, key, credentials);
      await recoverLegacy(user, password, key);
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
      await recoverLegacy(unlocked.account.user, password, unlocked.key);
      return startSession(unlocked.account.user, null, null, unlocked.key).user;
    }
  }, []);

  /** Re-enter the password after an idle lock or reload. Also refreshes an expired token when online. */
  const unlock = useCallback(async password => {
    const staffId = session?.user?.staffId;
    if (!staffId) throw new Error('Please sign in again.');
    const unlocked = await unlockAccount(staffId, password);
    if (!unlocked) throw new Error('Password is incorrect.');
    let credentials = access;
    if (!credentials?.token || credentials.expiresAt < Date.now() + 60 * 1000 || getSyncState().authExpired) {
      try {
        credentials = await apiRequest('/api/auth/login', { body: { staffId, password } });
        await saveRefresh(staffId, unlocked.key, credentials);
      } catch (error) {
        if (!(error instanceof NetworkError)) throw error;
        credentials = null;
      }
    }
    await recoverLegacy(session.user, password, unlocked.key);
    startSession(session.user, credentials?.token, credentials?.expiresAt, unlocked.key);
  }, [session, access]);

  const logout = useCallback(async () => {
    const token = access?.token;
    const staffId = session?.user?.staffId;
    const account = staffId && readJson(accountKey(staffId));
    let refreshToken = null;
    try { if (account?.refresh && getSessionKey()) refreshToken = (await decryptData(account.refresh, getSessionKey())).token; } catch { /* already locked */ }
    if (account) writeJson(accountKey(staffId), { ...account, refresh: null });
    wipeSession();
    writeJson(SESSION_KEY, null);
    setSession(null);
    setAccess(null);
    setMigrationWarning(null);
    setStatus('signed_out');
    if (token) apiRequest('/api/auth/logout', { token, body: { refreshToken } }).catch(() => {});
  }, [session, access]);

  const value = useMemo(() => ({
    user: session?.user || null,
    token: access?.token && access.expiresAt > Date.now() ? access.token : null,
    renew,
    migrationWarning,
    status,
    isAuthenticated: status === 'ready',
    login,
    unlock,
    logout
  }), [session, access, status, login, unlock, logout, renew, migrationWarning]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
