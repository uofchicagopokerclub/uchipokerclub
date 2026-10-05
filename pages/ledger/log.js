import Link from 'next/link';
import Seo from '../../components/Seo';
import LogResultForm from '../../components/LogResultForm';
import { club, ledger } from '../../content/club';

export default function LogResult() {
  return (
    <>
      <Seo
        title="Log your result"
        description="Log your chip count at a UChicago Poker Club meeting. It counts on the ledger once a board member approves it."
        path="/ledger/log"
        noindex
      />
      <section className="page-head">
        <div className="wrap">
          <div className="ruled">
            <p className="eyebrow">{ledger.term}</p>
            <h1 className="page-title">Log your result</h1>
            <p className="lead" style={{ marginTop: 18 }}>At the end of a meeting, count your chips and log them here. Your result counts once a board member checks your stack.</p>
          </div>
          <div className="split">
            <LogResultForm />
            <div>
              <h2 className="section-title" style={{ fontSize: '1.375rem' }}>How it works</h2>
              <ul className="ticks" style={{ marginTop: 16 }}>
                <li>Enter the meeting code shown in the room, then pick your name.</li>
                <li>Type the chips in front of you. Your result is your stack minus the starting stack.</li>
                <li>Show your chips to a board member. Nothing counts until they approve it.</li>
                <li>{club.disclaimer}</li>
              </ul>
              <p style={{ marginTop: 20 }}><Link className="text-link" href="/ledger/join">New here? Join the ledger</Link></p>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
