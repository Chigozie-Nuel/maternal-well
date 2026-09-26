import { createContext, useContext, useEffect, useId, useState } from 'react';

const STORAGE_KEY = 'maternawell_ui_language';

// Administrative UI copy only. A translated clinical instrument must be
// separately approved and versioned before it can replace the English EPDS.
export const UI_TRANSLATIONS = {
  en: {
    language: 'Language', dashboard: 'Dashboard', newScreening: 'New screening',
    screenings: 'Screenings', supervisor: 'Supervisor', help: 'Help and guides',
    signIn: 'Sign in', signOut: 'Sign out', next: 'Next', back: 'Back',
    close: 'Close', continue: 'Continue', save: 'Save', cancel: 'Cancel',
    print: 'Print guide', replayTour: 'Replay introduction', skipTour: 'Skip introduction',
    finishTour: 'Start using Maternawell', quickReference: 'Quick reference',
    supervisorGuide: 'Supervisor guide', faq: 'Frequently asked questions',
    languageReference: 'Yoruba UI reference',
    clinicalLanguageNotice: 'The validated Yoruba EPDS is not available in this release. Screening questions remain in English. Do not substitute an unvalidated translation. Yoruba navigation labels are a draft pending local language review.',
  },
  yo: {
    language: 'Èdè', dashboard: 'Ojú ìṣàkóso', newScreening: 'Ìwádìí tuntun',
    screenings: 'Àwọn ìwádìí', supervisor: 'Alábòójútó', help: 'Ìrànlọ́wọ́ àti ìtọ́sọ́nà',
    signIn: 'Wọlé', signOut: 'Jáde', next: 'Tẹ̀síwájú', back: 'Padà',
    close: 'Pa á dé', continue: 'Tẹ̀síwájú', save: 'Fipamọ́', cancel: 'Fagilé',
    print: 'Tẹ ìtọ́sọ́nà jáde', replayTour: 'Wo ìfihàn lẹ́ẹ̀kan sí i',
    skipTour: 'Rekọjá ìfihàn', finishTour: 'Bẹ̀rẹ̀ sí í lo Maternawell',
    quickReference: 'Ìtọ́sọ́nà kúkúrú', supervisorGuide: 'Ìtọ́sọ́nà alábòójútó',
    faq: 'Àwọn ìbéèrè tí a sábà máa ń béèrè', languageReference: 'Ìtọ́sọ́nà èdè Yorùbá',
  },
};

function readLanguage() {
  try { return localStorage.getItem(STORAGE_KEY) === 'yo' ? 'yo' : 'en'; }
  catch { return 'en'; }
}

const LanguageContext = createContext(null);

export function LanguageProvider({ children }) {
  const [language, setLanguageState] = useState(readLanguage);
  const setLanguage = (value) => setLanguageState(value === 'yo' ? 'yo' : 'en');
  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, language); } catch { /* Preference only. */ }
  }, [language]);
  const t = (key) => UI_TRANSLATIONS[language][key] || UI_TRANSLATIONS.en[key] || key;
  return <LanguageContext.Provider value={{ language, setLanguage, t }}>
    {children}
  </LanguageContext.Provider>;
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) throw new Error('useLanguage must be used within a LanguageProvider');
  return context;
}

export function LanguageSelector() {
  const { language, setLanguage, t } = useLanguage();
  const id = useId();
  return <label htmlFor={id} style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
    <span lang={language}>{t('language')}</span>
    <select id={id} value={language} onChange={(event) => setLanguage(event.target.value)}
      style={{ minHeight: 44, padding: '8px 12px', border: '1px solid #CBD5E1', borderRadius: 8, background: 'white', color: '#172E23' }}>
      <option value="en" lang="en">English</option>
      <option value="yo" lang="yo">Yorùbá (UI draft)</option>
    </select>
  </label>;
}

export function EpdsLanguageNotice({ always = false }) {
  const { language } = useLanguage();
  if (!always && language !== 'yo') return null;
  return <p role="note" lang="en" style={{ padding: 12, border: '1px solid #D97706', borderRadius: 8, background: '#FFFBEB', color: '#78350F', fontSize: 14 }}>
    {UI_TRANSLATIONS.en.clinicalLanguageNotice}
  </p>;
}
