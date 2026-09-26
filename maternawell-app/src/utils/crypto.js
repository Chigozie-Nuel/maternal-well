/**
 * Maternawell Nigeria - encryption at rest (SRS NFR-8).
 *
 * Every record saved on the device is stored as an AES-GCM (256-bit) envelope.
 * The key is derived with PBKDF2-SHA-256 (210,000 iterations, per-user salt) from the
 * staff password, is non-extractable, lives in memory only, and is wiped on sign-out
 * or after 10 minutes of inactivity.
 */

const PBKDF2_ITERATIONS = 210000;
const IV_LENGTH_BYTES = 12;
export const IDLE_LOCK_TIMEOUT_MS = 10 * 60 * 1000;
const CHECK_PLAINTEXT = 'maternawell-key-check-v1';

let sessionKey = null;
let idleTimer = null;
let listenersRegistered = false;

const toBase64 = bytes => {
  let binary = '';
  for (let index = 0; index < bytes.byteLength; index++) binary += String.fromCharCode(bytes[index]);
  return btoa(binary);
};
const fromBase64 = text => Uint8Array.from(atob(text), character => character.charCodeAt(0));

export function generateSalt() {
  return toBase64(crypto.getRandomValues(new Uint8Array(16)));
}

export async function deriveKey(password, saltBase64) {
  if (!password || typeof password !== 'string') throw new Error('A password is required to unlock encrypted records.');
  const material = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), { name: 'PBKDF2' }, false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: fromBase64(saltBase64), iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

/** A random, non-extractable key for data that exists before anyone signs in (anonymous self-referral queue). */
export async function generateDeviceKey() {
  return crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}

export async function encryptData(value, key) {
  if (!key) throw new Error('Records are locked. Sign in to continue.');
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH_BYTES));
  const cipher = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(JSON.stringify(value)));
  return `MW1:${toBase64(iv)}:${toBase64(new Uint8Array(cipher))}`;
}

export async function decryptData(envelope, key) {
  if (!key) throw new Error('Records are locked. Sign in to continue.');
  const parts = typeof envelope === 'string' ? envelope.split(':') : [];
  if (parts.length !== 3 || parts[0] !== 'MW1') throw new Error('Malformed encrypted record.');
  try {
    const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: fromBase64(parts[1]) }, key, fromBase64(parts[2]));
    return JSON.parse(new TextDecoder().decode(plain));
  } catch {
    throw new Error('Decryption failed: wrong password or corrupted record.');
  }
}

/** Encrypted marker used to verify a password offline without storing any password hash. */
export const createKeyCheck = key => encryptData(CHECK_PLAINTEXT, key);
export async function verifyKeyCheck(check, key) {
  try { return (await decryptData(check, key)) === CHECK_PLAINTEXT; }
  catch { return false; }
}

// ---- In-memory session key -------------------------------------------------

export function setSessionKey(key) {
  sessionKey = key;
  resetIdleTimer();
  registerActivityListeners();
}

export function getSessionKey() {
  return sessionKey;
}

export function lockSession() {
  sessionKey = null;
  if (idleTimer) clearTimeout(idleTimer);
  idleTimer = null;
  if (typeof window !== 'undefined') window.dispatchEvent(new Event('maternawell:locked'));
}

export function wipeSession() {
  sessionKey = null;
  if (idleTimer) clearTimeout(idleTimer);
  idleTimer = null;
}

export function resetIdleTimer() {
  if (idleTimer) clearTimeout(idleTimer);
  idleTimer = sessionKey ? setTimeout(lockSession, IDLE_LOCK_TIMEOUT_MS) : null;
}

function registerActivityListeners() {
  if (listenersRegistered || typeof window === 'undefined') return;
  for (const event of ['pointerdown', 'keydown', 'touchstart', 'scroll']) {
    window.addEventListener(event, () => { if (sessionKey) resetIdleTimer(); }, { passive: true });
  }
  listenersRegistered = true;
}
