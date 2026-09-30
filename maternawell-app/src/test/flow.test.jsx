import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import MotherInfoForm from '../pages/MotherInfoForm';
import ScreeningQuestion from '../pages/ScreeningQuestion';
import Results from '../pages/Results';
import Dashboard from '../pages/Dashboard';
import { AuthProvider, useAuth } from '../context/AuthContext';
import { EPDS_QUESTIONS } from '../utils/constants';
import { db, listCases } from '../db/db';
import { getSessionKey } from '../utils/crypto';
import { WORKER, renderRoutes, resetAll, signInAs } from './harness';

const routes = {
  '/new-screening': <MotherInfoForm />,
  '/screening/:id': <ScreeningQuestion />,
  '/results/:id': <Results />,
  '/dashboard': <Dashboard />
};

async function fillConsentAndDetails() {
  fireEvent.click(await screen.findByLabelText(/I have read this statement/i));
  fireEvent.click(screen.getByLabelText(/The mother agrees/i));
  fireEvent.change(screen.getByLabelText(/Full name/i), { target: { value: 'Amina Bello' } });
  fireEvent.change(screen.getByLabelText(/PHC file number/i), { target: { value: 'IKJ/2026/0412' } });
  fireEvent.change(screen.getByLabelText(/Age \(years\)/i), { target: { value: '24' } });
  fireEvent.change(screen.getByLabelText(/Weeks since delivery/i), { target: { value: '6' } });
  fireEvent.click(screen.getByRole('button', { name: /Start the 10 questions/i }));
}

async function answer(questionId, value) {
  await screen.findByText(new RegExp(`Question ${questionId} of 10`));
  const label = EPDS_QUESTIONS.find(q => q.id === questionId).options.find(option => option.value === value).label;
  fireEvent.click(await screen.findByRole('button', { name: label }, { timeout: 3000 }));
  const next = await screen.findByRole('button', { name: questionId === 10 ? /Complete Screening/i : /^Next/i }, { timeout: 3000 });
  await waitFor(() => expect(next).toBeEnabled());
  fireEvent.click(next);
}

describe('Health worker screening flow (FR-1..FR-8, NFR-4)', () => {
  beforeEach(async () => {
    await resetAll();
    vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new TypeError('offline'))));
    await signInAs(WORKER);
  });
  afterEach(() => vi.unstubAllGlobals());

  it('scores all 10 answers (B1 regression), escalates Item-10 and blocks until safety is confirmed', async () => {
    renderRoutes(routes, '/new-screening');
    await fillConsentAndDetails();
    for (let q = 1; q <= 9; q++) await answer(q, 0);
    await answer(10, 1); // "Hardly ever": total 1, but Item-10 positive

    expect(await screen.findByRole('dialog', { name: /Same-day escalation/i })).toBeInTheDocument();
    expect(screen.getByText(/not a (clinical )?diagnosis/i)).toBeInTheDocument();
    const confirm = screen.getByRole('button', { name: /Confirm safety steps/i });
    expect(confirm).toBeDisabled();
    fireEvent.click(screen.getByLabelText(/not alone/i));
    fireEvent.click(screen.getByLabelText(/informed the facility supervisor/i));
    fireEvent.click(confirm);
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());

    const [saved] = await listCases('HW-01', getSessionKey());
    expect(saved.score).toBe(1);
    expect(saved.answers[10]).toBe(1);
    expect(saved.riskTier.tier).toBe('low');
    expect(saved.hasSelfHarmRisk).toBe(true);
    expect(saved.referralPlan.pathway).toBe('urgent_psychiatric');
    expect(saved.escalationDueBy).toBeTruthy();
    expect(saved.workerSafetyConfirmation.confirmedBy).toBe('HW-01');
    const actions = (await db.syncOutbox.toArray()).map(item => item.action);
    expect(actions).toEqual(expect.arrayContaining(['CREATE', 'SAFETY_CONFIRM']));
  }, 30000);

  it('scores reverse-keyed items correctly through the UI (moderate tier at the cutoff of 9)', async () => {
    renderRoutes(routes, '/new-screening');
    await fillConsentAndDetails();
    const values = [1, 1, 1, 1, 1, 1, 1, 1, 1, 0]; // total 9
    for (let q = 1; q <= 10; q++) await answer(q, values[q - 1]);
    await screen.findByText(/EPDS Screening Complete/i);
    const [saved] = await listCases('HW-01', getSessionKey());
    expect(saved.score).toBe(9);
    expect(saved.riskTier.tier).toBe('moderate');
    expect(saved.referralPlan.pathway).toBe('phc_counselling');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  }, 30000);

  it('keeps an interrupted screening and offers to resume it (NFR-3)', async () => {
    const first = renderRoutes(routes, '/new-screening');
    await fillConsentAndDetails();
    for (let q = 1; q <= 4; q++) await answer(q, 2);
    await screen.findByText(/Question 5 of 10/);
    await waitFor(async () => expect(await db.caseDrafts.count()).toBe(1));
    first.unmount(); // simulate the tab closing mid-screening

    renderRoutes(routes, '/dashboard');
    expect(await screen.findByText(/Resume screening for Amina Bello/i)).toBeInTheDocument();
    expect(screen.getByText(/4 of 10 answered/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Resume/i }));
    expect(await screen.findByText(/Question 5 of 10/)).toBeInTheDocument();
  }, 30000);

  it('shows "no active screening" for an unknown id without a hooks error', async () => {
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {});
    renderRoutes(routes, '/screening/unknown');
    expect(await screen.findByText(/No active screening found/i)).toBeInTheDocument();
    expect(errors.mock.calls.flat().join(' ')).not.toMatch(/Rendered (more|fewer) hooks/);
    errors.mockRestore();
  });
});

describe('Staff sign-in (FR-14)', () => {
  beforeEach(resetAll);
  afterEach(() => vi.unstubAllGlobals());

  function Probe() {
    const { login, logout, user, status } = useAuth();
    return (
      <div>
        <span data-testid="status">{status}</span><span data-testid="role">{user?.role}</span>
        <button type="button" onClick={() => login('hw-01', 'Worker01!2026').catch(err => { document.title = err.message; })}>good</button>
        <button type="button" onClick={() => login('HW-01', 'wrong').catch(err => { document.title = err.message; })}>bad</button>
        <button type="button" onClick={logout}>out</button>
      </div>
    );
  }

  it('signs in online, then offline on the same device with the right password only', async () => {
    const user = { id: 'HW-01', staffId: 'HW-01', role: 'health_worker', facilityId: 'phc-ikeja', name: 'hw' };
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(new Response(JSON.stringify({ user, token: 'x'.repeat(43), expiresAt: Date.now() + 3600000 }), { status: 200 }))));
    render(<MemoryRouter><AuthProvider><Probe /></AuthProvider></MemoryRouter>);
    fireEvent.click(screen.getByText('good'));
    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('ready'));
    expect(screen.getByTestId('role')).toHaveTextContent('health_worker');
    expect(localStorage.getItem('maternawell_session')).not.toContain('xxxxxxxx');
    await act(async () => { fireEvent.click(screen.getByText('out')); });
    expect(screen.getByTestId('status')).toHaveTextContent('signed_out');

    vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new TypeError('offline'))));
    fireEvent.click(screen.getByText('bad'));
    await waitFor(() => expect(document.title).toMatch(/incorrect/));
    expect(screen.getByTestId('status')).toHaveTextContent('signed_out');
    fireEvent.click(screen.getByText('good'));
    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('ready'));
  }, 30000);
});
