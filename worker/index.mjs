import { scoreEpds, classifyRisk, isEscalation, getReferralPlan } from '../maternawell-app/src/domain/epds.js';
import { escalationDueBy, isUrgent } from '../maternawell-app/src/domain/escalation.js';

const SESSION_MS = 8 * 60 * 60 * 1000;
const REFRESH_MS = 7 * 24 * 60 * 60 * 1000;
const BODY_LIMIT = 1024 * 1024;
const FOLLOW_UP_STATUSES = ['pending', 'contacted', 'completed', 'lost_to_followup'];
const FACILITIES = [
  { id: 'phc-ikeja', name: 'Ikeja Primary Health Centre', lga: 'Ikeja', location: 'Wamako Street, Ikeja, Lagos' },
  { id: 'phc-surulere', name: 'Surulere Primary Health Centre', lga: 'Surulere', location: 'Akerele Ext., Surulere, Lagos' },
  { id: 'phc-epe', name: 'Epe Primary Health Centre', lga: 'Epe', location: 'Marina Road, Epe, Lagos' },
  { id: 'phc-ikorodu', name: 'Ikorodu Primary Health Centre', lga: 'Ikorodu', location: 'Ayangburen Road, Ikorodu, Lagos' },
  { id: 'phc-lagos-island', name: 'Lagos Island Primary Health Centre', lga: 'Lagos Island', location: 'Broad Street, Lagos Island' },
  { id: 'phc-alimosho', name: 'Alimosho Primary Health Centre', lga: 'Alimosho', location: 'Council Road, Idimu, Lagos' },
  { id: 'phc-badagry', name: 'Badagry Primary Health Centre', lga: 'Badagry', location: 'Hospital Road, Badagry, Lagos' },
  { id: 'phc-eti-osa', name: 'Eti-Osa Primary Health Centre', lga: 'Eti-Osa', location: 'Igbo-Efon, Lekki, Lagos' }
];
const DEMO_CREDENTIALS = FACILITIES.slice(0, 3).flatMap((facility, index) => {
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
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const textField = (value, maximum = 2000) => typeof value === 'string' ? value.trim().slice(0, maximum) : '';
const now = () => new Date().toISOString();
const clientTime = value => {
  const time = typeof value === 'string' ? Date.parse(value) : NaN;
  return Number.isFinite(time) && time <= Date.now() + 5 * 60 * 1000 ? new Date(time).toISOString() : null;
};
const bytes = value => new TextEncoder().encode(value);
const hex = data => Array.from(new Uint8Array(data), byte => byte.toString(16).padStart(2, '0')).join('');
const b64 = data => {
  const source = new Uint8Array(data);
  let binary = '';
  for (let offset = 0; offset < source.length; offset += 8192) binary += String.fromCharCode(...source.subarray(offset, offset + 8192));
  return btoa(binary);
};
const unb64 = data => Uint8Array.from(atob(data), char => char.charCodeAt(0));
const hash = async value => hex(await crypto.subtle.digest('SHA-256', bytes(value)));
const randomToken = () => b64(crypto.getRandomValues(new Uint8Array(32))).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
const keyCache = new Map();
async function encryptionKey(value) {
  reject(!/^[a-fA-F0-9]{64}$/.test(value || ''), 500, 'Encryption key is not configured.');
  if (!keyCache.has(value)) keyCache.set(value, crypto.subtle.importKey('raw', Uint8Array.from(value.match(/../g), part => parseInt(part, 16)), 'AES-GCM', false, ['encrypt', 'decrypt']));
  return keyCache.get(value);
}
async function encrypt(value, env) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await encryptionKey(env.MATERNAWELL_DATA_KEY), bytes(JSON.stringify(value)));
  return `${b64(iv)}.${b64(ciphertext)}`;
}
async function decrypt(envelope, env) {
  const [iv, data] = envelope.split('.');
  return JSON.parse(new TextDecoder().decode(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(iv) }, await encryptionKey(env.MATERNAWELL_DATA_KEY), unb64(data))));
}
async function newRevision(env) {
  const row = await env.DB.prepare('INSERT INTO revisions(created_at) VALUES (?) RETURNING revision').bind(now()).first();
  return Number(row.revision);
}
async function audit(env, user, action, entityId, details = {}, clientTimestamp = null) {
  const revision = await newRevision(env);
  const entry = { id: crypto.randomUUID(), timestamp: now(), userId: user.id, staffId: user.staffId || user.id, facilityId: user.facilityId, action, entityId, details, revision, syncStatus: 'synced' };
  if (clientTimestamp) entry.clientTimestamp = clientTimestamp;
  await env.DB.prepare('INSERT INTO audit_log VALUES (?, ?, ?, ?, ?)').bind(entry.id, entry.facilityId, entry.userId, revision, await encrypt(entry, env)).run();
  return entry;
}
async function saveScreening(env, record) {
  record.revision = await newRevision(env);
  record.updatedAt = now();
  record.syncStatus = 'synced';
  await env.DB.prepare('INSERT INTO screenings VALUES (?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET revision=excluded.revision, data=excluded.data').bind(record.id, record.facilityId, record.workerId, record.revision, await encrypt(record, env)).run();
  return record;
}
async function screeningById(env, id) {
  const row = await env.DB.prepare('SELECT data FROM screenings WHERE id = ?').bind(id).first();
  return row ? decrypt(row.data, env) : null;
}
async function notifyEscalation(env, record) {
  if (!record.hasSelfHarmRisk && record.score < 13) return;
  await env.DB.prepare('INSERT INTO notifications VALUES (?, ?, ?, ?, ?, ?)').bind(crypto.randomUUID(), record.id, record.facilityId, now(), 'facility_dashboard', 'queued_for_supervisor').run();
  await audit(env, { id: 'system', facilityId: record.facilityId }, 'ESCALATION_NOTIFICATION_QUEUED', record.id, { channel: 'facility_dashboard', deliveryStatus: 'queued_for_supervisor' });
}
async function validateAndCreate(env, payload, user, anonymous = false) {
  reject(!object(payload), 400, 'Screening payload must be an object.');
  const id = textField(payload.id, 100);
  reject(!id, 400, 'A stable screening ID is required.');
  reject(await screeningById(env, id), 409, 'Screening ID already exists.');
  reject(payload.facilityId && payload.facilityId !== user.facilityId, 403, 'Facility does not match authenticated staff.');
  reject(!object(payload.motherData), 400, 'Mother data is required.');
  const mother = payload.motherData;
  reject(mother.consentGiven !== true && payload.consentGiven !== true, 400, 'Explicit informed consent is required.');
  let score;
  try { score = scoreEpds(payload.answers); } catch (error) { throw new ApiError(400, error.message); }
  const answers = Object.fromEntries(Array.from({ length: 10 }, (_, index) => [index + 1, payload.answers[index + 1]]));
  const urgent = isEscalation(answers) || score >= 13;
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
    status: urgent ? 'urgent_referral' : score >= 9 ? 'referral_needed' : 'completed',
    createdAt: clientTime(payload.createdAt) || now(), completedAt: clientTime(payload.completedAt) || now(), receivedAt: now(),
    selfHarmAcknowledged: false, referralOutcome: 'pending', followUps: [], deletedAt: null
  };
  if (record.hasSelfHarmRisk) record.escalationDueBy = escalationDueBy(record.completedAt);
  await saveScreening(env, record);
  await audit(env, user, anonymous ? 'ANONYMOUS_SCREENING_CREATED' : 'SCREENING_COMPLETED', id, { score, hasSelfHarmRisk: record.hasSelfHarmRisk });
  await notifyEscalation(env, record);
  return record;
}
function restrictedRecord(record, user) {
  if (record.deletedAt) return { id: record.id, facilityId: record.facilityId, deletedAt: record.deletedAt, revision: record.revision, syncStatus: 'synced' };
  if (user.role === 'health_worker') return record;
  const { motherData, answers, referralNotes, supervisorNotes, followUps, workerSafetyConfirmation, ...summary } = record;
  if (user.role === 'admin') {
    summary.motherData = { isAnonymous: Boolean(record.isAnonymous) };
    return summary;
  }
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
}
async function processOperation(env, item, user) {
  reject(!object(item) || !textField(item.id, 100) || !textField(item.entityId, 100), 400, 'Operation ID and entity ID are required.');
  const fingerprint = await hash(JSON.stringify(item));
  const processed = await env.DB.prepare('SELECT user_id, fingerprint FROM processed_operations WHERE id = ?').bind(item.id).first();
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
    await audit(env, user, `CLIENT_${payload.action}`, textField(payload.entityId || payload.details?.screeningId || item.entityId, 100), {
      clientEventId: textField(payload.id || item.entityId, 100), source: 'offline_client'
    }, textField(payload.timestamp, 40));
  } else {
    reject(item.entity !== 'screenings', 400, 'Unsupported entity.');
    reject(payload.id && payload.id !== item.entityId, 400, 'Entity ID and payload ID differ.');
    if (item.action === 'CREATE') {
      reject(user.role !== 'health_worker', 403, 'Only health workers can create named screenings.');
      await validateAndCreate(env, { ...payload, id: item.entityId }, user);
    } else {
      const record = await screeningById(env, item.entityId);
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
        await saveScreening(env, record);
        await audit(env, user, 'REFERRAL_FOLLOW_UP_RECORDED', record.id, followUp);
      } else if (item.action === 'SAFETY_CONFIRM') {
        reject(user.role !== 'health_worker', 403, 'Only the screening health worker confirms immediate safety steps.');
        reject(!record.hasSelfHarmRisk, 400, 'Screening has no self-harm escalation.');
        reject(payload.notLeftAlone !== true || payload.supervisorInformed !== true, 400, 'Both safety confirmations are required.');
        if (!record.workerSafetyConfirmation) {
          record.workerSafetyConfirmation = { notLeftAlone: true, supervisorInformed: true, confirmedAt: now(), confirmedBy: user.id };
          await saveScreening(env, record);
          await audit(env, user, 'ESCALATION_SAFETY_CONFIRMED', record.id, { confirmedBy: user.id });
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
        await saveScreening(env, record);
        await audit(env, user, 'ESCALATION_ACKNOWLEDGED', record.id, { notes: record.supervisorNotes });
      } else if (item.action === 'DELETE') {
        reject(user.role !== 'supervisor', 403, 'Only a facility supervisor can delete a record.');
        reject(record.hasSelfHarmRisk && !record.selfHarmAcknowledged, 409, 'A pending self-harm escalation must be acknowledged first.');
        reject(!textField(payload.reason), 400, 'A deletion reason is required.');
        record.deletedAt = now();
        record.deletedBy = user.id;
        record.deletionReason = textField(payload.reason);
        await saveScreening(env, record);
        await audit(env, user, 'SCREENING_SOFT_DELETED', record.id, { reason: record.deletionReason });
      } else throw new ApiError(400, 'Unsupported screening action.');
    }
  }
  await env.DB.prepare('INSERT INTO processed_operations VALUES (?, ?, ?)').bind(item.id, user.id, fingerprint).run();
}
async function rateLimit(request, env, purpose, limit) {
  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  const bucket = `${purpose}:${ip}`;
  const until = Date.now() + 15 * 60 * 1000;
  await env.DB.prepare('INSERT INTO rate_limits VALUES (?, 1, ?) ON CONFLICT(bucket) DO UPDATE SET count = CASE WHEN rate_limits.until <= ? THEN 1 ELSE rate_limits.count + 1 END, until = CASE WHEN rate_limits.until <= ? THEN excluded.until ELSE rate_limits.until END').bind(bucket, until, Date.now(), Date.now()).run();
  const row = await env.DB.prepare('SELECT count FROM rate_limits WHERE bucket = ?').bind(bucket).first();
  reject(row.count > limit, 429, 'Too many requests. Please try again in 15 minutes.');
}
async function authenticate(request, env) {
  const token = /^Bearer ([A-Za-z0-9_-]{43})$/.exec(request.headers.get('Authorization') || '')?.[1];
  reject(!token, 401, 'Authentication is required.');
  const row = await env.DB.prepare('SELECT profile FROM sessions WHERE token_hash = ? AND expires_at > ?').bind(await hash(token), Date.now()).first();
  reject(!row, 401, 'Session has expired or is invalid.');
  return JSON.parse(row.profile);
}
async function issueSession(env, user) {
  const token = randomToken(), refreshToken = randomToken();
  const expiresAt = Date.now() + SESSION_MS, refreshExpiresAt = Date.now() + REFRESH_MS;
  await env.DB.batch([
    env.DB.prepare('INSERT INTO sessions VALUES (?, ?, ?)').bind(await hash(token), JSON.stringify(user), expiresAt),
    env.DB.prepare('INSERT INTO refresh_tokens VALUES (?, ?, ?)').bind(await hash(refreshToken), JSON.stringify(user), refreshExpiresAt)
  ]);
  return { token, expiresAt, refreshToken, refreshExpiresAt };
}
async function readBody(request) {
  reject(Number(request.headers.get('Content-Length') || 0) > BODY_LIMIT, 413, 'Request body is too large.');
  let stream = request.body;
  if (request.headers.get('Content-Encoding') === 'gzip') stream = stream.pipeThrough(new DecompressionStream('gzip'));
  const reader = stream?.getReader();
  const chunks = [];
  let size = 0;
  if (reader) {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      reject(size > BODY_LIMIT, 413, 'Request body is too large.');
      chunks.push(value);
    }
  }
  const joined = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { joined.set(chunk, offset); offset += chunk.byteLength; }
  try { return JSON.parse(new TextDecoder().decode(joined)); }
  catch { throw new ApiError(400, 'Request body must contain valid JSON.'); }
}
function publicReceipt(record) {
  const { id, anonymousCode, facilityId, score, riskTier, hasSelfHarmRisk, referralPlan, referralActions, createdAt, status } = record;
  return { id, anonymousCode, facilityId, score, riskTier, hasSelfHarmRisk, referralPlan, referralActions, createdAt, status, syncStatus: 'synced' };
}
function response(request, env, status, body) {
  const origin = request.headers.get('Origin');
  const allowed = origin && [env.ALLOWED_ORIGIN, 'capacitor://localhost', 'https://localhost', 'http://localhost'].includes(origin);
  return new Response(status === 204 ? null : JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'no-referrer',
      'Vary': 'Origin',
      ...(allowed ? { 'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Headers': 'Authorization, Content-Type', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS' } : {})
    }
  });
}
async function handle(request, env) {
  const url = new URL(request.url);
  if (request.method === 'OPTIONS') return response(request, env, 204);
  if (request.method === 'GET' && url.pathname === '/api/health') return response(request, env, 200, { status: 'ok', notificationMode: 'facility_dashboard' });
  if (request.method === 'GET' && url.pathname === '/api/facilities') return response(request, env, 200, { facilities: FACILITIES });
  if (request.method === 'POST' && url.pathname === '/api/auth/login') {
    await rateLimit(request, env, 'login', 30);
    const body = await readBody(request);
    const account = DEMO_CREDENTIALS.find(entry => entry.staffId === textField(body.staffId, 100));
    reject(env.PUBLIC_DEMO !== 'true' || !account || body.password !== account.password, 401, 'Invalid staff ID or password.');
    reject(body.facilityId && body.facilityId !== account.facilityId, 403, 'Staff account belongs to another facility.');
    const { password, ...profile } = account;
    const user = { id: profile.staffId, ...profile };
    const credentials = await issueSession(env, user);
    await audit(env, user, 'STAFF_LOGIN', user.id);
    return response(request, env, 200, { user, ...credentials });
  }
  if (request.method === 'POST' && url.pathname === '/api/auth/refresh') {
    await rateLimit(request, env, 'refresh', 60);
    const body = await readBody(request);
    const refreshToken = typeof body.refreshToken === 'string' ? body.refreshToken : '';
    reject(!/^[A-Za-z0-9_-]{43}$/.test(refreshToken), 401, 'Refresh credential is invalid.');
    const tokenHash = await hash(refreshToken);
    const row = await env.DB.prepare('DELETE FROM refresh_tokens WHERE token_hash = ? AND expires_at > ? RETURNING profile').bind(tokenHash, Date.now()).first();
    reject(!row, 401, 'Refresh credential has expired or was revoked.');
    const user = JSON.parse(row.profile);
    const credentials = await issueSession(env, user);
    await audit(env, user, 'STAFF_SESSION_REFRESHED', user.id);
    return response(request, env, 200, { user, ...credentials });
  }
  if (request.method === 'POST' && url.pathname === '/api/self-referral') {
    await rateLimit(request, env, 'self-referral', 20);
    const body = await readBody(request);
    reject(!object(body), 400, 'Screening payload is required.');
    const facilityId = body.facilityId || body.motherData?.facilityId;
    reject(!FACILITIES.some(facility => facility.id === facilityId), 400, 'Select a valid facility.');
    reject(body.consentGiven !== true && body.motherData?.consentGiven !== true, 400, 'Explicit informed consent is required.');
    reject(body.motherData?.name && body.motherData.name !== 'Anonymous Mother' || body.motherData?.motherName || body.motherData?.phone || body.motherData?.phoneNumber, 400, 'Anonymous submissions must not contain named patient details.');
    const previous = await screeningById(env, textField(body.id, 100));
    if (previous) {
      reject(!previous.isAnonymous || previous.facilityId !== facilityId || previous.anonymousCode !== body.anonymousCode || JSON.stringify(previous.answers) !== JSON.stringify(body.answers), 409, 'Submission ID already exists with different content.');
      return response(request, env, 200, { screening: publicReceipt(previous), duplicate: true });
    }
    const screening = await validateAndCreate(env, { ...body, facilityId, motherData: body.motherData || {} }, { id: 'anonymous', facilityId }, true);
    return response(request, env, 201, { screening: publicReceipt(screening) });
  }
  reject(!url.pathname.startsWith('/api/'), 404, 'API endpoint not found.');
  const user = await authenticate(request, env);
  if (request.method === 'POST' && url.pathname === '/api/auth/logout') {
    const body = await readBody(request);
    const token = request.headers.get('Authorization').slice(7);
    await env.DB.prepare('DELETE FROM sessions WHERE token_hash = ?').bind(await hash(token)).run();
    if (typeof body.refreshToken === 'string') await env.DB.prepare('DELETE FROM refresh_tokens WHERE token_hash = ? AND json_extract(profile, \'$.id\') = ?').bind(await hash(body.refreshToken), user.id).run();
    return response(request, env, 200, { ok: true });
  }
  if (request.method === 'GET' && url.pathname === '/api/auth/me') return response(request, env, 200, { user });
  if (request.method === 'POST' && url.pathname === '/api/sync/push') {
    const body = await readBody(request);
    reject(!Array.isArray(body.items) || body.items.length > 50, 400, 'Provide a batch of at most 50 operations.');
    const acceptedIds = [], rejectedItems = [];
    for (const item of body.items) {
      try { await processOperation(env, item, user); acceptedIds.push(item.id); }
      catch (error) { rejectedItems.push({ id: item?.id ?? null, status: error.status || 500, error: error.status ? error.message : 'Operation could not be saved.' }); }
    }
    return response(request, env, 200, { acceptedIds, rejectedItems });
  }
  if (request.method === 'GET' && url.pathname === '/api/sync/pull') {
    reject(url.searchParams.get('facilityId') && url.searchParams.get('facilityId') !== user.facilityId, 403, 'Cannot read another facility.');
    const since = Number(url.searchParams.get('since') || 0);
    reject(!Number.isSafeInteger(since) || since < 0, 400, 'Invalid synchronization cursor.');
    const page = await env.DB.prepare(`SELECT revision FROM (
      SELECT revision FROM screenings WHERE facility_id = ?
      UNION ALL
      SELECT revision FROM audit_log WHERE facility_id = ? AND (? = 'admin' OR user_id = ?)
    ) WHERE revision > ? ORDER BY revision LIMIT 101`).bind(user.facilityId, user.facilityId, user.role, user.id, since).all();
    const rows = page.results;
    const cursor = rows.length ? Number(rows[Math.min(rows.length, 100) - 1].revision) : since;
    const hasMore = rows.length > 100;
    const screeningRows = await env.DB.prepare('SELECT data FROM screenings WHERE facility_id = ? AND revision > ? AND revision <= ? ORDER BY revision').bind(user.facilityId, since, cursor).all();
    const auditRows = await env.DB.prepare("SELECT data FROM audit_log WHERE facility_id = ? AND revision > ? AND revision <= ? AND (? = 'admin' OR user_id = ?) ORDER BY revision").bind(user.facilityId, since, cursor, user.role, user.id).all();
    const screenings = await Promise.all(screeningRows.results.map(async row => restrictedRecord(await decrypt(row.data, env), user)));
    const auditLogs = await Promise.all(auditRows.results.map(row => decrypt(row.data, env)));
    return response(request, env, 200, { screenings, auditLogs, cursor, hasMore });
  }
  if (request.method === 'GET' && url.pathname === '/api/admin/audit') {
    reject(user.role !== 'admin', 403, 'Administrator access is required.');
    const auditRows = await env.DB.prepare('SELECT data FROM audit_log WHERE facility_id = ? ORDER BY revision DESC LIMIT 1000').bind(user.facilityId).all();
    const notificationRows = await env.DB.prepare('SELECT * FROM notifications WHERE facility_id = ? ORDER BY created_at DESC LIMIT 1000').bind(user.facilityId).all();
    const auditLogs = await Promise.all(auditRows.results.map(row => decrypt(row.data, env)));
    return response(request, env, 200, { auditLogs, notifications: notificationRows.results });
  }
  throw new ApiError(404, 'API endpoint not found.');
}
export default {
  async fetch(request, env) {
    try { return await handle(request, env); }
    catch (error) {
      if (!error.status) console.error('API request failed', { path: new URL(request.url).pathname, error: error.message });
      return response(request, env, error.status || 500, { error: error.status ? error.message : 'Internal server error.' });
    }
  }
};
