import { useEffect, useState } from 'react';

// Google usually answers in a second or two, but now and then takes most of a minute (2026-10-06: four requests in
// a row took 18 to 42 seconds). A button that only says "Logging" for that long looks frozen, so after a few
// seconds this line says the page is still working. It is always in the page and empty until then, so screen
// readers already know the status line when the text appears. Empty, it takes no space (see globals.css).
const SLOW_MS = 6000;

export default function StillWorking({ busy }) {
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    if (!busy) return undefined;
    const t = setTimeout(() => setSlow(true), SLOW_MS);
    return () => { clearTimeout(t); setSlow(false); };
  }, [busy]);
  return (
    <p className="still-working" role="status">
      {busy && slow ? 'Still working. This can take a minute. Keep this page open.' : ''}
    </p>
  );
}
