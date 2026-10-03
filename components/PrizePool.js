import { ledger } from '../content/club';
import { money, ordinal } from '../lib/ledger';

const total = () => ledger.payouts.reduce((a, b) => a + b, 0);

// The maroon panel, used once on the ledger page.
export function PrizePanel() {
  return (
    <section className="prize-panel" aria-label="Ledger prize pool">
      <div>
        <span className="pool-label">Ledger prize pool</span>
        <span className="pool-amt">{money(total())}</span>
      </div>
      <ol>
        {ledger.payouts.map((p, i) => (
          <li key={i}>
            <span>{ordinal(i + 1)}</span>
            <b>{money(p)}</b>
          </li>
        ))}
      </ol>
      <p className="pool-note">{ledger.prizeNote}</p>
    </section>
  );
}

// The quiet version for the home page, where the meeting band is the maroon block.
export function PrizeLine() {
  return (
    <>
      <ol className="prize-line" aria-label="Ledger prize pool by place">
        {ledger.payouts.map((p, i) => (
          <li key={i}>
            <span>{ordinal(i + 1)}</span>
            <b>{money(p)}</b>
          </li>
        ))}
      </ol>
      <p className="prize-total">{money(total())} ledger prize pool. {ledger.prizeNote}</p>
    </>
  );
}
