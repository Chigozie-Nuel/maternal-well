import Dexie from 'dexie';
import { FACILITIES } from '../utils/constants';
import { encryptScreeningRecord, ensureSessionKey } from '../utils/crypto';

export const db = new Dexie('MaternawellDB');

// Define database schema
db.version(1).stores({
  screenings: 'id, facilityId, workerId, riskTier, hasSelfHarmRisk, status, syncStatus, createdAt, updatedAt',
  drafts: 'id, workerId, facilityId, updatedAt',
  followUps: 'id, screeningId, status, syncStatus, updatedAt',
  escalations: 'id, screeningId, facilityId, status, syncStatus, createdAt',
  auditLog: 'id, timestamp, userId, facilityId, action, entityId, syncStatus',
  outbox: 'id, entity, entityId, action, status, retryCount, nextRetryAt, createdAt',
  users: 'id, staffId, role, facilityId',
  facilities: 'id, name, type, location'
});

/**
 * Performs a one-time migration from localStorage to Dexie IndexedDB.
 * Encrypts sensitive fields at rest before storage and removes plaintext localStorage keys.
 */
export async function migrateFromLocalStorage(overrideKey = null) {
  try {
    const isMigrated = localStorage.getItem('maternawell_migrated_to_dexie');
    if (isMigrated) return;

    const cryptoKey = overrideKey || await ensureSessionKey();

    // 1. Seed facilities if empty
    const facilityCount = await db.facilities.count();
    if (facilityCount === 0 && Array.isArray(FACILITIES)) {
      await db.facilities.bulkPut(FACILITIES);
    }

    // 2. Migrate and encrypt screenings from localStorage
    const savedScreenings = localStorage.getItem('maternawell_screenings');
    if (savedScreenings) {
      try {
        const parsed = JSON.parse(savedScreenings);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const formatted = parsed.map(s => ({
            id: s.id || crypto.randomUUID(),
            facilityId: s.facilityId || s.motherData?.facilityId || 'phc-ikeja',
            workerId: s.workerId || s.createdBy || 'hw-001',
            motherData: s.motherData || {
              name: s.motherName || 'Unknown Patient',
              phone: s.phone || '',
              fileNumber: s.fileNumber || `MW-${Math.floor(1000 + Math.random() * 9000)}`
            },
            answers: s.answers || {},
            score: typeof s.score === 'number' ? s.score : (s.epdsScore || 0),
            riskTier: s.riskTier?.label || s.riskTier || 'Low Risk',
            riskDetails: s.riskDetails || s.riskTier || {},
            referralPlan: s.referralPlan || null,
            hasSelfHarmRisk: Boolean(s.hasSelfHarmRisk || (s.answers && s.answers[10] > 0)),
            selfHarmAcknowledged: Boolean(s.selfHarmAcknowledged),
            status: s.status || 'completed',
            syncStatus: s.syncStatus || 'synced',
            notes: s.notes || '',
            createdAt: s.timestamp || s.createdAt || new Date().toISOString(),
            updatedAt: s.updatedAt || s.timestamp || new Date().toISOString()
          }));

          // Encrypt at rest before storing in Dexie
          const encryptedRecords = await Promise.all(
            formatted.map(rec => encryptScreeningRecord(rec, cryptoKey))
          );
          await db.screenings.bulkPut(encryptedRecords);
        }
      } catch (e) {
        console.error('Failed to parse localStorage screenings during migration:', e);
      }
    }

    // 3. Migrate audit logs from localStorage
    const savedLogs = localStorage.getItem('maternawell_audit_logs');
    if (savedLogs) {
      try {
        const parsedLogs = JSON.parse(savedLogs);
        if (Array.isArray(parsedLogs) && parsedLogs.length > 0) {
          const formattedLogs = parsedLogs.map(log => ({
            id: log.id || crypto.randomUUID(),
            timestamp: log.timestamp || new Date().toISOString(),
            userId: log.userId || log.user?.staffId || 'system',
            facilityId: log.facilityId || 'phc-ikeja',
            action: log.action || 'UNKNOWN',
            entityId: log.screeningId || log.entityId || '',
            details: log.details || {},
            syncStatus: 'synced'
          }));
          await db.auditLog.bulkPut(formattedLogs);
        }
      } catch (e) {
        console.error('Failed to parse localStorage audit logs during migration:', e);
      }
    }

    // Clean up plaintext localStorage keys (R3)
    localStorage.removeItem('maternawell_screenings');
    localStorage.removeItem('maternawell_audit_logs');
    localStorage.removeItem('maternawell_active_draft');
    localStorage.setItem('maternawell_migrated_to_dexie', 'true');
  } catch (err) {
    console.warn('Migration from localStorage encountered non-fatal error:', err);
  }
}
