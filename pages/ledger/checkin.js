import Link from 'next/link';
import Seo from '../../components/Seo';
import CheckinForm from '../../components/CheckinForm';
import { ledger } from '../../content/club';

// Only useful in the room, with the meeting code, so it is kept out of search engines and the sitemap.
export default function Checkin() {
  return (
    <>
      <Seo
        title="Check in"
        description="Check in at a UChicago Poker Club meeting to get your chips."
        path="/ledger/checkin"
        noindex
      />
      <section className="page-head">
        <div className="wrap">
          <div className="ruled">
            <p className="eyebrow">{ledger.term}</p>
            <h1 className="page-title">Check in</h1>
            <p className="lead" style={{ marginTop: 18 }}>Check in when you get your chips, then show the confirmation to a board member.</p>
          </div>
          <div className="split">
            <CheckinForm />
            <div>
              <h2 className="section-title" style={{ fontSize: '1.375rem' }}>How check-in works</h2>
              <ul className="ticks" style={{ marginTop: 16 }}>
                {ledger.checkinSteps.map((s) => <li key={s}>{s}</li>)}
              </ul>
              <p style={{ marginTop: 20 }}>
                New to the ledger? <Link className="text-link" href="/ledger/join">Join the ledger</Link>. It checks you in too.
              </p>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
