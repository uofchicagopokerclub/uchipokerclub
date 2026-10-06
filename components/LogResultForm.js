import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { postToLedger } from '../lib/api';
import { endSentence, nameKey, signed, tone, wholeChips } from '../lib/ledger';
import FormSuccess from './FormSuccess';
import SubmitButton from './SubmitButton';

const NAME_KEY = 'ucpc-log-name';
function readName() {
  try { return localStorage.getItem(NAME_KEY) || ''; } catch { return ''; }
}
function writeName(v) {
  try { localStorage.setItem(NAME_KEY, v); } catch {}
}

// The old backend answers an action it does not know as a wrong board password.
const NOT_READY = 'Logging is not switched on yet. Ask a board member.';

// Members log their end-of-night chip count at a meeting. Step one: the meeting code unlocks tonight's week and
// the list of names. Step two: name and chips. Nothing counts until a board member has seen the chips and
// approved it in the board tool. Field names (code, name, chips) are the Apps Script contract. No hidden spam
// field here: the meeting code keeps bots out, and a field a browser autofills would silently drop a real entry.
export default function LogResultForm() {
  const [meeting, setMeeting] = useState(null); // { code, week, startingStack, names } once the code is accepted
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [remembered, setRemembered] = useState(false); // the name was filled in from this phone's memory
  const [shared, setShared] = useState(false); // "Log another player" was used: this phone is being passed around
  const [chips, setChips] = useState('');
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [sending, setSending] = useState(false);
  const [logged, setLogged] = useState(null); // { name, week, chips, result, replaced }, as sent
  const refs = { code: useRef(null), name: useRef(null), chips: useRef(null) };
  // The field to focus once the next step is on screen. A timer can fire before React has drawn it.
  const focusNext = useRef(null);

  useEffect(() => {
    const field = focusNext.current;
    if (!field) return;
    focusNext.current = null;
    refs[field]?.current?.focus();
  });

  // Focus the field now if it is on screen (inside the tap, so iOS opens the keyboard), or once a step change has
  // drawn it.
  function fail(field, msg) {
    setErrors({ [field]: msg });
    const el = refs[field]?.current;
    if (el) el.focus(); else focusNext.current = field;
  }

  async function openMeeting(e) {
    e.preventDefault();
    setErrors({});
    setFormError('');
    if (!code.trim()) return fail('code', 'Enter the meeting code.');
    // The fields stay editable during a slow answer, so what was sent is kept, not what is in them afterwards.
    const checked = code;
    setSending(true);
    try {
      const res = await postToLedger({ action: 'roster', code: checked });
      if (res.auth) return setFormError(NOT_READY);
      if (!res.ok) return res.field ? fail(res.field, res.error) : setFormError(res.error || 'Something went wrong. Try again.');
      setMeeting({ code: checked, week: res.week, startingStack: res.startingStack, names: res.names });
      // A name already picked (the code changed mid-meeting) stays; otherwise offer the one this phone remembers.
      const kept = res.names.find((n) => nameKey(n) === nameKey(name));
      const fromMemory = !kept && !shared ? res.names.find((n) => nameKey(n) === nameKey(readName())) : '';
      setName(kept || fromMemory || '');
      setRemembered(Boolean(fromMemory));
      focusNext.current = kept ? 'chips' : 'name';
    } catch (err) {
      setFormError(err.message);
    } finally {
      setSending(false);
    }
  }

  const count = wholeChips(chips);
  const result = count !== null && meeting ? count - meeting.startingStack : null;

  async function submit(e) {
    e.preventDefault();
    setErrors({});
    setFormError('');
    if (!name) return fail('name', 'Pick your name.');
    if (count === null) return fail('chips', 'Enter the number of chips in front of you.');
    const sent = { name, week: meeting.week, chips: count, result };
    setSending(true);
    try {
      const res = await postToLedger({ action: 'submit', code: meeting.code, name: sent.name, chips: sent.chips });
      if (res.auth) return setFormError(NOT_READY);
      if (res.ok) {
        // Only the phone's owner is remembered, never the next person it was handed to.
        if (!shared) writeName(sent.name);
        setLogged({ ...sent, result: typeof res.result === 'number' ? res.result : sent.result, replaced: Boolean(res.replaced) });
      } else if (res.field === 'code') {
        // The board changed the code during the meeting: back to step one with the reason.
        setMeeting(null);
        fail('code', res.error);
      } else if (res.field) {
        fail(res.field, res.error);
      } else {
        setFormError(res.error || 'Something went wrong. Try again.');
      }
    } catch (err) {
      setFormError(err.message);
    } finally {
      setSending(false);
    }
  }

  function another() {
    setShared(true);
    setLogged(null);
    setName('');
    setRemembered(false);
    setChips('');
    focusNext.current = 'name';
  }

  if (logged) {
    return (
      <FormSuccess>
        <h2>{endSentence(`Logged, ${logged.name}`)}</h2>
        <p>
          {logged.week}: {logged.chips.toLocaleString('en-US')} chips, {signed(logged.result)}.
          {logged.replaced ? ' This replaces your earlier entry.' : ''}
        </p>
        <p>Show your chips to a board member. Your result counts once they approve it.</p>
        <button className="btn btn-secondary" type="button" onClick={another} style={{ marginTop: 16 }}>Log another player</button>
      </FormSuccess>
    );
  }

  const invalid = (k) => (errors[k] ? 'true' : undefined);

  if (!meeting) {
    return (
      <form className="form" onSubmit={openMeeting} noValidate>
        <label className="field">
          <span className="field-label">Meeting code</span>
          <input
            ref={refs.code} className="input" name="code" maxLength={20} autoComplete="off" autoCapitalize="characters"
            autoCorrect="off" spellCheck="false" enterKeyHint="go" value={code} onChange={(e) => setCode(e.target.value)}
            aria-invalid={invalid('code')} aria-describedby="log-code-help"
          />
          <span className="field-help" id="log-code-help">Shown in the room at the meeting.</span>
          {errors.code && <span className="field-error">{errors.code}</span>}
        </label>
        {formError && <p className="form-error" role="alert">{formError}</p>}
        <div><SubmitButton busy={sending} busyLabel="Checking">Continue</SubmitButton></div>
      </form>
    );
  }

  return (
    <form className="form" onSubmit={submit} noValidate>
      <p className="muted">
        Tonight is {meeting.week}. Everyone started with {meeting.startingStack.toLocaleString('en-US')} chips.
      </p>
      <div className="field">
        <label className="field-label" htmlFor="log-name">Your name</label>
        <select
          id="log-name" ref={refs.name} className="input" name="name" value={name} aria-invalid={invalid('name')}
          onChange={(e) => { setName(e.target.value); setRemembered(false); }}
        >
          <option value="">Select your name</option>
          {meeting.names.map((n) => <option key={n} value={n}>{n}</option>)}
        </select>
        <span className="field-help">
          {remembered ? 'Filled in from this phone. Not you? Pick your name. ' : ''}
          Not on the list? <Link className="text-link" href="/ledger/join">Join the ledger</Link> first.
        </span>
        {errors.name && <span className="field-error">{errors.name}</span>}
      </div>
      <label className="field">
        <span className="field-label">Chips in front of you</span>
        <input
          ref={refs.chips} className="input" name="chips" inputMode="numeric" autoComplete="off" enterKeyHint="send"
          maxLength={10} value={chips} onChange={(e) => setChips(e.target.value)} aria-invalid={invalid('chips')}
          aria-describedby="log-chips-help"
        />
        <span className="field-help" id="log-chips-help" aria-live="polite">
          {result !== null
            ? <>That&rsquo;s <b className={tone(result)}>{signed(result)}</b> for tonight.</>
            : 'Count your whole stack at the end of the night.'}
        </span>
        {errors.chips && <span className="field-error">{errors.chips}</span>}
      </label>
      {formError && <p className="form-error" role="alert">{formError}</p>}
      <div><SubmitButton busy={sending} busyLabel="Logging">Log my result</SubmitButton></div>
    </form>
  );
}
