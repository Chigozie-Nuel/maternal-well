import { useEffect, useRef, useState } from 'react';
import { useLanguage } from '../context/LanguageContext';

const TOUR_VERSION = '1';
const REPLAY_EVENT = 'maternawell:replay-onboarding';
const steps = [
  { title: 'Welcome to Maternawell', body: 'Confirm that you are using your assigned account and facility. Explain the screening and obtain the mother’s consent before recording personal or health information.' },
  { title: 'Complete all ten questions', body: 'Create a screening, enter the required background information, and record the mother’s answers to all ten EPDS questions. Use Back to correct an answer. EPDS supports assessment; it does not establish a diagnosis.' },
  { title: 'Act on the result', body: 'Review the recommended care pathway. A positive response to the self-harm question requires same-day escalation regardless of the total score. Follow your facility’s approved emergency protocol and record referral and follow-up actions.' },
  { title: 'Keep work safe offline', body: 'The app saves screening drafts on this device. Check the save and sync status before leaving. Pending records need a connection to reach the server. Keep this browser’s site data until syncing is confirmed. Help contains printable guides and lets you replay this introduction.' },
];

export function replayOnboarding() {
  window.dispatchEvent(new Event(REPLAY_EVENT));
}

export default function Onboarding({ user }) {
  const { t, language } = useLanguage();
  const userId = user?.id || user?.staffId;
  const storageKey = userId ? `maternawell_onboarding_${TOUR_VERSION}_${encodeURIComponent(userId)}` : null;
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  const dialogRef = useRef(null);
  const closeRef = useRef(null);

  useEffect(() => {
    if (!storageKey) { setOpen(false); return; }
    let completed = false;
    try { completed = localStorage.getItem(storageKey) === 'complete'; } catch { /* Show tour if storage is unavailable. */ }
    setStep(0);
    setOpen(!completed);
    const replay = () => { setStep(0); setOpen(true); };
    window.addEventListener(REPLAY_EVENT, replay);
    return () => window.removeEventListener(REPLAY_EVENT, replay);
  }, [storageKey]);

  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement;
    closeRef.current?.focus();
    return () => previous?.focus?.();
  }, [open]);

  function finish() {
    if (storageKey) {
      try { localStorage.setItem(storageKey, 'complete'); } catch { /* Preference only. */ }
    }
    setOpen(false);
  }

  function handleKeyDown(event) {
    if (event.key === 'Escape') { finish(); return; }
    if (event.key !== 'Tab') return;
    const items = [...dialogRef.current.querySelectorAll('button:not([disabled]), a[href]')];
    const first = items[0];
    const last = items[items.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
  }

  if (!open || !userId) return null;
  return <div style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(15, 35, 25, .66)', display: 'grid', placeItems: 'center', padding: 16 }}>
    <section ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="onboarding-title"
      aria-describedby="onboarding-copy" onKeyDown={handleKeyDown}
      style={{ maxWidth: 560, width: '100%', maxHeight: '90vh', overflowY: 'auto', background: 'white', padding: 24, borderRadius: 16, boxShadow: '0 20px 80px #0005' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginBottom: 20 }}>
        <span lang="en" style={{ color: '#2E7D32', fontWeight: 700 }}>Introduction · {step + 1} / {steps.length}</span>
        <button ref={closeRef} type="button" onClick={finish} className="btn btn-secondary" lang={language}>{t('skipTour')}</button>
      </div>
      <div aria-live="polite" lang="en">
        <h2 id="onboarding-title" style={{ fontSize: 24, marginBottom: 12 }}>{steps[step].title}</h2>
        <p id="onboarding-copy" style={{ color: '#334155', lineHeight: 1.7 }}>{steps[step].body}</p>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginTop: 28 }}>
        <button type="button" className="btn btn-secondary" disabled={step === 0} onClick={() => setStep((value) => value - 1)} lang={language}>{t('back')}</button>
        <button type="button" className="btn btn-primary" onClick={() => step === steps.length - 1 ? finish() : setStep((value) => value + 1)} lang={language}>
          {t(step === steps.length - 1 ? 'finishTour' : 'next')}
        </button>
      </div>
    </section>
  </div>;
}
