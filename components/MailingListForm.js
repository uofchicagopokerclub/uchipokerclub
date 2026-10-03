import { useState } from 'react';
import { mailingList } from '../content/club';
import { postToLedger } from '../lib/api';

// Same fields and button as the old Squarespace footer form. Sign-ups land in the
// "Mailing list" tab of the club Google Sheet.
export default function MailingListForm() {
  const [values, setValues] = useState({ fname: '', lname: '', email: '', website: '' });
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);

  const set = (k) => (e) => setValues((v) => ({ ...v, [k]: e.target.value }));

  async function submit(e) {
    e.preventDefault();
    const v = {
      fname: values.fname.replace(/\s+/g, ' ').trim(),
      lname: values.lname.replace(/\s+/g, ' ').trim(),
      email: values.email.trim().toLowerCase(),
      website: values.website,
    };
    const errs = {};
    if (!v.fname) errs.fname = 'Enter your first name.';
    if (!v.lname) errs.lname = 'Enter your last name.';
    if (!/^\S+@\S+\.\S+$/.test(v.email)) errs.email = 'Enter a valid email address.';
    setErrors(errs);
    setFormError('');
    if (Object.keys(errs).length) return;

    setSending(true);
    try {
      const res = await postToLedger({ action: 'subscribe', ...v });
      if (res.ok) setDone(true);
      else if (res.field) setErrors({ [res.field]: res.error });
      else setFormError(res.error || 'Something went wrong. Try again.');
    } catch (err) {
      setFormError(err.message);
    } finally {
      setSending(false);
    }
  }

  if (done) {
    return (
      <div className="form-ok" role="status">
        <h3>{mailingList.success}</h3>
      </div>
    );
  }

  return (
    <form className="form" onSubmit={submit} noValidate>
      <div className="signup-row">
        <label className="field">
          <span className="sr-only">First Name</span>
          <input className="input" name="fname" placeholder="First Name" maxLength={30} autoComplete="given-name" value={values.fname} onChange={set('fname')} aria-invalid={errors.fname ? 'true' : undefined} />
          {errors.fname && <span className="field-error">{errors.fname}</span>}
        </label>
        <label className="field">
          <span className="sr-only">Last Name</span>
          <input className="input" name="lname" placeholder="Last Name" maxLength={30} autoComplete="family-name" value={values.lname} onChange={set('lname')} aria-invalid={errors.lname ? 'true' : undefined} />
          {errors.lname && <span className="field-error">{errors.lname}</span>}
        </label>
        <label className="field wide">
          <span className="sr-only">Email Address</span>
          <input className="input" type="email" name="email" placeholder="Email Address" maxLength={120} autoComplete="email" inputMode="email" value={values.email} onChange={set('email')} aria-invalid={errors.email ? 'true' : undefined} />
          {errors.email && <span className="field-error">{errors.email}</span>}
        </label>
      </div>
      <label className="trap" aria-hidden="true">
        Website
        <input name="website" tabIndex={-1} autoComplete="off" value={values.website} onChange={set('website')} />
      </label>
      {formError && <p className="form-error" role="alert">{formError}</p>}
      <div>
        <button className="btn btn-primary" type="submit" disabled={sending}>{sending ? 'Signing up' : 'Sign Up'}</button>
        <p className="field-help" style={{ marginTop: 10 }}>Only the board sees your email.</p>
      </div>
    </form>
  );
}
