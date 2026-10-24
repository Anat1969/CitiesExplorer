import { motion } from 'framer-motion';
import { casesFor } from '../data/cases';
import { MOVES, PHASE_LABEL } from '../data/moves';
import { PROBLEMS, problemById } from '../data/problems';
import { linkProps } from '../lib/route';
import CaseCard from './CaseCard';
import NotFound from './NotFound';

export default function ProblemPage({ id }: { id: string }) {
  const p = problemById(id);
  if (!p) return <NotFound />;
  const list = casesFor(p.id);
  const idx = PROBLEMS.indexOf(p);
  const next = PROBLEMS[(idx + 1) % PROBLEMS.length];
  const counted = MOVES.map((m) => ({ m, n: list.filter((c) => c.moves.includes(m.id)).length }))
    .filter((x) => x.n)
    .sort((a, b) => b.n - a.n)
    .slice(0, 8);
  return (
    <main className="page" style={{ '--c': p.color } as React.CSSProperties}>
      <nav className="crumbs" aria-label="מיקום">
        <a {...linkProps({ view: 'home' })}>בעיות</a>
        <span>/</span>
        <span>{p.code}</span>
      </nav>
      <header className="problem-head">
        <span className="code">{p.code}</span>
        <h1>{p.title}</h1>
        <p className="question">{p.question}</p>
        <p className="lede">{p.summary}</p>
      </header>

      <section className="block">
        <div className="block-head">
          <h2>מהלכים שחוזרים</h2>
          <p>מה משותף למקרים שפתרו את הבעיה הזו.</p>
        </div>
        <ol className="moves">
          {p.moves.map((m, i) => (
            <motion.li key={m.title} initial={{ opacity: 0, x: -16 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.06 }}>
              <span className="mono">{String(i + 1).padStart(2, '0')}</span>
              <div>
                <b>{m.title}</b>
                <p>{m.text}</p>
              </div>
            </motion.li>
          ))}
        </ol>
      </section>

      <section className="block">
        <div className="block-head">
          <h2>המהלכים בנתונים</h2>
          <p>כמה מהמקרים של הבעיה הזו השתמשו בכל מהלך.</p>
        </div>
        <ol className="tally">
          {counted.map(({ m, n }) => (
            <li key={m.id}>
              <a {...linkProps({ view: 'move', move: m.id })}>{m.title}</a>
              <span className="tally-bar"><i style={{ width: `${(n / list.length) * 100}%` }} /></span>
              <span className="mono">{n} מתוך {list.length}</span>
              <span className="mono muted">{PHASE_LABEL[m.phase]}</span>
            </li>
          ))}
        </ol>
      </section>

      <section className="block">
        <div className="block-head">
          <h2>{list.length} מקרי בוחן</h2>
        </div>
        <div className="grid">
          {list.map((c, i) => (
            <CaseCard key={c.id} c={c} from={p.id} i={i} />
          ))}
        </div>
      </section>

      <a className="next" {...linkProps({ view: 'problem', problem: next.id })}>
        <span className="mono">הבעיה הבאה</span>
        <b>{next.title}</b>
      </a>
    </main>
  );
}
