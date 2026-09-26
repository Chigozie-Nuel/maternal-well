import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertCircle, ArrowRight, ShieldCheck } from 'lucide-react';
import { useScreening } from '../context/ScreeningContext';
import { PageHeader } from '../components/ui';

// Read aloud to the mother before any personal or health information is recorded (NDPA 2023 s.30, SRS NFR-6).
export const CONSENT_STATEMENT = [
  'We would like to ask you 10 short questions about how you have been feeling in the past 7 days. This helps us see whether you might benefit from extra support.',
  'This is a screening, not a diagnosis. Your answers will be stored securely and encrypted, and seen only by health staff at this facility who are involved in your care.',
  'If your answers suggest you need support, we will recommend next steps, which may include a referral. If you tell us you have had thoughts of harming yourself, we must inform the facility supervisor the same day so that you get help quickly.',
  'Taking part is your choice. You can refuse, stop at any time, or later ask for your information to be corrected or withdrawn. Your care at this facility will not be affected.'
];

const initial = {
  name: '', fileNumber: '', age: '', weeksPostpartum: '', phone: '', numberOfChildren: '',
  hasSupportSystem: 'yes', previousMentalHealthHistory: 'no', consentGiven: false, statementRead: false
};

const MotherInfoForm = () => {
  const navigate = useNavigate();
  const { startScreening } = useScreening();
  const [form, setForm] = useState(initial);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = field => event => setForm(previous => ({ ...previous, [field]: event.target.type === 'checkbox' ? event.target.checked : event.target.value }));

  const handleSubmit = async event => {
    event.preventDefault();
    const name = form.name.trim();
    const fileNumber = form.fileNumber.trim();
    const age = Number(form.age);
    const weeks = Number(form.weeksPostpartum);
    if (!name || !fileNumber || form.age === '' || form.weeksPostpartum === '') return setError('Enter the mother’s name, file number, age and weeks since delivery.');
    if (!Number.isInteger(age) || age < 12 || age > 55) return setError('Enter an age between 12 and 55 years.');
    if (!Number.isInteger(weeks) || weeks < 0 || weeks > 52) return setError('Weeks since delivery must be between 0 and 52.');
    if (!form.statementRead || !form.consentGiven) return setError('Read the consent statement to the mother and record her agreement before continuing. If she does not agree, do not record any information.');
    setBusy(true);
    try {
      const draft = await startScreening({
        name, fileNumber, age, weeksPostpartum: weeks, phone: form.phone.trim(),
        numberOfChildren: form.numberOfChildren === '' ? null : Number(form.numberOfChildren),
        hasSupportSystem: form.hasSupportSystem, previousMentalHealthHistory: form.previousMentalHealthHistory,
        consentGiven: true, consentDate: new Date().toISOString()
      });
      navigate(`/screening/${draft.id}`);
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="New screening" subtitle="Step 1 of 2: consent and mother’s details. Step 2: the 10 EPDS questions." />
      <form onSubmit={handleSubmit} className="card p-5 sm:p-8" noValidate>
        <section aria-labelledby="consent-heading" className="mb-6 rounded-2xl border-2 border-green-300 bg-green-50 p-4">
          <h2 id="consent-heading" className="mb-2 flex items-center gap-2 text-lg font-bold text-green-950"><ShieldCheck size={20} aria-hidden="true" /> Consent (read this to the mother)</h2>
          <div className="space-y-2 text-sm leading-relaxed text-green-950">
            {CONSENT_STATEMENT.map(paragraph => <p key={paragraph}>{paragraph}</p>)}
          </div>
          <label className="mt-4 flex min-h-[44px] items-start gap-3 text-sm font-semibold text-green-950">
            <input type="checkbox" className="mt-1 h-5 w-5" checked={form.statementRead} onChange={set('statementRead')} />
            I have read this statement to the mother in a language she understands and answered her questions.
          </label>
          <label className="flex min-h-[44px] items-start gap-3 text-sm font-semibold text-green-950">
            <input type="checkbox" className="mt-1 h-5 w-5" checked={form.consentGiven} onChange={set('consentGiven')} />
            The mother agrees to be screened and for her information to be recorded.
          </label>
        </section>

        <fieldset disabled={!form.consentGiven || !form.statementRead} className="disabled:opacity-50">
          <legend className="mb-3 text-lg font-bold text-slate-900">Mother’s details</legend>
          <div className="grid gap-x-4 sm:grid-cols-2">
            <div className="input-group"><label htmlFor="name" className="input-label">Full name *</label>
              <input id="name" className="input-field" value={form.name} onChange={set('name')} autoComplete="off" /></div>
            <div className="input-group"><label htmlFor="fileNumber" className="input-label">PHC file number *</label>
              <input id="fileNumber" className="input-field" value={form.fileNumber} onChange={set('fileNumber')} placeholder="e.g. IKJ/2026/0412" autoComplete="off" /></div>
            <div className="input-group"><label htmlFor="age" className="input-label">Age (years) *</label>
              <input id="age" type="number" inputMode="numeric" className="input-field" value={form.age} onChange={set('age')} /></div>
            <div className="input-group"><label htmlFor="weeks" className="input-label">Weeks since delivery *</label>
              <input id="weeks" type="number" inputMode="numeric" className="input-field" value={form.weeksPostpartum} onChange={set('weeksPostpartum')} /></div>
            <div className="input-group"><label htmlFor="phone" className="input-label">Phone (for follow-up)</label>
              <input id="phone" type="tel" inputMode="tel" className="input-field" value={form.phone} onChange={set('phone')} placeholder="080X XXX XXXX" /></div>
            <div className="input-group"><label htmlFor="children" className="input-label">Number of children</label>
              <input id="children" type="number" inputMode="numeric" className="input-field" value={form.numberOfChildren} onChange={set('numberOfChildren')} /></div>
            <div className="input-group"><label htmlFor="support" className="input-label">Support from family or partner</label>
              <select id="support" className="input-field" value={form.hasSupportSystem} onChange={set('hasSupportSystem')}>
                <option value="yes">Yes</option><option value="uncertain">Some / unsure</option><option value="no">No</option>
              </select></div>
            <div className="input-group"><label htmlFor="history" className="input-label">Previous mental health support</label>
              <select id="history" className="input-field" value={form.previousMentalHealthHistory} onChange={set('previousMentalHealthHistory')}>
                <option value="no">None known</option><option value="depression">Yes, for low mood</option><option value="anxiety">Yes, for anxiety</option><option value="other">Yes, other</option>
              </select></div>
          </div>
        </fieldset>

        {error && <p role="alert" className="mb-4 flex items-start gap-2 rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-800"><AlertCircle size={18} className="mt-0.5 shrink-0" aria-hidden="true" />{error}</p>}
        <div className="flex flex-wrap gap-3">
          <button type="submit" className="btn btn-primary flex-1" disabled={busy}>Start the 10 questions <ArrowRight size={18} aria-hidden="true" /></button>
          <button type="button" className="btn btn-secondary" onClick={() => navigate('/dashboard')}>Cancel</button>
        </div>
      </form>
    </div>
  );
};

export default MotherInfoForm;
