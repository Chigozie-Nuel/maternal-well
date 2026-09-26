/**
 * Same-clinic-day escalation deadline (SRS NFR-4, business rule 3).
 *
 * Nigeria uses West Africa Time (UTC+1, no daylight saving), so the deadline is
 * computed at a fixed offset and gives the same answer on the device and the server.
 */

export const CLINIC_DAY_END_HOUR = 17;
const WAT_OFFSET_MS = 60 * 60 * 1000;

export function escalationDueBy(completedAt) {
  const completed = new Date(completedAt);
  const local = new Date(completed.getTime() + WAT_OFFSET_MS);
  const due = new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate(), CLINIC_DAY_END_HOUR, 0, 0));
  // Completed after clinic hours: still due the same calendar day.
  if (local.getTime() >= due.getTime()) due.setUTCHours(23, 59, 59, 0);
  return new Date(due.getTime() - WAT_OFFSET_MS).toISOString();
}

export function requiresAcknowledgement(record) {
  return Boolean(record?.hasSelfHarmRisk);
}

export function isUrgent(record) {
  return Boolean(record?.hasSelfHarmRisk || (typeof record?.score === 'number' && record.score >= 13));
}

export function escalationState(record, now = new Date()) {
  if (!requiresAcknowledgement(record)) return 'none';
  if (record.selfHarmAcknowledged) return 'acknowledged';
  const due = record.escalationDueBy || escalationDueBy(record.completedAt || record.createdAt);
  return new Date(now) > new Date(due) ? 'overdue' : 'pending';
}
