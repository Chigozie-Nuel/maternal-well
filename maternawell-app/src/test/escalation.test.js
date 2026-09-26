import { describe, it, expect } from 'vitest';
import { escalationDueBy, escalationState } from '../domain/escalation';

describe('Same-clinic-day escalation (NFR-4, business rule 3)', () => {
  it('is due at 17:00 West Africa Time on the day of screening', () => {
    // 10:00 WAT = 09:00 UTC
    expect(escalationDueBy('2026-09-26T09:00:00.000Z')).toBe('2026-09-26T16:00:00.000Z');
  });

  it('is due before midnight when screened after clinic hours', () => {
    // 18:30 WAT = 17:30 UTC
    expect(escalationDueBy('2026-09-26T17:30:00.000Z')).toBe('2026-09-26T22:59:59.000Z');
  });

  it('moves from pending to overdue to acknowledged', () => {
    const record = { hasSelfHarmRisk: true, completedAt: '2026-09-26T09:00:00.000Z' };
    expect(escalationState(record, new Date('2026-09-26T12:00:00Z'))).toBe('pending');
    expect(escalationState(record, new Date('2026-09-26T16:01:00Z'))).toBe('overdue');
    expect(escalationState({ ...record, selfHarmAcknowledged: true }, new Date('2026-09-27T00:00:00Z'))).toBe('acknowledged');
    expect(escalationState({ hasSelfHarmRisk: false, score: 20 })).toBe('none');
  });
});
