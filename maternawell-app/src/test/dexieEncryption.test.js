import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';
import { db, migrateFromLocalStorage } from '../db/db';
import { 
  deriveKey, 
  generateSalt, 
  setSessionKey, 
  encryptScreeningRecord, 
  decryptScreeningRecord,
  wipeSession 
} from '../utils/crypto';

describe('R2 & R3: Dexie Encryption at Rest & Migration Verification', () => {
  let key;
  let salt;

  beforeEach(async () => {
    wipeSession();
    await db.screenings.clear();
    await db.drafts.clear();
    await db.auditLog.clear();
    localStorage.clear();

    salt = generateSalt();
    key = await deriveKey('TestPassword123!', salt);
    setSessionKey(key, salt);
  });

  it('proves raw IndexedDB record contains no plaintext name, phone, fileNumber, or answers (NFR-8)', async () => {
    const rawPlaintextRecord = {
      id: 'screening-enc-001',
      facilityId: 'phc-surulere',
      workerId: 'hw-402',
      motherData: {
        name: 'Chioma Okonkwo',
        phone: '08031234567',
        fileNumber: 'PHC-SURU-9821'
      },
      answers: { 1: 2, 2: 1, 3: 3, 4: 0, 5: 1, 10: 2 },
      score: 9,
      riskTier: 'Moderate Risk',
      notes: 'Patient reports persistent postpartum anxiety.'
    };

    // Encrypt at rest before storing in Dexie
    const recordToStore = await encryptScreeningRecord(rawPlaintextRecord, key);
    await db.screenings.put(recordToStore);

    // Read the RAW record directly from IndexedDB without decryption
    const rawFromDb = await db.screenings.get('screening-enc-001');

    expect(rawFromDb).toBeDefined();
    expect(rawFromDb._isEncrypted).toBe(true);

    // Verify motherData PII is NOT plaintext
    expect(rawFromDb.motherData.name).toMatch(/^MW1:/);
    expect(rawFromDb.motherData.name).not.toContain('Chioma');
    expect(rawFromDb.motherData.name).not.toContain('Okonkwo');

    expect(rawFromDb.motherData.phone).toMatch(/^MW1:/);
    expect(rawFromDb.motherData.phone).not.toContain('08031234567');

    expect(rawFromDb.motherData.fileNumber).toMatch(/^MW1:/);
    expect(rawFromDb.motherData.fileNumber).not.toContain('PHC-SURU-9821');

    // Verify EPDS item answers are NOT plaintext
    expect(rawFromDb.answers).toMatch(/^MW1:/);
    expect(typeof rawFromDb.answers).toBe('string');
    expect(rawFromDb.answers).not.toEqual(rawPlaintextRecord.answers);

    // Verify clinical notes are NOT plaintext
    expect(rawFromDb.notes).toMatch(/^MW1:/);
    expect(rawFromDb.notes).not.toContain('anxiety');

    // Verify decrypted record restores original plaintext exactly
    const decrypted = await decryptScreeningRecord(rawFromDb, key);
    expect(decrypted.motherData.name).toBe('Chioma Okonkwo');
    expect(decrypted.motherData.phone).toBe('08031234567');
    expect(decrypted.motherData.fileNumber).toBe('PHC-SURU-9821');
    expect(decrypted.answers).toEqual({ 1: 2, 2: 1, 3: 3, 4: 0, 5: 1, 10: 2 });
    expect(decrypted.notes).toBe('Patient reports persistent postpartum anxiety.');
  });

  it('R3: migration encrypts legacy localStorage records and removes plaintext localStorage keys', async () => {
    const legacyPlaintextScreenings = [
      {
        id: 'legacy-001',
        motherData: {
          name: 'Bisi Adebayo',
          phone: '07011223344',
          fileNumber: 'PHC-LEGACY-01'
        },
        answers: { 1: 0, 2: 0, 10: 0 },
        score: 0,
        riskTier: 'Low Risk'
      }
    ];

    localStorage.setItem('maternawell_screenings', JSON.stringify(legacyPlaintextScreenings));
    localStorage.setItem('maternawell_audit_logs', JSON.stringify([{ id: 'log-1', action: 'TEST' }]));

    await migrateFromLocalStorage(key);

    // Assert raw record in Dexie is encrypted
    const rawStored = await db.screenings.get('legacy-001');
    expect(rawStored).toBeDefined();
    expect(rawStored._isEncrypted).toBe(true);
    expect(rawStored.motherData.name).toMatch(/^MW1:/);
    expect(rawStored.motherData.name).not.toContain('Bisi');
    expect(rawStored.answers).toMatch(/^MW1:/);

    // Assert plaintext keys are completely removed from localStorage
    expect(localStorage.getItem('maternawell_screenings')).toBeNull();
    expect(localStorage.getItem('maternawell_audit_logs')).toBeNull();
    expect(localStorage.getItem('maternawell_migrated_to_dexie')).toBe('true');
  });
});
