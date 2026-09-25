import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { scoreEpds, classifyRisk, isEscalation, getReferralPlan } from '../domain/epds';

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
  const [screenings, setScreenings] = useState(() => {
    try {
      const saved = localStorage.getItem('maternawell_screenings');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [currentScreening, setCurrentScreening] = useState(() => {
    try {
      const draft = localStorage.getItem('maternawell_active_draft');
      return draft ? JSON.parse(draft) : null;
    } catch {
      return null;
    }
  });

  const [auditLogs, setAuditLogs] = useState(() => {
    try {
      const saved = localStorage.getItem('maternawell_audit_logs');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [lastSyncTime, setLastSyncTime] = useState(null);

  useEffect(() => {
    localStorage.setItem('maternawell_screenings', JSON.stringify(screenings));
  }, [screenings]);

  useEffect(() => {
    localStorage.setItem('maternawell_audit_logs', JSON.stringify(auditLogs));
  }, [auditLogs]);

  useEffect(() => {
    if (currentScreening && !currentScreening.completed) {
      localStorage.setItem('maternawell_active_draft', JSON.stringify(currentScreening));
    } else {
      localStorage.removeItem('maternawell_active_draft');
    }
  }, [currentScreening]);

  const addAuditLog = useCallback((action, details) => {
    const user = getCurrentUser();
    const log = {
      id: Date.now().toString(),
      timestamp: new Date().toISOString(),
      action,
      details,
      userId: user?.staffId || user?.id || user?.name || 'anonymous',
      facilityId: user?.facility || 'Unknown Facility'
    };
    setAuditLogs(prev => [log, ...prev].slice(0, 1000));
  }, []);

  const performSync = useCallback(async () => {
    const pendingScreenings = screenings.filter(s => s.syncStatus === 'pending');
    if (pendingScreenings.length === 0) return;

    try {
      // Offline-first simulation / API bridge
      await new Promise(resolve => setTimeout(resolve, 800));
      
      setScreenings(prev => prev.map(s => 
        s.syncStatus === 'pending' ? { ...s, syncStatus: 'synced', syncedAt: new Date().toISOString() } : s
      ));
      
      const now = new Date().toISOString();
      setLastSyncTime(now);
      addAuditLog('DATA_SYNCED', { count: pendingScreenings.length, timestamp: now });
    } catch (error) {
      console.error('Sync failed:', error);
      addAuditLog('SYNC_FAILED', { error: error.message });
    }
  }, [screenings, addAuditLog]);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      performSync();
    };
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [performSync]);

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
      id: Date.now().toString(),
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
      status: 'in_progress',
      syncStatus: 'pending'
    };

    setCurrentScreening(newScreening);
    addAuditLog('SCREENING_STARTED', { 
      screeningId: newScreening.id, 
      fileNumber: standardizedMother.fileNumber,
      patientName: standardizedMother.name 
    });
    return newScreening;
  };

  /**
   * Atomic answer submission and advance.
   * Eliminates the Question 10 race condition (Defect B1).
   * 
   * @param {number} questionId - item number 1 to 10
   * @param {number} value - score 0 to 3
   * @returns {Object} updated or completed screening
   */
  const answerAndAdvance = (questionId, value) => {
    if (!currentScreening) return null;

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
        syncStatus: 'pending'
      };
      setCurrentScreening(updatedScreening);
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
      syncStatus: 'pending',
      selfHarmAcknowledged: false,
      referralOutcome: 'pending'
    };

    setScreenings(prev => [completedScreening, ...prev]);
    setCurrentScreening(completedScreening);
    localStorage.removeItem('maternawell_active_draft');

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

  const resetCurrentScreening = () => {
    setCurrentScreening(null);
    localStorage.removeItem('maternawell_active_draft');
  };

  const saveReferralOutcome = (screeningId, outcome, notes = '') => {
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
    addAuditLog('REFERRAL_OUTCOME_SAVED', { screeningId, outcome, notes });
  };

  const updateScreeningStatus = (screeningId, status) => {
    setScreenings(prev => prev.map(s => 
      s.id === screeningId 
        ? { ...s, status, updatedAt: new Date().toISOString(), syncStatus: 'pending' }
        : s
    ));
    addAuditLog('SCREENING_STATUS_UPDATED', { screeningId, status });
  };

  const acknowledgeSelfHarmFlag = (screeningId, supervisorNotes) => {
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
      isAnonymous: true,
      syncStatus: 'pending',
      selfHarmAcknowledged: false,
      referralOutcome: 'pending'
    };

    setScreenings(prev => [anonymousScreening, ...prev]);
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

  const deleteScreening = (id) => {
    setScreenings(prev => prev.filter(s => s.id !== id));
    addAuditLog('SCREENING_DELETED', { screeningId: id });
  };

  const value = {
    screenings,
    currentScreening,
    auditLogs,
    isOnline,
    lastSyncTime,
    startScreening,
    answerAndAdvance,
    previousQuestion,
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
