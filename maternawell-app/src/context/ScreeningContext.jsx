import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { scoreEpds, classifyRisk, isEscalation, getReferralPlan, HIGH_RISK_CUTOFF, NIGERIAN_EPDS_CUTOFF } from '../domain/epds';
import { escalationDueBy, escalationState, isUrgent } from '../domain/escalation';
import { deleteCase, deleteDraft, enqueueOperation, listAudit, listCases, listDrafts, purgeLegacyPlaintext, putAudit, putCase, putDraft } from '../db/db';
import { getSyncState, outboxSummary, retryFailed, startSyncScheduler, subscribeSync, syncNow } from '../db/sync';
import { getSessionKey } from '../utils/crypto';
import { useAuth } from './AuthContext';

/**
 * Screening, referral and escalation state for the signed-in staff member.
 * Every change is written to the encrypted on-device store and queued for sync
 * before the UI moves on, so nothing is lost if the connection, battery or tab dies.
 */
const ScreeningContext = createContext(null);

export const FOLLOW_UP_STATUSES = ['pending', 'contacted', 'completed', 'lost_to_followup'];
export const FOLLOW_UP_LABELS = { pending: 'Pending', contacted: 'Contacted', completed: 'Completed', lost_to_followup: 'Lost to follow-up' };

// Actions the server does not log itself; everything else is audited server-side when the operation syncs.
const CLIENT_ONLY_AUDIT = new Set(['SCREENING_STARTED', 'SCREENING_CANCELLED', 'DRAFT_RESUMED', 'CASE_EXPORTED']);

export const useScreening = () => {
  const context = useContext(ScreeningContext);
  if (!context) throw new Error('useScreening must be used within a ScreeningProvider');
  return context;
};

const nowIso = () => new Date().toISOString();

export function buildCompletedScreening(draft, answers, user) {
  const score = scoreEpds(answers);
  const escalation = isEscalation(answers);
  const plan = getReferralPlan(score, answers);
  const completedAt = nowIso();
  const { currentQuestion, ...rest } = draft;
  return {
    ...rest,
    facilityId: user.facilityId,
    workerId: user.id,
    answers,
    completed: true,
    score,
    riskTier: classifyRisk(score),
    hasSelfHarmRisk: escalation,
    referralPlan: plan,
    referralActions: plan.actions,
    status: escalation || score >= HIGH_RISK_CUTOFF ? 'urgent_referral' : score >= NIGERIAN_EPDS_CUTOFF ? 'referral_needed' : 'completed',
    ...(escalation ? { escalationDueBy: escalationDueBy(completedAt) } : {}),
    completedAt,
    updatedAt: completedAt,
    selfHarmAcknowledged: false,
    referralOutcome: 'pending',
    followUps: [],
    syncStatus: 'pending'
  };
}

export const ScreeningProvider = ({ children }) => {
  const { user, token, status } = useAuth();
  const ownerId = status === 'ready' ? user?.id : null;
  const [cases, setCases] = useState([]);
  const [drafts, setDrafts] = useState([]);
  const [currentScreening, setCurrentScreening] = useState(null);
  const [auditLogs, setAuditLogs] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [sync, setSync] = useState({ ...getSyncState(), pending: 0, failed: [], queuedSelfReferrals: 0 });
  const [isOnline, setIsOnline] = useState(typeof navigator === 'undefined' ? true : navigator.onLine);
  const busyRef = useRef(false);
  const contextRef = useRef(null);
  contextRef.current = { ownerId, token, key: getSessionKey(), role: user?.role };

  const key = () => {
    const sessionKey = getSessionKey();
    if (!sessionKey) throw new Error('Your session is locked. Enter your password to continue.');
    return sessionKey;
  };

  const reload = useCallback(async () => {
    const { ownerId: owner, key: sessionKey } = contextRef.current;
    if (!owner || !sessionKey) return;
    const [nextCases, nextDrafts, nextAudit, summary] = await Promise.all([
      listCases(owner, sessionKey), listDrafts(owner, sessionKey), listAudit(owner, sessionKey), outboxSummary(owner)
    ]);
    setCases(nextCases);
    setDrafts(nextDrafts);
    setAuditLogs(nextAudit);
    setSync(previous => ({ ...previous, ...getSyncState(), ...summary }));
    setLoaded(true);
  }, []);

  useEffect(() => { purgeLegacyPlaintext(); }, []);

  useEffect(() => {
    const online = () => setIsOnline(true);
    const offline = () => setIsOnline(false);
    window.addEventListener('online', online);
    window.addEventListener('offline', offline);
    return () => { window.removeEventListener('online', online); window.removeEventListener('offline', offline); };
  }, []);

  // Load this account's records and start background sync once the session is unlocked.
  useEffect(() => {
    if (!ownerId) {
      setCases([]); setDrafts([]); setAuditLogs([]); setCurrentScreening(null); setLoaded(false);
      return undefined;
    }
    reload();
    const stop = startSyncScheduler(() => contextRef.current);
    let lastRun = null;
    const unsubscribe = subscribeSync(state => {
      setSync(previous => ({ ...previous, ...state }));
      if (state.running) return;
      if (state.lastSyncAt !== lastRun) {
        lastRun = state.lastSyncAt;
        reload();
      } else {
        // Failed attempt: records are unchanged but the pending/failed counts may not be.
        outboxSummary(contextRef.current.ownerId).then(summary => setSync(previous => ({ ...previous, ...summary }))).catch(() => {});
      }
    });
    return () => { stop(); unsubscribe(); };
  }, [ownerId, reload]);

  const audit = useCallback(async (action, details = {}, entityId = details.screeningId || '') => {
    const { ownerId: owner } = contextRef.current;
    if (!owner) return;
    const entry = { id: crypto.randomUUID(), timestamp: nowIso(), action, entityId, userId: user.id, staffId: user.staffId, facilityId: user.facilityId, details, syncStatus: 'local' };
    await putAudit(owner, entry, key());
    if (CLIENT_ONLY_AUDIT.has(action) && user.role !== 'admin') {
      await enqueueOperation(owner, { entity: 'auditLog', entityId: entry.id, action: 'CREATE', payload: { id: entry.id, action, entityId, timestamp: entry.timestamp } }, key());
    }
    setAuditLogs(previous => [entry, ...previous]);
  }, [user]);

  const afterWrite = useCallback(async () => {
    await reload();
    syncNow(contextRef.current);
  }, [reload]);

  // ---- Screening flow ----------------------------------------------------------

  const startScreening = useCallback(async motherData => {
    if (user?.role !== 'health_worker') throw new Error('Only health workers can record named screenings.');
    const createdAt = nowIso();
    const draft = {
      id: crypto.randomUUID(),
      facilityId: user.facilityId,
      workerId: user.id,
      motherData: { ...motherData, consentGiven: true, consentRecordedBy: user.id },
      answers: {},
      currentQuestion: 1,
      completed: false,
      status: 'in_progress',
      createdAt,
      updatedAt: createdAt
    };
    await putDraft(ownerId, draft, key());
    setCurrentScreening(draft);
    setDrafts(previous => [draft, ...previous]);
    await audit('SCREENING_STARTED', { screeningId: draft.id, fileNumber: motherData.fileNumber }, draft.id);
    return draft;
  }, [user, ownerId, audit]);

  /**
   * Records one answer and moves to the next question in a single state update.
   * The draft is saved (encrypted) before the screen advances. Answering question 10
   * scores, classifies, stores and queues the completed screening.
   */
  const answerAndAdvance = useCallback(async (questionId, value) => {
    const draft = currentScreening;
    if (!draft || draft.completed || draft.currentQuestion !== questionId || busyRef.current) return draft;
    busyRef.current = true;
    try {
      const answers = { ...draft.answers, [questionId]: value };
      if (questionId < 10) {
        const next = { ...draft, answers, currentQuestion: questionId + 1, updatedAt: nowIso() };
        await putDraft(ownerId, next, key());
        setCurrentScreening(next);
        setDrafts(previous => [next, ...previous.filter(item => item.id !== next.id)]);
        return next;
      }
      const completed = buildCompletedScreening(draft, answers, user);
      await putCase(ownerId, completed, key());
      await enqueueOperation(ownerId, { entityId: completed.id, action: 'CREATE', payload: completed }, key());
      await deleteDraft(ownerId, completed.id);
      setCurrentScreening(completed);
      setDrafts(previous => previous.filter(item => item.id !== completed.id));
      setCases(previous => [completed, ...previous.filter(item => item.id !== completed.id)]);
      await audit('SCREENING_COMPLETED', { screeningId: completed.id, score: completed.score, riskTier: completed.riskTier.label, hasSelfHarmRisk: completed.hasSelfHarmRisk }, completed.id);
      if (completed.hasSelfHarmRisk) await audit('SELF_HARM_ESCALATION_TRIGGERED', { screeningId: completed.id, item10: answers[10], dueBy: completed.escalationDueBy }, completed.id);
      syncNow(contextRef.current);
      return completed;
    } finally {
      busyRef.current = false;
    }
  }, [currentScreening, ownerId, user, audit]);

  const previousQuestion = useCallback(() => {
    setCurrentScreening(draft => (draft && !draft.completed && draft.currentQuestion > 1 ? { ...draft, currentQuestion: draft.currentQuestion - 1 } : draft));
  }, []);

  const resumeDraft = useCallback(async draft => {
    const firstUnanswered = Array.from({ length: 10 }, (_, index) => index + 1).find(number => draft.answers?.[number] === undefined) || 10;
    const resumed = { ...draft, currentQuestion: firstUnanswered };
    setCurrentScreening(resumed);
    await audit('DRAFT_RESUMED', { screeningId: draft.id, question: firstUnanswered }, draft.id);
    return resumed;
  }, [audit]);

  const discardDraft = useCallback(async draftId => {
    await deleteDraft(ownerId, draftId);
    setDrafts(previous => previous.filter(item => item.id !== draftId));
    setCurrentScreening(current => (current?.id === draftId ? null : current));
    await audit('SCREENING_CANCELLED', { screeningId: draftId }, draftId);
  }, [ownerId, audit]);

  // ---- Referral, escalation and case management ------------------------------

  const updateCase = useCallback(async (id, action, payload, apply) => {
    const record = cases.find(item => item.id === id);
    if (!record) throw new Error('Case not found on this device. Sync and try again.');
    const updated = { ...apply(structuredClone(record)), updatedAt: nowIso(), syncStatus: 'pending' };
    await putCase(ownerId, updated, key());
    await enqueueOperation(ownerId, { entityId: id, action, payload }, key());
    setCases(previous => previous.map(item => (item.id === id ? updated : item)));
    return updated;
  }, [cases, ownerId]);

  const confirmSafety = useCallback(async id => {
    const updated = await updateCase(id, 'SAFETY_CONFIRM', { notLeftAlone: true, supervisorInformed: true }, record => ({
      ...record,
      workerSafetyConfirmation: { notLeftAlone: true, supervisorInformed: true, confirmedAt: nowIso(), confirmedBy: user.id }
    }));
    await audit('ESCALATION_SAFETY_CONFIRMED', { screeningId: id }, id);
    syncNow(contextRef.current);
    return updated;
  }, [updateCase, audit, user]);

  const recordFollowUp = useCallback(async (id, outcome, notes) => {
    if (!FOLLOW_UP_STATUSES.includes(outcome)) throw new Error('Choose a follow-up status.');
    const trimmed = (notes || '').trim();
    if (outcome !== 'pending' && !trimmed) throw new Error('Add a short note describing the follow-up.');
    const entryId = crypto.randomUUID();
    const updated = await updateCase(id, 'FOLLOW_UP', { outcome, notes: trimmed }, record => {
      const timestamp = nowIso();
      return {
        ...record,
        followUps: [...(record.followUps || []), { id: entryId, outcome, notes: trimmed, timestamp, workerId: user.id }],
        referralOutcome: outcome,
        referralOutcomeDate: timestamp,
        referralNotes: trimmed,
        status: outcome === 'completed' ? 'completed' : record.status
      };
    });
    await audit('REFERRAL_FOLLOW_UP_RECORDED', { screeningId: id, outcome }, id);
    afterWrite();
    return updated;
  }, [updateCase, audit, user, afterWrite]);

  const acknowledgeEscalation = useCallback(async (id, notes) => {
    if (user?.role !== 'supervisor') throw new Error('Only a facility supervisor can acknowledge an escalation.');
    const trimmed = (notes || '').trim();
    if (!trimmed) throw new Error('Describe the action taken before acknowledging.');
    const updated = await updateCase(id, 'ACKNOWLEDGE', { notes: trimmed }, record => ({
      ...record, selfHarmAcknowledged: true, selfHarmAcknowledgedAt: nowIso(), acknowledgedBy: user.id, supervisorNotes: trimmed
    }));
    await audit('ESCALATION_ACKNOWLEDGED', { screeningId: id }, id);
    afterWrite();
    return updated;
  }, [updateCase, audit, user, afterWrite]);

  const softDeleteCase = useCallback(async (id, reason) => {
    if (user?.role !== 'supervisor') throw new Error('Only a facility supervisor can remove a record.');
    const record = cases.find(item => item.id === id);
    if (record?.hasSelfHarmRisk && !record.selfHarmAcknowledged) throw new Error('Acknowledge the self-harm escalation before removing this record.');
    const trimmed = (reason || '').trim();
    if (!trimmed) throw new Error('A reason is required to remove a record.');
    await enqueueOperation(ownerId, { entityId: id, action: 'DELETE', payload: { reason: trimmed } }, key());
    await deleteCase(ownerId, id);
    setCases(previous => previous.filter(item => item.id !== id));
    await audit('SCREENING_SOFT_DELETED', { screeningId: id, reason: trimmed }, id);
    afterWrite();
  }, [cases, ownerId, user, audit, afterWrite]);

  const stats = useMemo(() => {
    const active = cases.filter(item => !item.deletedAt);
    const count = predicate => active.filter(predicate).length;
    return {
      total: active.length,
      lowRisk: count(item => item.riskTier?.tier === 'low'),
      moderateRisk: count(item => item.riskTier?.tier === 'moderate'),
      highRisk: count(item => item.riskTier?.tier === 'high'),
      urgentReferrals: count(isUrgent),
      selfHarmFlags: count(item => item.hasSelfHarmRisk),
      pendingAcknowledgments: count(item => escalationState(item) === 'pending'),
      overdueAcknowledgments: count(item => escalationState(item) === 'overdue'),
      referralsNeeded: count(item => item.riskTier?.tier !== 'low' || item.hasSelfHarmRisk),
      followUp: Object.fromEntries(FOLLOW_UP_STATUSES.map(status => [status, count(item => (item.riskTier?.tier !== 'low' || item.hasSelfHarmRisk) && (item.referralOutcome || 'pending') === status)])),
      anonymous: count(item => item.isAnonymous)
    };
  }, [cases]);

  const value = {
    loaded,
    screenings: cases,
    cases,
    drafts,
    activeDraft: drafts[0] || null,
    currentScreening,
    auditLogs,
    stats,
    getStats: () => stats,
    isOnline,
    sync,
    pendingSyncCount: sync.pending,
    lastSyncTime: sync.lastSyncAt,
    isSyncing: sync.running,
    getScreeningById: id => cases.find(item => item.id === id) || (currentScreening?.id === id ? currentScreening : null),
    startScreening,
    answerAndAdvance,
    previousQuestion,
    resumeDraft,
    discardDraft,
    resetCurrentScreening: () => setCurrentScreening(null),
    confirmSafety,
    recordFollowUp,
    acknowledgeEscalation,
    softDeleteCase,
    addAuditLog: audit,
    performSync: async () => { await syncNow(contextRef.current); await reload(); },
    retryFailedSync: async () => { await retryFailed(ownerId); await syncNow(contextRef.current); await reload(); }
  };

  return <ScreeningContext.Provider value={value}>{children}</ScreeningContext.Provider>;
};
