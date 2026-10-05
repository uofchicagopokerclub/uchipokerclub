import { useEffect, useState } from 'react';

// False on the server and on the first render, true once the page's JavaScript is running. Submit buttons stay
// disabled until then: a form sent before that is a plain browser GET, which puts every field, email included,
// into the URL.
export function useHydrated() {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    setReady(true);
  }, []);
  return ready;
}
