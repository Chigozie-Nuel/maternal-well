import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ChevronLeft, ChevronRight, AlertTriangle, Heart, ShieldAlert } from 'lucide-react';
import { useScreening } from '../context/ScreeningContext';
import { EPDS_QUESTIONS } from '../utils/constants';
import { EpdsLanguageNotice } from '../context/LanguageContext';

const ScreeningQuestion = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { currentScreening, answerAndAdvance, previousQuestion, resetCurrentScreening, drafts, resumeDraft, loaded } = useScreening();
  const [error, setError] = useState('');
  const [selectedAnswer, setSelectedAnswer] = useState(null);

  const isValidScreening = Boolean(currentScreening && currentScreening.id === id);
  const currentQNum = isValidScreening ? (currentScreening.currentQuestion || 1) : 1;
  const question = EPDS_QUESTIONS.find(q => q.id === currentQNum) || EPDS_QUESTIONS[0];
  const progress = (currentQNum / 10) * 100;
  const isLastQuestion = currentQNum === 10;
  const isFirstQuestion = currentQNum === 1;
  const [isSubmitting, setIsSubmitting] = useState(false);

  // After a reload or unlock, pick the saved draft back up (NFR-3).
  const savedDraft = !isValidScreening ? drafts.find(draft => draft.id === id) : null;
  useEffect(() => {
    if (savedDraft) resumeDraft(savedDraft);
  }, [savedDraft, resumeDraft]);

  // Restore existing answer when navigating between questions (unconditional hook execution)
  useEffect(() => {
    if (isValidScreening && currentScreening?.answers) {
      const saved = currentScreening.answers[currentQNum];
      setSelectedAnswer(saved !== undefined ? saved : null);
    } else {
      setSelectedAnswer(null);
    }
  }, [currentQNum, currentScreening, isValidScreening]);

  if (!isValidScreening) {
    if (!loaded || savedDraft) return <p className="p-10 text-center text-slate-600">Loading saved answers…</p>;
    return (
      <div style={{ padding: '40px', textAlign: 'center' }}>
        <h2>No active screening found</h2>
        <button onClick={() => navigate('/dashboard')} className="btn btn-primary" style={{ marginTop: '16px' }}>
          Go to Dashboard
        </button>
      </div>
    );
  }

  const handleContinue = async () => {
    if (selectedAnswer !== null && !isSubmitting) {
      setIsSubmitting(true);
      setError('');
      try {
        const result = await answerAndAdvance(question.id, selectedAnswer);
        if (isLastQuestion) {
          if (result && result.id) {
            navigate(`/results/${result.id}`);
          }
        }
      } catch (err) {
        setError(`${err.message} Your earlier answers are still saved.`);
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  const handleBack = () => {
    if (!isFirstQuestion && !isSubmitting) {
      previousQuestion();
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #F8F9FA 0%, #E8F5E9 100%)',
      padding: '20px'
    }}>
      <div className="container" style={{ maxWidth: '700px', paddingTop: '20px' }}>
        <EpdsLanguageNotice />
        {/* Progress Bar */}
        <div style={{ marginBottom: '24px' }}>
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center',
            marginBottom: '8px'
          }}>
            <span style={{ fontSize: '14px', fontWeight: '600', color: '#757575' }}>
              Question {currentQNum} of 10
            </span>
            <span style={{ fontSize: '14px', fontWeight: '600', color: '#2E7D32' }}>
              {Math.round(progress)}% Complete
            </span>
          </div>
          <div style={{
            width: '100%',
            height: '8px',
            background: '#E0E0E0',
            borderRadius: '4px',
            overflow: 'hidden'
          }}>
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.3 }}
              style={{
                height: '100%',
                background: 'linear-gradient(90deg, #2E7D32, #4CAF50)',
                borderRadius: '4px'
              }}
            />
          </div>
        </div>

        {/* No exit animation: the outgoing card must never be tappable once the next question is active. */}
          <motion.div
            key={currentQNum}
            initial={{ opacity: 0, x: 40 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.25 }}
            className="card"
            style={{ padding: '32px' }}
          >
            {question.isCritical && (
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '12px',
                  padding: '16px',
                  background: '#FFF3E0',
                  borderRadius: '12px',
                  marginBottom: '24px',
                  border: '2px solid #FFA726'
                }}
              >
                <AlertTriangle size={24} color="#F57C00" style={{ flexShrink: 0, marginTop: '2px' }} />
                <div>
                  <p style={{ fontWeight: '700', color: '#E65100', marginBottom: '4px' }}>
                    Clinical Safety Alert: Item 10 (Self-Harm Screening)
                  </p>
                  <p style={{ fontSize: '13px', color: '#795548', lineHeight: '1.4' }}>
                    Any non-zero response triggers a mandatory same-day escalation flag. Ensure patient privacy and clinical accompaniment.
                  </p>
                </div>
              </motion.div>
            )}

            <div style={{ marginBottom: '32px' }}>
              <div style={{
                width: '50px',
                height: '50px',
                background: 'linear-gradient(135deg, #2E7D32, #4CAF50)',
                borderRadius: '12px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '20px'
              }}>
                <Heart size={24} color="white" />
              </div>
              
              <h2 style={{
                fontSize: '22px',
                fontWeight: '600',
                color: '#212121',
                lineHeight: '1.5',
                marginBottom: '8px'
              }}>
                {question.text}
              </h2>
              <p style={{ color: '#757575', fontSize: '14px' }}>
                Select the option that best describes how the mother has felt in the past 7 days.
              </p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '32px' }}>
              {question.options.map((option, index) => {
                const isSelected = selectedAnswer === option.value;
                return (
                  <motion.button
                    key={`${question.id}-${option.value}`}
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                    whileHover={{ scale: 1.01 }}
                    whileTap={{ scale: 0.99 }}
                    onClick={() => setSelectedAnswer(option.value)}
                    aria-pressed={isSelected}
                    type="button"
                    style={{
                      padding: '16px 20px',
                      border: `2px solid ${isSelected ? '#2E7D32' : '#E0E0E0'}`,
                      background: isSelected ? '#E8F5E9' : 'white',
                      borderRadius: '12px',
                      cursor: 'pointer',
                      textAlign: 'left',
                      transition: 'all 0.2s ease',
                      fontSize: '15px',
                      color: isSelected ? '#1B5E20' : '#212121',
                      fontWeight: isSelected ? '600' : '400',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between'
                    }}
                  >
                    <span>{option.label}</span>
                    <span style={{
                      width: '22px',
                      height: '22px',
                      borderRadius: '50%',
                      border: `2px solid ${isSelected ? '#2E7D32' : '#BDBDBD'}`,
                      background: isSelected ? '#2E7D32' : 'transparent',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                      marginLeft: '12px'
                    }}>
                      {isSelected && <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'white' }} />}
                    </span>
                  </motion.button>
                );
              })}
            </div>

            {error && <p role="alert" className="mb-4 rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-800">{error}</p>}
            <div style={{ display: 'flex', gap: '12px' }}>
              {!isFirstQuestion && (
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={handleBack}
                  type="button"
                  className="btn btn-secondary"
                  style={{ flex: 1 }}
                >
                  <ChevronLeft size={20} />
                  Previous
                </motion.button>
              )}
              
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleContinue}
                disabled={selectedAnswer === null || isSubmitting}
                type="button"
                className="btn btn-primary"
                style={{ 
                  flex: !isFirstQuestion ? '2' : '1',
                  opacity: selectedAnswer === null || isSubmitting ? 0.6 : 1,
                  cursor: selectedAnswer === null || isSubmitting ? 'not-allowed' : 'pointer'
                }}
              >
                {isSubmitting ? 'Saving...' : isLastQuestion ? 'Complete Screening' : 'Next'}
                {!isLastQuestion && !isSubmitting && <ChevronRight size={20} />}
              </motion.button>
            </div>
          </motion.div>

        <div style={{
          marginTop: '20px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <p style={{ fontSize: '12px', color: '#757575', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <ShieldAlert size={14} />
            Screening result, not a clinical diagnosis.
          </p>

          <button
            onClick={() => {
              // Answers are already saved; the draft can be resumed or discarded from the dashboard.
              resetCurrentScreening();
              navigate('/dashboard');
            }}
            style={{
              background: 'none',
              border: 'none',
              color: '#757575',
              cursor: 'pointer',
              fontSize: '13px',
              textDecoration: 'underline'
            }}
          >
            Pause and return to dashboard
          </button>
        </div>
      </div>
    </div>
  );
};

export default ScreeningQuestion;
