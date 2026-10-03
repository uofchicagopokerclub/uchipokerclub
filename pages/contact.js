import Seo from '../components/Seo';
import SponsorForm from '../components/SponsorForm';
import { club, contact } from '../content/club';

export default function Contact() {
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

      <section className="section" id="sponsor" aria-labelledby="sponsor-title" style={{ paddingTop: 'var(--section)' }}>
        <div className="wrap split">
          <div>
            <h2 id="sponsor-title" className="section-title">{contact.sponsorTitle}</h2>
            <p className="lead" style={{ marginTop: 18, maxWidth: '40ch' }}>{contact.sponsorText}</p>
          </div>
          <SponsorForm />
        </div>
      </section>
    </>
  );
}
