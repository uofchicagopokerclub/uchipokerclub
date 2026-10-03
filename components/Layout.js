import SiteFooter from './SiteFooter';
import SiteHeader from './SiteHeader';

export default function Layout({ children }) {
  return (
    <>
      <a className="skip-link" href="#main">Skip to content</a>
      <SiteHeader />
      <main id="main" tabIndex={-1}>{children}</main>
      <SiteFooter />
    </>
  );
}
