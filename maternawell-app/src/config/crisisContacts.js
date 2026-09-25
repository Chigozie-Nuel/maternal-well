/**
 * Maternawell Nigeria - Crisis Contacts Configuration
 * 
 * In compliance with Rule 4:
 * Do NOT invent phone numbers. Mark crisis contacts with verified: false
 * and display "Number pending verification" in the UI until official lines are confirmed.
 */

export const CRISIS_CONTACTS = [
  {
    id: 'nigeria-suicide-prevention',
    name: 'National Suicide Prevention Helpline (Nigeria)',
    phone: '0800-PENDING',
    available: '24/7',
    verified: false,
    notes: 'Official toll-free line pending national emergency directory integration.'
  },
  {
    id: 'lagos-lifeline',
    name: 'Lagos Lifeline Mental Health Helpline',
    phone: '0800-000-0000',
    available: '24/7',
    verified: false,
    notes: 'Lagos State Ministry of Health mental health support service - pending confirmation.'
  },
  {
    id: 'luth-psychiatry-emergency',
    name: 'LUTH Department of Psychiatry Emergency Unit',
    phone: 'Pending Verification',
    available: 'Emergency Duty Hours',
    verified: false,
    notes: 'Tertiary psychiatric escalation point for MeHPriC stepped-care model.'
  }
];

export const STATUTORY_DISCLAIMER = 'This is a screening result, not a clinical diagnosis. Further evaluation by a qualified health practitioner is required.';
