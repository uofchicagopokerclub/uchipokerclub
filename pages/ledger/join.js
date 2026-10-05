import Link from 'next/link';
import Seo from '../../components/Seo';
import JoinLedgerForm from '../../components/JoinLedgerForm';
import { about, club, ledger } from '../../content/club';

export default function JoinLedger() {
  return (
    <>
      <Seo
        title="Join the ledger"
        description="Sign up for the UChicago Poker Club ledger with the code shared at weekly meetings."
        path="/ledger/join"
      />
      <section className="page-head">
        <div className="wrap">
          <div className="ruled">
            <p className="eyebrow">{ledger.term}</p>
            <h1 className="page-title">Join the ledger</h1>
            <p className="lead" style={{ marginTop: 18 }}>Sign up once. At each meeting, log your chips and a board member approves your result.</p>
          </div>
          <div className="split">
            <JoinLedgerForm />
            <div>
              <h2 className="section-title" style={{ fontSize: '1.375rem' }}>How the ledger works</h2>
              <ul className="ticks" style={{ marginTop: 16 }}>
                {about.meeting.slice(1).map((m) => <li key={m.title}>{m.text}</li>)}
                <li>{club.disclaimer}</li>
              </ul>
              <p style={{ marginTop: 20 }}><Link className="text-link" href="/ledger">View the ledger</Link></p>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
