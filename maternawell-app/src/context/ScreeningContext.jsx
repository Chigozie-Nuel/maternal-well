import { createContext, useContext, useState, useEffect } from 'react';
import { calculateScore, getRiskTier, hasSelfHarmRisk } from '../utils/constants';

const ScreeningContext = createContext(null);

export const useScreening = () => {
  const context = useContext(ScreeningContext);
  if (!context) {
    throw new Error('useScreening must be used within a ScreeningProvider');
  }
  return context;
};

export const ScreeningProvider = ({ children }) => {
  const [screenings, setScreenings] = useState(() => {
    const saved = localStorage.getItem('maternawell_screenings');
    return saved ? JSON.parse(saved) : [];
  });

  const [currentScreening, setCurrentScreening] = useState(null);
  const [auditLogs, setAuditLogs] = useState(() => {
    const saved = localStorage.getItem('maternawell_audit_logs');
    return saved ? JSON.parse(saved) : [];
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
  }, []);

  const addAuditLog = (action, details) => {
    const log = {
      id: Date.now().toString(),
      timestamp: new Date().toISOString(),
      action,
      details,
      userId: localStorage.getItem('maternawell_user')?.id || 'anonymous'
    };
    setAuditLogs(prev => [log, ...prev].slice(0, 1000));
  };

  const startScreening = (motherData) => {
    const newScreening = {
      id: Date.now().toString(),
      motherData,
      answers: {},
      currentQuestion: 1,
      completed: false,
      score: null,
      riskTier: null,
      hasSelfHarmRisk: false,
      referralActions: [],
      createdAt: new Date().toISOString(),
      status: 'in_progress',
      syncStatus: 'synced'
    };
    setCurrentScreening(newScreening);
    addAuditLog('SCREENING_STARTED', { screeningId: newScreening.id, motherId: motherData.fileNumber });
    return newScreening;
  };

  const updateAnswer = (questionId, value) => {
    if (!currentScreening) return;

    const updatedAnswers = {
      ...currentScreening.answers,
      [questionId]: value
    };

    const updatedScreening = {
      ...currentScreening,
      answers: updatedAnswers,
      syncStatus: 'pending'
    };

    setCurrentScreening(updatedScreening);
  };

  const nextQuestion = () => {
    if (!currentScreening) return null;

    if (currentScreening.currentQuestion < 10) {
      const updated = {
        ...currentScreening,
        currentQuestion: currentScreening.currentQuestion + 1
      };
      setCurrentScreening(updated);
      return updated;
    }

    const score = calculateScore(currentScreening.answers);
    const riskTier = getRiskTier(score);
    const selfHarmRisk = hasSelfHarmRisk(currentScreening.answers);

    let referralActions = [];
    if (selfHarmRisk || score >= 13) {
      referralActions = [
        "URGENT: Refer to Facility Supervisor same day",
        "Immediate mental health specialist consultation required",
        "Ensure mother is not left alone if Item-10 positive",
        "Activate emergency contact protocol",
        "Document and track referral completion"
      ];
    } else if (score >= 9) {
      referralActions = [
        "Refer to Facility Supervisor for assessment within 1 week",
        "Provide counseling on stress management",
        "Consider peer support group referral",
        "Monitor closely with weekly check-ins",
        "Educate family members on supporting the mother"
      ];
    } else {
      referralActions = [
        "Continue routine postnatal care",
        "Provide psychoeducation on normal postpartum adjustments",
        "Schedule follow-up in 4-6 weeks",
        "Encourage family support systems"
      ];
    }

    const completedScreening = {
      ...currentScreening,
      completed: true,
      score,
      riskTier,
      hasSelfHarmRisk: selfHarmRisk,
      referralActions,
      status: selfHarmRisk || score >= 13 ? 'urgent_referral' : score >= 9 ? 'referral_needed' : 'completed',
      completedAt: new Date().toISOString(),
      syncStatus: 'pending'
    };

    setScreenings(prev => [completedScreening, ...prev]);
    setCurrentScreening(completedScreening);
    addAuditLog('SCREENING_COMPLETED', { 
      screeningId: completedScreening.id, 
      score, 
      riskTier: riskTier.label,
      hasSelfHarmRisk: selfHarmRisk 
    });
    return completedScreening;
  };

  const previousQuestion = () => {
    if (!currentScreening) return null;

    if (currentScreening.currentQuestion > 1) {
      const updated = {
        ...currentScreening,
        currentQuestion: currentScreening.currentQuestion - 1
      };
      setCurrentScreening(updated);
      return updated;
    }
    return currentScreening;
  };

  const resetCurrentScreening = () => {
    setCurrentScreening(null);
  };

  const saveReferralOutcome = (screeningId, outcome) => {
    setScreenings(prev => prev.map(s => 
      s.id === screeningId 
        ? { 
            ...s, 
            referralOutcome: outcome, 
            referralOutcomeDate: new Date().toISOString(),
            status: outcome === 'completed' ? 'completed' : s.status
          }
        : s
    ));
    addAuditLog('REFERRAL_OUTCOME_SAVED', { screeningId, outcome });
  };

  const updateScreeningStatus = (screeningId, status) => {
    setScreenings(prev => prev.map(s => 
      s.id === screeningId 
        ? { ...s, status, updatedAt: new Date().toISOString() }
        : s
    ));
    addAuditLog('SCREENING_STATUS_UPDATED', { screeningId, status });
  };

  const acknowledgeSelfHarmFlag = (screeningId, supervisorNotes) => {
    setScreenings(prev => prev.map(s => 
      s.id === screeningId 
        ? { 
            ...s, 
            selfHarmAcknowledged: true,
            selfHarmAcknowledgedAt: new Date().toISOString(),
            supervisorNotes,
            acknowledgedBy: localStorage.getItem('maternawell_user')?.id
          }
        : s
    ));
    addAuditLog('SELF_HARM_FLAG_ACKNOWLEDGED', { screeningId, supervisorNotes });
  };

  const performSync = async () => {
    const pendingScreenings = screenings.filter(s => s.syncStatus === 'pending');
    if (pendingScreenings.length === 0) return;

    try {
      // Simulate API sync
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      setScreenings(prev => prev.map(s => 
        s.syncStatus === 'pending' ? { ...s, syncStatus: 'synced', syncedAt: new Date().toISOString() } : s
      ));
      
      setLastSyncTime(new Date().toISOString());
      addAuditLog('DATA_SYNCED', { count: pendingScreenings.length });
    } catch (error) {
      console.error('Sync failed:', error);
      addAuditLog('SYNC_FAILED', { error: error.message });
    }
  };

  const createAnonymousScreening = (motherData, answers) => {
    const score = calculateScore(answers);
    const riskTier = getRiskTier(score);
    const selfHarmRisk = hasSelfHarmRisk(answers);

    let referralActions = [];
    if (selfHarmRisk || score >= 13) {
      referralActions = [
        "URGENT: Contact mental health hotline immediately",
        "Visit nearest health facility",
        "Tell a trusted family member or friend",
        "Call emergency services if in immediate danger"
      ];
    } else if (score >= 9) {
      referralActions = [
        "Schedule appointment with health worker",
        "Join peer support group",
        "Practice self-care activities",
        "Talk to someone you trust"
      ];
    } else {
      referralActions = [
        "Continue self-care practices",
        "Maintain social connections",
        "Attend routine postnatal checkups"
      ];
    }

    const anonymousScreening = {
      id: `anon_${Date.now()}`,
      motherData: { ...motherData, isAnonymous: true },
      answers,
      completed: true,
      score,
      riskTier,
      hasSelfHarmRisk: selfHarmRisk,
      referralActions,
      status: selfHarmRisk || score >= 13 ? 'urgent_referral' : score >= 9 ? 'referral_needed' : 'completed',
      createdAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
      isAnonymous: true,
      syncStatus: 'pending'
    };

    setScreenings(prev => [anonymousScreening, ...prev]);
    addAuditLog('ANONYMOUS_SCREENING_CREATED', { score, riskTier: riskTier.label });
    return anonymousScreening;
  };

  const getStats = () => {
    const total = screenings.length;
    const lowRisk = screenings.filter(s => s.riskTier?.label === 'Low Risk').length;
    const moderateRisk = screenings.filter(s => s.riskTier?.label === 'Moderate Risk').length;
    const highRisk = screenings.filter(s => s.riskTier?.label === 'High Risk').length;
    const urgentReferrals = screenings.filter(s => s.hasSelfHarmRisk).length;
    const referralsCompleted = screenings.filter(s => s.referralOutcome).length;
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
    updateAnswer,
    nextQuestion,
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
