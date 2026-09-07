import { useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, AlertTriangle, CheckCircle, X, Send } from 'lucide-react';
import { useScreening } from '../context/ScreeningContext';
import { format } from 'date-fns';

const SupervisorDashboard = () => {
  const { screenings, acknowledgeSelfHarmFlag, getStats } = useScreening();
  const [selectedScreening, setSelectedScreening] = useState(null);
  const [showAckModal, setShowAckModal] = useState(false);
  const [supervisorNotes, setSupervisorNotes] = useState('');

  const stats = getStats();
  const pendingAcknowledgments = screenings.filter(s => s.hasSelfHarmRisk && !s.selfHarmAcknowledged);

  const handleAcknowledge = () => {
    if (selectedScreening && supervisorNotes.trim()) {
      acknowledgeSelfHarmFlag(selectedScreening.id, supervisorNotes);
      setShowAckModal(false);
      setSelectedScreening(null);
      setSupervisorNotes('');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-green-700 to-green-900 text-white py-8 px-6">
        <div className="max-w-7xl mx-auto">
          <button
            onClick={() => window.history.back()}
            className="flex items-center gap-2 text-green-100 hover:text-white mb-4"
          >
            <ArrowLeft className="w-5 h-5" />
            Back to Main Dashboard
          </button>
          <h1 className="text-3xl font-bold">Supervisor Dashboard</h1>
          <p className="text-green-100 mt-2">Manage urgent referrals and self-harm flags</p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-xl shadow-md p-6 border-l-4 border-red-500"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500 mb-1">Pending Acknowledgments</p>
                <p className="text-3xl font-bold text-gray-900">{stats.pendingAcknowledgments}</p>
              </div>
              <AlertTriangle className="w-12 h-12 text-red-500" />
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-white rounded-xl shadow-md p-6 border-l-4 border-orange-500"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500 mb-1">Urgent Referrals</p>
                <p className="text-3xl font-bold text-gray-900">{stats.urgentReferrals}</p>
              </div>
              <AlertTriangle className="w-12 h-12 text-orange-500" />
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-white rounded-xl shadow-md p-6 border-l-4 border-blue-500"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500 mb-1">Total Screenings</p>
                <p className="text-3xl font-bold text-gray-900">{stats.total}</p>
              </div>
              <CheckCircle className="w-12 h-12 text-blue-500" />
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-white rounded-xl shadow-md p-6 border-l-4 border-green-500"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500 mb-1">Referrals Completed</p>
                <p className="text-3xl font-bold text-gray-900">{stats.referralsCompleted}</p>
              </div>
              <CheckCircle className="w-12 h-12 text-green-500" />
            </div>
          </motion.div>
        </div>

        {/* Pending Acknowledgments Table */}
        {pendingAcknowledgments.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-xl shadow-md overflow-hidden mb-8"
          >
            <div className="bg-red-50 border-b border-red-200 px-6 py-4">
              <h2 className="text-lg font-semibold text-red-800 flex items-center gap-2">
                <AlertTriangle className="w-5 h-5" />
                Self-Harm Flags Requiring Immediate Attention
              </h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Patient</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Score</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {pendingAcknowledgments.map((screening) => (
                    <tr key={screening.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4">
                        <div>
                          <p className="font-medium text-gray-900">
                            {screening.motherData?.isAnonymous ? 'Anonymous' : screening.motherData?.name}
                          </p>
                          <p className="text-sm text-gray-500">File: {screening.motherData?.fileNumber}</p>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-lg font-bold text-red-600">{screening.score}</span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        {format(new Date(screening.createdAt), 'PPp')}
                      </td>
                      <td className="px-6 py-4">
                        <span className="px-3 py-1 bg-red-100 text-red-800 rounded-full text-xs font-medium">
                          Requires Acknowledgment
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <button
                          onClick={() => {
                            setSelectedScreening(screening);
                            setShowAckModal(true);
                          }}
                          className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm font-medium"
                        >
                          Acknowledge
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </motion.div>
        )}

        {/* All Screenings List */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-xl shadow-md overflow-hidden"
        >
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">All Screenings</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Patient</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Score</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Risk Level</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Self-Harm</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {screenings.map((screening) => (
                  <tr key={screening.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div>
                        <p className="font-medium text-gray-900">
                          {screening.motherData?.isAnonymous ? 'Anonymous' : screening.motherData?.name}
                        </p>
                        <p className="text-sm text-gray-500">File: {screening.motherData?.fileNumber}</p>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`font-bold ${
                        screening.score >= 13 ? 'text-red-600' :
                        screening.score >= 9 ? 'text-orange-600' : 'text-green-600'
                      }`}>
                        {screening.score}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                        screening.riskTier?.label === 'High Risk' ? 'bg-red-100 text-red-800' :
                        screening.riskTier?.label === 'Moderate Risk' ? 'bg-orange-100 text-orange-800' :
                        'bg-green-100 text-green-800'
                      }`}>
                        {screening.riskTier?.label}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                        screening.status === 'urgent_referral' ? 'bg-red-100 text-red-800' :
                        screening.status === 'referral_needed' ? 'bg-orange-100 text-orange-800' :
                        'bg-green-100 text-green-800'
                      }`}>
                        {screening.status.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      {screening.hasSelfHarmRisk ? (
                        <span className="flex items-center gap-2">
                          <AlertTriangle className="w-4 h-4 text-red-600" />
                          <span className="text-red-600 font-medium">Yes</span>
                          {screening.selfHarmAcknowledged && (
                            <CheckCircle className="w-4 h-4 text-green-600" />
                          )}
                        </span>
                      ) : (
                        <span className="text-gray-400">No</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {format(new Date(screening.createdAt), 'PP')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </motion.div>
      </div>

      {/* Acknowledgment Modal */}
      {showAckModal && selectedScreening && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6"
          >
            <div className="flex items-center gap-3 mb-4">
              <AlertTriangle className="w-6 h-6 text-red-600" />
              <h2 className="text-xl font-bold text-gray-900">Acknowledge Self-Harm Flag</h2>
            </div>

            <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-4">
              <p className="text-sm text-red-800">
                <strong>Patient:</strong> {selectedScreening.motherData?.name || 'Anonymous'}
              </p>
              <p className="text-sm text-red-800">
                <strong>EPDS Score:</strong> {selectedScreening.score}
              </p>
              <p className="text-sm text-red-800">
                <strong>Date:</strong> {format(new Date(selectedScreening.createdAt), 'PPp')}
              </p>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Supervisor Notes / Action Taken *
              </label>
              <textarea
                value={supervisorNotes}
                onChange={(e) => setSupervisorNotes(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all"
                rows="4"
                placeholder="Describe the action taken, follow-up plan, or consultation notes..."
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleAcknowledge}
                disabled={!supervisorNotes.trim()}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-red-600 text-white rounded-xl hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
              >
                <Send className="w-4 h-4" />
                Acknowledge & Save
              </button>
              <button
                onClick={() => {
                  setShowAckModal(false);
                  setSelectedScreening(null);
                  setSupervisorNotes('');
                }}
                className="px-4 py-3 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
};

export default SupervisorDashboard;
