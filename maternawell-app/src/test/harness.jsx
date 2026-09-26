import { render } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { AuthProvider } from '../context/AuthContext';
import { ScreeningProvider } from '../context/ScreeningContext';
import { LanguageProvider } from '../context/LanguageContext';
import { db } from '../db/db';
import { createKeyCheck, deriveKey, generateSalt, setSessionKey, wipeSession } from '../utils/crypto';

export const WORKER = { id: 'HW-01', staffId: 'HW-01', name: 'health worker 01', role: 'health_worker', facilityId: 'phc-ikeja', facility: 'Ikeja Primary Health Centre' };
export const SUPERVISOR = { id: 'SUP-01', staffId: 'SUP-01', name: 'supervisor 01', role: 'supervisor', facilityId: 'phc-ikeja', facility: 'Ikeja Primary Health Centre' };

/** Puts a user in the "signed in and unlocked" state, as a real login would. */
export async function signInAs(user, password = 'Password!2026') {
  const salt = generateSalt();
  const key = await deriveKey(password, salt);
  localStorage.setItem(`maternawell_account_${user.staffId}`, JSON.stringify({ salt, check: await createKeyCheck(key), user }));
  localStorage.setItem('maternawell_session', JSON.stringify({ user, token: 'test-token', expiresAt: Date.now() + 3600000 }));
  setSessionKey(key);
  return key;
}

export async function resetAll() {
  wipeSession();
  localStorage.clear();
  await Promise.all(db.tables.map(table => table.clear()));
}

export function renderRoutes(routes, initialPath) {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <LanguageProvider>
        <AuthProvider>
          <ScreeningProvider>
            <Routes>
              {Object.entries(routes).map(([path, element]) => <Route key={path} path={path} element={element} />)}
            </Routes>
          </ScreeningProvider>
        </AuthProvider>
      </LanguageProvider>
    </MemoryRouter>
  );
}
