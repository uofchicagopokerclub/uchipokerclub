import { useHydrated } from '../lib/useHydrated';

// The submit button for every public form. It stays off until the page's JavaScript runs, because a form sent
// before then is a plain browser GET that puts every field, email included, into the URL. It looks ready while
// it waits (see .btn:disabled[data-hydrating] in globals.css).
export default function SubmitButton({ busy, busyLabel, children }) {
  const ready = useHydrated();
  return (
    <button className="btn btn-primary" type="submit" disabled={busy || !ready} data-hydrating={ready ? undefined : ''}>
      {busy ? busyLabel : children}
    </button>
  );
}
