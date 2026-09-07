import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight, AlertTriangle, Heart } from 'lucide-react';
import { useScreening } from '../context/ScreeningContext';
import { EPDS_QUESTIONS } from '../utils/constants';

const ScreeningQuestion = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { currentScreening, updateAnswer, nextQuestion, previousQuestion, resetCurrentScreening } = useScreening();
  const [selectedAnswer, setSelectedAnswer] = useState(null);

  if (!currentScreening || currentScreening.id !== id) {
    return (
      <div style={{ padding: '40px', textAlign: 'center' }}>
        <h2>No active screening found</h2>
        <button onClick={() => navigate('/dashboard')} className="btn btn-primary">
          Go to Dashboard
        </button>
      </div>
    );
  }

  const question = EPDS_QUESTIONS.find(q => q.id === currentScreening.currentQuestion);
  const progress = (currentScreening.currentQuestion / 10) * 100;
  const isLastQuestion = currentScreening.currentQuestion === 10;
  const isFirstQuestion = currentScreening.currentQuestion === 1;

  const handleContinue = () => {
    if (selectedAnswer !== null) {
      updateAnswer(question.id, selectedAnswer);
      
      if (isLastQuestion) {
        const result = nextQuestion();
        if (result) {
          navigate(`/results/${result.id}`);
        }
      } else {
        nextQuestion();
        setSelectedAnswer(null);
      }
    }
  };

  const handleBack = () => {
    if (!isFirstQuestion) {
      const prev = previousQuestion();
      if (prev && prev.answers[prev.currentQuestion] !== undefined) {
        setSelectedAnswer(prev.answers[prev.currentQuestion]);
      } else {
        setSelectedAnswer(null);
      }
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #F8F9FA 0%, #E8F5E9 100%)',
      padding: '20px'
    }}>
      <div className="container" style={{ maxWidth: '700px', paddingTop: '20px' }}>
        {/* Progress Bar */}
        <div style={{ marginBottom: '24px' }}>
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center',
            marginBottom: '8px'
          }}>
            <span style={{ fontSize: '14px', fontWeight: '600', color: '#757575' }}>
              Question {currentScreening.currentQuestion} of 10
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
              transition={{ duration: 0.5 }}
              style={{
                height: '100%',
                background: 'linear-gradient(90deg, #2E7D32, #4CAF50)',
                borderRadius: '4px'
              }}
            />
          </div>
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={currentScreening.currentQuestion}
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -50 }}
            transition={{ duration: 0.3 }}
            className="card"
            style={{ padding: '32px' }}
          >
            {question.isCritical && (
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '16px',
                  background: '#FFF3E0',
                  borderRadius: '12px',
                  marginBottom: '24px',
                  border: '2px solid #FFA726'
                }}
              >
                <AlertTriangle size={24} color="#FFA726" />
                <div>
                  <p style={{ fontWeight: '600', color: '#F57C00', marginBottom: '4px' }}>
                    Sensitive Question
                  </p>
                  <p style={{ fontSize: '13px', color: '#F57C00' }}>
                    This question addresses self-harm. Please ensure privacy and provide support.
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
                Select the response that best describes how you have felt in the past 7 days.
              </p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '32px' }}>
              {question.options.map((option, index) => (
                <motion.button
                  key={option.value}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setSelectedAnswer(option.value)}
                  style={{
                    padding: '16px 20px',
                    border: `2px solid ${selectedAnswer === option.value ? '#2E7D32' : '#E0E0E0'}`,
                    background: selectedAnswer === option.value ? '#E8F5E9' : 'white',
                    borderRadius: '12px',
                    cursor: 'pointer',
                    textAlign: 'left',
                    transition: 'all 0.3s ease',
                    fontSize: '15px',
                    color: selectedAnswer === option.value ? '#2E7D32' : '#212121',
                    fontWeight: selectedAnswer === option.value ? '600' : '400'
                  }}
                >
                  {option.label}
                </motion.button>
              ))}
            </div>

            <div style={{ display: 'flex', gap: '12px' }}>
              {!isFirstQuestion && (
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={handleBack}
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
                disabled={selectedAnswer === null}
                className="btn btn-primary"
                style={{ 
                  flex: !isFirstQuestion ? '2' : '1',
                  opacity: selectedAnswer === null ? 0.6 : 1,
                  cursor: selectedAnswer === null ? 'not-allowed' : 'pointer'
                }}
              >
                {isLastQuestion ? 'Complete Screening' : 'Next'}
                {!isLastQuestion && <ChevronRight size={20} />}
              </motion.button>
            </div>
          </motion.div>
        </AnimatePresence>

        <div style={{
          marginTop: '20px',
          textAlign: 'center'
        }}>
          <button
            onClick={() => {
              if (window.confirm('Are you sure you want to cancel this screening?')) {
                resetCurrentScreening();
                navigate('/dashboard');
              }
            }}
            style={{
              background: 'none',
              border: 'none',
              color: '#757575',
              cursor: 'pointer',
              fontSize: '14px',
              textDecoration: 'underline'
            }}
          >
            Cancel Screening
          </button>
        </div>
      </div>
    </div>
  );
};

export default ScreeningQuestion;
