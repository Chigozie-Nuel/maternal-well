import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createApplication } from '../index.mjs';

let application, base;

before(async () => {
  application = createApplication({ databasePath: ':memory:', production: false });
  await new Promise(resolve => application.server.listen(0, '127.0.0.1', resolve));
  base = `http://127.0.0.1:${application.server.address().port}`;
  await signIn();
});
after(() => application.close());

const call = async (path, { token, body, method } = {}) => {
  const response = await fetch(`${base}${path}`, {
    method: method || (body ? 'POST' : 'GET'),
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined
  });
  return { status: response.status, body: await response.json().catch(() => null) };
};
const login = async (staffId, password) => (await call('/api/auth/login', { body: { staffId, password } })).body.token;
const answers = (values) => Object.fromEntries(values.map((value, index) => [index + 1, value]));
const screening = (answerValues, extra = {}) => ({
  id: randomUUID(),
  motherData: { name: 'Adaeze Okafor', fileNumber: `PHC-${Math.random().toString().slice(2, 8)}`, phone: '08030000000', age: 27, weeksPostpartum: 6, consentGiven: true },
  answers: answers(answerValues),
  createdAt: new Date().toISOString(),
  completedAt: new Date().toISOString(),
  ...extra
});
const push = (token, items) => call('/api/sync/push', { token, body: { items } });
const op = (entityId, action, payload) => ({ id: randomUUID(), entity: 'screenings', entityId, action, payload });

let worker, supervisor, admin, otherWorker;
const signIn = async () => {
  worker = await login('HW-01', 'Worker01!2026');
  supervisor = await login('SUP-01', 'Supervisor01!2026');
  admin = await login('ADMIN-01', 'Admin01!2026');
  otherWorker = await login('HW-02', 'Worker02!2026');
};

test('login rejects a wrong password and returns the role on success', async () => {
  assert.equal((await call('/api/auth/login', { body: { staffId: 'HW-01', password: 'nope' } })).status, 401);
  const ok = await call('/api/auth/login', { body: { staffId: 'SUP-01', password: 'Supervisor01!2026' } });
  assert.equal(ok.status, 200);
  assert.equal(ok.body.user.role, 'supervisor');
  assert.equal(ok.body.user.facilityId, 'phc-ikeja');
});

test('API requires authentication', async () => {
  assert.equal((await call('/api/sync/pull')).status, 401);
});

test('server re-scores EPDS and ignores client-supplied scores', async () => {
  const record = screening([0, 0, 0, 0, 0, 0, 0, 0, 0, 0], { score: 30 });
  const result = await push(worker, [op(record.id, 'CREATE', record)]);
  assert.equal(result.body.acceptedIds.length, 1);
  const pulled = (await call('/api/sync/pull?since=0', { token: worker })).body.screenings.find(item => item.id === record.id);
  assert.equal(pulled.score, 0);
  assert.equal(pulled.riskTier.tier, 'low');
  assert.equal(pulled.referralPlan.pathway, 'community_peer');
});

test('screenings without consent or with missing answers are rejected', async () => {
  const noConsent = screening([1, 1, 1, 1, 1, 1, 1, 1, 1, 0]);
  noConsent.motherData.consentGiven = false;
  const missing = screening([1, 1, 1]);
  const result = await push(worker, [op(noConsent.id, 'CREATE', noConsent), op(missing.id, 'CREATE', missing)]);
  assert.equal(result.body.acceptedIds.length, 0);
  assert.equal(result.body.rejectedItems.length, 2);
});

test('replaying the same operation is idempotent', async () => {
  const record = screening([1, 1, 1, 1, 1, 1, 1, 1, 1, 0]);
  const item = op(record.id, 'CREATE', record);
  await push(worker, [item]);
  const again = await push(worker, [item]);
  assert.deepEqual(again.body.acceptedIds, [item.id]);
});

test('Item-10 escalation: due today, safety confirm, supervisor-only acknowledgement', async () => {
  const record = screening([0, 0, 0, 0, 0, 0, 0, 0, 0, 1]);
  await push(worker, [op(record.id, 'CREATE', record)]);
  let pulled = (await call('/api/sync/pull?since=0', { token: supervisor })).body.screenings.find(item => item.id === record.id);
  assert.equal(pulled.hasSelfHarmRisk, true);
  assert.equal(pulled.referralPlan.pathway, 'urgent_psychiatric');
  assert.ok(pulled.escalationDueBy);
  assert.equal(pulled.answers[10], 1, 'escalated answers are visible to the supervisor');

  const badConfirm = await push(worker, [op(record.id, 'SAFETY_CONFIRM', { notLeftAlone: true })]);
  assert.equal(badConfirm.body.rejectedItems.length, 1);
  const confirm = await push(worker, [op(record.id, 'SAFETY_CONFIRM', { notLeftAlone: true, supervisorInformed: true })]);
  assert.equal(confirm.body.acceptedIds.length, 1);

  const workerAck = await push(worker, [op(record.id, 'ACKNOWLEDGE', { notes: 'seen' })]);
  assert.equal(workerAck.body.rejectedItems[0].status, 403);
  const noNotes = await push(supervisor, [op(record.id, 'ACKNOWLEDGE', { notes: ' ' })]);
  assert.equal(noNotes.body.rejectedItems[0].status, 400);
  const ack = await push(supervisor, [op(record.id, 'ACKNOWLEDGE', { notes: 'Called mother, psychiatric appointment today.' })]);
  assert.equal(ack.body.acceptedIds.length, 1);

  pulled = (await call('/api/sync/pull?since=0', { token: supervisor })).body.screenings.find(item => item.id === record.id);
  assert.equal(pulled.selfHarmAcknowledged, true);
  assert.equal(pulled.acknowledgedBy, 'SUP-01');
  assert.equal(pulled.workerSafetyConfirmation.confirmedBy, 'HW-01');
});

test('supervisors see case status but not item-level answers for non-escalated cases', async () => {
  const record = screening([2, 1, 1, 1, 1, 1, 1, 1, 1, 0]);
  await push(worker, [op(record.id, 'CREATE', record)]);
  const pulled = (await call('/api/sync/pull?since=0', { token: supervisor })).body.screenings.find(item => item.id === record.id);
  assert.equal(pulled.score, 10);
  assert.equal(pulled.motherData.fileNumber, record.motherData.fileNumber);
  assert.equal(pulled.answers, undefined);
  assert.equal(pulled.motherData.phone, undefined);
});

test('follow-up status uses pending / contacted / completed', async () => {
  const record = screening([2, 1, 1, 1, 1, 1, 1, 1, 1, 0]);
  await push(worker, [op(record.id, 'CREATE', record)]);
  const invalid = await push(worker, [op(record.id, 'FOLLOW_UP', { outcome: 'referred', notes: 'x' })]);
  assert.equal(invalid.body.rejectedItems.length, 1);
  const contacted = await push(worker, [op(record.id, 'FOLLOW_UP', { outcome: 'contacted', notes: 'Phoned, clinic visit booked.' })]);
  const completed = await push(supervisor, [op(record.id, 'FOLLOW_UP', { outcome: 'completed', notes: 'Attended counselling.' })]);
  assert.equal(contacted.body.acceptedIds.length + completed.body.acceptedIds.length, 2);
  const pulled = (await call('/api/sync/pull?since=0', { token: worker })).body.screenings.find(item => item.id === record.id);
  assert.equal(pulled.referralOutcome, 'completed');
  assert.equal(pulled.followUps.length, 2);
});

test('records are scoped to the facility', async () => {
  const record = screening([0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
  await push(worker, [op(record.id, 'CREATE', record)]);
  const other = (await call('/api/sync/pull?since=0', { token: otherWorker })).body.screenings;
  assert.ok(!other.some(item => item.id === record.id));
  const tamper = await push(otherWorker, [op(record.id, 'FOLLOW_UP', { outcome: 'contacted', notes: 'x' })]);
  assert.equal(tamper.body.rejectedItems[0].status, 404);
});

test('anonymous self-referral reaches the facility queue without identity', async () => {
  const body = { id: randomUUID(), anonymousCode: 'MW-ABCD-2345', facilityId: 'phc-ikeja', consentGiven: true, motherData: { consentGiven: true }, answers: answers([3, 3, 2, 2, 1, 1, 0, 0, 0, 2]) };
  const created = await call('/api/self-referral', { body });
  assert.equal(created.status, 201);
  assert.equal(created.body.screening.hasSelfHarmRisk, true);
  assert.equal(created.body.screening.motherData, undefined, 'receipt does not echo data');
  const named = await call('/api/self-referral', { body: { ...body, id: randomUUID(), motherData: { name: 'Real Name', consentGiven: true } } });
  assert.equal(named.status, 400);
  const queue = (await call('/api/sync/pull?since=0', { token: supervisor })).body.screenings;
  const found = queue.find(item => item.anonymousCode === 'MW-ABCD-2345');
  assert.ok(found);
  assert.equal(found.isAnonymous, true);
});

test('soft delete: supervisor only, reason required, pending escalation blocks it', async () => {
  const record = screening([0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
  await push(worker, [op(record.id, 'CREATE', record)]);
  assert.equal((await push(worker, [op(record.id, 'DELETE', { reason: 'dup' })])).body.rejectedItems[0].status, 403);
  assert.equal((await push(supervisor, [op(record.id, 'DELETE', {})])).body.rejectedItems[0].status, 400);
  assert.equal((await push(supervisor, [op(record.id, 'DELETE', { reason: 'Duplicate registration' })])).body.acceptedIds.length, 1);
  const flagged = screening([0, 0, 0, 0, 0, 0, 0, 0, 0, 2]);
  await push(worker, [op(flagged.id, 'CREATE', flagged)]);
  assert.equal((await push(supervisor, [op(flagged.id, 'DELETE', { reason: 'x' })])).body.rejectedItems[0].status, 409);
});

test('admin reads the audit trail with real user ids and cannot write', async () => {
  const audit = await call('/api/admin/audit', { token: admin });
  assert.equal(audit.status, 200);
  assert.ok(audit.body.auditLogs.some(entry => entry.action === 'ESCALATION_ACKNOWLEDGED' && entry.userId === 'SUP-01'));
  assert.ok(audit.body.auditLogs.every(entry => entry.userId && entry.timestamp));
  assert.ok(audit.body.notifications.length >= 1, 'escalations record a supervisor notification');
  const record = screening([0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
  assert.equal((await push(admin, [op(record.id, 'CREATE', record)])).body.rejectedItems[0].status, 403);
  assert.equal((await call('/api/admin/audit', { token: worker })).status, 403);
});

test('CORS allows the Android shell origin', async () => {
  const response = await fetch(`${base}/api/health`, { headers: { Origin: 'capacitor://localhost' } });
  assert.equal(response.headers.get('access-control-allow-origin'), 'capacitor://localhost');
  const foreign = await fetch(`${base}/api/health`, { headers: { Origin: 'https://evil.example' } });
  assert.equal(foreign.headers.get('access-control-allow-origin'), null);
});
