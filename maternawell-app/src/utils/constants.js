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

export const RISK_TIERS = {
  LOW: { min: 0, max: 8, label: "Low Risk", color: "#66BB6A" },
  MEDIUM: { min: 9, max: 12, label: "Moderate Risk", color: "#FFA726" },
  HIGH: { min: 13, max: 30, label: "High Risk", color: "#EF5350" }
};

export const REFERRAL_ACTIONS = {
  LOW: [
    "Continue routine postnatal care",
    "Provide psychoeducation on normal postpartum adjustments",
    "Schedule follow-up in 4-6 weeks",
    "Encourage family support systems"
  ],
  MEDIUM: [
    "Refer to Facility Supervisor for assessment within 1 week",
    "Provide counseling on stress management",
    "Consider peer support group referral",
    "Monitor closely with weekly check-ins",
    "Educate family members on supporting the mother"
  ],
  HIGH: [
    "URGENT: Refer to Facility Supervisor same day",
    "Immediate mental health specialist consultation required",
    "Ensure mother is not left alone if Item-10 positive",
    "Activate emergency contact protocol",
    "Document and track referral completion"
  ]
};

export const FACILITIES = [
  { id: 1, name: "Lagos University Teaching Hospital (LUTH)", type: "Tertiary", location: "Idi-Araba, Lagos" },
  { id: 2, name: "Lagos State University Teaching Hospital (LASUTH)", type: "Tertiary", location: "Ikeja, Lagos" },
  { id: 3, name: "Gbagada General Hospital", type: "Secondary", location: "Gbagada, Lagos" },
  { id: 4, name: "Isolo General Hospital", type: "Secondary", location: "Isolo, Lagos" },
  { id: 5, name: "Surulere General Hospital", type: "Secondary", location: "Surulere, Lagos" },
  { id: 6, name: "Badagry General Hospital", type: "Secondary", location: "Badagry, Lagos" },
  { id: 7, name: "Epe General Hospital", type: "Secondary", location: "Epe, Lagos" },
  { id: 8, name: "Ikorodo General Hospital", type: "Secondary", location: "Ikorodu, Lagos" }
];

export const calculateScore = (answers) => {
  return Object.values(answers).reduce((sum, value) => sum + value, 0);
};

export const getRiskTier = (score) => {
  if (score <= RISK_TIERS.LOW.max) return RISK_TIERS.LOW;
  if (score <= RISK_TIERS.MEDIUM.max) return RISK_TIERS.MEDIUM;
  return RISK_TIERS.HIGH;
};

export const hasSelfHarmRisk = (answers) => {
  return answers[10] > 0;
};
