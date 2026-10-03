import { signed, tone } from '../lib/ledger';
import { firstMeetingLine, useStandings } from './LedgerTable';

export default function LedgerTop5({ feed, connected }) {
  const { standings, status } = useStandings(feed, connected);
  const top = standings.players.slice(0, 5);

  if (status === 'loading') return <p className="ledger-state">Loading standings.</p>;
  if (status === 'error') return <p className="ledger-state">Standings could not load right now.</p>;
  if (standings.latest < 0) return <p className="ledger-state">No results yet. {firstMeetingLine()}</p>;

  return (
    <table className="top5">
      <caption className="sr-only">Top five on the ledger through {standings.weeks[standings.latest]}</caption>
      <thead className="sr-only">
        <tr><th scope="col">Rank</th><th scope="col">Player</th><th scope="col">Ledger</th></tr>
      </thead>
      <tbody>
        {top.map((p, i) => (
          <tr key={`${p.name}#${i}`}>
            <td className="r">{p.tied ? 'T' : ''}{p.rank}</td>
            <td>{p.name}</td>
            <td className={`t ${tone(p.total)}`}>{signed(p.total)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
