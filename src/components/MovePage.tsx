import { CASES } from '../data/cases';
import { COST_LABEL, moveById, MOVES, PHASE_LABEL } from '../data/moves';
import { PROBLEMS } from '../data/problems';
import { linkProps } from '../lib/route';
import CaseCard from './CaseCard';
import NotFound from './NotFound';

export default function MovePage({ id }: { id: string }) {
  const m = moveById(id);
  if (!m) return <NotFound />;
  const list = CASES.filter((c) => c.moves.includes(m.id));
  const problems = PROBLEMS.map((p) => ({ p, n: list.filter((c) => c.problems.includes(p.id)).length })).filter((x) => x.n);
  // Moves that travel with this one: used in the same cases.
  const together = MOVES.filter((o) => o.id !== m.id)
    .map((o) => ({ o, n: list.filter((c) => c.moves.includes(o.id)).length }))
    .filter((x) => x.n)
    .sort((a, b) => b.n - a.n)
    .slice(0, 6);
  return (
    <main className="page">
      <nav className="crumbs" aria-label="מיקום">
        <a {...linkProps({ view: 'moves' })}>מטריצת המהלכים</a>
        <span>/</span>
        <span>{m.title}</span>
      </nav>
      <header className="problem-head" style={{ '--c': '#17191c' } as React.CSSProperties}>
        <span className="code">{PHASE_LABEL[m.phase]}, {COST_LABEL[m.cost]}</span>
        <h1>{m.title}</h1>
        <p className="question">{m.text}</p>
        <p className="lede">שימש ב-{list.length} {list.length === 1 ? 'מקרה' : 'מקרים'} באטלס.</p>
      </header>
      {problems.length ? (
        <section className="block">
          <div className="block-head"><h2>לאילו בעיות</h2></div>
          <div className="chips">
            {problems.map(({ p, n }) => (
              <a key={p.id} className="chip" style={{ '--c': p.color } as React.CSSProperties} {...linkProps({ view: 'problem', problem: p.id })}>
                {p.title} <span className="mono">{n}</span>
              </a>
            ))}
          </div>
        </section>
      ) : null}
      {together.length ? (
        <section className="block">
          <div className="block-head">
            <h2>מהלכים שבאים יחד איתו</h2>
            <p>מהלכים שהופיעו באותם מקרים. ככה נראית אסטרטגיה, לא מהלך בודד.</p>
          </div>
          <div className="chips">
            {together.map(({ o, n }) => (
              <a key={o.id} className="chip" {...linkProps({ view: 'move', move: o.id })}>
                {o.title} <span className="mono">{n}</span>
              </a>
            ))}
          </div>
        </section>
      ) : null}
      <section className="block">
        <div className="block-head"><h2>המקרים</h2></div>
        <div className="grid">
          {list.map((c, i) => (
            <CaseCard key={c.id} c={c} i={i} />
          ))}
        </div>
      </section>
    </main>
  );
}
