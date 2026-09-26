import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '../db/db';
import { enqueueOutbox, getPendingOutboxCount, flushOutbox } from '../db/sync';

describe('Outbox Sync Engine & IndexedDB Data Layer', () => {
  beforeEach(async () => {
    await db.outbox.clear();
    await db.screenings.clear();
    await db.auditLog.clear();
  });

  it('enqueues mutations into the persistent outbox table with pending status', async () => {
    const payload = {
      id: 'screening-test-1',
      facilityId: 'phc-ikeja',
      score: 14,
      riskTier: 'High Risk'
    };

    const outboxId = await enqueueOutbox({
      entity: 'screenings',
      entityId: payload.id,
      action: 'CREATE',
      payload
    });

    expect(outboxId).toBeDefined();

    const pendingCount = await getPendingOutboxCount();
    expect(pendingCount).toBe(1);

    const record = await db.outbox.get(outboxId);
    expect(record.status).toBe('pending');
    expect(record.retryCount).toBe(0);
    expect(record.payload).toEqual(payload);
  });

  it('applies exponential backoff and tracks retry count on server network errors', async () => {
    // Add item directly to outbox
    const item = {
      id: 'outbox-err-1',
      entity: 'screenings',
      entityId: 'sc-1',
      action: 'CREATE',
      payload: { id: 'sc-1' },
      status: 'pending',
      retryCount: 0,
      nextRetryAt: Date.now() - 1000,
      createdAt: new Date().toISOString()
    };
    await db.outbox.put(item);

    // Mock fetch failure
    global.fetch = async () => {
      throw new Error('Connection refused (mock server down)');
    };

    const result = await flushOutbox();
    expect(result.synced).toBe(0);
    expect(result.error).toContain('Connection refused');

    const updated = await db.outbox.get('outbox-err-1');
    expect(updated.retryCount).toBe(1);
    expect(updated.nextRetryAt).toBeGreaterThan(Date.now());
    expect(updated.lastError).toContain('Connection refused');
  });
});
