import { useRef, useState } from 'react';
import { club } from '../content/club';
import { postToLedger } from '../lib/api';
import { endSentence } from '../lib/ledger';

const EMPTY = { name: '', company: '', email: '', message: '', website: '' };

// Sponsor inquiries land in the "Sponsor inquiries" tab of the club Sheet for the board to follow up.
// Nothing is emailed. Field names are the Apps Script contract: do not rename them.
export default function SponsorForm() {
  const [values, setValues] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(null);
  const refs = { name: useRef(null), company: useRef(null), email: useRef(null), message: useRef(null) };

  const set = (k) => (e) => setValues((v) => ({ ...v, [k]: e.target.value }));

  function fail(field, msg) {
    setErrors({ [field]: msg });
    refs[field]?.current?.focus();
  }

  async function submit(e) {
    e.preventDefault();
    setErrors({});
    setFormError('');
    const v = {
      name: values.name.replace(/\s+/g, ' ').trim(),
      company: values.company.replace(/\s+/g, ' ').trim(),
      email: values.email.trim().toLowerCase(),
      message: values.message.trim(),
      website: values.website,
    };
    if (!v.name) return fail('name', 'Enter your name.');
    if (!v.company) return fail('company', 'Enter your company.');
    if (!/^\S+@\S+\.\S+$/.test(v.email)) return fail('email', 'Enter a valid email address.');

    setSending(true);
    try {
      const res = await postToLedger({ action: 'sponsor', ...v });
      if (res.ok) setSent({ name: res.name || v.name, email: v.email });
      else if (res.field) fail(res.field, res.error);
      else setFormError(res.error || 'Something went wrong. Try again.');
    } catch (err) {
      setFormError(err.message);
    } finally {
      setSending(false);
    }
  }

  if (sent) {
    return (
      <div className="form-ok" role="status">
        <h3>{endSentence(`Thanks, ${sent.name}`)}</h3>
        <p>A member of the board will reach out at {sent.email}.</p>
      </div>
    );
  }

  const invalid = (k) => (errors[k] ? 'true' : undefined);

  return (
    <form className="form" onSubmit={submit} noValidate>
      <div className="signup-row">
        <label className="field">
          <span className="field-label">Name</span>
          <input ref={refs.name} className="input" name="name" maxLength={60} autoComplete="name" value={values.name} onChange={set('name')} aria-invalid={invalid('name')} />
          {errors.name && <span className="field-error">{errors.name}</span>}
        </label>
        <label className="field">
          <span className="field-label">Company</span>
          <input ref={refs.company} className="input" name="company" maxLength={80} autoComplete="organization" value={values.company} onChange={set('company')} aria-invalid={invalid('company')} />
          {errors.company && <span className="field-error">{errors.company}</span>}
        </label>
        <label className="field wide">
          <span className="field-label">Work email</span>
          <input ref={refs.email} className="input" type="email" name="email" maxLength={120} autoComplete="email" inputMode="email" value={values.email} onChange={set('email')} aria-invalid={invalid('email')} />
          {errors.email && <span className="field-error">{errors.email}</span>}
        </label>
        <label className="field wide">
          <span className="field-label">Message (optional)</span>
          <textarea ref={refs.message} className="input textarea" name="message" maxLength={1000} rows={4} value={values.message} onChange={set('message')} aria-invalid={invalid('message')} />
          {errors.message && <span className="field-error">{errors.message}</span>}
        </label>
      </div>
      <label className="trap" aria-hidden="true">
        Website
        <input name="website" tabIndex={-1} autoComplete="off" value={values.website} onChange={set('website')} />
      </label>
      {formError && <p className="form-error" role="alert">{formError}</p>}
      <div>
        <button className="btn btn-primary" type="submit" disabled={sending}>{sending ? 'Sending' : 'Request the prospectus'}</button>
        <p className="field-help" style={{ marginTop: 10 }}>
          Prefer email? Write to <a className="text-link" href={`mailto:${club.email}`}>{club.email}</a>.
        </p>
      </div>
    </form>
  );
}
