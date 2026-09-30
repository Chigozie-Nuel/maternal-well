/**
 * Maternawell Nigeria - Crisis Contacts Configuration
 * 
 * Publicly published contacts. A published number is not proof of live service;
 * facilities must confirm local availability before relying on it in an emergency.
 */

export const CRISIS_CONTACTS = [
  {
    id: 'national-emergency',
    name: 'Nigeria emergency response',
    phone: '112',
    available: 'Availability varies by location',
    verified: true,
    sourceUrl: 'https://statehouse.gov.ng/nec-moves-to-strengthen-national-emergency-response-okays-112-as-lifeline/',
    notes: 'Officially adopted national emergency number. Rollout is ongoing; proceed to the nearest emergency facility if unavailable.'
  },
  {
    id: 'lagos-lifeline',
    name: 'Lagos Lifeline Mental Health Helpline',
    phone: '07000006463',
    available: 'Confirm current hours with the service',
    verified: true,
    sourceUrl: 'https://lagosstate.gov.ng/news/Health%20Services/view/6722bfa71415802f26321399',
    notes: 'Lagos State published Lifeline number. Facility staff should confirm operational hours and an alternative emergency route.'
  }
];

export const STATUTORY_DISCLAIMER = 'This is a screening result, not a clinical diagnosis. Further evaluation by a qualified health practitioner is required.';
