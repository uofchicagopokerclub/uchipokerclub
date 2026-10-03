import Link from 'next/link';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import { club } from '../content/club';
import { InstagramIcon } from './Icons';

// Same four pages as the old site, plus the ledger.
export const NAV = [
  { href: '/', label: 'Home' },
  { href: '/about', label: 'About' },
  { href: '/team', label: 'Team' },
  { href: '/ledger', label: 'Ledger' },
  { href: '/contact', label: 'Contact' },
];

function isCurrent(pathname, href) {
  return href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(`${href}/`);
}

export default function SiteHeader() {
  const { pathname, events } = useRouter();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const close = () => setOpen(false);
    events.on('routeChangeStart', close);
    return () => events.off('routeChangeStart', close);
  }, [events]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  return (
    <header className="site-header">
      <div className="wrap header-row">
        <Link className="brand" href="/">
          <img src="/images/logo-80.webp" alt="" width="35" height="40" />
          <span className="brand-name">{club.name}</span>
        </Link>
        <nav className="site-nav" aria-label="Main">
          <ul className="nav-list">
            {NAV.map((item) => (
              <li key={item.href}>
                <Link className="nav-link" href={item.href} aria-current={isCurrent(pathname, item.href) ? 'page' : undefined}>
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <a className="icon-link header-ig" href={club.instagram.url} target="_blank" rel="noopener noreferrer" aria-label="Instagram">
          <InstagramIcon />
        </a>
        <button className="menu-btn" type="button" aria-expanded={open} aria-controls="mobile-nav" onClick={() => setOpen((v) => !v)}>
          {open ? 'Close' : 'Menu'}
        </button>
      </div>
      <nav id="mobile-nav" className="mobile-nav" data-open={open} aria-label="Main">
        <ul className="wrap">
          {NAV.map((item) => (
            <li key={item.href}>
              <Link href={item.href} aria-current={isCurrent(pathname, item.href) ? 'page' : undefined}>
                {item.label}
              </Link>
            </li>
          ))}
          <li>
            <a href={club.instagram.url} target="_blank" rel="noopener noreferrer">Instagram</a>
          </li>
        </ul>
      </nav>
    </header>
  );
}
