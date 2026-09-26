import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  generateSalt,
  deriveKey,
  encryptData,
  decryptData,
  encryptScreeningRecord,
  decryptScreeningRecord,
  setSessionKey,
  getSessionKey,
  lockSession,
  wipeSession,
  isSessionLocked
} from '../utils/crypto';

describe('Web Crypto AES-GCM Encryption Module', () => {
  const password = 'CorrectPassword123!';
  const wrongPassword = 'WrongPassword456!';
  let salt;
  let validKey;
  let wrongKey;

  beforeEach(async () => {
    wipeSession();
    salt = generateSalt();
    validKey = await deriveKey(password, salt);
    wrongKey = await deriveKey(wrongPassword, salt);
  });

  it('generates a 16-byte base64 salt', () => {
    expect(salt).toBeDefined();
    expect(typeof salt).toBe('string');
    // Base64 of 16 bytes is 24 chars with padding
    expect(salt.length).toBe(24);
  });

  it('derives a valid CryptoKey with AES-GCM algorithm', () => {
    expect(validKey).toBeDefined();
    expect(validKey.algorithm.name).toBe('AES-GCM');
    expect(validKey.algorithm.length).toBe(256);
    expect(validKey.usages).toContain('encrypt');
    expect(validKey.usages).toContain('decrypt');
  });

  it('performs an encrypt/decrypt round trip on a string', async () => {
    const plainText = 'Amina Bello (08012345678)';
    const envelope = await encryptData(plainText, validKey);

    expect(envelope.startsWith('MW1:')).toBe(true);
    expect(envelope).not.toContain(plainText);

    const decrypted = await decryptData(envelope, validKey);
    expect(decrypted).toBe(plainText);
  });

  it('performs an encrypt/decrypt round trip on structured objects', async () => {
    const originalAnswers = { 1: 0, 2: 1, 3: 2, 4: 0, 5: 3, 10: 1 };
    const envelope = await encryptData(originalAnswers, validKey);

    expect(envelope.startsWith('MW1:')).toBe(true);

    const decrypted = await decryptData(envelope, validKey);
    expect(decrypted).toEqual(originalAnswers);
  });

  it('fails decryption and throws when given a wrong key (wrong password)', async () => {
    const sensitiveData = 'High-risk patient clinical notes';
    const envelope = await encryptData(sensitiveData, validKey);

    await expect(decryptData(envelope, wrongKey)).rejects.toThrow(
      'Decryption failed: invalid key or corrupted data.'
    );
  });

  it('encrypts and decrypts sensitive fields in a full screening record', async () => {
    const record = {
      id: 'screening-001',
      facilityId: 'phc-ikeja',
      workerId: 'hw-001',
      score: 11,
      riskTier: 'Moderate Risk',
      hasSelfHarmRisk: false,
      motherData: {
        name: 'Funke Akindele',
        phone: '08099887766',
        fileNumber: 'MW-4821'
      },
      notes: 'Patient reports severe insomnia since birth.',
      answers: { 1: 1, 2: 2, 3: 1, 10: 0 }
    };

    const encrypted = await encryptScreeningRecord(record, validKey);

    expect(encrypted._isEncrypted).toBe(true);
    expect(encrypted.motherData.name).toMatch(/^MW1:/);
    expect(encrypted.motherData.phone).toMatch(/^MW1:/);
    expect(encrypted.motherData.fileNumber).toMatch(/^MW1:/);
    expect(encrypted.notes).toMatch(/^MW1:/);
    expect(encrypted.answers).toMatch(/^MW1:/);
    // Non-PII fields remain plaintext for fast indexing/filtering
    expect(encrypted.score).toBe(11);
    expect(encrypted.riskTier).toBe('Moderate Risk');

    const decrypted = await decryptScreeningRecord(encrypted, validKey);

    expect(decrypted._isEncrypted).toBe(false);
    expect(decrypted.motherData.name).toBe('Funke Akindele');
    expect(decrypted.motherData.phone).toBe('08099887766');
    expect(decrypted.motherData.fileNumber).toBe('MW-4821');
    expect(decrypted.notes).toBe('Patient reports severe insomnia since birth.');
    expect(decrypted.answers).toEqual({ 1: 1, 2: 2, 3: 1, 10: 0 });
  });

  it('manages session key lifecycle and idle lock state', () => {
    expect(isSessionLocked()).toBe(false);
    expect(getSessionKey()).toBe(null);

    setSessionKey(validKey, salt);
    expect(getSessionKey()).toBe(validKey);
    expect(isSessionLocked()).toBe(false);

    lockSession();
    expect(isSessionLocked()).toBe(true);
    expect(getSessionKey()).toBe(null);

    wipeSession();
    expect(isSessionLocked()).toBe(false);
    expect(getSessionKey()).toBe(null);
  });
});
