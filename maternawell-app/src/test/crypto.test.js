import { describe, it, expect } from 'vitest';
import { createKeyCheck, decryptData, deriveKey, encryptData, generateSalt, getSessionKey, lockSession, setSessionKey, verifyKeyCheck, wipeSession } from '../utils/crypto';

describe('Encryption at rest (NFR-8)', () => {
  it('generates distinct 16-byte salts', () => {
    const a = generateSalt();
    expect(atob(a)).toHaveLength(16);
    expect(generateSalt()).not.toBe(a);
  });

  it('derives a non-extractable AES-GCM key', async () => {
    const key = await deriveKey('Worker01!2026', generateSalt());
    expect(key.algorithm.name).toBe('AES-GCM');
    expect(key.extractable).toBe(false);
  });

  it('round-trips structured records and never stores plaintext', async () => {
    const key = await deriveKey('pw', generateSalt());
    const record = { motherData: { name: 'Amina Bello' }, answers: { 10: 2 } };
    const envelope = await encryptData(record, key);
    expect(envelope.startsWith('MW1:')).toBe(true);
    expect(envelope).not.toContain('Amina');
    expect(await decryptData(envelope, key)).toEqual(record);
  });

  it('uses a fresh IV for every encryption', async () => {
    const key = await deriveKey('pw', generateSalt());
    expect(await encryptData('same', key)).not.toBe(await encryptData('same', key));
  });

  it('rejects the wrong password', async () => {
    const salt = generateSalt();
    const envelope = await encryptData({ secret: true }, await deriveKey('right', salt));
    await expect(decryptData(envelope, await deriveKey('wrong', salt))).rejects.toThrow(/Decryption failed/);
  });

  it('verifies a password offline with the key check (no hash stored)', async () => {
    const salt = generateSalt();
    const check = await createKeyCheck(await deriveKey('right', salt));
    expect(await verifyKeyCheck(check, await deriveKey('right', salt))).toBe(true);
    expect(await verifyKeyCheck(check, await deriveKey('wrong', salt))).toBe(false);
  });

  it('locking clears the in-memory key and announces the lock', async () => {
    const key = await deriveKey('pw', generateSalt());
    setSessionKey(key);
    expect(getSessionKey()).toBe(key);
    let announced = false;
    window.addEventListener('maternawell:locked', () => { announced = true; }, { once: true });
    lockSession();
    expect(getSessionKey()).toBeNull();
    expect(announced).toBe(true);
    wipeSession();
  });
});
