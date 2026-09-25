/**
 * Maternawell Nigeria - Edinburgh Postnatal Depression Scale (EPDS) Domain Engine
 * 
 * Pure domain logic (no React dependencies).
 * Clinical standards:
 * - Validated cutoff for Nigeria: >= 9 (Uwakwe & Okonkwo, 2003)
 * - Stepped-care task-shifting model: MeHPriC Lagos State (Adewuya et al., 2025)
 * - Item-10 self-harm ideation: mandatory same-day escalation flag if score > 0
 */

export const NIGERIAN_EPDS_CUTOFF = 9;
export const HIGH_RISK_CUTOFF = 13;

export const RISK_TIERS = {
  LOW: {
    tier: 'low',
    min: 0,
    max: 8,
    label: 'Low Risk',
    color: '#66BB6A',
    badgeClass: 'bg-green-100 text-green-800 border-green-200'
  },
  MODERATE: {
    tier: 'moderate',
    min: 9,
    max: 12,
    label: 'Moderate Risk',
    color: '#FFA726',
    badgeClass: 'bg-orange-100 text-orange-800 border-orange-200'
  },
  HIGH: {
    tier: 'high',
    min: 13,
    max: 30,
    label: 'High Risk',
    color: '#EF5350',
    badgeClass: 'bg-red-100 text-red-800 border-red-200'
  }
};

/**
 * Validates and calculates EPDS score across all 10 items.
 * Throws an Error if not all 10 items (1-10) are answered with integer values between 0 and 3.
 * 
 * @param {Record<number|string, number>} answers 
 * @returns {number} total score (0 - 30)
 */
export function scoreEpds(answers) {
  if (!answers || typeof answers !== 'object') {
    throw new Error('EPDS answers must be provided as an object containing items 1 to 10');
  }

  let total = 0;
  for (let i = 1; i <= 10; i++) {
    const val = answers[i] !== undefined ? answers[i] : answers[String(i)];
    if (val === undefined || val === null || typeof val !== 'number' || !Number.isInteger(val) || val < 0 || val > 3) {
      throw new Error(`EPDS requires all 10 items to be answered with values between 0 and 3. Missing or invalid item ${i}: ${val}`);
    }
    total += val;
  }

  return total;
}

/**
 * Classifies the risk tier according to the Nigerian validated cutoff (>= 9).
 * 
 * @param {number} score 
 * @returns {typeof RISK_TIERS[keyof typeof RISK_TIERS]}
 */
export function classifyRisk(score) {
  if (typeof score !== 'number' || isNaN(score) || score < 0 || score > 30) {
    throw new Error(`Invalid EPDS score for classification: ${score}`);
  }

  if (score < NIGERIAN_EPDS_CUTOFF) {
    return RISK_TIERS.LOW;
  }
  if (score < HIGH_RISK_CUTOFF) {
    return RISK_TIERS.MODERATE;
  }
  return RISK_TIERS.HIGH;
}

/**
 * Evaluates whether Item 10 indicates self-harm ideation requiring immediate escalation.
 * In accordance with FS-5 and NFR-4: any non-zero score (> 0) on Item 10 triggers same-day escalation.
 * 
 * @param {Record<number|string, number>} answers 
 * @returns {boolean}
 */
export function isEscalation(answers) {
  if (!answers || typeof answers !== 'object') {
    return false;
  }
  const item10 = answers[10] !== undefined ? answers[10] : answers['10'];
  return typeof item10 === 'number' && item10 > 0;
}

/**
 * Generates the stepped-care referral recommendation plan based on EPDS score and Item 10.
 * 
 * @param {number} score 
 * @param {Record<number|string, number>} answers 
 * @returns {{
 *   tier: 'low' | 'moderate' | 'high',
 *   pathway: 'community_peer' | 'phc_counselling' | 'urgent_psychiatric',
 *   urgency: 'routine' | 'within_1_week' | 'same_day',
 *   actions: string[]
 * }}
 */
export function getReferralPlan(score, answers) {
  const risk = classifyRisk(score);
  const selfHarm = isEscalation(answers);

  if (selfHarm || score >= HIGH_RISK_CUTOFF) {
    return {
      tier: 'high',
      pathway: 'urgent_psychiatric',
      urgency: 'same_day',
      actions: [
        'URGENT: Same-day escalation to Facility Supervisor required.',
        'Immediate psychiatric referral / mhGAP mental health specialist consultation.',
        'Safety priority: Ensure mother is accompanied and not left alone.',
        'Activate emergency family and facility contact protocol.',
        'Document and track referral completion in the facility case register.'
      ]
    };
  }

  if (score >= NIGERIAN_EPDS_CUTOFF) {
    return {
      tier: 'moderate',
      pathway: 'phc_counselling',
      urgency: 'within_1_week',
      actions: [
        'Refer to Facility Supervisor / designated PHC clinician for assessment within 1 week.',
        'Provide structured primary care counseling on stress and postpartum adjustment.',
        'Refer to community mother-to-mother or peer support group.',
        'Schedule close follow-up with weekly check-ins.',
        'Provide psychoeducation to partner and family on supporting the mother.'
      ]
    };
  }

  return {
    tier: 'low',
    pathway: 'community_peer',
    urgency: 'routine',
    actions: [
      'Continue routine postnatal healthcare checkups and immunization visits.',
      'Provide psychoeducation on normal maternal adjustments and self-care.',
      'Encourage family support systems and community peer connections.',
      'Schedule routine follow-up assessment in 4 to 6 weeks.'
    ]
  };
}
