import { useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, AlertTriangle, CheckCircle, Phone, MapPin } from 'lucide-react';
import { useScreening } from '../context/ScreeningContext';
import AnonymousSelfReferral from '../components/AnonymousSelfReferral';
import { FACILITIES } from '../utils/constants';
import { CRISIS_CONTACTS, STATUTORY_DISCLAIMER } from '../config/crisisContacts';

const SelfReferralPage = () => {
  const [showForm, setShowForm] = useState(false);
  const [result, setResult] = useState(null);
  const { createAnonymousScreening } = useScreening();

  const handleSubmit = async (data) => {
    const screening = await createAnonymousScreening(
      {
        age: data.age,
        location: data.location,
        hasSupport: data.hasSupport,
        babyAge: data.babyAge,
        facilityId: data.facilityId,
        consentGiven: data.consentGiven,
        consentDate: data.consentDate,
        contactInfo: data.contactInfo
      },
      data.answers
    );
    setResult(screening);
  };

  if (result) {
    const urgent = result.hasSelfHarmRisk || result.referralPlan?.urgency === 'same_day';
    const facility = FACILITIES.find(item => item.id === (result.facilityId || result.motherData?.facilityId));
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 via-white to-blue-50 py-8 px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-2xl mx-auto"
        >
          <button
            onClick={() => {
              setResult(null);
              setShowForm(false);
            }}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-800 mb-6"
          >
            <ArrowLeft className="w-5 h-5" />
            Back to Home
          </button>

          <div className="bg-white rounded-2xl shadow-xl p-8">
            <p className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-900 mb-6">{STATUTORY_DISCLAIMER}</p>
            <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-6">
              <p className="text-sm text-green-900">Your referral reference</p>
              <p className="text-2xl font-bold font-mono text-green-900">{result.anonymousCode}</p>
              <p className="text-sm text-green-900 mt-2">Save this reference and show it at {facility?.name || 'your chosen health facility'}.</p>
              <p role="status" className="text-sm text-green-900 mt-2">{result.syncStatus === 'synced' ? 'Received by the facility service.' : 'Saved on this device. Delivery to the facility is pending an internet connection.'}</p>
            </div>
            {/* Result Header */}
            <div className={`text-center mb-6 ${
              urgent ? 'text-red-600' : 
              result.score >= 9 ? 'text-orange-600' : 'text-green-600'
            }`}>
              {urgent ? (
                <AlertTriangle className="w-16 h-16 mx-auto mb-4" />
              ) : (
                <CheckCircle className="w-16 h-16 mx-auto mb-4" />
              )}
              <h1 className="text-2xl font-bold mb-2">
                {urgent ? 'Immediate Support Needed' : 
                 result.score >= 9 ? 'Support Recommended' : 'Routine Support Recommended'}
              </h1>
              <p className="text-gray-600">Your EPDS Score: <span className="font-bold">{result.score}</span></p>
            </div>

            {/* Risk Level */}
            <div className={`rounded-xl p-4 mb-6 ${
              result.riskTier.label === 'High Risk' ? 'bg-red-50 border-2 border-red-200' :
              result.riskTier.label === 'Moderate Risk' ? 'bg-orange-50 border-2 border-orange-200' :
              'bg-green-50 border-2 border-green-200'
            }`}>
              <p className="text-sm font-medium text-gray-600 mb-1">Risk Level</p>
              <p className={`text-xl font-bold ${
                result.riskTier.label === 'High Risk' ? 'text-red-700' :
                result.riskTier.label === 'Moderate Risk' ? 'text-orange-700' :
                'text-green-700'
              }`}>
                {result.riskTier.label}
              </p>
            </div>

            {/* Emergency Contact */}
            {urgent && (
              <div role="alert" className="bg-red-50 border-2 border-red-300 rounded-xl p-6 mb-6">
                <h3 className="font-bold text-red-800 mb-3 flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5" />
                  Immediate Help Available
                </h3>
                <div className="space-y-2 text-red-700">
                  <p className="font-semibold">Emergency Contacts:</p>
                  {CRISIS_CONTACTS.filter(contact => contact.verified).map(contact => <p key={contact.id}><a href={`tel:${contact.phone}`}>{contact.name}: {contact.phone}</a></p>)}
                  {!CRISIS_CONTACTS.some(contact => contact.verified) && <p>Helpline numbers are pending verification. Please seek help directly at your nearest health facility.</p>}
                  <p>🏥 Visit nearest health facility immediately</p>
                  <p>💬 Tell someone you trust how you're feeling</p>
                </div>
              </div>
            )}

            {/* Recommended Actions */}
            <div className="mb-6">
              <h3 className="font-semibold text-gray-900 mb-3">Recommended Next Steps</h3>
              <ul className="space-y-2">
                {result.referralActions.map((action, index) => (
                  <li key={index} className="flex items-start gap-3">
                    <CheckCircle className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" />
                    <span className="text-gray-700">{action}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Support Resources */}
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-6">
              <h3 className="font-semibold text-blue-900 mb-3">Support Resources</h3>
              <div className="space-y-3 text-sm text-blue-800">
                <div className="flex items-center gap-2">
                  <Phone className="w-4 h-4" />
                  <span>Ask your chosen facility for its current mental health support contacts.</span>
                </div>
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4" />
                  <span>{facility ? `${facility.name} — ${facility.location || facility.lga}` : 'Visit your selected Primary Health Centre.'}</span>
                </div>
                <p className="mt-3 text-xs">
                  Remember: You're not alone. Many mothers experience these feelings, and help is available.
                  Speaking to a healthcare provider can make a significant difference.
                </p>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    );
  }

  if (showForm) {
    return <AnonymousSelfReferral onSubmit={handleSubmit} onCancel={() => setShowForm(false)} />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-white to-blue-50 py-8 px-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-3xl mx-auto"
      >
        <button
          onClick={() => window.history.back()}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-800 mb-6"
        >
          <ArrowLeft className="w-5 h-5" />
          Back
        </button>

        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-3">
            Self-Assessment for New Mothers
          </h1>
          <p className="text-lg text-gray-600">
            Check how you've been feeling over the past week
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-6 mb-8">
          <div className="bg-white rounded-2xl shadow-lg p-6">
            <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center mb-4">
              <CheckCircle className="w-6 h-6 text-green-600" />
            </div>
            <h3 className="font-semibold text-gray-900 mb-2">Private & Confidential</h3>
            <p className="text-sm text-gray-600">
              Your name is not required. Contact details are optional if you want your chosen facility to follow up with you.
            </p>
          </div>

          <div className="bg-white rounded-2xl shadow-lg p-6">
            <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center mb-4">
              <Phone className="w-6 h-6 text-blue-600" />
            </div>
            <h3 className="font-semibold text-gray-900 mb-2">Instant Results</h3>
            <p className="text-sm text-gray-600">
              Get immediate feedback and personalized recommendations based on your responses.
            </p>
          </div>

          <div className="bg-white rounded-2xl shadow-lg p-6">
            <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center mb-4">
              <MapPin className="w-6 h-6 text-purple-600" />
            </div>
            <h3 className="font-semibold text-gray-900 mb-2">Local Resources</h3>
            <p className="text-sm text-gray-600">
              Find nearby health facilities and support groups in your area.
            </p>
          </div>

          <div className="bg-white rounded-2xl shadow-lg p-6">
            <div className="w-12 h-12 bg-orange-100 rounded-xl flex items-center justify-center mb-4">
              <AlertTriangle className="w-6 h-6 text-orange-600" />
            </div>
            <h3 className="font-semibold text-gray-900 mb-2">Crisis Support</h3>
            <p className="text-sm text-gray-600">
              If you're in crisis, we'll provide immediate help resources and emergency contacts.
            </p>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-xl p-8 mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">How It Works</h2>
          <ol className="space-y-4">
            <li className="flex items-start gap-4">
              <span className="flex-shrink-0 w-8 h-8 bg-green-100 text-green-700 rounded-full flex items-center justify-center font-bold">1</span>
              <div>
                <p className="font-medium text-gray-900">Answer 10 Simple Questions</p>
                <p className="text-sm text-gray-600">Each question asks about how you've felt in the past 7 days</p>
              </div>
            </li>
            <li className="flex items-start gap-4">
              <span className="flex-shrink-0 w-8 h-8 bg-green-100 text-green-700 rounded-full flex items-center justify-center font-bold">2</span>
              <div>
                <p className="font-medium text-gray-900">Get Your Score</p>
                <p className="text-sm text-gray-600">See your risk level and understand what it means</p>
              </div>
            </li>
            <li className="flex items-start gap-4">
              <span className="flex-shrink-0 w-8 h-8 bg-green-100 text-green-700 rounded-full flex items-center justify-center font-bold">3</span>
              <div>
                <p className="font-medium text-gray-900">Receive Recommendations</p>
                <p className="text-sm text-gray-600">Get personalized next steps and support resources</p>
              </div>
            </li>
          </ol>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-2xl p-6 mb-8">
          <h3 className="font-semibold text-blue-900 mb-2">Important Note</h3>
          <p className="text-sm text-blue-800">
            This screening tool is not a diagnosis. If you're struggling, please reach out to a healthcare 
            professional. You deserve support, and help is available.
          </p>
        </div>

        <button
          onClick={() => setShowForm(true)}
          className="w-full py-4 bg-gradient-to-r from-green-600 to-green-700 text-white rounded-xl font-semibold text-lg hover:from-green-700 hover:to-green-800 transition-all shadow-lg hover:shadow-xl"
        >
          Start Self-Assessment
        </button>
      </motion.div>
    </div>
  );
};

export default SelfReferralPage;
