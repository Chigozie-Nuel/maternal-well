import { STATUTORY_DISCLAIMER } from '../config/crisisContacts';
import { FACILITIES } from './constants';

const FOLLOW_UP = { pending: 'Pending', contacted: 'Contacted', completed: 'Completed', lost_to_followup: 'Lost to follow-up' };

/** Referral / case summary PDF. Loaded on demand so jsPDF is not in the main bundle. */
export async function exportCasePdf(record, { includeAnswers = true } = {}) {
  const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([import('jspdf'), import('jspdf-autotable')]);
  const doc = new jsPDF();
  const facility = FACILITIES.find(item => item.id === record.facilityId)?.name || record.facilityId || '';
  const when = value => (value ? new Date(value).toLocaleString('en-NG') : '—');

  doc.setFillColor(46, 125, 50);
  doc.rect(0, 0, 210, 26, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(16);
  doc.text('Maternawell Nigeria - EPDS Screening & Referral', 105, 12, { align: 'center' });
  doc.setFontSize(10);
  doc.text(`${facility}  |  Nigerian EPDS cutoff >= 9`, 105, 20, { align: 'center' });

  doc.setTextColor(150, 60, 0);
  doc.setFontSize(10);
  doc.text(doc.splitTextToSize(STATUTORY_DISCLAIMER, 182), 14, 34);
  doc.setTextColor(0, 0, 0);

  const identity = record.isAnonymous || record.motherData?.isAnonymous
    ? [['Self-referral code', record.anonymousCode || '—'], ['Contact (volunteered)', record.motherData?.contactInfo || 'Not provided']]
    : [['Name', record.motherData?.name || '—'], ['PHC file number', record.motherData?.fileNumber || '—'], ['Age / weeks since delivery', `${record.motherData?.age ?? '—'} yrs / ${record.motherData?.weeksPostpartum ?? '—'} wks`], ['Phone', record.motherData?.phone || '—']];

  autoTable(doc, {
    startY: 44,
    theme: 'grid',
    styles: { fontSize: 10 },
    columnStyles: { 0: { fontStyle: 'bold', cellWidth: 60 } },
    body: [
      ...identity,
      ['Screened', when(record.completedAt)],
      ['EPDS total', `${record.score} / 30`],
      ['Risk tier', record.riskTier?.label || '—'],
      ['Item 10 (self-harm)', record.hasSelfHarmRisk ? `POSITIVE - same-day escalation${record.selfHarmAcknowledged ? ` (acknowledged ${when(record.selfHarmAcknowledgedAt)})` : ' (awaiting supervisor)'}` : 'Negative'],
      ['Referral pathway', { community_peer: 'Community / peer support', phc_counselling: 'PHC counselling within 1 week', urgent_psychiatric: 'Immediate psychiatric referral (same day)' }[record.referralPlan?.pathway] || '—'],
      ['Follow-up status', FOLLOW_UP[record.referralOutcome || 'pending']]
    ]
  });

  autoTable(doc, {
    startY: doc.lastAutoTable.finalY + 6,
    head: [['#', 'Recommended actions']],
    body: (record.referralPlan?.actions || record.referralActions || []).map((action, index) => [index + 1, action]),
    styles: { fontSize: 9 },
    headStyles: { fillColor: [46, 125, 50] },
    columnStyles: { 0: { cellWidth: 10 } }
  });

  if (record.followUps?.length) {
    autoTable(doc, {
      startY: doc.lastAutoTable.finalY + 6,
      head: [['Follow-up', 'Date', 'Note']],
      body: record.followUps.map(item => [FOLLOW_UP[item.outcome] || item.outcome, when(item.timestamp), item.notes || '']),
      styles: { fontSize: 9 },
      headStyles: { fillColor: [46, 125, 50] }
    });
  }

  if (includeAnswers && record.answers && Object.keys(record.answers).length === 10) {
    autoTable(doc, {
      startY: doc.lastAutoTable.finalY + 6,
      head: [['EPDS item', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10']],
      body: [['Score', ...Array.from({ length: 10 }, (_, index) => record.answers[index + 1])]],
      styles: { fontSize: 9, halign: 'center' },
      headStyles: { fillColor: [46, 125, 50] }
    });
  }

  doc.setFontSize(8);
  doc.setTextColor(120, 120, 120);
  doc.text(`Confidential health record (NDPA 2023). Generated ${new Date().toLocaleString('en-NG')}.`, 105, 288, { align: 'center' });
  doc.save(`maternawell_${(record.anonymousCode || record.motherData?.fileNumber || record.id).replace(/[^A-Za-z0-9-]/g, '_')}.pdf`);
}
