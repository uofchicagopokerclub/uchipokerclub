import { useEffect, useState } from 'react';
import { chicagoNow } from './schedule';

// Starts from the time the page was generated, so the first render matches the HTML exactly, then
// switches to the visitor's clock. A page served from cache can then never show a past meeting as next.
export function useNow(serverNow) {
  const [now, setNow] = useState(serverNow);
  useEffect(() => {
    setNow(chicagoNow());
  }, []);
  return now;
}
