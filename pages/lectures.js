import Seo from '../components/Seo';
import { lectures } from '../content/club';
import { formatDay } from '../lib/schedule';

export default function Lectures() {
  const decks = lectures.decks.slice().sort((a, b) => b.date.localeCompare(a.date));
  return (
    <>
      <Seo
        title="Lecture slides"
        description="Slides from the UChicago Poker Club's weekly strategy lectures: how to play, pot odds, preflop, implied odds and more."
        path="/lectures"
      />
      <section className="page-head">
        <div className="wrap">
          <div className="ruled">
            <p className="eyebrow">{lectures.term}</p>
            <h1 className="page-title">Lecture slides</h1>
            <p className="lead">{lectures.intro}</p>
          </div>
          <ol className="decks" reversed>
            {decks.map((d) => (
              <li className="deck" key={d.file}>
                <div>
                  <p className="event-date">{formatDay(d.date)}</p>
                  <h2>{d.title}</h2>
                  <ul className="ticks">{d.topics.map((t) => <li key={t}>{t}</li>)}</ul>
                </div>
                <div className="deck-get">
                  <a className="btn btn-secondary" href={d.file} target="_blank" rel="noopener">
                    View slides<span className="sr-only">: {d.title}, PDF</span>
                  </a>
                  <span className="deck-meta">PDF, {d.slides} slides, {d.size}</span>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>
    </>
  );
}
