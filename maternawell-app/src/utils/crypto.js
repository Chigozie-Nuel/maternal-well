/**
 * Maternawell Nigeria - Web Crypto AES-GCM (256-bit) Module
 * 
 * Provides field-level encryption at rest for sensitive health/PII fields:
 * - Patient names, phone numbers, file numbers & contact info
 * - Clinical notes & supervisor notes
 * - EPDS item-level answers
 * 
 * Derivation: PBKDF2 (SHA-256, 210,000 iterations, per-user/facility salt)
 * Encryption: AES-GCM with 96-bit random IV per operation
 * In-memory key caching with 10-minute idle auto-lock and logout wiper.
 */

const PBKDF2_ITERATIONS = 210000;
const AES_KEY_LENGTH = 256;
const IV_LENGTH_BYTES = 12; // 96-bit IV recommended for AES-GCM
const IDLE_LOCK_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes

// In-memory key cache (never persisted to localStorage or IndexedDB)
let inMemoryCryptoKey = null;
let sessionSalt = null;
let isLocked = false;
let idleTimer = null;
let idleListenersRegistered = false;

// Helpers for Base64 encoding/decoding in browser & Node environments
function uint8ArrayToBase64(bytes) {
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(bytes).toString('base64');
  }
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToUint8Array(base64) {
  if (typeof Buffer !== 'undefined') {
    return new Uint8Array(Buffer.from(base64, 'base64'));
  }
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * Generate a cryptographically secure random salt (16 bytes / 128-bit)
 */
export function generateSalt() {
  const salt = new Uint8Array(16);
  crypto.getRandomValues(salt);
  return uint8ArrayToBase64(salt);
}

/**
 * Derives an AES-GCM 256-bit key from a password and salt using PBKDF2 (210,000 iterations)
 */
export async function deriveKey(password, saltBase64) {
  if (!password || typeof password !== 'string') {
    throw new Error('A valid password string is required for key derivation.');
  }

  const saltBytes = typeof saltBase64 === 'string' 
    ? base64ToUint8Array(saltBase64) 
    : saltBase64;

  const enc = new TextEncoder();
  const passwordKey = await crypto.subtle.importKey(
    'raw',
    enc.encode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );

  return await crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: saltBytes,
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256'
    },
    passwordKey,
    {
      name: 'AES-GCM',
      length: AES_KEY_LENGTH
    },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * Encrypt arbitrary plain text or JSON-serializable value using AES-GCM
 */
export async function encryptData(plainValue, cryptoKey) {
  if (!cryptoKey) {
    throw new Error('Encryption key not provided or session locked.');
  }

  const textToEncrypt = typeof plainValue === 'string' 
    ? plainValue 
    : JSON.stringify(plainValue);

  const enc = new TextEncoder();
  const iv = new Uint8Array(IV_LENGTH_BYTES);
  crypto.getRandomValues(iv);

  const ciphertextBuffer = await crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv: iv
    },
    cryptoKey,
    enc.encode(textToEncrypt)
  );

  const ivBase64 = uint8ArrayToBase64(iv);
  const cipherBase64 = uint8ArrayToBase64(new Uint8Array(ciphertextBuffer));

  // Envelope format: MW1:<iv>:<ciphertext>
  return `MW1:${ivBase64}:${cipherBase64}`;
}

/**
 * Decrypt envelope string formatted as MW1:<iv>:<ciphertext>
 */
export async function decryptData(encryptedEnvelope, cryptoKey) {
  if (!cryptoKey) {
    throw new Error('Decryption key not provided or session locked.');
  }

  if (typeof encryptedEnvelope !== 'string' || !encryptedEnvelope.startsWith('MW1:')) {
    // If not encrypted envelope, return as-is (graceful migration/backwards compatibility)
    return encryptedEnvelope;
  }

  const parts = encryptedEnvelope.split(':');
  if (parts.length !== 3) {
    throw new Error('Malformed encrypted envelope format.');
  }

  const iv = base64ToUint8Array(parts[1]);
  const ciphertext = base64ToUint8Array(parts[2]);

  try {
    const decryptedBuffer = await crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: iv
      },
      cryptoKey,
      ciphertext
    );

    const dec = new TextDecoder();
    const decryptedText = dec.decode(decryptedBuffer);

    try {
      return JSON.parse(decryptedText);
    } catch {
      return decryptedText;
    }
  } catch (err) {
    throw new Error('Decryption failed: invalid key or corrupted data.');
  }
}

/**
 * Encrypt sensitive fields of a screening record before storing in Dexie
 * Fields: motherData (name, phone, fileNumber, contactInfo), answers, notes, supervisorNotes
 */
export async function encryptScreeningRecord(record, key) {
  if (!key || !record) return record;

  const clone = { ...record };

  if (clone.motherData) {
    clone.motherData = {
      ...clone.motherData,
      name: clone.motherData.name ? await encryptData(clone.motherData.name, key) : '',
      motherName: clone.motherData.motherName ? await encryptData(clone.motherData.motherName, key) : '',
      phone: clone.motherData.phone ? await encryptData(clone.motherData.phone, key) : '',
      phoneNumber: clone.motherData.phoneNumber ? await encryptData(clone.motherData.phoneNumber, key) : '',
      fileNumber: clone.motherData.fileNumber ? await encryptData(clone.motherData.fileNumber, key) : '',
      contactInfo: clone.motherData.contactInfo ? await encryptData(clone.motherData.contactInfo, key) : ''
    };
  }

  if (clone.notes) {
    clone.notes = await encryptData(clone.notes, key);
  }

  if (clone.supervisorNotes) {
    clone.supervisorNotes = await encryptData(clone.supervisorNotes, key);
  }

  if (clone.referralNotes) {
    clone.referralNotes = await encryptData(clone.referralNotes, key);
  }

  if (clone.answers) {
    clone.answers = await encryptData(clone.answers, key);
  }

  clone._isEncrypted = true;
  return clone;
}

/**
 * Decrypt sensitive fields of a screening record when reading from Dexie
 */
export async function decryptScreeningRecord(record, key) {
  if (!key || !record || !record._isEncrypted) return record;

  const clone = { ...record };

  if (clone.motherData) {
    clone.motherData = {
      ...clone.motherData,
      name: clone.motherData.name ? await decryptData(clone.motherData.name, key) : '',
      motherName: clone.motherData.motherName ? await decryptData(clone.motherData.motherName, key) : '',
      phone: clone.motherData.phone ? await decryptData(clone.motherData.phone, key) : '',
      phoneNumber: clone.motherData.phoneNumber ? await decryptData(clone.motherData.phoneNumber, key) : '',
      fileNumber: clone.motherData.fileNumber ? await decryptData(clone.motherData.fileNumber, key) : '',
      contactInfo: clone.motherData.contactInfo ? await decryptData(clone.motherData.contactInfo, key) : ''
    };
  }

  if (clone.notes) {
    clone.notes = await decryptData(clone.notes, key);
  }

  if (clone.supervisorNotes) {
    clone.supervisorNotes = await decryptData(clone.supervisorNotes, key);
  }

  if (clone.referralNotes) {
    clone.referralNotes = await decryptData(clone.referralNotes, key);
  }

  if (clone.answers) {
    clone.answers = await decryptData(clone.answers, key);
  }

  clone._isEncrypted = false;
  return clone;
}

/**
 * Encrypt sensitive fields of a draft record before storing in Dexie
 */
export async function encryptDraftRecord(draft, key) {
  if (!key || !draft) return draft;
  return await encryptScreeningRecord(draft, key);
}

/**
 * Decrypt sensitive fields of a draft record
 */
export async function decryptDraftRecord(draft, key) {
  if (!key || !draft || !draft._isEncrypted) return draft;
  return await decryptScreeningRecord(draft, key);
}

/**
 * Encrypt sensitive fields in followUps table
 */
export async function encryptFollowUpRecord(followUp, key) {
  if (!key || !followUp) return followUp;
  const clone = { ...followUp };
  if (clone.notes) {
    clone.notes = await encryptData(clone.notes, key);
  }
  if (clone.contactInfo) {
    clone.contactInfo = await encryptData(clone.contactInfo, key);
  }
  clone._isEncrypted = true;
  return clone;
}

/**
 * Decrypt sensitive fields in followUps table
 */
export async function decryptFollowUpRecord(followUp, key) {
  if (!key || !followUp || !followUp._isEncrypted) return followUp;
  const clone = { ...followUp };
  if (clone.notes) {
    clone.notes = await decryptData(clone.notes, key);
  }
  if (clone.contactInfo) {
    clone.contactInfo = await decryptData(clone.contactInfo, key);
  }
  clone._isEncrypted = false;
  return clone;
}

/**
 * Encrypt sensitive fields in escalations table
 */
export async function encryptEscalationRecord(escalation, key) {
  if (!key || !escalation) return escalation;
  const clone = { ...escalation };
  if (clone.notes) {
    clone.notes = await encryptData(clone.notes, key);
  }
  if (clone.supervisorNotes) {
    clone.supervisorNotes = await encryptData(clone.supervisorNotes, key);
  }
  clone._isEncrypted = true;
  return clone;
}

/**
 * Decrypt sensitive fields in escalations table
 */
export async function decryptEscalationRecord(escalation, key) {
  if (!key || !escalation || !escalation._isEncrypted) return escalation;
  const clone = { ...escalation };
  if (clone.notes) {
    clone.notes = await decryptData(clone.notes, key);
  }
  if (clone.supervisorNotes) {
    clone.supervisorNotes = await decryptData(clone.supervisorNotes, key);
  }
  clone._isEncrypted = false;
  return clone;
}

/**
 * In-memory Session Key Management & Idle Timeout
 */
export function setSessionKey(key, salt) {
  inMemoryCryptoKey = key;
  sessionSalt = salt;
  isLocked = false;
  resetIdleTimer();
  registerActivityListeners();
}

export function getSessionKey() {
  if (isLocked) return null;
  return inMemoryCryptoKey;
}

export function isSessionLocked() {
  return isLocked;
}

export function lockSession() {
  inMemoryCryptoKey = null;
  isLocked = true;
  if (typeof window !== 'undefined') window.dispatchEvent(new Event('maternawell:locked'));
}

export function wipeSession() {
  inMemoryCryptoKey = null;
  sessionSalt = null;
  isLocked = false;
  if (idleTimer) {
    clearTimeout(idleTimer);
    idleTimer = null;
  }
}

export async function unlockSession(password) {
  if (!sessionSalt) {
    throw new Error('Session cannot be unlocked without salt. Please log in again.');
  }
  const key = await deriveKey(password, sessionSalt);
  setSessionKey(key, sessionSalt);
  return key;
}

/**
 * Ensure an active session key exists; derives from default password/salt if none loaded
 */
export async function ensureSessionKey() {
  if (inMemoryCryptoKey && !isLocked) {
    return inMemoryCryptoKey;
  }
  throw new Error('Session locked. Sign in again to unlock your encrypted records.');
}

export function resetIdleTimer() {
  if (idleTimer) clearTimeout(idleTimer);
  if (!inMemoryCryptoKey) return;

  idleTimer = setTimeout(() => {
    lockSession();
  }, IDLE_LOCK_TIMEOUT_MS);
}

function registerActivityListeners() {
  if (idleListenersRegistered || typeof window === 'undefined') return;

  const events = ['mousemove', 'keydown', 'click', 'touchstart'];
  events.forEach(event => {
    window.addEventListener(event, resetIdleTimer, { passive: true });
  });

  idleListenersRegistered = true;
}
