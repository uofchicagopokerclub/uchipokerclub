import Seo from '../components/Seo';
import { board } from '../content/club';

export default function Team() {
  return (
    <>
      <Seo
        title="Team"
        description="The 2026-2027 board of the University of Chicago Undergraduate Poker Club."
        path="/team"
      />
      <section className="page-head">
        <div className="wrap">
          <div className="ruled">
            <p className="eyebrow">{board.season}</p>
            <h1 className="page-title">The board</h1>
          </div>
          <ul className="board-grid">
            {board.members.map((m, i) => (
              <li className="member" key={m.name}>
                <img src={m.photo} alt={m.name} width="429" height="343" loading={i < 3 ? 'eager' : 'lazy'} decoding="async" />
                <h2>{m.name}</h2>
                <p className="role">{m.role}</p>
                <p className="year">Class of {m.year}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </>
  );
}
