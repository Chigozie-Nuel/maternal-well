/**
 * Anonymous self-referral (SRS FR-12, FR-13, business rule 4).
 *
 * The mother's result is computed on the device, so she always sees it, even offline.
 * The submission goes to the chosen facility's referral queue (the same queue health
 * workers use). Without a connection it is kept encrypted on the device and sent later.
 * No name is collected; contact details are sent only if she chooses to share them.
 */
import { apiRequest, ApiError, NetworkError } from '../config/api';
import { classifyRisk, getReferralPlan, isEscalation, scoreEpds } from '../domain/epds';
import { queueSelfReferral } from './db';

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function generateAnonymousCode() {
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  const chars = Array.from(bytes, byte => CODE_ALPHABET[byte % CODE_ALPHABET.length]).join('');
  return `MW-${chars.slice(0, 4)}-${chars.slice(4)}`;
}

export async function submitSelfReferral({ facilityId, answers, contactInfo, consentGiven }) {
  if (!consentGiven) throw new Error('Consent is needed before your answers can be shared with the facility.');
  const score = scoreEpds(answers);
  const completedAt = new Date().toISOString();
  const submission = {
    id: crypto.randomUUID(),
    anonymousCode: generateAnonymousCode(),
    facilityId,
    consentGiven: true,
    motherData: { consentGiven: true, consentDate: completedAt, ...(contactInfo ? { contactInfo } : {}) },
    answers,
    createdAt: completedAt,
    completedAt
  };
  const plan = getReferralPlan(score, answers);
  const receipt = {
    id: submission.id,
    anonymousCode: submission.anonymousCode,
    facilityId,
    score,
    riskTier: classifyRisk(score),
    hasSelfHarmRisk: isEscalation(answers),
    referralPlan: plan,
    referralActions: plan.actions,
    createdAt: completedAt
  };
  try {
    await apiRequest('/api/self-referral', { body: submission });
    return { ...receipt, syncStatus: 'synced' };
  } catch (error) {
    const transient = error instanceof NetworkError || (error instanceof ApiError && (error.status >= 500 || error.status === 429));
    if (!transient) throw new Error(error.message || 'Your answers could not be sent.');
    await queueSelfReferral(submission);
    return { ...receipt, syncStatus: 'queued' };
  }
}
