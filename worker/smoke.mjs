import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { gzipSync } from 'node:zlib';

const base = process.env.API_BASE || 'http://127.0.0.1:8787';
const call = async (path, { token, body, method, origin } = {}) => {
  const result = await fetch(`${base}${path}`, {
    method: method || (body ? 'POST' : 'GET'),
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(origin ? { Origin: origin } : {}) },
    body: body ? JSON.stringify(body) : undefined
  });
  return { status: result.status, body: await result.json().catch(() => null), headers: result.headers };
};
const health = await call('/api/health');
assert.equal(health.status, 200);
assert.equal(health.body.status, 'ok');
const wrong = await call('/api/auth/login', { body: { staffId: 'HW-01', password: 'wrong' } });
assert.equal(wrong.status, 401);
const worker = await call('/api/auth/login', { body: { staffId: 'HW-01', password: 'Worker01!2026' } });
assert.equal(worker.status, 200);
assert.equal(worker.body.user.role, 'health_worker');
const supervisor = await call('/api/auth/login', { body: { staffId: 'SUP-01', password: 'Supervisor01!2026' } });
assert.equal(supervisor.status, 200);
const admin = await call('/api/auth/login', { body: { staffId: 'ADMIN-01', password: 'Admin01!2026' } });
assert.equal(admin.status, 200);
const id = randomUUID();
const record = {
  id,
  motherData: { name: 'Fictional Demo Patient', fileNumber: `DEMO-${id.slice(0, 8)}`, consentGiven: true },
  answers: Object.fromEntries(Array.from({ length: 10 }, (_, index) => [index + 1, index === 9 ? 1 : 0])),
  score: 0
};
const item = { id: randomUUID(), entity: 'screenings', entityId: id, action: 'CREATE', payload: record };
const pushed = await call('/api/sync/push', { token: worker.body.token, body: { items: [item] } });
assert.equal(pushed.status, 200);
assert.deepEqual(pushed.body.acceptedIds, [item.id]);
const pulled = await call('/api/sync/pull?since=0', { token: supervisor.body.token });
assert.equal(pulled.status, 200);
const screening = pulled.body.screenings.find(entry => entry.id === id);
assert.equal(screening.hasSelfHarmRisk, true);
assert.ok(screening.answers);
const acknowledged = await call('/api/sync/push', {
  token: supervisor.body.token,
  body: { items: [{ id: randomUUID(), entity: 'screenings', entityId: id, action: 'ACKNOWLEDGE', payload: { notes: 'Fictional supervisor demo handoff.' } }] }
});
assert.equal(acknowledged.body.acceptedIds.length, 1);
const audit = await call('/api/admin/audit', { token: admin.body.token });
assert.equal(audit.status, 200);
assert.ok(audit.body.auditLogs.some(entry => entry.entityId === id));
const anonymousId = randomUUID();
const referral = await call('/api/self-referral', { body: {
  id: anonymousId, anonymousCode: `MW-DEMO-${anonymousId.slice(0, 8).toUpperCase()}`,
  facilityId: 'phc-ikeja', motherData: { consentGiven: true },
  answers: Object.fromEntries(Array.from({ length: 10 }, (_, index) => [index + 1, 0]))
} });
assert.equal(referral.status, 201);
assert.equal(referral.body.screening.syncStatus, 'synced');
const auditItem = { id: randomUUID(), entity: 'auditLog', entityId: id, action: 'CREATE', payload: { action: 'DEMO_CHECK', details: { note: 'fictional test'.repeat(100) } } };
const compressed = await fetch(`${base}/api/sync/push`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${worker.body.token}`, 'Content-Type': 'application/json', 'Content-Encoding': 'gzip' },
  body: gzipSync(JSON.stringify({ items: [auditItem] }))
});
assert.equal(compressed.status, 200);
assert.deepEqual((await compressed.json()).acceptedIds, [auditItem.id]);
const cors = await call('/api/health', { origin: 'https://chigozie-nuel.github.io' });
assert.equal(cors.headers.get('access-control-allow-origin'), 'https://chigozie-nuel.github.io');
console.log('Cloudflare API smoke test passed: health, auth, sync, escalation, audit, anonymous referral, gzip, CORS.');
