import Link from 'next/link';
import { club, mailingList } from '../content/club';
import MailingListForm from './MailingListForm';
import { NAV } from './SiteHeader';

export default function SiteFooter() {
  const year = new Date().getFullYear();
  return (
    <footer className="site-footer">
      <div className="wrap footer-grid">
        <div className="footer-brand">
          <img src="/images/logo-120.webp" alt="" width="52" height="59" loading="lazy" />
          <div>
            <strong>{club.name}</strong>
            <span>{club.fullName}</span>
          </div>
        </div>
        <div>
          <h2 className="footer-title">{mailingList.title}</h2>
          <MailingListForm />
        </div>
        <ul className="footer-links" aria-label="Site and contact links">
          {NAV.filter((n) => n.href !== '/').map((n) => (
            <li key={n.href}><Link href={n.href}>{n.label}</Link></li>
          ))}
          <li><a href={club.instagram.url} target="_blank" rel="noopener noreferrer">Instagram</a></li>
          <li><a href={club.x.url} target="_blank" rel="noopener noreferrer">X</a></li>
          <li><a href={`mailto:${club.email}`}>Email</a></li>
        </ul>
      </div>
      <div className="wrap">
        <div className="footer-base">
          <p>{club.disclaimer}</p>
          <p suppressHydrationWarning>&copy; {year} {club.fullName}</p>
        </div>
      </div>
    </footer>
  );
}
