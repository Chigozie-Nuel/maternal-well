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

  useEffect(() => {
    localStorage.setItem('maternawell_screenings', JSON.stringify(screenings));
  }, [screenings]);

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
      status: 'in_progress'
    };
    setCurrentScreening(newScreening);
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
      answers: updatedAnswers
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

    // Complete screening
    const score = calculateScore(currentScreening.answers);
    const riskTier = getRiskTier(score);
    const selfHarmRisk = hasSelfHarmRisk(currentScreening.answers);

    const completedScreening = {
      ...currentScreening,
      completed: true,
      score,
      riskTier,
      hasSelfHarmRisk: selfHarmRisk,
      status: selfHarmRisk || score >= 13 ? 'urgent_referral' : score >= 9 ? 'referral_needed' : 'completed',
      completedAt: new Date().toISOString()
    };

    setScreenings(prev => [completedScreening, ...prev]);
    setCurrentScreening(completedScreening);
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
        ? { ...s, referralOutcome: outcome, referralOutcomeDate: new Date().toISOString() }
        : s
    ));
  };

  const getStats = () => {
    const total = screenings.length;
    const lowRisk = screenings.filter(s => s.riskTier?.label === 'Low Risk').length;
    const moderateRisk = screenings.filter(s => s.riskTier?.label === 'Moderate Risk').length;
    const highRisk = screenings.filter(s => s.riskTier?.label === 'High Risk').length;
    const urgentReferrals = screenings.filter(s => s.hasSelfHarmRisk).length;
    const referralsCompleted = screenings.filter(s => s.referralOutcome).length;

    return { total, lowRisk, moderateRisk, highRisk, urgentReferrals, referralsCompleted };
  };

  const value = {
    screenings,
    currentScreening,
    startScreening,
    updateAnswer,
    nextQuestion,
    previousQuestion,
    resetCurrentScreening,
    saveReferralOutcome,
    getStats
  };

  return (
    <ScreeningContext.Provider value={value}>
      {children}
    </ScreeningContext.Provider>
  );
};
