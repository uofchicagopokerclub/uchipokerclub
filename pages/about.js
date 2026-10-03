import Seo from '../components/Seo';
import ScheduleTable from '../components/ScheduleTable';
import { about, events, schedule } from '../content/club';
import { chicagoNow, formatDay } from '../lib/schedule';

export default function About({ now }) {
  return (
    <>
      <Seo
        title="About"
        description="The University of Chicago Undergraduate Poker Club: how a weekly meeting runs, the Fall schedule, and this term's events. All levels are welcome."
        path="/about"
      />

      <section className="page-head">
        <div className="wrap">
          <div className="about-intro ruled">
            <div>
              <p className="eyebrow">About</p>
              <h1 className="page-title">{about.title}</h1>
              <p className="lead" style={{ marginTop: 18 }}>{about.lead}</p>
              {about.body.map((t) => <p className="body" key={t}>{t}</p>)}
            </div>
            <div className="logo-panel">
              <img src="/images/logo.webp" alt="The club's logo: two playing cards with a phoenix and the words uchicago poker club" width="559" height="636" />
            </div>
          </div>
          <dl className="facts">
            {about.facts.map((f) => (
              <div key={f.label}>
                <dt>{f.value}</dt>
                <dd>{f.label.split(/(\d{4}-\d{4})/).map((part, i) => (i % 2 ? <span key={i} style={{ whiteSpace: 'nowrap' }}>{part}</span> : part))}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      <section className="section" aria-labelledby="meeting-title" style={{ paddingTop: 'var(--section)' }}>
        <div className="wrap">
          <h2 id="meeting-title" className="section-title ruled">How a weekly meeting runs</h2>
          <ol className="steps">
            {about.meeting.map((m) => (
              <li key={m.title}>
                <h3>{m.title}</h3>
                <p>{m.text}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="section" id="schedule" aria-labelledby="schedule-title">
        <div className="wrap">
          <h2 id="schedule-title" className="section-title ruled">{schedule.term} schedule</h2>
          <ScheduleTable now={now} />
        </div>
      </section>

      <section className="section" id="events" aria-labelledby="events-title">
        <div className="wrap">
          <h2 id="events-title" className="section-title ruled">Two events this term</h2>
          <div className="events">
            {events.map((e) => (
              <article className="event" key={e.title}>
                <p className="event-date">{formatDay(e.date)}</p>
                <h3>{e.title}</h3>
                <ul className="ticks">{e.points.map((p) => <li key={p}>{p}</li>)}</ul>
              </article>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}

// Hourly, so past meetings grey out and "Next" moves along on its own.
export async function getStaticProps() {
  return { props: { now: chicagoNow() }, revalidate: 3600 };
}
