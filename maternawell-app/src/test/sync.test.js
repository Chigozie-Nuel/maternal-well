import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { db, enqueueOperation, getCase, getMeta, putCase } from '../db/db';
import { backoffFor, getSyncState, markAuthRestored, syncNow } from '../db/sync';
import { deriveKey, generateSalt } from '../utils/crypto';

const json = (body, status = 200) => Promise.resolve(new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } }));

describe('Outbox sync engine (FR-9, NFR-2)', () => {
  let key;
  let context;
  beforeEach(async () => {
    await Promise.all(db.tables.map(table => table.clear()));
    key = await deriveKey('pw', generateSalt());
    context = { ownerId: 'HW-01', token: 't', key, role: 'health_worker' };
    markAuthRestored();
  });
  afterEach(() => vi.unstubAllGlobals());

  it('pushes queued operations, clears them, then pulls and stores server records encrypted', async () => {
    const op = await enqueueOperation('HW-01', { entityId: 'c1', action: 'CREATE', payload: { id: 'c1', motherData: { name: 'Amina' } } }, key);
    const fetchMock = vi.fn((url, init) => {
      if (url.includes('/push')) {
        const body = JSON.parse(init.body);
        expect(body.items[0]).toMatchObject({ id: op.id, entityId: 'c1', action: 'CREATE' });
        expect(body.items[0].payload.motherData.name).toBe('Amina');
        return json({ acceptedIds: [op.id], rejectedItems: [] });
      }
      return json({ screenings: [{ id: 'c1', score: 4, motherData: { name: 'Amina' } }], auditLogs: [], cursor: 7 });
    });
    vi.stubGlobal('fetch', fetchMock);
    await syncNow(context);
    expect(await db.syncOutbox.count()).toBe(0);
    expect((await getCase('HW-01', 'c1', key)).syncStatus).toBe('synced');
    expect(JSON.stringify(await db.cases.toArray())).not.toContain('Amina');
    expect(await getMeta('cursor:HW-01')).toBe(7);
    expect(fetchMock.mock.calls[1][0]).toContain('since=0');
  });

  it('keeps work pending with exponential backoff when the network is down', async () => {
    await enqueueOperation('HW-01', { entityId: 'c1', action: 'CREATE', payload: {} }, key);
    vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new TypeError('Failed to fetch'))));
    const before = Date.now();
    await syncNow(context);
    const [item] = await db.syncOutbox.toArray();
    expect(item.status).toBe('pending');
    expect(item.retryCount).toBe(1);
    expect(item.nextRetryAt).toBeGreaterThanOrEqual(before + 5000);
    expect(getSyncState().serverReachable).toBe(false);
    expect([1, 2, 3, 10].map(backoffFor)).toEqual([5000, 10000, 20000, 300000]);
  });

  it('marks validation rejections failed but retries server errors', async () => {
    const bad = await enqueueOperation('HW-01', { entityId: 'c1', action: 'CREATE', payload: {} }, key);
    const flaky = await enqueueOperation('HW-01', { entityId: 'c2', action: 'CREATE', payload: {} }, key);
    vi.stubGlobal('fetch', vi.fn(url => (url.includes('/push')
      ? json({ acceptedIds: [], rejectedItems: [{ id: bad.id, status: 400, error: 'Explicit informed consent is required.' }, { id: flaky.id, status: 500, error: 'Operation could not be saved.' }] })
      : json({ screenings: [], auditLogs: [], cursor: 1 }))));
    await syncNow(context);
    expect((await db.syncOutbox.get(bad.id)).status).toBe('failed');
    expect((await db.syncOutbox.get(bad.id)).lastError).toMatch(/consent/);
    expect((await db.syncOutbox.get(flaky.id)).status).toBe('pending');
  });

  it('flags an expired session instead of dropping work', async () => {
    await enqueueOperation('HW-01', { entityId: 'c1', action: 'CREATE', payload: {} }, key);
    vi.stubGlobal('fetch', vi.fn(() => json({ error: 'Session has expired or is invalid.' }, 401)));
    await syncNow(context);
    expect(getSyncState().authExpired).toBe(true);
    expect(await db.syncOutbox.count()).toBe(1);
  });

  it('renews authentication after an offline sign-in and uploads queued work on reconnect', async () => {
    const item = await enqueueOperation('HW-01', { entityId: 'c1', action: 'CREATE', payload: { id: 'c1' } }, key);
    const renew = vi.fn().mockResolvedValue('renewed-token');
    const fetchMock = vi.fn((url, init) => {
      expect(init.headers.Authorization).toBe('Bearer renewed-token');
      return url.includes('/push') ? json({ acceptedIds: [item.id], rejectedItems: [] }) : json({ screenings: [], cursor: 1 });
    });
    vi.stubGlobal('fetch', fetchMock);
    const result = await syncNow({ ...context, token: null, renew });
    expect(renew).toHaveBeenCalledOnce();
    expect(result.pushed).toBe(1);
    expect(await db.syncOutbox.count()).toBe(0);
    expect(getSyncState().lastSyncAt).toBeTruthy();
  });

  it('does not claim staff synchronization succeeded when no credential can be restored', async () => {
    await enqueueOperation('HW-01', { entityId: 'c1', action: 'CREATE', payload: {} }, key);
    const previousSync = getSyncState().lastSyncAt;
    const result = await syncNow({ ...context, token: null });
    expect(result.error).toMatch(/Sign in online/);
    expect(getSyncState().lastSyncAt).toBe(previousSync);
    expect(await db.syncOutbox.count()).toBe(1);
  });

  it('pulls every page before reporting a completed synchronization', async () => {
    vi.stubGlobal('fetch', vi.fn(url => url.includes('since=0')
      ? json({ screenings: [{ id: 'a' }], auditLogs: [], cursor: 100, hasMore: true })
      : json({ screenings: [{ id: 'b' }], auditLogs: [], cursor: 115, hasMore: false })));
    const result = await syncNow(context);
    expect(result.pulled).toBe(2);
    expect(await getMeta('cursor:HW-01')).toBe(115);
  });

  it('never overwrites a record that still has local changes queued', async () => {
    await putCase('HW-01', { id: 'c1', referralOutcome: 'contacted' }, key);
    const op = await enqueueOperation('HW-01', { entityId: 'c1', action: 'FOLLOW_UP', payload: { outcome: 'contacted', notes: 'x' } }, key);
    vi.stubGlobal('fetch', vi.fn(url => (url.includes('/push')
      ? json({ acceptedIds: [], rejectedItems: [{ id: op.id, status: 503, error: 'busy' }] })
      : json({ screenings: [{ id: 'c1', referralOutcome: 'pending' }], cursor: 2 }))));
    await syncNow(context);
    expect((await getCase('HW-01', 'c1', key)).referralOutcome).toBe('contacted');
  });
});
