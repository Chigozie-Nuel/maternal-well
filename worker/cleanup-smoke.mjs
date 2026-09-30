import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

const base = process.env.API_BASE || 'http://127.0.0.1:8787';
async function call(path, token, body) {
  const response = await fetch(`${base}${path}`, {
    method: body ? 'POST' : 'GET',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined
  });
  assert.equal(response.ok, true, `${path}: ${response.status}`);
  return response.json();
}
const { token } = await call('/api/auth/login', null, { staffId: 'SUP-01', password: 'Supervisor01!2026' });
const { screenings } = await call('/api/sync/pull?since=0', token);
const testRecords = screenings.filter(record => !record.deletedAt && (
  (record.motherData?.name === 'Fictional Demo Patient' && record.motherData?.fileNumber?.startsWith('DEMO-')) ||
  record.anonymousCode?.startsWith('MW-DEMO-')
));
for (const record of testRecords) {
  const item = { id: randomUUID(), entity: 'screenings', entityId: record.id, action: 'DELETE', payload: { reason: 'Remove fictional deployment smoke-test record.' } };
  const result = await call('/api/sync/push', token, { items: [item] });
  assert.deepEqual(result.acceptedIds, [item.id]);
}
console.log(`Soft-deleted ${testRecords.length} fictional smoke-test records.`);
