import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { HelpCircle, X } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';

// One-line explanation for each screen (SRS 2.6 "in-app contextual help").
const hints = [
  ['/new-screening', 'Explain why you are screening, read the consent statement to the mother, and only continue if she agrees.'],
  ['/screening/', 'Read each question exactly as written and ask about the past 7 days. Your answers save after every tap.'],
  ['/results/', 'This is a screening result, not a diagnosis. Follow the referral steps shown and record follow-up on the case page.'],
  ['/cases/', 'Update follow-up as it happens: contacted when you reach the mother, completed when she attends the referral.'],
  ['/screenings', 'Search by name, file number or self-referral code. Filter to find cases that still need follow-up.'],
  ['/supervisor', 'Item-10 flags must be acknowledged today. Overdue flags are shown in red at the top.'],
  ['/admin', 'The audit trail lists every screening, referral and escalation action with the staff ID and time.'],
  ['/self-referral', 'Answer for yourself about the past 7 days. Your name is not needed. You will get a reference code to show at the clinic.'],
  ['/dashboard', 'Start a new screening or resume one that was interrupted. Check the sync status before you finish your shift.'],
  ['/login', 'Sign in with your own staff ID. After signing in once online, you can also sign in on this device without internet.'],
  ['/help', 'Choose a guide, then print it or save it as a PDF.']
];

export default function ContextHelp() {
  const { pathname } = useLocation();
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  useEffect(() => setOpen(false), [pathname]);
  const hint = hints.find(([prefix]) => pathname.startsWith(prefix))?.[1];
  if (!hint) return null;
  return (
    <div className="no-print fixed bottom-4 right-4 z-[800] flex flex-col items-end gap-2">
      {open && (
        <div role="dialog" aria-label="Help for this screen" className="w-72 rounded-2xl border border-green-200 bg-white p-4 text-sm shadow-xl">
          <div className="mb-2 flex items-start justify-between gap-2">
            <strong className="text-green-900">About this screen</strong>
            <button type="button" aria-label="Close help" onClick={() => setOpen(false)} className="grid h-8 w-8 place-items-center rounded-full hover:bg-slate-100"><X size={16} /></button>
          </div>
          <p className="text-slate-700">{hint}</p>
          {pathname !== '/help' && <Link to="/help" className="mt-3 inline-flex min-h-[40px] items-center font-bold text-green-800 underline">{t('help')}</Link>}
        </div>
      )}
      <button type="button" aria-expanded={open} aria-label="What is this screen for?" onClick={() => setOpen(value => !value)}
        className="grid h-12 w-12 place-items-center rounded-full bg-green-800 text-white shadow-lg hover:bg-green-900">
        <HelpCircle size={24} aria-hidden="true" />
      </button>
    </div>
  );
}
