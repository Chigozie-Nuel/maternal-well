import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import React from 'react';
import {
  scoreEpds,
  classifyRisk,
  isEscalation,
  getReferralPlan,
  NIGERIAN_EPDS_CUTOFF,
  HIGH_RISK_CUTOFF,
  RISK_TIERS
} from '../domain/epds';
import { EPDS_QUESTIONS } from '../utils/constants';
import AnonymousSelfReferral from '../components/AnonymousSelfReferral';
import ScreeningQuestion from '../pages/ScreeningQuestion';
import { ScreeningProvider, useScreening } from '../context/ScreeningContext';

describe('EPDS Domain Engine Unit Tests', () => {
  it('correctly scores all zeros as 0 (Low Risk)', () => {
    const answers = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0, 8: 0, 9: 0, 10: 0 };
    const score = scoreEpds(answers);
    expect(score).toBe(0);
    const risk = classifyRisk(score);
    expect(risk.tier).toBe('low');
    expect(risk.label).toBe('Low Risk');
    expect(isEscalation(answers)).toBe(false);

    const plan = getReferralPlan(score, answers);
    expect(plan.pathway).toBe('community_peer');
    expect(plan.urgency).toBe('routine');
  });

  it('correctly classifies score 8 as Low Risk (boundary)', () => {
    const answers = { 1: 1, 2: 1, 3: 1, 4: 1, 5: 1, 6: 1, 7: 1, 8: 1, 9: 0, 10: 0 };
    const score = scoreEpds(answers);
    expect(score).toBe(8);
    const risk = classifyRisk(score);
    expect(risk.tier).toBe('low');
    expect(risk.label).toBe('Low Risk');

    const plan = getReferralPlan(score, answers);
    expect(plan.pathway).toBe('community_peer');
    expect(plan.urgency).toBe('routine');
  });

  it('correctly classifies Nigerian-validated cutoff 9 as Moderate Risk', () => {
    const answers = { 1: 1, 2: 1, 3: 1, 4: 1, 5: 1, 6: 1, 7: 1, 8: 1, 9: 1, 10: 0 };
    const score = scoreEpds(answers);
    expect(score).toBe(9);
    expect(score).toBeGreaterThanOrEqual(NIGERIAN_EPDS_CUTOFF);
    const risk = classifyRisk(score);
    expect(risk.tier).toBe('moderate');
    expect(risk.label).toBe('Moderate Risk');

    const plan = getReferralPlan(score, answers);
    expect(plan.pathway).toBe('phc_counselling');
    expect(plan.urgency).toBe('within_1_week');
  });

  it('correctly classifies score 12 as Moderate Risk (boundary)', () => {
    const answers = { 1: 2, 2: 2, 3: 2, 4: 2, 5: 2, 6: 2, 7: 0, 8: 0, 9: 0, 10: 0 };
    const score = scoreEpds(answers);
    expect(score).toBe(12);
    const risk = classifyRisk(score);
    expect(risk.tier).toBe('moderate');

    const plan = getReferralPlan(score, answers);
    expect(plan.pathway).toBe('phc_counselling');
    expect(plan.urgency).toBe('within_1_week');
  });

  it('correctly classifies score 13 as High Risk (boundary)', () => {
    const answers = { 1: 2, 2: 2, 3: 2, 4: 2, 5: 2, 6: 2, 7: 1, 8: 0, 9: 0, 10: 0 };
    const score = scoreEpds(answers);
    expect(score).toBe(13);
    expect(score).toBeGreaterThanOrEqual(HIGH_RISK_CUTOFF);
    const risk = classifyRisk(score);
    expect(risk.tier).toBe('high');
    expect(risk.label).toBe('High Risk');

    const plan = getReferralPlan(score, answers);
    expect(plan.pathway).toBe('urgent_psychiatric');
    expect(plan.urgency).toBe('same_day');
  });

  it('correctly scores all threes as 30 (maximum High Risk)', () => {
    const answers = { 1: 3, 2: 3, 3: 3, 4: 3, 5: 3, 6: 3, 7: 3, 8: 3, 9: 3, 10: 3 };
    const score = scoreEpds(answers);
    expect(score).toBe(30);
    const risk = classifyRisk(score);
    expect(risk.tier).toBe('high');
    expect(isEscalation(answers)).toBe(true);

    const plan = getReferralPlan(score, answers);
    expect(plan.pathway).toBe('urgent_psychiatric');
    expect(plan.urgency).toBe('same_day');
  });

  it('triggers same-day escalation and urgent psychiatric pathway when Item 10 = 1, even with total 1', () => {
    const answers = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0, 8: 0, 9: 0, 10: 1 };
    const score = scoreEpds(answers);
    expect(score).toBe(1);
    
    // Total score 1 is numerically Low Risk tier:
    const risk = classifyRisk(score);
    expect(risk.tier).toBe('low');

    // BUT Item 10 > 0 escalates immediately:
    expect(isEscalation(answers)).toBe(true);
    const plan = getReferralPlan(score, answers);
    expect(plan.tier).toBe('high');
    expect(plan.pathway).toBe('urgent_psychiatric');
    expect(plan.urgency).toBe('same_day');
    expect(plan.actions[0]).toMatch(/URGENT: Same-day escalation/);
  });

  it('verifies that reverse-scored EPDS questions (3, 5, 6, 7, 8, 9, 10) have options ranging from 3 to 0', () => {
    const reverseScoredIds = [3, 5, 6, 7, 8, 9, 10];
    reverseScoredIds.forEach(id => {
      const q = EPDS_QUESTIONS.find(item => item.id === id);
      expect(q).toBeDefined();
      const values = q.options.map(o => o.value);
      expect(values).toEqual([3, 2, 1, 0]);
    });

    const standardScoredIds = [1, 2, 4];
    standardScoredIds.forEach(id => {
      const q = EPDS_QUESTIONS.find(item => item.id === id);
      expect(q).toBeDefined();
      const values = q.options.map(o => o.value);
      expect(values).toEqual([0, 1, 2, 3]);
    });
  });

  it('throws an error if fewer than 10 answers are provided', () => {
    const nineAnswers = { 1: 1, 2: 1, 3: 1, 4: 1, 5: 1, 6: 1, 7: 1, 8: 1, 9: 1 };
    expect(() => scoreEpds(nineAnswers)).toThrow(/Missing or invalid item 10/);
  });

  it('scores in under 50 milliseconds (performance benchmark)', () => {
    const answers = { 1: 2, 2: 1, 3: 3, 4: 0, 5: 2, 6: 1, 7: 3, 8: 0, 9: 2, 10: 1 };
    const start = performance.now();
    for (let i = 0; i < 2000; i++) {
      scoreEpds(answers);
      classifyRisk(15);
      isEscalation(answers);
      getReferralPlan(15, answers);
    }
    const elapsed = performance.now() - start;
    expect(elapsed).toBeLessThan(50);
  });
});

describe('Defect Regressions: Questionnaire State Integrity', () => {
  it('B2 Regression: AnonymousSelfReferral captures Question 10 and self-harm flag upon completion', () => {
    const mockSubmit = vi.fn();
    render(<AnonymousSelfReferral onSubmit={mockSubmit} onCancel={() => {}} />);

    // Step 1: fill background info
    fireEvent.change(screen.getByLabelText(/Your Age/i), { target: { value: '25' } });
    fireEvent.click(screen.getByRole('button', { name: /Continue to Questions/i }));

    // Questions 1 to 9: click first option (0 or 3 depending on item)
    for (let q = 1; q <= 9; q++) {
      expect(screen.getAllByText(new RegExp(`Question ${q} of 10`, 'i')).length).toBeGreaterThan(0);
      const currentQuestionDef = EPDS_QUESTIONS.find(item => item.id === q);
      // Select the first option
      const firstOptionLabel = currentQuestionDef.options[0].label;
      const optionBtn = screen.getByRole('button', { name: new RegExp(firstOptionLabel, 'i') });
      fireEvent.click(optionBtn);
    }

    // Question 10 (Self-Harm): Select "Yes, quite often" (score 3)
    expect(screen.getAllByText(/Question 10 of 10/i).length).toBeGreaterThan(0);
    const q10Option = screen.getByRole('button', { name: /Yes, quite often/i });
    fireEvent.click(q10Option);

    // Verify onSubmit was called with complete answers object containing question 10 = 3
    expect(mockSubmit).toHaveBeenCalledTimes(1);
    const submittedData = mockSubmit.mock.calls[0][0];
    expect(submittedData.answers).toBeDefined();
    expect(submittedData.answers[10]).toBe(3);
    expect(isEscalation(submittedData.answers)).toBe(true);
  });

  it('B1 Regression: ScreeningContext atomic answerAndAdvance correctly computes and stores Question 10', () => {
    let contextValues = null;

    const TestConsumer = () => {
      const screening = useScreening();
      contextValues = screening;
      return (
        <div>
          <button
            onClick={() => {
              screening.startScreening({
                name: 'Amina Bello',
                age: 24,
                phone: '08011223344',
                fileNumber: 'PHC-IKJ-001'
              });
            }}
          >
            Start
          </button>
        </div>
      );
    };

    render(
      <ScreeningProvider>
        <TestConsumer />
      </ScreeningProvider>
    );

    // Start screening
    act(() => {
      contextValues.startScreening({
        name: 'Amina Bello',
        age: 24,
        phone: '08011223344',
        fileNumber: 'PHC-IKJ-001'
      });
    });

    expect(contextValues.currentScreening).toBeDefined();
    expect(contextValues.currentScreening.currentQuestion).toBe(1);

    // Answer questions 1 to 9 with score 0
    for (let q = 1; q <= 9; q++) {
      act(() => {
        contextValues.answerAndAdvance(q, 0);
      });
      if (q < 9) {
        expect(contextValues.currentScreening.currentQuestion).toBe(q + 1);
      }
    }

    // Answer question 10 with score 1 (Item-10 self-harm ideation)
    let completed = null;
    act(() => {
      completed = contextValues.answerAndAdvance(10, 1);
    });

    // Verify Question 10 is NOT lost, total score is 1, and escalation flag IS triggered!
    expect(completed).toBeDefined();
    expect(completed.completed).toBe(true);
    expect(completed.answers[10]).toBe(1);
    expect(completed.score).toBe(1);
    expect(completed.hasSelfHarmRisk).toBe(true);
    expect(completed.status).toBe('urgent_referral');
    expect(completed.referralPlan.pathway).toBe('urgent_psychiatric');
    expect(completed.referralPlan.urgency).toBe('same_day');
  });
});
