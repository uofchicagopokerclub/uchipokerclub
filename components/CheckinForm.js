import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { ledger } from '../content/club';
import { postToLedger } from '../lib/api';
import { formatClock } from '../lib/schedule';
import FormSuccess from './FormSuccess';
import SubmitButton from './SubmitButton';

// After a check-in the email is remembered on this phone, so next week a member types only the meeting code.
const STORE_EMAIL = 'ucpc-checkin-email';
function readEmail() {
  try { return localStorage.getItem(STORE_EMAIL) || ''; } catch { return ''; }
}
function writeEmail(v) {
  try { localStorage.setItem(STORE_EMAIL, v); } catch {}
}

// Field names (code, email) are the Apps Script contract. Do not rename them.
export default function CheckinForm() {
  const [values, setValues] = useState({ code: '', email: '' });
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [unknown, setUnknown] = useState(false); // the email is on no one's ledger row, so point to joining
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(null); // { name, week, at }
  // Off after "Check in someone else", so a friend using this phone does not replace the owner's saved email.
  const [rememberEmail, setRememberEmail] = useState(true);
  const refs = { code: useRef(null), email: useRef(null) };

  useEffect(() => {
    const saved = readEmail();
    if (saved) setValues((v) => (v.email ? v : { ...v, email: saved }));
  }, []);

  const set = (k) => (e) => setValues((v) => ({ ...v, [k]: e.target.value }));

  function fail(field, msg) {
    setErrors({ [field]: msg });
    refs[field]?.current?.focus();
  }

  async function submit(e) {
    e.preventDefault();
    setErrors({});
    setFormError('');
    setUnknown(false);
    const v = { code: values.code.trim(), email: values.email.trim().toLowerCase() };
    // Quick checks here; the server repeats them and has the final say.
    if (!v.code) return fail('code', 'Enter the meeting code.');
    if (!/^\S+@\S+\.\S+$/.test(v.email)) return fail('email', 'Enter the email you joined the ledger with.');

    setSending(true);
    try {
      const res = await postToLedger({ action: 'checkin', ...v });
      if (res.ok) {
        if (rememberEmail) writeEmail(v.email);
        setDone({ name: res.name, week: res.week, at: res.at });
      } else if (res.field) {
        fail(res.field, res.error);
        setUnknown(Boolean(res.unknown));
      } else {
        setFormError(res.error || 'Something went wrong. Try again.');
      }
    } catch (err) {
      setFormError(err.message);
    } finally {
      setSending(false);
    }
  }

  function someoneElse() {
    // Keep the code for the next person on this phone; their email is theirs to type.
    setValues((v) => ({ code: v.code, email: '' }));
    setRememberEmail(false);
    setDone(null);
    setTimeout(() => refs.email.current?.focus(), 0);
  }

  if (done) {
    const time = formatClock(done.at);
    return (
      <FormSuccess>
        <p className="checkin-when">Checked in for {done.week}{time ? ` at ${time}` : ''}</p>
        <h2 className="checkin-name">{done.name}</h2>
        <p>{ledger.checkinNote}</p>
        <div className="actions" style={{ marginTop: 16 }}>
          <button className="btn btn-secondary" type="button" onClick={someoneElse}>Check in someone else</button>
        </div>
      </FormSuccess>
    );
  }

  const invalid = (k) => (errors[k] ? 'true' : undefined);

  return (
    <form className="form" onSubmit={submit} noValidate>
      <label className="field">
        <span className="field-label">Meeting code</span>
        <input ref={refs.code} className="input" name="code" maxLength={20} autoComplete="off" autoCapitalize="characters" autoCorrect="off" spellCheck="false" value={values.code} onChange={set('code')} aria-invalid={invalid('code')} aria-describedby="code-help" />
        <span className="field-help" id="code-help">Shown in the room at meetings.</span>
        {errors.code && <span className="field-error">{errors.code}</span>}
      </label>
      <label className="field">
        <span className="field-label">Email</span>
        <input ref={refs.email} className="input" type="email" name="email" maxLength={120} autoComplete="email" inputMode="email" placeholder="you@uchicago.edu" value={values.email} onChange={set('email')} aria-invalid={invalid('email')} aria-describedby="email-help" />
        <span className="field-help" id="email-help">The one you joined the ledger with. Remembered on this phone for next week.</span>
        {errors.email && <span className="field-error">{errors.email}</span>}
        {unknown && <Link className="text-link" href="/ledger/join">Join the ledger</Link>}
      </label>
      {formError && <p className="form-error" role="alert">{formError}</p>}
      <div>
        <SubmitButton busy={sending} busyLabel="Checking in">Check in</SubmitButton>
      </div>
    </form>
  );
}
