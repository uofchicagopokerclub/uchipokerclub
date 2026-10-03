import { useRef, useState } from 'react';
import { ledger } from '../content/club';
import { postToLedger } from '../lib/api';
import { endSentence } from '../lib/ledger';

const YEARS = ledger.years;
const DOMAIN = '@uchicago.edu';
const EMPTY = { code: '', name: '', email: '', year: '', website: '' };

// Field names (code, name, email, year, website) are the Apps Script contract. Do not rename them.
export default function JoinLedgerForm() {
  const [values, setValues] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [sending, setSending] = useState(false);
  const [joined, setJoined] = useState('');
  const refs = { code: useRef(null), name: useRef(null), email: useRef(null), year: useRef(null) };

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
      code: values.code.trim(),
      name: values.name.replace(/\s+/g, ' ').trim(),
      email: values.email.trim().toLowerCase(),
      year: values.year,
      website: values.website,
    };
    // Quick checks here; the server repeats them and has the final say.
    if (!v.code) return fail('code', 'Enter the sign-up code.');
    if (!v.name) return fail('name', 'Enter the name you want on the leaderboard.');
    if (!/^\S+@\S+\.\S+$/.test(v.email)) return fail('email', 'Enter a valid email address.');
    if (!v.email.endsWith(DOMAIN)) return fail('email', `Use your ${DOMAIN} email.`);
    if (!v.year) return fail('year', 'Pick your class year.');

    setSending(true);
    try {
      const res = await postToLedger({ action: 'join', ...v });
      if (res.ok) setJoined(res.name || v.name);
      else if (res.field) fail(res.field, res.error);
      else setFormError(res.error || 'Something went wrong. Try again.');
    } catch (err) {
      setFormError(err.message);
    } finally {
      setSending(false);
    }
  }

  function again() {
    // Keep the code filled in for the next person at a sign-up table.
    setValues((v) => ({ ...EMPTY, code: v.code }));
    setJoined('');
    setTimeout(() => refs.name.current?.focus(), 0);
  }

  if (joined) {
    return (
      <div className="form-ok" role="status">
        <h2>{endSentence(`You\u2019re on the ledger, ${joined}`)}</h2>
        <p>Your results show on the leaderboard after your first weekly meeting.</p>
        <button className="btn btn-secondary" type="button" onClick={again} style={{ marginTop: 16 }}>Sign up someone else</button>
      </div>
    );
  }

  const invalid = (k) => (errors[k] ? 'true' : undefined);

  return (
    <form className="form" onSubmit={submit} noValidate>
      <label className="field">
        <span className="field-label">Sign-up code</span>
        <input ref={refs.code} className="input" name="code" maxLength={20} autoComplete="off" autoCapitalize="characters" spellCheck="false" value={values.code} onChange={set('code')} aria-invalid={invalid('code')} aria-describedby="code-help" />
        <span className="field-help" id="code-help">The board shares it at meetings.</span>
        {errors.code && <span className="field-error">{errors.code}</span>}
      </label>
      <label className="field">
        <span className="field-label">Name on the leaderboard</span>
        <input ref={refs.name} className="input" name="name" maxLength={40} autoComplete="name" value={values.name} onChange={set('name')} aria-invalid={invalid('name')} aria-describedby="name-help" />
        <span className="field-help" id="name-help">This shows on the public leaderboard. First name and last initial works.</span>
        {errors.name && <span className="field-error">{errors.name}</span>}
      </label>
      <label className="field">
        <span className="field-label">Email</span>
        <input ref={refs.email} className="input" type="email" name="email" maxLength={120} autoComplete="email" inputMode="email" placeholder={`you${DOMAIN}`} value={values.email} onChange={set('email')} aria-invalid={invalid('email')} aria-describedby="email-help" />
        <span className="field-help" id="email-help">Use your {DOMAIN} address. Only the board sees your email.</span>
        {errors.email && <span className="field-error">{errors.email}</span>}
      </label>
      <label className="field">
        <span className="field-label">Class year</span>
        <select ref={refs.year} className="input" name="year" value={values.year} onChange={set('year')} aria-invalid={invalid('year')}>
          <option value="">Select</option>
          {YEARS.map((y) => <option key={y}>{y}</option>)}
        </select>
        {errors.year && <span className="field-error">{errors.year}</span>}
      </label>
      <label className="trap" aria-hidden="true">
        Website
        <input name="website" tabIndex={-1} autoComplete="off" value={values.website} onChange={set('website')} />
      </label>
      {formError && <p className="form-error" role="alert">{formError}</p>}
      <div>
        <button className="btn btn-primary" type="submit" disabled={sending}>{sending ? 'Joining' : 'Join the ledger'}</button>
      </div>
    </form>
  );
}
