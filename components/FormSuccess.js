// The confirmation that replaces a submitted form. A phone is scrolled to the bottom of a tall form when it is
// sent, so the much shorter confirmation would land under the header or off screen; it brings itself into view
// and takes focus so screen readers announce it. It runs as a ref callback, before the first paint, so the old
// scroll position never shows. The jump is instant: the page shrinking under a smooth scroll cancels it and
// leaves the confirmation above the screen.
function reveal(el) {
  if (!el) return;
  el.focus({ preventScroll: true });
  el.scrollIntoView({ block: 'nearest', behavior: 'instant' });
}

export default function FormSuccess({ children }) {
  return (
    <div ref={reveal} className="form-ok" role="status" tabIndex={-1}>
      {children}
    </div>
  );
}
