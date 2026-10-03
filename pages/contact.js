import Seo from '../components/Seo';
import { club, contact } from '../content/club';

export default function Contact() {
  const prospectus = `mailto:${club.email}?subject=${encodeURIComponent(contact.prospectusSubject)}`;
  return (
    <>
      <Seo
        title="Contact"
        description="Reach the University of Chicago Undergraduate Poker Club for membership questions and sponsorship opportunities."
        path="/contact"
      />
      <section className="page-head">
        <div className="wrap">
          <div className="ruled">
            <p className="eyebrow">Contact</p>
            <h1 className="page-title" style={{ maxWidth: '20ch' }}>{contact.title}</h1>
          </div>
          <ul className="contact-list">
            <li>
              <a href={club.instagram.url} target="_blank" rel="noopener noreferrer">
                <span className="kind">Instagram</span>
                <span className="value">{club.instagram.handle}</span>
              </a>
            </li>
            <li>
              <a href={club.x.url} target="_blank" rel="noopener noreferrer">
                <span className="kind">X</span>
                <span className="value">{club.x.handle}</span>
              </a>
            </li>
            <li>
              <a href={`mailto:${club.email}`}>
                <span className="kind">Email</span>
                <span className="value">{club.email.split('@')[0]}<wbr />@{club.email.split('@')[1]}</span>
              </a>
            </li>
          </ul>
        </div>
      </section>

      <section className="section" aria-labelledby="sponsor-title" style={{ paddingTop: 'var(--section)' }}>
        <div className="wrap split">
          <h2 id="sponsor-title" className="section-title">{contact.sponsorTitle}</h2>
          <div>
            <p className="lead" style={{ maxWidth: '46ch' }}>{contact.sponsorText}</p>
            <div className="actions">
              <a className="btn btn-primary" href={prospectus}>Request the prospectus</a>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
