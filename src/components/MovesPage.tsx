import { motion } from 'framer-motion';
import { useState } from 'react';
import { CASES } from '../data/cases';
import { COST_LABEL, MOVES, PHASE_LABEL, type Phase } from '../data/moves';
import { PROBLEMS } from '../data/problems';
import { linkProps } from '../lib/route';

/** Problem x move matrix: how many cases used each move for each problem. Empty cells are gaps worth noticing. */
export default function MovesPage() {
  const [phase, setPhase] = useState<Phase | 'all'>('all');
  const [hover, setHover] = useState<{ m: string; p: string } | null>(null);
  const used = MOVES.filter((m) => CASES.some((c) => c.moves.includes(m.id))).filter((m) => phase === 'all' || m.phase === phase);
  const count = (m: string, p: string) => CASES.filter((c) => c.moves.includes(m) && c.problems.includes(p)).length;
  const max = Math.max(1, ...used.flatMap((m) => PROBLEMS.map((p) => count(m.id, p.id))));
  const cell = hover ? CASES.filter((c) => c.moves.includes(hover.m) && c.problems.includes(hover.p)) : [];

  return (
    <main className="page">
      <header className="block-head page-head">
        <p className="eyebrow">שפת הדפוסים של האטלס</p>
        <h1>מטריצת המהלכים</h1>
        <p>
          כל שורה היא מהלך תכנוני, כל עמודה בעיה. המספר בתא הוא מספר המקרים שבהם המהלך שימש לפתרון הבעיה. תא כהה הוא מהלך מוכח, ותא ריק הוא שאלה פתוחה: אולי מהלך שלא נוסה.
        </p>
      </header>
      <div className="filters" role="group" aria-label="שלב">
        <button type="button" aria-pressed={phase === 'all'} onClick={() => setPhase('all')}>כל המהלכים</button>
        {(['quick', 'medium', 'long'] as Phase[]).map((p) => (
          <button key={p} type="button" aria-pressed={phase === p} onClick={() => setPhase(p)}>{PHASE_LABEL[p]}</button>
        ))}
      </div>
      <div className="matrix-wrap">
        <table className="matrix">
          <thead>
            <tr>
              <th scope="col" className="corner">מהלך</th>
              {PROBLEMS.map((p) => (
                <th key={p.id} scope="col" style={{ '--c': p.color } as React.CSSProperties}>
                  <a {...linkProps({ view: 'problem', problem: p.id })}>
                    <span className="code">{p.code}</span>
                    <span className="th-title">{p.title}</span>
                  </a>
                </th>
              ))}
              <th scope="col">סך הכול</th>
            </tr>
          </thead>
          <tbody>
            {used.map((m, i) => {
              const total = CASES.filter((c) => c.moves.includes(m.id)).length;
              return (
                <motion.tr key={m.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: Math.min(i, 20) * 0.015 }}>
                  <th scope="row">
                    <a {...linkProps({ view: 'move', move: m.id })}>{m.title}</a>
                    <span className="mono">{PHASE_LABEL[m.phase]}</span>
                  </th>
                  {PROBLEMS.map((p) => {
                    const n = count(m.id, p.id);
                    return (
                      <td key={p.id} style={{ '--c': p.color, '--a': n / max } as React.CSSProperties}>
                        {n ? (
                          <button
                            type="button"
                            className="cell"
                            aria-label={`${m.title}, ${p.title}: ${n} מקרים`}
                            onMouseEnter={() => setHover({ m: m.id, p: p.id })}
                            onFocus={() => setHover({ m: m.id, p: p.id })}
                            onClick={() => setHover({ m: m.id, p: p.id })}
                          >
                            {n}
                          </button>
                        ) : (
                          <span className="gap" aria-hidden="true" />
                        )}
                      </td>
                    );
                  })}
                  <td className="total mono">{total}</td>
                </motion.tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="cell-panel" role="status">
        {hover ? (
          <>
            <b>{MOVES.find((m) => m.id === hover.m)?.title}</b>
            <span>{PROBLEMS.find((p) => p.id === hover.p)?.title}</span>
            <ul>
              {cell.map((c) => (
                <li key={c.id}><a {...linkProps({ view: 'case', case: c.id, problem: hover.p })}>{c.name}</a> <span className="en">{c.city}, {c.years}</span></li>
              ))}
            </ul>
          </>
        ) : (
          <span>מעבר על תא או לחיצה עליו מציגים את המקרים שבו.</span>
        )}
      </div>
    </main>
  );
}
