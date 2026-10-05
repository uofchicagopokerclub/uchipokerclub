import Link from 'next/link';
import Seo from '../../components/Seo';
import LedgerTable, { metaLine, useStandings } from '../../components/LedgerTable';
import { PrizePanel } from '../../components/PrizePool';
import { ledger } from '../../content/club';
import { fetchStandings, ledgerApiUrl } from '../../lib/api';

export default function LedgerPage({ feed, connected }) {
  // One source for the headline and the table, including standings the browser had to fetch itself.
  const { standings, status } = useStandings(feed, connected);
  const term = standings.term || ledger.term;
  // Before the first results the line stays general; the empty table says when they post.
  const headline = standings.latest >= 0 ? metaLine(standings) : 'Standings update after every weekly meeting.';
  return (
    <>
      <Seo
        title="Ledger"
        description="The live ledger leaderboard for the University of Chicago Undergraduate Poker Club: paper profit and loss from every weekly meeting."
        path="/ledger"
      />
      <section className="page-head">
        <div className="wrap">
          <div className="ruled">
            <p className="eyebrow">{term}</p>
            <h1 className="page-title">The ledger</h1>
            <p className="muted" style={{ marginTop: 12 }}>{headline}</p>
            <div className="actions" style={{ marginTop: 20 }}>
              <Link className="btn btn-primary" href="/ledger/log">Log my result</Link>
              <Link className="btn btn-secondary" href="/ledger/join">Join the ledger</Link>
            </div>
          </div>
          <PrizePanel />
          <LedgerTable standings={standings} status={status} />
          <p className="ledger-foot">
            {ledger.explainer}{' '}
            <Link className="text-link" href="/ledger/join">Join the ledger</Link>
          </p>
        </div>
      </section>
    </>
  );
}

export async function getStaticProps() {
  return {
    props: { feed: await fetchStandings(), connected: Boolean(ledgerApiUrl()) },
    revalidate: 60,
  };
}
