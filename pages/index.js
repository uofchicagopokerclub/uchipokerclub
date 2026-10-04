import Link from 'next/link';
import Seo from '../components/Seo';
import LedgerTop5 from '../components/LedgerTop5';
import { PrizeLine } from '../components/PrizePool';
import { cohort, gallery, home, ledger, schedule, sponsors } from '../content/club';
import { fetchStandings, ledgerApiUrl } from '../lib/api';
import { chicagoNow, formatDay, formatTimeRange, nextMeeting } from '../lib/schedule';
import { useNow } from '../lib/useNow';

const GALLERY_SLOTS = ['g-a', 'g-b', 'g-c', 'g-d', 'g-e', 'g-f', 'g-g', 'g-h'];

// Each gallery photo also exists as a "-700" copy whose longer side is 700px.
function gallerySrcSet(g) {
  const small = Math.round(g.width * Math.min(1, 700 / Math.max(g.width, g.height)));
  if (small >= g.width) return undefined;
  return `${g.src.replace('.webp', '-700.webp')} ${small}w, ${g.src} ${g.width}w`;
}

export default function Home({ feed, connected, now }) {
  const next = nextMeeting(schedule.meetings, useNow(now));
  return (
    <>
      <Seo
        description="The University of Chicago's undergraduate poker club: a weekly strategy lecture, live play, a running ledger, and recruiting events with our sponsors."
        path="/"
      />

      <section className="hero">
        <div className="wrap hero-grid">
          <div>
            <span className="bar" />
            <p className="eyebrow">{home.eyebrow}</p>
            <h1 className="display">{home.title}</h1>
            <p className="lead">{home.lead}</p>
            <div className="actions">
              <Link className="btn btn-primary" href="/about#schedule">See the schedule</Link>
              <Link className="btn btn-secondary" href="/ledger">View the ledger</Link>
            </div>
          </div>
          <figure className="hero-media">
            <img
              src={home.heroImage.src} width={home.heroImage.width} height={home.heroImage.height} alt={home.heroImage.alt} fetchPriority="high"
              srcSet={home.heroImage.srcSet} sizes="(max-width: 899px) 100vw, 50vw"
            />
          </figure>
        </div>
      </section>

      <section className="sponsors" aria-labelledby="sponsors-title">
        <div className="wrap">
          <div className="sponsors-inner">
            <h2 id="sponsors-title" className="label-title">{sponsors.heading}</h2>
            <ul className="logo-row">
              {sponsors.firms.map((f) => (
                <li key={f.name}>
                  <img
                    src={f.logo} alt={f.name} loading="lazy" decoding="async"
                    width={Math.round((f.width / f.height) * f.displayHeight)} height={f.displayHeight}
                    style={{ height: f.displayHeight }}
                  />
                </li>
              ))}
            </ul>
            <p className="sponsor-note">
              {sponsors.note} <Link className="text-link" href="/contact#sponsor">{sponsors.cta}</Link>
            </p>
          </div>
        </div>
      </section>

      <section className="band" aria-labelledby="next-title">
        <div className="wrap band-grid">
          <div>
            <h2 className="band-label" id="next-title">{next?.event ? 'Next event' : 'Next meeting'}</h2>
            {next ? (
              <>
                <p className="band-title">{formatDay(next.date)}</p>
                {next.event && <p className="band-what">{next.what}</p>}
              </>
            ) : (
              <p className="band-title">{schedule.afterLast}</p>
            )}
          </div>
          <div>
            {next && (
              <p className="band-meta">
                {formatTimeRange(next.start, next.end)}
                <br />
                {next.place}
              </p>
            )}
            <p className="band-note">{home.meetingNote}</p>
            <div className="actions">
              <Link className="btn btn-light" href="/about#schedule">See the schedule</Link>
            </div>
          </div>
        </div>
      </section>

      <section className="section" aria-labelledby="pillars-title" style={{ paddingTop: 'var(--section)' }}>
        <div className="wrap">
          <h2 id="pillars-title" className="section-title ruled">What we do</h2>
          <ol className="pillars">
            {home.pillars.map((p) => (
              <li className="pillar" key={p.title}>
                <h3>{p.title}</h3>
                <p>{p.text}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="section" aria-labelledby="ledger-title">
        <div className="wrap split">
          <div>
            <p className="eyebrow">{ledger.term}</p>
            <h2 id="ledger-title" className="section-title">The ledger</h2>
            <p className="muted" style={{ marginTop: 16 }}>{home.ledgerText}</p>
            <PrizeLine />
            <div className="actions">
              <Link className="btn btn-secondary" href="/ledger">View the ledger</Link>
            </div>
          </div>
          <div>
            <LedgerTop5 feed={feed} connected={connected} />
          </div>
        </div>
      </section>

      <section className="section" aria-label="Photos from club games">
        <div className="wrap">
          <div className="gallery">
            {gallery.map((g, i) => (
              <figure key={g.src} className={GALLERY_SLOTS[i]}>
                <img
                  src={g.src} width={g.width} height={g.height} alt={g.alt} loading="lazy" decoding="async"
                  srcSet={gallerySrcSet(g)}
                  sizes="(max-width: 767px) 50vw, 40vw"
                />
              </figure>
            ))}
          </div>
        </div>
      </section>

      <section className="section" aria-labelledby="cohort-title">
        <div className="wrap">
          <div className="cohort-head">
            <div>
              <h2 id="cohort-title" className="section-title">{cohort.title}</h2>
              <p className="lead" style={{ marginTop: 16 }}>{cohort.lead}</p>
            </div>
            <p className="muted">{cohort.text}</p>
          </div>
          <div className="cohort-lists">
            <div>
              <h3>What you get</h3>
              <ul className="ticks">{cohort.get.map((t) => <li key={t}>{t}</li>)}</ul>
            </div>
            <div>
              <h3>How we select</h3>
              <ul className="ticks">{cohort.select.map((t) => <li key={t}>{t}</li>)}</ul>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}

// Rebuilt in the background at most every 60 seconds, so the ledger and "next meeting" stay current
// without a redeploy, and visitors never wait on the Google Sheet.
export async function getStaticProps() {
  return {
    props: { feed: await fetchStandings(), connected: Boolean(ledgerApiUrl()), now: chicagoNow() },
    revalidate: 60,
  };
}
