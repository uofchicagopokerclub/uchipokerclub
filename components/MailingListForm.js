import { useRef, useState } from 'react';
import { ledger, mailingList } from '../content/club';
import { postToLedger } from '../lib/api';
import FormSuccess from './FormSuccess';
import SubmitButton from './SubmitButton';

// Class years only, without the ledger sign-up's "Other" (Max, 2026-10-07).
const YEARS = ledger.years.filter((y) => y !== 'Other');

// The old Squarespace footer form's fields and button, plus class year and major. Sign-ups land in the
// "Mailing list" tab of the club Google Sheet.
export default function MailingListForm() {
  const [values, setValues] = useState({ fname: '', lname: '', email: '', year: '', major: '', website: '' });
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);
  const refs = { fname: useRef(null), lname: useRef(null), email: useRef(null), year: useRef(null), major: useRef(null) };

  const set = (k) => (e) => setValues((v) => ({ ...v, [k]: e.target.value }));

  function fail(errs) {
    setErrors(errs);
    refs[Object.keys(errs)[0]]?.current?.focus();
  }

  async function submit(e) {
    e.preventDefault();
    const v = {
      fname: values.fname.replace(/\s+/g, ' ').trim(),
      lname: values.lname.replace(/\s+/g, ' ').trim(),
      email: values.email.trim().toLowerCase(),
      year: values.year,
      major: values.major.replace(/\s+/g, ' ').trim(),
      website: values.website,
    };
    const errs = {};
    if (!v.fname) errs.fname = 'Enter your first name.';
    if (!v.lname) errs.lname = 'Enter your last name.';
    if (!/^\S+@\S+\.\S+$/.test(v.email)) errs.email = 'Enter a valid email address.';
    if (!v.year) errs.year = 'Pick your class year.';
    if (!v.major) errs.major = 'Enter your major. Undeclared is fine.';
    setFormError('');
    if (Object.keys(errs).length) return fail(errs);
    setErrors({});

    setSending(true);
    try {
      const res = await postToLedger({ action: 'subscribe', ...v });
      if (res.ok) setDone(true);
      else if (res.field) fail({ [res.field]: res.error });
      else setFormError(res.error || 'Something went wrong. Try again.');
    } catch (err) {
      setFormError(err.message);
    } finally {
      setSending(false);
    }
  }

  if (done) {
    return (
      <FormSuccess>
        <h3>{mailingList.success}</h3>
      </FormSuccess>
    );
  }

  return (
    <form className="form" onSubmit={submit} noValidate>
      <div className="signup-row">
        <label className="field">
          <span className="sr-only">First Name</span>
          <input ref={refs.fname} className="input" name="fname" placeholder="First Name" maxLength={30} autoComplete="given-name" value={values.fname} onChange={set('fname')} aria-invalid={errors.fname ? 'true' : undefined} />
          {errors.fname && <span className="field-error">{errors.fname}</span>}
        </label>
        <label className="field">
          <span className="sr-only">Last Name</span>
          <input ref={refs.lname} className="input" name="lname" placeholder="Last Name" maxLength={30} autoComplete="family-name" value={values.lname} onChange={set('lname')} aria-invalid={errors.lname ? 'true' : undefined} />
          {errors.lname && <span className="field-error">{errors.lname}</span>}
        </label>
        <label className="field wide">
          <span className="sr-only">Email Address</span>
          <input ref={refs.email} className="input" type="email" name="email" placeholder="Email Address" maxLength={120} autoComplete="email" inputMode="email" value={values.email} onChange={set('email')} aria-invalid={errors.email ? 'true' : undefined} />
          {errors.email && <span className="field-error">{errors.email}</span>}
        </label>
        <label className="field">
          <span className="sr-only">Class Year</span>
          <select ref={refs.year} className="input" name="year" value={values.year} onChange={set('year')} data-empty={values.year ? undefined : ''} aria-invalid={errors.year ? 'true' : undefined}>
            <option value="">Class Year</option>
            {YEARS.map((y) => <option key={y}>{y}</option>)}
          </select>
          {errors.year && <span className="field-error">{errors.year}</span>}
        </label>
        <label className="field">
          <span className="sr-only">Major</span>
          <input ref={refs.major} className="input" name="major" placeholder="Major" maxLength={60} autoComplete="off" value={values.major} onChange={set('major')} aria-invalid={errors.major ? 'true' : undefined} />
          {errors.major && <span className="field-error">{errors.major}</span>}
        </label>
      </div>
      <label className="trap" aria-hidden="true">
        Website
        <input name="website" tabIndex={-1} autoComplete="off" value={values.website} onChange={set('website')} />
      </label>
      {formError && <p className="form-error" role="alert">{formError}</p>}
      <div>
        <SubmitButton busy={sending} busyLabel="Signing up">Sign Up</SubmitButton>
        <p className="field-help" style={{ marginTop: 10 }}>Only the board sees your email.</p>
      </div>
    </form>
  );
}
