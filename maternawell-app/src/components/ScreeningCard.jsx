import { motion } from 'framer-motion';
import { FileText, Clock, CheckCircle, AlertTriangle, X, Download, Trash2, Eye } from 'lucide-react';
import { format } from 'date-fns';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const ScreeningCard = ({ screening, onView, onDelete, onExport }) => {
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
    if (!riskTier) return 'bg-gray-200';
    switch(riskTier.label) {
      case 'Low Risk': return 'bg-green-500';
      case 'Moderate Risk': return 'bg-orange-500';
      case 'High Risk': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  const handleExport = () => {
    const doc = new jsPDF();
    
    // Add header
    doc.setFillColor(46, 125, 50);
    doc.rect(0, 0, 210, 30, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(20);
    doc.text('Maternawell Nigeria - Screening Report', 105, 15, { align: 'center' });
    doc.setFontSize(12);
    doc.text('Postpartum Depression Screening Results', 105, 24, { align: 'center' });
    
    // Reset text color
    doc.setTextColor(0, 0, 0);
    
    // Patient Info
    doc.setFontSize(14);
    doc.text('Patient Information', 14, 45);
    doc.setFontSize(11);
    const patientData = [
      ['File Number:', screening.motherData?.fileNumber || 'N/A'],
      ['Name:', screening.motherData?.name || 'Anonymous'],
      ['Age:', screening.motherData?.age?.toString() || 'N/A'],
      ['Phone:', screening.motherData?.phone || 'N/A'],
      ['Screening Date:', format(new Date(screening.createdAt), 'PPP p')],
    ];
    
    autoTable(doc, {
      startY: 50,
      body: patientData,
      theme: 'plain',
      columnStyles: { 0: { fontStyle: 'bold' } }
    });
    
    // Score Section
    const finalY = doc.lastAutoTable.finalY + 10;
    doc.setFontSize(14);
    doc.text('Screening Results', 14, finalY);
    
    doc.setFontSize(11);
    doc.text(`EPDS Score: ${screening.score}`, 14, finalY + 10);
    doc.text(`Risk Level: ${screening.riskTier?.label || 'N/A'}`, 14, finalY + 17);
    
    if (screening.hasSelfHarmRisk) {
      doc.setTextColor(220, 38, 38);
      doc.text('⚠ SELF-HARM RISK DETECTED', 14, finalY + 24);
      doc.setTextColor(0, 0, 0);
    }
    
    // Referral Actions
    const actionsY = finalY + 35;
    doc.setFontSize(14);
    doc.text('Recommended Actions', 14, actionsY);
    
    doc.setFontSize(10);
    screening.referralActions?.forEach((action, index) => {
      doc.text(`• ${action}`, 14, actionsY + 10 + (index * 7));
    });
    
    // Footer
    doc.setFontSize(9);
    doc.setTextColor(128, 128, 128);
    doc.text(`Generated on ${format(new Date(), 'PPP p')}`, 105, 280, { align: 'center' });
    doc.text('Maternawell Nigeria - Confidential', 105, 285, { align: 'center' });
    
    doc.save(`screening_${screening.motherData?.fileNumber || screening.id}.pdf`);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white rounded-xl shadow-md hover:shadow-lg transition-all duration-300 border border-gray-100 overflow-hidden"
    >
      <div className="p-5">
        <div className="flex justify-between items-start mb-3">
          <div className="flex items-center gap-3">
            <div className={`w-3 h-3 rounded-full ${getRiskColor(screening.riskTier)}`} />
            <div>
              <h3 className="font-semibold text-gray-900">
                {screening.motherData?.isAnonymous ? 'Anonymous Screening' : screening.motherData?.name}
              </h3>
              <p className="text-sm text-gray-500">File: {screening.motherData?.fileNumber}</p>
            </div>
          </div>
          <span className={`px-3 py-1 rounded-full text-xs font-medium border ${getStatusColor(screening.status)}`}>
            {screening.status.replace('_', ' ').toUpperCase()}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-4">
          <div className="bg-gray-50 rounded-lg p-3">
            <p className="text-xs text-gray-500 mb-1">EPDS Score</p>
            <p className="text-2xl font-bold text-gray-900">{screening.score ?? '-'}</p>
          </div>
          <div className="bg-gray-50 rounded-lg p-3">
            <p className="text-xs text-gray-500 mb-1">Risk Level</p>
            <p className="text-sm font-semibold text-gray-900">{screening.riskTier?.label ?? '-'}</p>
          </div>
        </div>

        {screening.hasSelfHarmRisk && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-red-600" />
            <span className="text-sm font-medium text-red-700">Self-harm risk detected - Requires immediate attention</span>
          </div>
        )}

        <div className="flex items-center gap-2 text-xs text-gray-500 mb-4">
          <Clock className="w-3 h-3" />
          <span>{format(new Date(screening.createdAt), 'PPp')}</span>
        </div>

        {screening.referralOutcome && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-3 mb-4">
            <div className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-green-600" />
              <span className="text-sm font-medium text-green-700">
                Referral Outcome: {screening.referralOutcome}
              </span>
            </div>
          </div>
        )}

        <div className="flex gap-2">
          <button
            onClick={() => onView(screening)}
            className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 transition-colors text-sm font-medium"
          >
            <Eye className="w-4 h-4" />
            View Details
          </button>
          <button
            onClick={handleExport}
            className="px-3 py-2 bg-green-50 text-green-700 rounded-lg hover:bg-green-100 transition-colors"
            title="Export PDF"
          >
            <Download className="w-4 h-4" />
          </button>
          <button
            onClick={() => onDelete(screening.id)}
            className="px-3 py-2 bg-red-50 text-red-700 rounded-lg hover:bg-red-100 transition-colors"
            title="Delete"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    </motion.div>
  );
};

export default ScreeningCard;
