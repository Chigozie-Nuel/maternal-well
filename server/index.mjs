import http from 'node:http';
import { DatabaseSync } from 'node:sqlite';
import { randomBytes, randomUUID, scryptSync, timingSafeEqual, createHash, createCipheriv, createDecipheriv } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync, statSync, createReadStream } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { scoreEpds, classifyRisk, isEscalation, getReferralPlan } from '../maternawell-app/src/domain/epds.js';
import { escalationDueBy, isUrgent } from '../maternawell-app/src/domain/escalation.js';

const serverDirectory = path.dirname(fileURLToPath(import.meta.url));
const SESSION_MS = 8 * 60 * 60 * 1000;
const BODY_LIMIT = 1024 * 1024;
export const FOLLOW_UP_STATUSES = ['pending', 'contacted', 'completed', 'lost_to_followup'];
// Kept in step with the public facility directory in the client.
export const FACILITIES = [
  { id: 'phc-ikeja', name: 'Ikeja Primary Health Centre', lga: 'Ikeja', location: 'Wamako Street, Ikeja, Lagos' },
  { id: 'phc-surulere', name: 'Surulere Primary Health Centre', lga: 'Surulere', location: 'Akerele Ext., Surulere, Lagos' },
  { id: 'phc-epe', name: 'Epe Primary Health Centre', lga: 'Epe', location: 'Marina Road, Epe, Lagos' },
  { id: 'phc-ikorodu', name: 'Ikorodu Primary Health Centre', lga: 'Ikorodu', location: 'Ayangburen Road, Ikorodu, Lagos' },
  { id: 'phc-lagos-island', name: 'Lagos Island Primary Health Centre', lga: 'Lagos Island', location: 'Broad Street, Lagos Island' },
  { id: 'phc-alimosho', name: 'Alimosho Primary Health Centre', lga: 'Alimosho', location: 'Council Road, Idimu, Lagos' },
  { id: 'phc-badagry', name: 'Badagry Primary Health Centre', lga: 'Badagry', location: 'Hospital Road, Badagry, Lagos' },
  { id: 'phc-eti-osa', name: 'Eti-Osa Primary Health Centre', lga: 'Eti-Osa', location: 'Igbo-Efon, Lekki, Lagos' }
];
export const DEMO_CREDENTIALS = FACILITIES.slice(0, 3).flatMap((facility, index) => {
  const number = String(index + 1).padStart(2, '0');
  return [
    { staffId: `HW-${number}`, password: `Worker${number}!2026`, role: 'health_worker' },
    { staffId: `SUP-${number}`, password: `Supervisor${number}!2026`, role: 'supervisor' },
    { staffId: `ADMIN-${number}`, password: `Admin${number}!2026`, role: 'admin' }
  ].map(account => ({ ...account, facilityId: facility.id, facility: facility.name, name: `${account.role.replace('_', ' ')} ${number}` }));
});

class ApiError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}
const reject = (condition, status, message) => { if (condition) throw new ApiError(status, message); };
const textField = (value, maximum = 2000) => typeof value === 'string' ? value.trim().slice(0, maximum) : '';
const hash = value => createHash('sha256').update(value).digest('hex');
const now = () => new Date().toISOString();
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
// Offline screenings keep the time they were really completed, but never a future time.
const clientTime = value => {
  const time = typeof value === 'string' ? Date.parse(value) : NaN;
  return Number.isFinite(time) && time <= Date.now() + 5 * 60 * 1000 ? new Date(time).toISOString() : null;
};
const DEFAULT_ALLOWED_ORIGINS = ['capacitor://localhost', 'https://localhost', 'http://localhost'];

function loadKey(dbPath, suppliedKey, production) {
  const value = suppliedKey || process.env.MATERNOWELL_DATA_KEY || process.env.MATERNAWELL_DATA_KEY;
  if (value) {
    reject(!/^[a-fA-F0-9]{64}$/.test(value), 500, 'MATERNAWELL_DATA_KEY must contain 64 hexadecimal characters.');
    return Buffer.from(value, 'hex');
  }
  reject(production, 500, 'Production requires MATERNAWELL_DATA_KEY.');
  if (dbPath === ':memory:') return randomBytes(32);
  const keyPath = `${dbPath}.key`;
  if (!existsSync(keyPath)) writeFileSync(keyPath, randomBytes(32), { mode: 0o600, flag: 'wx' });
  const key = readFileSync(keyPath);
  reject(key.length !== 32, 500, 'Invalid database encryption key.');
  return key;
}

export function createApplication(options = {}) {
  const production = options.production ?? process.env.NODE_ENV === 'production';
  const databasePath = options.databasePath || process.env.MATERNAWELL_DB || path.join(serverDirectory, 'data', 'maternawell.sqlite');
  if (databasePath !== ':memory:') mkdirSync(path.dirname(databasePath), { recursive: true });
  const key = loadKey(databasePath, options.dataKey, production);
  const database = new DatabaseSync(databasePath);
  database.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;
    CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, staff_id TEXT UNIQUE NOT NULL, salt TEXT NOT NULL, password_hash TEXT NOT NULL, profile TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS sessions (token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), expires_at INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS revisions (revision INTEGER PRIMARY KEY AUTOINCREMENT, created_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS screenings (id TEXT PRIMARY KEY, facility_id TEXT NOT NULL, worker_id TEXT, revision INTEGER NOT NULL, data TEXT NOT NULL);
    CREATE INDEX IF NOT EXISTS screenings_facility_revision ON screenings(facility_id, revision);
    CREATE TABLE IF NOT EXISTS audit_log (id TEXT PRIMARY KEY, facility_id TEXT NOT NULL, user_id TEXT NOT NULL, revision INTEGER NOT NULL, data TEXT NOT NULL);
    CREATE INDEX IF NOT EXISTS audit_facility_revision ON audit_log(facility_id, revision);
    CREATE TABLE IF NOT EXISTS processed_operations (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, fingerprint TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS notifications (id TEXT PRIMARY KEY, screening_id TEXT NOT NULL, facility_id TEXT NOT NULL, created_at TEXT NOT NULL, channel TEXT NOT NULL, delivery_status TEXT NOT NULL);
  `);
  const encrypt = value => {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', key, iv);
    const encrypted = Buffer.concat([cipher.update(JSON.stringify(value), 'utf8'), cipher.final()]);
    return [iv, cipher.getAuthTag(), encrypted].map(part => part.toString('base64')).join('.');
  };
  const decrypt = envelope => {
    const [iv, tag, body] = envelope.split('.').map(part => Buffer.from(part, 'base64'));
    const decipher = createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(tag);
    return JSON.parse(Buffer.concat([decipher.update(body), decipher.final()]).toString('utf8'));
  };
  const seedAccounts = options.seedAccounts ?? (production ? [] : DEMO_CREDENTIALS);
  for (const account of seedAccounts) {
    if (database.prepare('SELECT id FROM users WHERE staff_id = ?').get(account.staffId)) continue;
    const facility = FACILITIES.find(entry => entry.id === account.facilityId);
    reject(!facility || !['health_worker', 'supervisor', 'admin'].includes(account.role) || !account.password, 500, 'Invalid seed account.');
    const salt = randomBytes(16).toString('hex');
    const passwordHash = scryptSync(account.password, salt, 64).toString('hex');
    const profile = { id: account.staffId, staffId: account.staffId, name: account.name || account.staffId, facilityId: facility.id, facility: facility.name, role: account.role };
    database.prepare('INSERT INTO users VALUES (?, ?, ?, ?, ?)').run(profile.id, profile.staffId, salt, passwordHash, JSON.stringify(profile));
  }
  const newRevision = () => Number(database.prepare('INSERT INTO revisions(created_at) VALUES (?)').run(now()).lastInsertRowid);
  const audit = (user, action, entityId, details = {}, clientTimestamp = null) => {
    const revision = newRevision();
    const entry = { id: randomUUID(), timestamp: now(), userId: user.id, staffId: user.staffId || user.id, facilityId: user.facilityId, action, entityId, details, revision, syncStatus: 'synced' };
    if (clientTimestamp) entry.clientTimestamp = clientTimestamp;
    database.prepare('INSERT INTO audit_log VALUES (?, ?, ?, ?, ?)').run(entry.id, entry.facilityId, entry.userId, revision, encrypt(entry));
    return entry;
  };
  const saveScreening = record => {
    record.revision = newRevision();
    record.updatedAt = now();
    record.syncStatus = 'synced';
    database.prepare('INSERT INTO screenings VALUES (?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET revision=excluded.revision, data=excluded.data').run(record.id, record.facilityId, record.workerId, record.revision, encrypt(record));
    return record;
  };
  const screeningById = id => {
    const row = database.prepare('SELECT data FROM screenings WHERE id = ?').get(id);
    return row ? decrypt(row.data) : null;
  };
  const transaction = callback => {
    database.exec('BEGIN IMMEDIATE');
    try { const value = callback(); database.exec('COMMIT'); return value; }
    catch (error) { database.exec('ROLLBACK'); throw error; }
  };
  const notifyEscalation = record => {
    if (!record.hasSelfHarmRisk && record.score < 13) return;
    database.prepare('INSERT INTO notifications VALUES (?, ?, ?, ?, ?, ?)').run(randomUUID(), record.id, record.facilityId, now(), 'mock_facility_supervisor', 'mock_recorded_not_sent');
    audit({ id: 'system', facilityId: record.facilityId }, 'ESCALATION_NOTIFICATION_RECORDED', record.id, { channel: 'mock_facility_supervisor', deliveryStatus: 'mock_recorded_not_sent' });
  };
  const validateAndCreate = (payload, user, anonymous = false) => {
    reject(!object(payload), 400, 'Screening payload must be an object.');
    const id = textField(payload.id, 100);
    reject(!id, 400, 'A stable screening ID is required.');
    reject(screeningById(id), 409, 'Screening ID already exists.');
    reject(payload.facilityId && payload.facilityId !== user.facilityId, 403, 'Facility does not match authenticated staff.');
    reject(!object(payload.motherData), 400, 'Mother data is required.');
    const mother = payload.motherData;
    reject(mother.consentGiven !== true && payload.consentGiven !== true, 400, 'Explicit informed consent is required.');
    let score;
    try { score = scoreEpds(payload.answers); } catch (error) { throw new ApiError(400, error.message); }
    const answers = Object.fromEntries(Array.from({ length: 10 }, (_, index) => [index + 1, payload.answers[index + 1]]));
    const isUrgent = isEscalation(answers) || score >= 13;
    const anonymousCode = anonymous ? textField(payload.anonymousCode, 40) : null;
    reject(anonymous && !/^MW-[A-Z0-9-]{4,36}$/.test(anonymousCode), 400, 'A valid anonymous code is required.');
    const motherData = anonymous ? {
      isAnonymous: true, name: 'Anonymous Mother', fileNumber: anonymousCode,
      contactInfo: textField(mother.contactInfo, 250), consentGiven: true, consentDate: textField(mother.consentDate, 40) || now()
    } : {
      name: textField(mother.name, 150), fileNumber: textField(mother.fileNumber, 80), phone: textField(mother.phone, 50),
      age: mother.age, weeksPostpartum: mother.weeksPostpartum, numberOfChildren: mother.numberOfChildren,
      hasSupportSystem: textField(mother.hasSupportSystem, 30), previousMentalHealthHistory: textField(mother.previousMentalHealthHistory, 100),
      consentGiven: true, consentDate: textField(mother.consentDate, 40) || now()
    };
    reject(!anonymous && (!motherData.name || !motherData.fileNumber), 400, 'Patient name and file number are required.');
    const referralPlan = getReferralPlan(score, answers);
    const record = {
      id, facilityId: user.facilityId, workerId: user.id, motherData, answers, score, riskTier: classifyRisk(score),
      hasSelfHarmRisk: isEscalation(answers), referralPlan, referralActions: referralPlan.actions,
      completed: true, isAnonymous: anonymous, ...(anonymous ? { anonymousCode } : {}),
      status: isUrgent ? 'urgent_referral' : score >= 9 ? 'referral_needed' : 'completed',
      createdAt: clientTime(payload.createdAt) || now(), completedAt: clientTime(payload.completedAt) || now(), receivedAt: now(),
      selfHarmAcknowledged: false, referralOutcome: 'pending', followUps: [], deletedAt: null
    };
    if (record.hasSelfHarmRisk) record.escalationDueBy = escalationDueBy(record.completedAt);
    saveScreening(record);
    audit(user, anonymous ? 'ANONYMOUS_SCREENING_CREATED' : 'SCREENING_COMPLETED', id, { score, hasSelfHarmRisk: record.hasSelfHarmRisk });
    notifyEscalation(record);
    return record;
  };
  const restrictedRecord = (record, user) => {
    if (record.deletedAt) return { id: record.id, facilityId: record.facilityId, deletedAt: record.deletedAt, revision: record.revision, syncStatus: 'synced' };
    if (user.role === 'health_worker') return record;
    const { motherData, answers, referralNotes, supervisorNotes, followUps, workerSafetyConfirmation, ...summary } = record;
    if (user.role === 'admin') {
      summary.motherData = { isAnonymous: Boolean(record.isAnonymous) };
      return summary;
    }
    // Supervisors track every case by name and file number (FR-15) but only see
    // item-level EPDS answers and clinical notes once a case is escalated (SRS 5.5).
    summary.motherData = { isAnonymous: Boolean(record.isAnonymous), name: motherData?.name, fileNumber: motherData?.fileNumber };
    summary.followUps = followUps;
    summary.referralNotes = referralNotes;
    summary.supervisorNotes = supervisorNotes;
    if (isUrgent(record)) {
      summary.motherData = motherData;
      summary.answers = answers;
      summary.workerSafetyConfirmation = workerSafetyConfirmation;
    }
    return summary;
  };
  const processOperation = (item, user) => {
    reject(!object(item) || !textField(item.id, 100) || !textField(item.entityId, 100), 400, 'Operation ID and entity ID are required.');
    const fingerprint = hash(JSON.stringify(item));
    const processed = database.prepare('SELECT user_id, fingerprint FROM processed_operations WHERE id = ?').get(item.id);
    if (processed) {
      reject(processed.user_id !== user.id || processed.fingerprint !== fingerprint, 409, 'Operation ID reused with different content or identity.');
      return;
    }
    reject(user.role === 'admin', 403, 'Administrators have audit access only.');
    const payload = item.payload || {};
    reject(!object(payload), 400, 'Operation payload must be an object.');
    if (item.entity === 'auditLog') {
      reject(item.action !== 'CREATE', 400, 'Audit entries are append only.');
      reject(!/^[A-Z_]{3,80}$/.test(payload.action || ''), 400, 'Invalid audit action.');
      // Submitted events cannot impersonate a staff member or replace authoritative server audit entries.
      audit(user, `CLIENT_${payload.action}`, textField(payload.entityId || payload.details?.screeningId || item.entityId, 100), {
        clientEventId: textField(payload.id || item.entityId, 100), source: 'offline_client'
      }, textField(payload.timestamp, 40));
    } else {
      reject(item.entity !== 'screenings', 400, 'Unsupported entity.');
      reject(payload.id && payload.id !== item.entityId, 400, 'Entity ID and payload ID differ.');
      if (item.action === 'CREATE') {
        reject(user.role !== 'health_worker', 403, 'Only health workers can create named screenings.');
        validateAndCreate({ ...payload, id: item.entityId }, user);
      } else {
        const record = screeningById(item.entityId);
        reject(!record || record.facilityId !== user.facilityId, 404, 'Screening not found in your facility.');
        reject(record.deletedAt, 409, 'Screening was deleted.');
        if (item.action === 'FOLLOW_UP') {
          reject(!FOLLOW_UP_STATUSES.includes(payload.outcome), 400, 'Invalid referral follow-up status.');
          const notes = textField(payload.notes);
          reject(payload.outcome !== 'pending' && !notes, 400, 'Follow-up notes are required.');
          const followUp = { id: item.id, outcome: payload.outcome, notes, timestamp: now(), workerId: user.id };
          record.followUps.push(followUp);
          record.referralOutcome = payload.outcome;
          record.referralOutcomeDate = followUp.timestamp;
          record.referralNotes = notes;
          if (payload.outcome === 'completed') record.status = 'completed';
          saveScreening(record);
          audit(user, 'REFERRAL_FOLLOW_UP_RECORDED', record.id, followUp);
        } else if (item.action === 'SAFETY_CONFIRM') {
          reject(user.role !== 'health_worker', 403, 'Only the screening health worker confirms immediate safety steps.');
          reject(!record.hasSelfHarmRisk, 400, 'Screening has no self-harm escalation.');
          reject(payload.notLeftAlone !== true || payload.supervisorInformed !== true, 400, 'Both safety confirmations are required.');
          if (!record.workerSafetyConfirmation) {
            record.workerSafetyConfirmation = { notLeftAlone: true, supervisorInformed: true, confirmedAt: now(), confirmedBy: user.id };
            saveScreening(record);
            audit(user, 'ESCALATION_SAFETY_CONFIRMED', record.id, { confirmedBy: user.id });
          }
        } else if (item.action === 'ACKNOWLEDGE') {
          reject(user.role !== 'supervisor', 403, 'Only a facility supervisor can acknowledge escalation.');
          reject(!record.hasSelfHarmRisk, 400, 'Only Item-10 self-harm flags require supervisor acknowledgement.');
          reject(!textField(payload.notes), 400, 'Supervisor acknowledgment notes are required.');
          reject(record.selfHarmAcknowledged, 409, 'Escalation has already been acknowledged.');
          record.selfHarmAcknowledged = true;
          record.selfHarmAcknowledgedAt = now();
          record.acknowledgedBy = user.id;
          record.supervisorNotes = textField(payload.notes);
          saveScreening(record);
          audit(user, 'ESCALATION_ACKNOWLEDGED', record.id, { notes: record.supervisorNotes });
        } else if (item.action === 'DELETE') {
          reject(user.role !== 'supervisor', 403, 'Only a facility supervisor can delete a record.');
          reject(record.hasSelfHarmRisk && !record.selfHarmAcknowledged, 409, 'A pending self-harm escalation must be acknowledged first.');
          reject(!textField(payload.reason), 400, 'A deletion reason is required.');
          record.deletedAt = now();
          record.deletedBy = user.id;
          record.deletionReason = textField(payload.reason);
          saveScreening(record);
          audit(user, 'SCREENING_SOFT_DELETED', record.id, { reason: record.deletionReason });
        } else throw new ApiError(400, 'Unsupported screening action.');
      }
    }
    database.prepare('INSERT INTO processed_operations VALUES (?, ?, ?)').run(item.id, user.id, fingerprint);
  };
  const rateBuckets = new Map();
  const rateLimit = (request, purpose, limit) => {
    const bucketKey = `${purpose}:${request.socket.remoteAddress || 'unknown'}`;
    const current = Date.now();
    for (const [name, entry] of rateBuckets) if (entry.until <= current) rateBuckets.delete(name);
    const bucket = rateBuckets.get(bucketKey) || { count: 0, until: current + 15 * 60 * 1000 };
    bucket.count += 1;
    rateBuckets.set(bucketKey, bucket);
    reject(bucket.count > limit, 429, 'Too many requests. Please try again in 15 minutes.');
  };
  const authenticate = request => {
    const token = /^Bearer ([A-Za-z0-9_-]{43})$/.exec(request.headers.authorization || '')?.[1];
    reject(!token, 401, 'Authentication is required.');
    const row = database.prepare('SELECT users.profile FROM sessions JOIN users ON users.id = sessions.user_id WHERE token_hash = ? AND expires_at > ?').get(hash(token), Date.now());
    reject(!row, 401, 'Session has expired or is invalid.');
    return JSON.parse(row.profile);
  };
  const readBody = async request => {
    let size = 0;
    const chunks = [];
    for await (const chunk of request) {
      size += chunk.length;
      reject(size > BODY_LIMIT, 413, 'Request body is too large.');
      chunks.push(chunk);
    }
    try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); }
    catch { throw new ApiError(400, 'Request body must contain valid JSON.'); }
  };
  const json = (response, status, body) => {
    response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer' });
    response.end(JSON.stringify(body));
  };
  const distDirectory = path.resolve(options.distDirectory || path.join(serverDirectory, '..', 'maternawell-app', 'dist'));
  const allowedOrigins = new Set([...DEFAULT_ALLOWED_ORIGINS, ...(options.allowedOrigins || (process.env.MATERNAWELL_ALLOWED_ORIGINS || '').split(',').map(value => value.trim()).filter(Boolean))]);
  const handler = async (request, response) => {
    try {
      const origin = request.headers.origin;
      if (origin && allowedOrigins.has(origin)) {
        // The Android (Capacitor) shell runs on its own origin and calls this API directly.
        response.setHeader('Access-Control-Allow-Origin', origin);
        response.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
        response.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        response.setHeader('Vary', 'Origin');
      }
      if (request.method === 'OPTIONS') { response.writeHead(204); return response.end(); }
      const url = new URL(request.url, 'http://localhost');
      if (production && options.trustProxy && request.headers['x-forwarded-proto'] !== 'https') throw new ApiError(400, 'HTTPS is required.');
      if (request.method === 'GET' && url.pathname === '/api/health') return json(response, 200, { status: 'ok', notificationMode: 'mock' });
      if (request.method === 'GET' && url.pathname === '/api/facilities') return json(response, 200, { facilities: FACILITIES });
      if (request.method === 'POST' && url.pathname === '/api/auth/login') {
        rateLimit(request, 'login', 30);
        const body = await readBody(request);
        const row = database.prepare('SELECT * FROM users WHERE staff_id = ?').get(textField(body.staffId, 100));
        const candidate = scryptSync(typeof body.password === 'string' ? body.password.slice(0, 1024) : '', row?.salt || 'invalid-user-salt', 64);
        reject(!row || !timingSafeEqual(candidate, Buffer.from(row.password_hash, 'hex')), 401, 'Invalid staff ID or password.');
        const user = JSON.parse(row.profile);
        reject(body.facilityId && body.facilityId !== user.facilityId, 403, 'Staff account belongs to another facility.');
        const token = randomBytes(32).toString('base64url');
        const expiresAt = Date.now() + SESSION_MS;
        database.prepare('DELETE FROM sessions WHERE expires_at <= ?').run(Date.now());
        database.prepare('INSERT INTO sessions VALUES (?, ?, ?)').run(hash(token), user.id, expiresAt);
        audit(user, 'STAFF_LOGIN', user.id);
        return json(response, 200, { user, token, expiresAt });
      }
      if (request.method === 'POST' && url.pathname === '/api/self-referral') {
        rateLimit(request, 'self-referral', 20);
        const body = await readBody(request);
        reject(!object(body), 400, 'Screening payload is required.');
        const facilityId = body.facilityId || body.motherData?.facilityId;
        reject(!FACILITIES.some(facility => facility.id === facilityId), 400, 'Select a valid facility.');
        reject(body.consentGiven !== true && body.motherData?.consentGiven !== true, 400, 'Explicit informed consent is required.');
        reject(body.motherData?.name && body.motherData.name !== 'Anonymous Mother' || body.motherData?.motherName || body.motherData?.phone || body.motherData?.phoneNumber, 400, 'Anonymous submissions must not contain named patient details.');
        const previous = screeningById(textField(body.id, 100));
        if (previous) {
          reject(!previous.isAnonymous || previous.facilityId !== facilityId || previous.anonymousCode !== body.anonymousCode || JSON.stringify(previous.answers) !== JSON.stringify(body.answers), 409, 'Submission ID already exists with different content.');
          return json(response, 200, { screening: publicReceipt(previous), duplicate: true });
        }
        const screening = transaction(() => validateAndCreate({ ...body, facilityId, motherData: body.motherData || {} }, { id: 'anonymous', facilityId }, true));
        return json(response, 201, { screening: publicReceipt(screening) });
      }
      if (url.pathname.startsWith('/api/')) {
        const user = authenticate(request);
        if (request.method === 'POST' && url.pathname === '/api/auth/logout') {
          database.prepare('DELETE FROM sessions WHERE token_hash = ?').run(hash(request.headers.authorization.slice(7)));
          return json(response, 200, { ok: true });
        }
        if (request.method === 'GET' && url.pathname === '/api/auth/me') return json(response, 200, { user });
        if (request.method === 'POST' && url.pathname === '/api/sync/push') {
          const body = await readBody(request);
          reject(!Array.isArray(body.items) || body.items.length > 50, 400, 'Provide a batch of at most 50 operations.');
          const acceptedIds = [], rejectedItems = [];
          for (const item of body.items) {
            try { transaction(() => processOperation(item, user)); acceptedIds.push(item.id); }
            catch (error) { rejectedItems.push({ id: item?.id ?? null, status: error.status || 500, error: error.status ? error.message : 'Operation could not be saved.' }); }
          }
          return json(response, 200, { acceptedIds, rejectedItems });
        }
        if (request.method === 'GET' && url.pathname === '/api/sync/pull') {
          reject(url.searchParams.get('facilityId') && url.searchParams.get('facilityId') !== user.facilityId, 403, 'Cannot read another facility.');
          const since = Number(url.searchParams.get('since') || 0);
          reject(!Number.isSafeInteger(since) || since < 0, 400, 'Invalid synchronization cursor.');
          const cursor = Number(database.prepare('SELECT COALESCE(MAX(revision), 0) AS revision FROM revisions').get().revision);
          const screenings = database.prepare('SELECT data FROM screenings WHERE facility_id = ? AND revision > ? AND revision <= ? ORDER BY revision').all(user.facilityId, since, cursor).map(row => restrictedRecord(decrypt(row.data), user));
          const auditLogs = database.prepare('SELECT data FROM audit_log WHERE facility_id = ? AND revision > ? AND revision <= ? ORDER BY revision').all(user.facilityId, since, cursor).map(row => decrypt(row.data)).filter(entry => user.role === 'admin' || entry.userId === user.id);
          return json(response, 200, { screenings, auditLogs, cursor });
        }
        if (request.method === 'GET' && url.pathname === '/api/admin/audit') {
          reject(user.role !== 'admin', 403, 'Administrator access is required.');
          const auditLogs = database.prepare('SELECT data FROM audit_log WHERE facility_id = ? ORDER BY revision DESC LIMIT 1000').all(user.facilityId).map(row => decrypt(row.data));
          const notifications = database.prepare('SELECT * FROM notifications WHERE facility_id = ? ORDER BY created_at DESC LIMIT 1000').all(user.facilityId);
          return json(response, 200, { auditLogs, notifications });
        }
        throw new ApiError(404, 'API endpoint not found.');
      }
      reject(!['GET', 'HEAD'].includes(request.method), 405, 'Method not allowed.');
      let requestedPath;
      try { requestedPath = decodeURIComponent(url.pathname); } catch { throw new ApiError(400, 'Invalid path.'); }
      const candidate = path.resolve(distDirectory, `.${requestedPath}`);
      reject(!candidate.startsWith(`${distDirectory}${path.sep}`) && candidate !== distDirectory, 403, 'Invalid path.');
      let file = existsSync(candidate) && statSync(candidate).isFile() ? candidate : path.join(distDirectory, 'index.html');
      reject(!existsSync(file), 404, 'Frontend build not found. Run npm run build in maternawell-app.');
      const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.woff2': 'font/woff2' };
      response.writeHead(200, { 'Content-Type': `${types[path.extname(file)] || 'application/octet-stream'}; charset=utf-8`, 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer', 'Cache-Control': path.extname(file) === '.html' ? 'no-cache' : 'public, max-age=3600', 'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'" });
      if (request.method === 'HEAD') response.end(); else createReadStream(file).pipe(response);
    } catch (error) {
      if (!response.headersSent) json(response, error.status || 500, { error: error.status ? error.message : 'Internal server error.' });
      else response.end();
    }
  };
  const server = http.createServer(handler);
  server.requestTimeout = 15_000;
  server.headersTimeout = 15_000;
  server.on('close', () => database.close());
  return { server, database, close: () => new Promise(resolve => server.close(resolve)) };
}

function publicReceipt(record) {
  const { id, anonymousCode, facilityId, score, riskTier, hasSelfHarmRisk, referralPlan, referralActions, createdAt, status } = record;
  return { id, anonymousCode, facilityId, score, riskTier, hasSelfHarmRisk, referralPlan, referralActions, createdAt, status, syncStatus: 'synced' };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const host = process.env.HOST || '127.0.0.1';
  const production = process.env.NODE_ENV === 'production';
  const trustProxy = process.env.TRUST_HTTPS_PROXY === 'true';
  if (production && !trustProxy) throw new Error('Production requires HTTPS termination and TRUST_HTTPS_PROXY=true.');
  if (production && !['127.0.0.1', '::1', 'localhost'].includes(host)) throw new Error('Bind the application to loopback behind the HTTPS proxy.');
  const application = createApplication({ production, trustProxy });
  application.server.listen(Number(process.env.PORT || 4000), host, () => console.log(`Maternawell API listening on http://${host}:${process.env.PORT || 4000}; escalation notifications are MOCK ONLY.`));
  for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => application.server.close(() => process.exit(0)));
}
