import { motion } from 'framer-motion';
import { Clock, CheckCircle, AlertTriangle, Download, Trash2, Eye, ShieldAlert } from 'lucide-react';
import { format } from 'date-fns';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const ScreeningCard = ({ screening, onView, onDelete, onUpdateOutcome }) => {
  const getStatusColor = (status) => {
    switch(status) {
      case 'urgent_referral': return 'bg-red-100 text-red-800 border-red-300';
      case 'referral_needed': return 'bg-orange-100 text-orange-800 border-orange-300';
      case 'completed': return 'bg-green-100 text-green-800 border-green-300';
      case 'in_progress': return 'bg-blue-100 text-blue-800 border-blue-300';
      default: return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  const getRiskColor = (riskTier) => {
    const tier = riskTier?.tier || (riskTier?.label === 'High Risk' ? 'high' : riskTier?.label === 'Moderate Risk' ? 'moderate' : 'low');
    switch(tier) {
      case 'low': return 'bg-green-500';
      case 'moderate': return 'bg-orange-500';
      case 'high': return 'bg-red-500';
      default: return 'bg-gray-400';
    }
  };

  const patientName = screening.motherData?.isAnonymous
    ? 'Anonymous Mother'
    : (screening.motherData?.name || screening.motherData?.motherName || 'Unnamed Patient');
  const fileNumber = screening.motherData?.fileNumber || screening.id;
  const phoneNumber = screening.motherData?.phone || screening.motherData?.phoneNumber || 'N/A';
  const actions = screening.referralPlan?.actions || screening.referralActions || [];

  const handleExport = () => {
    const doc = new jsPDF();
    
    // Header
    doc.setFillColor(46, 125, 50);
    doc.rect(0, 0, 210, 30, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(18);
    doc.text('Maternawell Nigeria - Clinical Screening Report', 105, 14, { align: 'center' });
    doc.setFontSize(11);
    doc.text('Edinburgh Postnatal Depression Scale (EPDS) • Nigerian Cutoff >= 9', 105, 23, { align: 'center' });
    
    doc.setTextColor(0, 0, 0);
    
    // Patient Info
    doc.setFontSize(13);
    doc.text('Patient Demographics', 14, 42);
    
    const patientData = [
      ['File / ID Number:', fileNumber],
      ['Patient Name:', patientName],
      ['Age / Postpartum:', `${screening.motherData?.age || 'N/A'} yrs • ${screening.motherData?.weeksPostpartum || 'N/A'} weeks postpartum`],
      ['Contact Phone:', phoneNumber],
      ['Screening Timestamp:', format(new Date(screening.createdAt || screening.completedAt || Date.now()), 'PPP p')]
    ];
    
    autoTable(doc, {
      startY: 46,
      body: patientData,
      theme: 'plain',
      styles: { fontSize: 10, cellPadding: 2 },
      columnStyles: { 0: { fontStyle: 'bold', cellWidth: 50 } }
    });
    
    // Score Section
    const finalY = doc.lastAutoTable.finalY + 8;
    doc.setFontSize(13);
    doc.text('Assessment & Classification', 14, finalY);
    
    doc.setFontSize(11);
    doc.text(`EPDS Total Score: ${screening.score} / 30`, 14, finalY + 8);
    doc.text(`Risk Tier: ${screening.riskTier?.label || 'N/A'}`, 14, finalY + 15);
    
    if (screening.hasSelfHarmRisk) {
      doc.setTextColor(220, 38, 38);
      doc.setFont(undefined, 'bold');
      doc.text('CRITICAL: Item 10 Self-Harm Ideation Reported (Mandatory Same-Day Escalation)', 14, finalY + 22);
      doc.setFont(undefined, 'normal');
      doc.setTextColor(0, 0, 0);
    }
    
    // Referral Actions
    const actionsY = finalY + (screening.hasSelfHarmRisk ? 32 : 24);
    doc.setFontSize(13);
    doc.text('Stepped-Care Referral Recommendations', 14, actionsY);
    
    doc.setFontSize(10);
    actions.forEach((action, index) => {
      doc.text(`• ${action}`, 14, actionsY + 7 + (index * 6.5));
    });
    
    // Non-Diagnosis Statutory Disclaimer (NFR-5)
    doc.setFontSize(9);
    doc.setTextColor(198, 40, 40);
    doc.text('STATUTORY NOTICE: This is a clinical screening result, not a definitive medical diagnosis.', 105, 274, { align: 'center' });
    
    doc.setTextColor(128, 128, 128);
    doc.text(`Generated under MeHPriC Protocol • Confidential Health Record • ${format(new Date(), 'PPP p')}`, 105, 282, { align: 'center' });
    
    doc.save(`maternawell_${fileNumber}.pdf`);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white rounded-xl shadow-sm hover:shadow-md transition-all duration-200 border border-gray-200 overflow-hidden flex flex-col justify-between"
    >
      <div className="p-5">
        <div className="flex justify-between items-start mb-3">
          <div className="flex items-center gap-3">
            <div className={`w-3.5 h-3.5 rounded-full ${getRiskColor(screening.riskTier)}`} />
            <div>
              <h3 className="font-bold text-gray-900 leading-snug">
                {patientName}
              </h3>
              <p className="text-xs text-gray-500 font-mono">File: {fileNumber}</p>
            </div>
          </div>
          <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border ${getStatusColor(screening.status)}`}>
            {screening.status.replace('_', ' ').toUpperCase()}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-3 mb-3">
          <div className="bg-gray-50 rounded-lg p-2.5">
            <p className="text-xs text-gray-500 mb-0.5 font-medium">EPDS Score</p>
            <p className="text-xl font-bold text-gray-900">{screening.score ?? '-'} <span className="text-xs font-normal text-gray-500">/ 30</span></p>
          </div>
          <div className="bg-gray-50 rounded-lg p-2.5">
            <p className="text-xs text-gray-500 mb-0.5 font-medium">Classification</p>
            <p className="text-sm font-bold text-gray-900">{screening.riskTier?.label ?? '-'}</p>
          </div>
        </div>

        {screening.hasSelfHarmRisk && (
          <div className="bg-red-50 border border-red-300 rounded-lg p-2.5 mb-3 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
            <div className="text-xs text-red-800">
              <span className="font-bold">Item-10 Escalation:</span> Same-day supervisor review required.
              {screening.selfHarmAcknowledged ? (
                <span className="text-green-700 font-semibold block mt-0.5">✓ Acknowledged by supervisor</span>
              ) : (
                <span className="text-red-700 font-semibold block mt-0.5">⚠ Pending supervisor review</span>
              )}
            </div>
          </div>
        )}

        <div className="flex items-center justify-between text-xs text-gray-500 mb-3">
          <span className="flex items-center gap-1">
            <Clock className="w-3.5 h-3.5" />
            {format(new Date(screening.createdAt || Date.now()), 'PP p')}
          </span>
          <span className="flex items-center gap-1 text-gray-400">
            <ShieldAlert className="w-3.5 h-3.5" />
            Screening result
          </span>
        </div>

        {screening.referralOutcome && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-2 mb-3">
            <div className="flex items-center gap-1.5 text-xs font-medium text-green-800">
              <CheckCircle className="w-3.5 h-3.5 text-green-600" />
              Follow-up: <span className="font-bold uppercase">{screening.referralOutcome}</span>
            </div>
          </div>
        )}
      </div>

      <div className="p-3 bg-gray-50 border-t border-gray-100 flex items-center gap-2">
        <button
          onClick={() => onView && onView(screening)}
          className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 hover:text-gray-900 transition-colors text-xs font-semibold"
        >
          <Eye className="w-3.5 h-3.5" />
          Details
        </button>
        <button
          onClick={handleExport}
          className="py-2 px-3 bg-green-50 border border-green-300 text-green-800 rounded-lg hover:bg-green-100 transition-colors text-xs font-semibold flex items-center gap-1"
          title="Export Medical PDF"
        >
          <Download className="w-3.5 h-3.5" />
          PDF
        </button>
        {onDelete && (
          <button
            onClick={() => onDelete(screening.id)}
            className="py-2 px-3 bg-white border border-gray-200 text-red-600 rounded-lg hover:bg-red-50 hover:border-red-200 transition-colors text-xs"
            title="Delete Record"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </motion.div>
  );
};

export default ScreeningCard;
