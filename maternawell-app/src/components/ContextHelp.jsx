import { Link, useLocation } from 'react-router-dom';
import { EpdsLanguageNotice, LanguageSelector, useLanguage } from '../context/LanguageContext';

const hints = [
  ['/new-screening', 'Explain the purpose of screening and confirm consent before collecting information.'],
  ['/screening/', 'Ask about the past seven days. Record the mother’s answer without changing the question wording.'],
  ['/results/', 'Review the recommended action, record the referral, and set a follow-up date where needed.'],
  ['/supervisor', 'Check unresolved referrals and data completeness before exporting your facility report.'],
  ['/self-referral', 'This is a screening tool. A health professional can help you understand the result and arrange care.'],
  ['/dashboard', 'Resume an unfinished draft or start a new screening. Check pending sync before ending your shift.'],
  ['/screenings', 'Resume an unfinished draft or start a new screening. Check pending sync before ending your shift.'],
  ['/login', 'Use your assigned staff account. Your facility and access permissions are set by your administrator.'],
];

export default function ContextHelp() {
  const { pathname } = useLocation();
  const { t, language } = useLanguage();
  if (pathname === '/help') return null;
  const hint = hints.find(([prefix]) => pathname.startsWith(prefix))?.[1];
  return <aside aria-label="Page help" className="context-help no-print" style={{ padding: '16px 20px', background: '#EDF5EF', borderTop: '1px solid #D2E3D5' }}>
    <div style={{ maxWidth: 1200, margin: '0 auto', display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
      {hint && <p lang="en" style={{ flex: '1 1 280px', fontSize: 14, color: '#294C35' }}>{hint}</p>}
      <LanguageSelector />
      <Link to="/help" lang={language} style={{ minHeight: 44, display: 'inline-flex', alignItems: 'center', fontWeight: 700, color: '#1B5E20' }}>{t('help')}</Link>
    </div>
    <div style={{ maxWidth: 1200, margin: '12px auto 0' }}><EpdsLanguageNotice /></div>
  </aside>;
}
