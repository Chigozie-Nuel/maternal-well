/**
 * Maternawell Nigeria - Clinical Constants & EPDS Scale Definitions
 * Validated for Primary Health Centers (PHCs) in Nigeria.
 */

import {
  NIGERIAN_EPDS_CUTOFF,
  HIGH_RISK_CUTOFF,
  RISK_TIERS,
  scoreEpds,
  classifyRisk,
  isEscalation,
  getReferralPlan
} from '../domain/epds';

export {
  NIGERIAN_EPDS_CUTOFF,
  HIGH_RISK_CUTOFF,
  RISK_TIERS,
  scoreEpds,
  classifyRisk,
  isEscalation,
  getReferralPlan
};

/**
 * Edinburgh Postnatal Depression Scale (EPDS)
 * 10-item clinical questionnaire (Cox et al., 1987)
 * Validated in Nigeria (Uwakwe & Okonkwo, 2003)
 */
export const EPDS_QUESTIONS = [
  {
    id: 1,
    text: "I have been able to laugh and see the funny side of things",
    options: [
      { value: 0, label: "As much as I always could" },
      { value: 1, label: "Not quite so much now" },
      { value: 2, label: "Definitely not so much now" },
      { value: 3, label: "Not at all" }
    ]
  },
  {
    id: 2,
    text: "I have looked forward with enjoyment to things",
    options: [
      { value: 0, label: "As much as I ever did" },
      { value: 1, label: "Rather less than I used to" },
      { value: 2, label: "Definitely less than I used to" },
      { value: 3, label: "Hardly at all" }
    ]
  },
  {
    id: 3,
    text: "I have blamed myself unnecessarily when things went wrong",
    options: [
      { value: 3, label: "Yes, most of the time" },
      { value: 2, label: "Yes, some of the time" },
      { value: 1, label: "Not very often" },
      { value: 0, label: "No, never" }
    ]
  },
  {
    id: 4,
    text: "I have been anxious or worried for no good reason",
    options: [
      { value: 0, label: "No, not at all" },
      { value: 1, label: "Hardly ever" },
      { value: 2, label: "Yes, sometimes" },
      { value: 3, label: "Yes, very often" }
    ]
  },
  {
    id: 5,
    text: "I have felt scared or panicky for no very good reason",
    options: [
      { value: 3, label: "Yes, quite a lot" },
      { value: 2, label: "Yes, sometimes" },
      { value: 1, label: "No, not much" },
      { value: 0, label: "No, not at all" }
    ]
  },
  {
    id: 6,
    text: "Things have been getting on top of me",
    options: [
      { value: 3, label: "Yes, most of the time I haven't been able to cope at all" },
      { value: 2, label: "Yes, sometimes I haven't been coping as well as usual" },
      { value: 1, label: "No, most of the time I have coped quite well" },
      { value: 0, label: "No, I have been coping as well as ever" }
    ]
  },
  {
    id: 7,
    text: "I have been so unhappy that I have had difficulty sleeping",
    options: [
      { value: 3, label: "Yes, most of the time" },
      { value: 2, label: "Yes, sometimes" },
      { value: 1, label: "Not very often" },
      { value: 0, label: "No, not at all" }
    ]
  },
  {
    id: 8,
    text: "I have felt sad or miserable",
    options: [
      { value: 3, label: "Yes, most of the time" },
      { value: 2, label: "Yes, quite often" },
      { value: 1, label: "Not very often" },
      { value: 0, label: "No, not at all" }
    ]
  },
  {
    id: 9,
    text: "I have been so unhappy that I have been crying",
    options: [
      { value: 3, label: "Yes, most of the time" },
      { value: 2, label: "Yes, quite often" },
      { value: 1, label: "Only occasionally" },
      { value: 0, label: "No, never" }
    ]
  },
  {
    id: 10,
    text: "The thought of harming myself has occurred to me",
    isCritical: true,
    options: [
      { value: 3, label: "Yes, quite often" },
      { value: 2, label: "Sometimes" },
      { value: 1, label: "Hardly ever" },
      { value: 0, label: "Never" }
    ]
  }
];

export const REFERRAL_ACTIONS = {
  LOW: [
    "Continue routine postnatal healthcare checkups and immunization visits.",
    "Provide reassurance and psychoeducation on normal maternal adjustments and self-care.",
    "Encourage family support systems and community peer connections.",
    "Schedule routine follow-up assessment in 4 to 6 weeks."
  ],
  MEDIUM: [
    "Refer to Facility Supervisor / designated PHC clinician for assessment within 1 week.",
    "Provide structured primary care counseling on stress and postpartum adjustment.",
    "Refer to community mother-to-mother or peer support group.",
    "Schedule close follow-up with weekly check-ins.",
    "Provide psychoeducation to partner and family on supporting the mother."
  ],
  HIGH: [
    "URGENT: Same-day escalation to Facility Supervisor required.",
    "Immediate psychiatric referral / mhGAP mental health specialist consultation.",
    "Safety priority: Ensure mother is accompanied and not left alone.",
    "Activate emergency family and facility contact protocol.",
    "Document and track referral completion in the facility case register."
  ]
};

/**
 * Primary Health Centers (PHCs) targeted by MeHPriC and Lagos State Primary Health Care Board
 */
export const FACILITIES = [
  { id: 'phc-ikeja', name: "Ikeja Primary Health Centre", lga: "Ikeja", location: "Wamako Street, Ikeja, Lagos" },
  { id: 'phc-surulere', name: "Surulere Primary Health Centre", lga: "Surulere", location: "Akerele Ext., Surulere, Lagos" },
  { id: 'phc-epe', name: "Epe Primary Health Centre", lga: "Epe", location: "Marina Road, Epe, Lagos" },
  { id: 'phc-ikorodu', name: "Ikorodu Primary Health Centre", lga: "Ikorodu", location: "Ayangburen Road, Ikorodu, Lagos" },
  { id: 'phc-lagos-island', name: "Lagos Island Primary Health Centre", lga: "Lagos Island", location: "Broad Street, Lagos Island" },
  { id: 'phc-alimosho', name: "Alimosho Primary Health Centre", lga: "Alimosho", location: "Council Road, Idimu, Lagos" },
  { id: 'phc-badagry', name: "Badagry Primary Health Centre", lga: "Badagry", location: "Hospital Road, Badagry, Lagos" },
  { id: 'phc-eti-osa', name: "Eti-Osa Primary Health Centre", lga: "Eti-Osa", location: "Igbo-Efon, Lekki, Lagos" }
];

export const calculateScore = (answers) => {
  return scoreEpds(answers);
};

export const getRiskTier = (score) => {
  return classifyRisk(score);
};

export const hasSelfHarmRisk = (answers) => {
  return isEscalation(answers);
};
