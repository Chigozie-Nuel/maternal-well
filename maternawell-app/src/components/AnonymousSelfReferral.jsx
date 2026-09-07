import { useState } from 'react';
import { motion } from 'framer-motion';
import { User, Phone, MapPin, Calendar, Baby, Heart, AlertCircle } from 'lucide-react';

const AnonymousSelfReferral = ({ onSubmit, onCancel }) => {
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    age: '',
    location: '',
    hasSupport: '',
    babyAge: ''
  });
  const [answers, setAnswers] = useState({});
  const [currentQuestion, setCurrentQuestion] = useState(1);

  const questions = [
    { id: 1, text: "I have been able to laugh and see the funny side of things" },
    { id: 2, text: "I have looked forward with enjoyment to things" },
    { id: 3, text: "I have blamed myself unnecessarily when things went wrong" },
    { id: 4, text: "I have been anxious or worried for no good reason" },
    { id: 5, text: "I have felt scared or panicky for no very good reason" },
    { id: 6, text: "Things have been getting on top of me" },
    { id: 7, text: "I have been so unhappy that I have had difficulty sleeping" },
    { id: 8, text: "I have felt sad or miserable" },
    { id: 9, text: "I have been so unhappy that I have been crying" },
    { id: 10, text: "The thought of harming myself has occurred to me", isCritical: true }
  ];

  const options = [
    { value: 0, label: "Never / Not at all" },
    { value: 1, label: "Hardly ever" },
    { value: 2, label: "Sometimes" },
    { value: 3, label: "Often / Very often" }
  ];

  const handleInfoSubmit = (e) => {
    e.preventDefault();
    setStep(2);
  };

  const handleAnswer = (value) => {
    setAnswers(prev => ({ ...prev, [currentQuestion]: value }));
    
    if (currentQuestion < 10) {
      setCurrentQuestion(prev => prev + 1);
    } else {
      // Complete screening
      const screeningData = {
        ...formData,
        answers
      };
      onSubmit(screeningData);
    }
  };

  const currentQ = questions.find(q => q.id === currentQuestion);
  const progress = ((currentQuestion - 1) / 10) * 100;

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-white to-blue-50 py-8 px-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-2xl mx-auto"
      >
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Self-Assessment Screening
          </h1>
          <p className="text-gray-600">
            Anonymous postpartum depression screening - Your information is confidential
          </p>
        </div>

        {/* Progress Bar */}
        {step === 2 && (
          <div className="mb-6">
            <div className="flex justify-between text-sm text-gray-600 mb-2">
              <span>Question {currentQuestion} of 10</span>
              <span>{Math.round(progress)}% Complete</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
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
            className="bg-white rounded-2xl shadow-xl p-8"
          >
            <div className="flex items-center gap-3 mb-6">
              <div className="p-3 bg-green-100 rounded-xl">
                <User className="w-6 h-6 text-green-600" />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-gray-900">Basic Information</h2>
                <p className="text-sm text-gray-500">This helps us provide appropriate resources</p>
              </div>
            </div>

            <form onSubmit={handleInfoSubmit} className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Your Age
                </label>
                <input
                  type="number"
                  required
                  min="15"
                  max="60"
                  value={formData.age}
                  onChange={(e) => setFormData(prev => ({ ...prev, age: e.target.value }))}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all"
                  placeholder="Enter your age"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Location (LGA/Area)
                </label>
                <input
                  type="text"
                  required
                  value={formData.location}
                  onChange={(e) => setFormData(prev => ({ ...prev, location: e.target.value }))}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all"
                  placeholder="e.g., Ikeja, Surulere, Epe"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Baby's Age
                </label>
                <select
                  required
                  value={formData.babyAge}
                  onChange={(e) => setFormData(prev => ({ ...prev, babyAge: e.target.value }))}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all"
                >
                  <option value="">Select baby's age</option>
                  <option value="0-1 months">0-1 months</option>
                  <option value="1-3 months">1-3 months</option>
                  <option value="3-6 months">3-6 months</option>
                  <option value="6-12 months">6-12 months</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Do you have someone who supports you?
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setFormData(prev => ({ ...prev, hasSupport: 'yes' }))}
                    className={`p-4 rounded-xl border-2 transition-all ${
                      formData.hasSupport === 'yes'
                        ? 'border-green-500 bg-green-50 text-green-700'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    Yes
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormData(prev => ({ ...prev, hasSupport: 'no' }))}
                    className={`p-4 rounded-xl border-2 transition-all ${
                      formData.hasSupport === 'no'
                        ? 'border-green-500 bg-green-50 text-green-700'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    No
                  </button>
                </div>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-blue-600 mt-0.5" />
                  <p className="text-sm text-blue-700">
                    Your responses are completely anonymous. We don't collect your name or phone number. 
                    If you're in crisis, we'll provide immediate help resources.
                  </p>
                </div>
              </div>

              <button
                type="submit"
                className="w-full py-4 bg-gradient-to-r from-green-600 to-green-700 text-white rounded-xl font-semibold hover:from-green-700 hover:to-green-800 transition-all shadow-lg hover:shadow-xl"
              >
                Start Assessment
              </button>

              <button
                type="button"
                onClick={onCancel}
                className="w-full py-3 text-gray-600 hover:text-gray-800 transition-colors"
              >
                Go Back to Home
              </button>
            </form>
          </motion.div>
        )}

        {/* Step 2: Questions */}
        {step === 2 && currentQ && (
          <motion.div
            key={currentQuestion}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="bg-white rounded-2xl shadow-xl p-8"
          >
            <div className="mb-6">
              <span className={`inline-block px-3 py-1 rounded-full text-xs font-medium mb-3 ${
                currentQ.isCritical ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'
              }`}>
                Question {currentQuestion} of 10
              </span>
              <h2 className="text-xl font-semibold text-gray-900 leading-relaxed">
                {currentQ.text}
              </h2>
              <p className="text-sm text-gray-500 mt-2">
                How have you felt over the past 7 days?
              </p>
            </div>

            <div className="space-y-3">
              {options.map((option) => (
                <button
                  key={option.value}
                  onClick={() => handleAnswer(option.value)}
                  className="w-full p-4 text-left border-2 border-gray-200 rounded-xl hover:border-green-500 hover:bg-green-50 transition-all group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-5 h-5 rounded-full border-2 border-gray-300 group-hover:border-green-500 flex items-center justify-center">
                      {answers[currentQuestion] === option.value && (
                        <div className="w-3 h-3 rounded-full bg-green-500" />
                      )}
                    </div>
                    <span className="text-gray-700 group-hover:text-gray-900">{option.label}</span>
                  </div>
                </button>
              ))}
            </div>

            {currentQuestion > 1 && (
              <button
                onClick={() => setCurrentQuestion(prev => prev - 1)}
                className="mt-6 w-full py-3 text-gray-600 hover:text-gray-800 transition-colors"
              >
                ← Previous Question
              </button>
            )}
          </motion.div>
        )}
      </motion.div>
    </div>
  );
};

export default AnonymousSelfReferral;
