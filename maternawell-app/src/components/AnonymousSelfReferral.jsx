import { useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { User, Heart, AlertTriangle, ShieldCheck, ArrowLeft, ArrowRight, ShieldAlert } from 'lucide-react';
import { EPDS_QUESTIONS, FACILITIES } from '../utils/constants';

const AnonymousSelfReferral = ({ onSubmit, onCancel }) => {
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    age: '',
    location: '',
    facilityId: FACILITIES[0]?.id || 'phc-ikeja',
    hasSupport: 'yes',
    babyAge: '0-1 months',
    consentGiven: false,
    shareContact: false,
    contactInfo: ''
  });
  const [answers, setAnswers] = useState({});
  const [currentQuestion, setCurrentQuestion] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const submissionRef = useRef(false);

  const handleInfoSubmit = (e) => {
    e.preventDefault();
    if (!formData.consentGiven) return;
    setStep(2);
  };

  const handleAnswer = async (value) => {
    if (submissionRef.current) return;
    const updatedAnswers = { ...answers, [currentQuestion]: value };
    setAnswers(updatedAnswers);
    
    if (currentQuestion < 10) {
      setCurrentQuestion(prev => prev + 1);
    } else {
      submissionRef.current = true;
      setSubmitting(true);
      setError('');
      try {
        await onSubmit({
          ...formData,
          contactInfo: formData.shareContact ? formData.contactInfo.trim() : undefined,
          consentDate: new Date().toISOString(),
          answers: updatedAnswers
        });
      } catch (err) {
        setError(err.message || 'We could not save your screening. Please try your answer again.');
      } finally {
        submissionRef.current = false;
        setSubmitting(false);
      }
    }
  };

  const currentQ = EPDS_QUESTIONS.find(q => q.id === currentQuestion) || EPDS_QUESTIONS[0];
  const progress = (currentQuestion / 10) * 100;
  const currentAnswer = answers[currentQuestion];

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-white to-blue-50 py-8 px-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-2xl mx-auto"
      >
        {import.meta.env.VITE_PUBLIC_DEMO === 'true' && <p role="note" className="mb-5 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm font-semibold text-amber-950">Public prototype: use fictional answers only. Do not enter real medical or contact information; this demonstration is not monitored for care.</p>}
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-green-100 text-green-800 text-xs font-semibold mb-3">
            <ShieldCheck className="w-4 h-4" />
            Private self-assessment
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Maternal Well-being Self-Check
          </h1>
          <p className="text-gray-600 text-sm max-w-md mx-auto">
            Take a few quiet minutes to reflect on how you have been feeling. Your name is not required.
          </p>
        </div>

        {/* Progress Bar */}
        {step === 2 && (
          <div className="mb-6">
            <div className="flex justify-between text-sm text-gray-600 mb-2 font-medium">
              <span>Question {currentQuestion} of 10</span>
              <span className="text-green-700">{Math.round(progress)}% Complete</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
              <motion.div
                className="bg-green-600 h-2 rounded-full"
                initial={{ width: 0 }}
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.3 }}
              />
            </div>
          </div>
        )}

        {/* Step 1: Basic Info */}
        {step === 1 && (
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="bg-white rounded-2xl shadow-xl p-8 border border-gray-100"
          >
            <div className="flex items-center gap-3 mb-6">
              <div className="p-3 bg-green-100 rounded-xl">
                <User className="w-6 h-6 text-green-700" />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-gray-900">Background Information</h2>
                <p className="text-sm text-gray-500">Helps customize local primary healthcare recommendations</p>
              </div>
            </div>

            <form onSubmit={handleInfoSubmit} className="space-y-5">
              <div>
                <label htmlFor="self-referral-age" className="block text-sm font-medium text-gray-700 mb-2">
                  Your Age (Years) *
                </label>
                <input
                  id="self-referral-age"
                  type="number"
                  required
                  min="15"
                  max="60"
                  value={formData.age}
                  onChange={(e) => setFormData(prev => ({ ...prev, age: e.target.value }))}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all"
                  placeholder="e.g. 26"
                />
              </div>

              <div>
                <label htmlFor="self-referral-facility" className="block text-sm font-medium text-gray-700 mb-2">
                  Preferred / Nearest Primary Health Centre *
                </label>
                <select
                  id="self-referral-facility"
                  required
                  value={formData.facilityId}
                  onChange={(e) => setFormData(prev => ({ ...prev, facilityId: e.target.value }))}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all"
                >
                  {FACILITIES.map(fac => (
                    <option key={fac.id} value={fac.id}>
                      {fac.name} ({fac.lga || fac.location})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Baby's Age *
                </label>
                <select
                  required
                  value={formData.babyAge}
                  onChange={(e) => setFormData(prev => ({ ...prev, babyAge: e.target.value }))}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all"
                >
                  <option value="0-1 months">0-1 months</option>
                  <option value="1-3 months">1-3 months</option>
                  <option value="3-6 months">3-6 months</option>
                  <option value="6-12 months">6-12 months</option>
                  <option value="Expecting">Still Pregnant</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Do you have a trusted family or partner support system?
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setFormData(prev => ({ ...prev, hasSupport: 'yes' }))}
                    className={`p-3.5 rounded-xl border-2 font-medium transition-all ${
                      formData.hasSupport === 'yes'
                        ? 'border-green-600 bg-green-50 text-green-800'
                        : 'border-gray-200 text-gray-600 hover:border-gray-300'
                    }`}
                  >
                    Yes, I have support
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormData(prev => ({ ...prev, hasSupport: 'no' }))}
                    className={`p-3.5 rounded-xl border-2 font-medium transition-all ${
                      formData.hasSupport === 'no'
                        ? 'border-green-600 bg-green-50 text-green-800'
                        : 'border-gray-200 text-gray-600 hover:border-gray-300'
                    }`}
                  >
                    No, feeling alone
                  </button>
                </div>
              </div>

              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-xs text-emerald-800">
                <p>
                  <strong>Your choice:</strong> Your name and contact details are not required.
                  At the end of this screening, you will receive an anonymous reference code that you can optionally show to a nurse at your chosen PHC.
                </p>
              </div>

              {import.meta.env.VITE_PUBLIC_DEMO !== 'true' && <label className="flex items-start gap-3 text-sm text-gray-700">
                <input type="checkbox" checked={formData.shareContact} onChange={e => setFormData(prev => ({ ...prev, shareContact: e.target.checked }))} />
                I would like my chosen facility to contact me. Sharing contact details is optional and makes this referral identifiable.
              </label>}
              {import.meta.env.VITE_PUBLIC_DEMO !== 'true' && formData.shareContact && (
                <div>
                  <label htmlFor="self-referral-contact" className="block text-sm font-medium text-gray-700 mb-2">Phone or other contact detail</label>
                  <input id="self-referral-contact" required maxLength={200} value={formData.contactInfo} onChange={e => setFormData(prev => ({ ...prev, contactInfo: e.target.value }))} className="w-full px-4 py-3 border border-gray-300 rounded-xl" />
                </div>
              )}
              <label className="flex items-start gap-3 text-sm text-gray-700">
                <input type="checkbox" required checked={formData.consentGiven} onChange={e => setFormData(prev => ({ ...prev, consentGiven: e.target.checked }))} />
                I consent to storing my screening and sharing it with my selected facility for referral and follow-up. I understand this screening is not a diagnosis.
              </label>

              <button
                type="submit"
                className="w-full py-4 bg-gradient-to-r from-green-600 to-green-700 text-white rounded-xl font-semibold hover:from-green-700 hover:to-green-800 transition-all shadow-md hover:shadow-lg flex items-center justify-center gap-2"
              >
                <span>Continue to Questions</span>
                <ArrowRight className="w-5 h-5" />
              </button>

              <button
                type="button"
                onClick={onCancel}
                className="w-full py-2.5 text-gray-600 hover:text-gray-900 transition-colors text-sm"
              >
                Cancel and return
              </button>
            </form>
          </motion.div>
        )}

        {/* Step 2: Questions */}
        {step === 2 && currentQ && (
          <motion.div
            key={currentQuestion}
            initial={{ opacity: 0, x: 25 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -25 }}
            transition={{ duration: 0.25 }}
            className="bg-white rounded-2xl shadow-xl p-8 border border-gray-100"
          >
            {currentQ.isCritical && (
              <div className="flex items-start gap-3 p-4 bg-orange-50 border-2 border-orange-300 rounded-xl mb-6">
                <AlertTriangle className="w-6 h-6 text-orange-600 flex-shrink-0 mt-0.5" />
                <div className="text-xs text-orange-900 leading-relaxed">
                  <p className="font-bold text-sm text-orange-950 mb-1">Gentle Note on Well-being</p>
                  <p>
                    Thoughts of self-harm or feeling overwhelmed can happen after childbirth. You are not alone,
                    and free confidential support is always available.
                  </p>
                </div>
              </div>
            )}

            <div className="mb-6">
              <span className={`inline-block px-3 py-1 rounded-full text-xs font-semibold mb-3 ${
                currentQ.isCritical ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-800'
              }`}>
                Question {currentQuestion} of 10
              </span>
              <h2 className="text-xl font-semibold text-gray-900 leading-relaxed">
                {currentQ.text}
              </h2>
              <p className="text-xs text-gray-500 mt-2">
                In the past 7 days, how often have you felt this way?
              </p>
            </div>

            <div className="space-y-3 mb-6">
              {currentQ.options.map((option) => {
                const isSelected = currentAnswer === option.value;
                return (
                  <button
                    key={`${currentQ.id}-${option.value}`}
                    type="button"
                    disabled={submitting}
                    onClick={() => handleAnswer(option.value)}
                    className={`w-full p-4 text-left border-2 rounded-xl transition-all flex items-center justify-between group ${
                      isSelected
                        ? 'border-green-600 bg-green-50 text-green-900 font-semibold'
                        : 'border-gray-200 hover:border-green-500 hover:bg-gray-50 text-gray-700'
                    }`}
                  >
                    <span>{option.label}</span>
                    <span className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ml-3 ${
                      isSelected ? 'border-green-600 bg-green-600' : 'border-gray-300 group-hover:border-green-500'
                    }`}>
                      {isSelected && <span className="w-2 h-2 rounded-full bg-white" />}
                    </span>
                  </button>
                );
              })}
            </div>

            {submitting && <p role="status" className="text-sm text-green-800 mb-4">Saving your screening…</p>}
            {error && <p role="alert" className="text-sm text-red-800 bg-red-50 rounded-xl p-4 mb-4">{error}</p>}

            <div className="flex items-center justify-between pt-4 border-t border-gray-100">
              {currentQuestion > 1 ? (
                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => setCurrentQuestion(prev => prev - 1)}
                  className="flex items-center gap-1.5 text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Previous Question
                </button>
              ) : <div />}

              <p className="text-xs text-gray-400 flex items-center gap-1">
                <ShieldAlert className="w-3.5 h-3.5" />
                Screening tool, not a diagnosis.
              </p>
            </div>
          </motion.div>
        )}
      </motion.div>
    </div>
  );
};

export default AnonymousSelfReferral;
