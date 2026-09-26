import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { scoreEpds, classifyRisk, isEscalation, getReferralPlan } from '../domain/epds';
import { db, migrateFromLocalStorage } from '../db/db';
import { 
  enqueueOutbox, 
  flushOutbox, 
  initSyncEngine, 
  subscribeSyncStatus, 
  getPendingOutboxCount, 
  getLastSyncTime, 
  isSyncInProgress 
} from '../db/sync';
import {
  encryptScreeningRecord,
  decryptScreeningRecord,
  encryptDraftRecord,
  decryptDraftRecord,
  ensureSessionKey,
  getSessionKey
} from '../utils/crypto';

const ScreeningContext = createContext(null);

export const useScreening = () => {
  const context = useContext(ScreeningContext);
  if (!context) {
    throw new Error('useScreening must be used within a ScreeningProvider');
  }
  return context;
};

const getCurrentUser = () => {
  try {
    const raw = localStorage.getItem('maternawell_user');
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

export const ScreeningProvider = ({ children }) => {
  const [screenings, setScreenings] = useState([]);
  const [currentScreening, setCurrentScreening] = useState(null);
  const [activeDraft, setActiveDraft] = useState(null);
  const [auditLogs, setAuditLogs] = useState([]);
  const [isOnline, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);
  const [lastSyncTime, setLastSyncTime] = useState(null);
  const [pendingSyncCount, setPendingSyncCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);

  // R6: Double-tap submission guard ref
  const isAnsweringRef = useRef(false);

  // Initialize DB, encryption and sync engine on mount
  useEffect(() => {
    let cleanupSync = () => {};

    async function initDbAndData() {
      const key = await ensureSessionKey();
      await migrateFromLocalStorage(key);

      // Load existing screenings from IndexedDB with transparent decryption
      try {
        const storedScreenings = await db.screenings.orderBy('createdAt').reverse().toArray();
        if (storedScreenings && storedScreenings.length > 0) {
          const decrypted = await Promise.all(
            storedScreenings.map(s => decryptScreeningRecord(s, key))
          );
          setScreenings(decrypted);
        }

        // Load active draft if exists
        const drafts = await db.drafts.toArray();
        if (drafts && drafts.length > 0) {
          const decryptedDrafts = await Promise.all(
            drafts.map(d => decryptDraftRecord(d, key))
          );
          const latestDraft = decryptedDrafts.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))[0];
          setActiveDraft(latestDraft);
        }

        // Load audit logs
        const storedLogs = await db.auditLog.orderBy('timestamp').reverse().limit(200).toArray();
        if (storedLogs) {
          setAuditLogs(storedLogs);
        }

        const pending = await getPendingOutboxCount();
        setPendingSyncCount(pending);
      } catch (err) {
        console.warn('Error reading/decrypting from IndexedDB on startup:', err);
      }

      cleanupSync = initSyncEngine();
    }

    initDbAndData();

    // Subscribe to sync state updates
    const unsubscribeSync = subscribeSyncStatus(async () => {
      try {
        const pending = await getPendingOutboxCount();
        setPendingSyncCount(pending);
        setLastSyncTime(getLastSyncTime());
        setIsSyncing(isSyncInProgress());
      } catch (e) {
        console.debug('Sync status update error:', e);
      }
    });

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      cleanupSync();
      unsubscribeSync();
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const addAuditLog = useCallback(async (action, details) => {
    const user = getCurrentUser();
    const log = {
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      action,
      details,
      userId: user?.staffId || user?.id || user?.name || 'anonymous',
      facilityId: user?.facility || 'Unknown Facility',
      syncStatus: 'pending'
    };

    setAuditLogs(prev => [log, ...prev].slice(0, 500));

    try {
      await db.auditLog.put(log);
      await enqueueOutbox({
        entity: 'auditLog',
        entityId: log.id,
        action: 'CREATE',
        payload: log
      });
    } catch (err) {
      console.warn('Failed to persist audit log to Dexie:', err);
    }
  }, []);

  const performSync = useCallback(async () => {
    setIsSyncing(true);
    try {
      await flushOutbox();
      const key = await ensureSessionKey();
      const updatedScreenings = await db.screenings.orderBy('createdAt').reverse().toArray();
      const decrypted = await Promise.all(
        updatedScreenings.map(s => decryptScreeningRecord(s, key))
      );
      setScreenings(decrypted);
      setLastSyncTime(new Date().toISOString());
      const pending = await getPendingOutboxCount();
      setPendingSyncCount(pending);
    } catch (error) {
      console.error('Manual sync encountered error:', error);
    } finally {
      setIsSyncing(false);
    }
  }, []);

  const startScreening = (motherData) => {
    const standardizedMother = {
      ...motherData,
      name: motherData.name || motherData.motherName || 'Unnamed Patient',
      motherName: motherData.name || motherData.motherName || 'Unnamed Patient',
      phone: motherData.phone || motherData.phoneNumber || '',
      phoneNumber: motherData.phone || motherData.phoneNumber || '',
      fileNumber: motherData.fileNumber || `PHC-${Date.now().toString().slice(-6)}`,
      consentGiven: motherData.consentGiven ?? true,
      consentDate: motherData.consentDate || new Date().toISOString()
    };

    const newScreening = {
      id: crypto.randomUUID(),
      motherData: standardizedMother,
      answers: {},
      currentQuestion: 1,
      completed: false,
      score: null,
      riskTier: null,
      hasSelfHarmRisk: false,
      referralPlan: null,
      referralActions: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      status: 'in_progress',
      syncStatus: 'pending'
    };

    setCurrentScreening(newScreening);
    setActiveDraft(newScreening);

    // Persist encrypted draft to Dexie asynchronously
    (async () => {
      try {
        const key = await ensureSessionKey();
        const encryptedDraft = await encryptDraftRecord(newScreening, key);
        await db.drafts.put(encryptedDraft);
      } catch (e) {
        console.warn('Draft save error:', e);
      }
    })();

    addAuditLog('SCREENING_STARTED', { 
      screeningId: newScreening.id, 
      fileNumber: standardizedMother.fileNumber,
      patientName: standardizedMother.name 
    });

    return newScreening;
  };

  /**
   * Atomic answer submission and advance with R6 double-tap protection.
   * Auto-saves encrypted draft on every answer; when Q10 completes, finalizes screening.
   */
  const answerAndAdvance = (questionId, value) => {
    if (!currentScreening || currentScreening.completed) return currentScreening;
    if (currentScreening.currentQuestion !== questionId) return currentScreening;

    const updatedAnswers = {
      ...currentScreening.answers,
      [questionId]: value
    };

      if (currentScreening.currentQuestion < 10) {
        const nextQuestionNum = currentScreening.currentQuestion + 1;
        const updatedScreening = {
          ...currentScreening,
          answers: updatedAnswers,
          currentQuestion: nextQuestionNum,
          updatedAt: new Date().toISOString(),
          syncStatus: 'pending'
        };

        setCurrentScreening(updatedScreening);
        setActiveDraft(updatedScreening);

        // Auto-save encrypted draft after every answer
        (async () => {
          try {
            const key = await ensureSessionKey();
            const encryptedDraft = await encryptDraftRecord(updatedScreening, key);
            await db.drafts.put(encryptedDraft);
          } catch (e) {
            console.warn('Draft update error:', e);
          }
        })();

        return updatedScreening;
      }

      // Question 10 answered - compute final clinical scores atomically
      const score = scoreEpds(updatedAnswers);
      const riskTier = classifyRisk(score);
      const escalation = isEscalation(updatedAnswers);
      const plan = getReferralPlan(score, updatedAnswers);

      const completedScreening = {
        ...currentScreening,
        answers: updatedAnswers,
        completed: true,
        score,
        riskTier,
        hasSelfHarmRisk: escalation,
        referralPlan: plan,
        referralActions: plan.actions,
        status: escalation || score >= 13 ? 'urgent_referral' : score >= 9 ? 'referral_needed' : 'completed',
        completedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        syncStatus: 'pending',
        selfHarmAcknowledged: false,
        referralOutcome: 'pending'
      };

      setScreenings(prev => [completedScreening, ...prev]);
      setCurrentScreening(completedScreening);
      setActiveDraft(null);

      // Save encrypted completed screening to Dexie and clean up draft
      (async () => {
        try {
          const key = await ensureSessionKey();
          const encryptedScreening = await encryptScreeningRecord(completedScreening, key);
          await db.screenings.put(encryptedScreening);
          await db.drafts.delete(completedScreening.id);
          await enqueueOutbox({
            entity: 'screenings',
            entityId: completedScreening.id,
            action: 'CREATE',
            payload: completedScreening
          });
        } catch (e) {
          console.warn('Screening DB persist error:', e);
        }
      })();

      addAuditLog('SCREENING_COMPLETED', {
        screeningId: completedScreening.id,
        fileNumber: completedScreening.motherData.fileNumber,
        score,
        riskTier: riskTier.label,
        hasSelfHarmRisk: escalation
      });

      if (escalation) {
        addAuditLog('SELF_HARM_ESCALATION_TRIGGERED', {
          screeningId: completedScreening.id,
          fileNumber: completedScreening.motherData.fileNumber,
          item10Score: updatedAnswers[10]
        });
      }

      return completedScreening;
  };

  const previousQuestion = () => {
    if (!currentScreening || currentScreening.currentQuestion <= 1) {
      return currentScreening;
    }

    const updated = {
      ...currentScreening,
      currentQuestion: currentScreening.currentQuestion - 1
    };
    setCurrentScreening(updated);
    return updated;
  };

  const resumeDraft = (draft) => {
    setCurrentScreening(draft);
    setActiveDraft(draft);
  };

  const discardDraft = async (draftId) => {
    if (activeDraft?.id === draftId) {
      setActiveDraft(null);
    }
    if (currentScreening?.id === draftId) {
      setCurrentScreening(null);
    }
    try {
      await db.drafts.delete(draftId);
    } catch (e) {
      console.warn('Failed to delete draft:', e);
    }
  };

  const resetCurrentScreening = () => {
    setCurrentScreening(null);
  };

  const saveReferralOutcome = async (screeningId, outcome, notes = '') => {
    setScreenings(prev => prev.map(s => 
      s.id === screeningId 
        ? { 
            ...s, 
            referralOutcome: outcome, 
            referralOutcomeDate: new Date().toISOString(),
            referralNotes: notes,
            status: outcome === 'completed' ? 'completed' : s.status,
            syncStatus: 'pending'
          }
        : s
    ));

    try {
      const key = await ensureSessionKey();
      const raw = await db.screenings.get(screeningId);
      if (raw) {
        const record = await decryptScreeningRecord(raw, key);
        record.referralOutcome = outcome;
        record.referralOutcomeDate = new Date().toISOString();
        record.referralNotes = notes;
        record.status = outcome === 'completed' ? 'completed' : record.status;
        record.syncStatus = 'pending';
        record.updatedAt = new Date().toISOString();

        const encrypted = await encryptScreeningRecord(record, key);
        await db.screenings.put(encrypted);
        await enqueueOutbox({
          entity: 'screenings',
          entityId: screeningId,
          action: 'UPDATE',
          payload: record
        });
      }
    } catch (e) {
      console.warn('Failed to save referral outcome to DB:', e);
    }

    addAuditLog('REFERRAL_OUTCOME_SAVED', { screeningId, outcome, notes });
  };

  const updateScreeningStatus = async (screeningId, status) => {
    setScreenings(prev => prev.map(s => 
      s.id === screeningId 
        ? { ...s, status, updatedAt: new Date().toISOString(), syncStatus: 'pending' }
        : s
    ));

    try {
      const key = await ensureSessionKey();
      const raw = await db.screenings.get(screeningId);
      if (raw) {
        const record = await decryptScreeningRecord(raw, key);
        record.status = status;
        record.updatedAt = new Date().toISOString();
        record.syncStatus = 'pending';

        const encrypted = await encryptScreeningRecord(record, key);
        await db.screenings.put(encrypted);
        await enqueueOutbox({
          entity: 'screenings',
          entityId: screeningId,
          action: 'UPDATE',
          payload: record
        });
      }
    } catch (e) {
      console.warn('Failed to update screening status in DB:', e);
    }

    addAuditLog('SCREENING_STATUS_UPDATED', { screeningId, status });
  };

  const acknowledgeSelfHarmFlag = async (screeningId, supervisorNotes) => {
    const user = getCurrentUser();
    const ackBy = user?.staffId || user?.name || 'Facility Supervisor';

    setScreenings(prev => prev.map(s => 
      s.id === screeningId 
        ? { 
            ...s, 
            selfHarmAcknowledged: true,
            selfHarmAcknowledgedAt: new Date().toISOString(),
            supervisorNotes,
            acknowledgedBy: ackBy,
            syncStatus: 'pending'
          }
        : s
    ));

    try {
      const key = await ensureSessionKey();
      const raw = await db.screenings.get(screeningId);
      if (raw) {
        const record = await decryptScreeningRecord(raw, key);
        record.selfHarmAcknowledged = true;
        record.selfHarmAcknowledgedAt = new Date().toISOString();
        record.supervisorNotes = supervisorNotes;
        record.acknowledgedBy = ackBy;
        record.syncStatus = 'pending';

        const encrypted = await encryptScreeningRecord(record, key);
        await db.screenings.put(encrypted);
        await enqueueOutbox({
          entity: 'screenings',
          entityId: screeningId,
          action: 'UPDATE',
          payload: record
        });
      }
    } catch (e) {
      console.warn('Failed to acknowledge self-harm in DB:', e);
    }

    addAuditLog('SELF_HARM_FLAG_ACKNOWLEDGED', { screeningId, supervisorNotes, acknowledgedBy: ackBy });
  };

  const createAnonymousScreening = (motherData, answers) => {
    const score = scoreEpds(answers);
    const riskTier = classifyRisk(score);
    const selfHarm = isEscalation(answers);
    const plan = getReferralPlan(score, answers);

    const anonymousCode = `MW-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

    const anonymousScreening = {
      id: `anon_${Date.now()}`,
      anonymousCode,
      motherData: { 
        ...motherData, 
        name: 'Anonymous Mother',
        isAnonymous: true,
        fileNumber: anonymousCode
      },
      answers,
      completed: true,
      score,
      riskTier,
      hasSelfHarmRisk: selfHarm,
      referralPlan: plan,
      referralActions: plan.actions,
      status: selfHarm || score >= 13 ? 'urgent_referral' : score >= 9 ? 'referral_needed' : 'completed',
      createdAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      isAnonymous: true,
      syncStatus: 'pending',
      selfHarmAcknowledged: false,
      referralOutcome: 'pending'
    };

    setScreenings(prev => [anonymousScreening, ...prev]);

    (async () => {
      try {
        const key = await ensureSessionKey();
        const encrypted = await encryptScreeningRecord(anonymousScreening, key);
        await db.screenings.put(encrypted);
        await enqueueOutbox({
          entity: 'screenings',
          entityId: anonymousScreening.id,
          action: 'CREATE',
          payload: anonymousScreening
        });
      } catch (e) {
        console.warn('Failed to persist anonymous screening to DB:', e);
      }
    })();

    addAuditLog('ANONYMOUS_SCREENING_CREATED', {
      anonymousCode,
      score,
      riskTier: riskTier.label,
      hasSelfHarmRisk: selfHarm
    });

    return anonymousScreening;
  };

  const getStats = () => {
    const total = screenings.length;
    const lowRisk = screenings.filter(s => s.riskTier?.tier === 'low' || s.riskTier?.label === 'Low Risk').length;
    const moderateRisk = screenings.filter(s => s.riskTier?.tier === 'moderate' || s.riskTier?.label === 'Moderate Risk').length;
    const highRisk = screenings.filter(s => s.riskTier?.tier === 'high' || s.riskTier?.label === 'High Risk').length;
    const urgentReferrals = screenings.filter(s => s.hasSelfHarmRisk || (s.score !== null && s.score >= 13)).length;
    const referralsCompleted = screenings.filter(s => s.referralOutcome === 'completed').length;
    const pendingAcknowledgments = screenings.filter(s => s.hasSelfHarmRisk && !s.selfHarmAcknowledged).length;

    return { 
      total, 
      lowRisk, 
      moderateRisk, 
      highRisk, 
      urgentReferrals, 
      referralsCompleted, 
      pendingAcknowledgments
    };
  };

  const getScreeningById = (id) => {
    return screenings.find(s => s.id === id);
  };

  const deleteScreening = async (id) => {
    setScreenings(prev => prev.filter(s => s.id !== id));
    try {
      await db.screenings.delete(id);
      await enqueueOutbox({
        entity: 'screenings',
        entityId: id,
        action: 'DELETE',
        payload: { id }
      });
    } catch (e) {
      console.warn('Failed to delete screening from DB:', e);
    }
    addAuditLog('SCREENING_DELETED', { screeningId: id });
  };

  const value = {
    screenings,
    currentScreening,
    activeDraft,
    auditLogs,
    isOnline,
    lastSyncTime,
    pendingSyncCount,
    isSyncing,
    startScreening,
    answerAndAdvance,
    previousQuestion,
    resumeDraft,
    discardDraft,
    resetCurrentScreening,
    saveReferralOutcome,
    updateScreeningStatus,
    acknowledgeSelfHarmFlag,
    performSync,
    createAnonymousScreening,
    getStats,
    getScreeningById,
    deleteScreening,
    addAuditLog
  };

  return (
    <ScreeningContext.Provider value={value}>
      {children}
    </ScreeningContext.Provider>
  );
};
