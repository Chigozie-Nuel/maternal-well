import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { EpdsLanguageNotice, LanguageSelector, UI_TRANSLATIONS, useLanguage } from '../context/LanguageContext';
import { replayOnboarding } from '../components/Onboarding';
import './Help.css';

const guides = [
  ['quick', 'quickReference'], ['supervisor', 'supervisorGuide'],
  ['faq', 'faq'], ['yoruba', 'languageReference'],
];

function QuickReference() {
  return <section className="guide-sheet">
    <h2>Health worker quick reference</h2>
    <p className="guide-subtitle">Maternawell · Keep at the screening station · Version 1</p>
    <ol>
      <li><strong>Prepare.</strong> Use your assigned account and verify the facility. Explain screening, confidentiality and next steps. Record informed consent.</li>
      <li><strong>Register.</strong> Select New screening. Enter the required details and relevant background information. Check the record before continuing.</li>
      <li><strong>Ask.</strong> Complete all ten English EPDS questions about the previous seven days. Use the exact displayed question and response options. Use Back to correct an answer.</li>
      <li><strong>Review.</strong> Check the total score and care plan: 0–8 low risk; 9–12 moderate risk; 13–30 high risk. A positive item 10 response overrides the total and requires same-day escalation.</li>
      <li><strong>Arrange care.</strong> Follow the displayed stepped-care recommendation and your facility’s approved protocol. Record the referral destination, action and follow-up date. Confirm contact information through your facility before relying on it.</li>
      <li><strong>Close the loop.</strong> Update referral and follow-up outcomes. An exported form is not proof that a referral was received.</li>
      <li><strong>Finish safely.</strong> Check the draft-save and sync indicators. Pending records remain on this device until a successful server sync. Do not clear site data or uninstall the app while work is pending. Sign out on shared devices.</li>
    </ol>
    <aside className="guide-callout"><strong>Urgent concern:</strong> Do not wait for sync or a printed referral to act on a self-harm concern. Follow the facility’s approved same-day emergency pathway.</aside>
    <p><strong>Offline:</strong> Install/open the app online before an offline shift. A saved draft and a record received by the server are different states. Reconnect and confirm that pending work has synced.</p>
    <p><strong>Language:</strong> The validated Yoruba EPDS is not included. Do not improvise a translated clinical questionnaire. Yoruba navigation is a draft for language review.</p>
    <p className="guide-footnote">Screening supports assessment and is not a diagnosis. Review this guide with the facility lead before clinical deployment.</p>
  </section>;
}

function SupervisorGuide() {
  return <>
    <section className="guide-sheet">
      <h2>Supervisor guide</h2><p className="guide-subtitle">Page 1 of 3 · Prepare the facility</p>
      <h3>Accounts and device readiness</h3>
      <p>Use an administrator-provisioned supervisor account. Confirm that the account belongs to the intended facility and that each worker has an individual account. Shared credentials weaken accountability.</p>
      <p>Open the installed app online before field use. Confirm that the expected version loads, the facility directory is current, and a test record can be saved and synced in a non-clinical test environment. Keep devices charged and protected by a device screen lock.</p>
      <h3>Prepare the clinical workflow</h3>
      <p>Agree who receives same-day escalations, how a worker contacts them, and how receipt is confirmed. Verify referral contacts through facility management. Confirm how emergency care is arranged when the network is unavailable.</p>
      <p>Train workers to explain consent, use all ten question items without changing their wording, and distinguish a screening result from a diagnosis. A self-harm response requires action regardless of total score.</p>
      <h3>Training and language</h3>
      <p>Ask each worker to complete the first-login introduction and practise a complete screening and referral. Print the quick reference. Validated Yoruba EPDS wording and local language review must be supplied before Yoruba clinical screening can be released.</p>
      <h3>Before each shift</h3>
      <ul><li>Confirm staffing for urgent referrals and follow-up.</li><li>Check the device’s connection, charge and save/sync status.</li><li>Resolve pending or failed work before clearing or replacing a device.</li><li>Confirm workers know the downtime procedure.</li></ul>
    </section>
    <section className="guide-sheet">
      <h2>Supervisor guide</h2><p className="guide-subtitle">Page 2 of 3 · Review service delivery</p>
      <h3>Daily review</h3>
      <p>Open the supervisor dashboard and select the intended reporting period. Review the screened count and risk distribution alongside referrals and follow-up outcomes. Check urgent and overdue cases promptly with the responsible worker.</p>
      <p>Dashboard data can be incomplete while devices are offline. Compare pending sync and the reporting cut-off with the reporting period. Do not treat missing records as evidence that screening or referral did not occur.</p>
      <h3>Referral completion</h3>
      <p>Confirm that a referral was accepted by its destination and that the recorded outcome reflects what actually happened. Record completion, rescheduling or the reason the mother could not attend. An action button or downloaded PDF alone does not establish receipt or attendance.</p>
      <h3>Data quality</h3>
      <ul><li>Check incomplete records, duplicate registrations and unexpected score patterns.</li><li>Confirm consent is recorded and all ten responses are present.</li><li>Resolve corrections with the responsible worker; preserve the audit history.</li><li>Check that follow-up dates and outcomes are current.</li></ul>
      <h3>Reporting</h3>
      <p>Use the dashboard’s report export where available. Confirm the facility, date range and total before sharing. Reports with patient details belong only in approved clinical channels. Facility summaries should omit identifying details when those details are not needed.</p>
      <p className="guide-footnote">A result on one device may not yet be available to another device. Confirm successful sync before reconciling totals.</p>
    </section>
    <section className="guide-sheet">
      <h2>Supervisor guide</h2><p className="guide-subtitle">Page 3 of 3 · Downtime and escalation</p>
      <h3>Network or sync failure</h3>
      <p>Check the connection and try sync again. Keep the device and browser profile that hold pending records. Record the time, affected worker and visible error for the technical lead. Avoid sending patient details in screenshots or support messages.</p>
      <h3>Save failure or device loss</h3>
      <p>If the app reports a save failure, do not assume the record is durable. Follow the facility’s approved downtime record process. If a device is lost, stolen or cleared before sync, tell the facility lead promptly; a remote backup cannot recover a record it never received.</p>
      <h3>Account problems</h3>
      <p>Use the administrator’s approved account recovery process. Do not create an alternate identity to regain access to an existing clinical record. Report unexpected facility access or role permissions before continuing.</p>
      <h3>Before deployment and after upgrades</h3>
      <ul><li>Verify emergency contacts, consent text, retention policy and staff training.</li><li>Test save/reload/resume, offline start and interrupted sync using non-clinical records.</li><li>Verify Android devices actually used at the facility.</li><li>Measure scoring latency and complete a full 8–12 hour offline-shift test.</li><li>Approve the validated Yoruba questionnaire before enabling Yoruba clinical questions.</li></ul>
      <h3>Local contacts</h3>
      <p>Facility clinical lead: ______________________________</p>
      <p>Approved emergency pathway: ________________________</p>
      <p>Technical support: _________________________________</p>
      <p className="guide-footnote">Complete these contacts before distributing printed copies. Document owner: facility supervisor. Review at each release and whenever contacts change.</p>
    </section>
  </>;
}

function FAQ() {
  const answers = [
    ['Is this a diagnosis?', 'No. EPDS is a screening instrument. A qualified health professional interprets the result and arranges assessment and care.'],
    ['What if item 10 is positive but the total is low?', 'The self-harm response overrides the numerical risk tier. Follow the approved same-day escalation pathway shown by the app and your facility.'],
    ['Can I work without internet?', 'After the app has been loaded and installed online, supported offline workflows can save on the same device. Check save status. Server sync and access from another device require a working connection.'],
    ['Does “saved” mean the supervisor can see the record?', 'No. A local save and successful server sync are separate. Confirm the sync indicator before assuming a record is available elsewhere.'],
    ['May I clear browser data to fix a problem?', 'Only after the facility technical lead has confirmed all necessary records are synced or recovered. Clearing site data removes local records and drafts.'],
    ['How do I continue an interrupted screening?', 'Sign in with the same account on the same device and browser profile. Use the saved draft shown on the dashboard. Check the answers before continuing.'],
    ['Is the questionnaire available in Yoruba?', 'Not yet. Only administrative UI labels are available as a draft. A validated and approved Yoruba EPDS version is required before Yoruba questions can be enabled.'],
    ['Where do I find help for my current page?', 'Use the page-help strip below the main content. This Help page contains the quick reference and a three-page supervisor guide, both printable from the browser.'],
    ['Can I see the introduction again?', 'Sign in and choose Replay introduction on this page. The first-login preference is stored per account on this browser.'],
    ['What if a referral contact does not work?', 'Use your facility’s verified escalation pathway and notify the supervisor so the directory can be corrected. Never delay urgent care while waiting for a network request.'],
  ];
  return <section className="guide-sheet"><h2>Frequently asked questions</h2>{answers.map(([question, answer]) =>
    <section className="faq-entry" key={question}><h3>{question}</h3><p>{answer}</p></section>
  )}</section>;
}

function YorubaReference() {
  const keys = ['language', 'dashboard', 'newScreening', 'screenings', 'supervisor', 'help', 'signIn', 'signOut', 'next', 'back', 'save', 'cancel', 'print'];
  return <section className="guide-sheet"><h2>Yoruba interface reference</h2>
    <p>This is an administrative navigation reference for review with Yoruba-speaking staff. It is not a translated EPDS instrument. The remaining instructions and clinical questionnaire are in English.</p>
    <EpdsLanguageNotice always />
    <table><thead><tr><th scope="col">English</th><th scope="col" lang="yo">Yorùbá — draft</th></tr></thead><tbody>
      {keys.map((key) => <tr key={key}><td>{UI_TRANSLATIONS.en[key]}</td><td lang="yo">{UI_TRANSLATIONS.yo[key]}</td></tr>)}
    </tbody></table>
    <h3>Required before clinical language release</h3>
    <p>A clinical lead must provide the validated Yoruba EPDS wording, response options, source/version and any permissions needed for use. A Yoruba language reviewer must approve the navigation and help copy. Preserve the validated response scoring and test equivalence with the English instrument before enabling Yoruba screening.</p>
  </section>;
}

export default function Help() {
  const { user } = useAuth();
  const { t, language } = useLanguage();
  const [guide, setGuide] = useState('quick');
  const home = user ? (user.role === 'supervisor' ? '/supervisor' : '/dashboard') : '/login';
  return <main className="help-page" lang="en">
    <header className="help-header no-print">
      <div><Link to={home} lang={language}>← {t(user ? 'dashboard' : 'signIn')}</Link><h1>Help and guides</h1><p>Practical support for screening, referrals and safe offline work.</p></div>
      <LanguageSelector />
    </header>
    <nav className="help-navigation no-print" aria-label="Guide selection">
      {guides.map(([id, key]) => <button type="button" key={id} aria-pressed={guide === id} onClick={() => setGuide(id)} lang={language}>{t(key)}</button>)}
    </nav>
    <div className="help-actions no-print">
      <button className="btn btn-primary" type="button" onClick={() => window.print()} lang={language}>{t('print')}</button>
      {user && <button className="btn btn-secondary" type="button" onClick={replayOnboarding} lang={language}>{t('replayTour')}</button>}
      <span>Select a guide, then print or save it as a PDF.</span>
    </div>
    <article className={`printable-guide guide-${guide}`}>
      {guide === 'quick' && <QuickReference />}
      {guide === 'supervisor' && <SupervisorGuide />}
      {guide === 'faq' && <FAQ />}
      {guide === 'yoruba' && <YorubaReference />}
    </article>
  </main>;
}
