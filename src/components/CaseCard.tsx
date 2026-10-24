import { motion } from 'framer-motion';
import { SCALES, type Case } from '../data/cases';
import { problemById } from '../data/problems';
import { useBoard } from '../lib/board';
import { linkProps } from '../lib/route';
import { carShare, MiniSection } from './Section';

export default function CaseCard({ c, from, i = 0 }: { c: Case; from?: string; i?: number }) {
  const board = useBoard();
  const saved = board.has(c.id);
  const a = carShare(c.section.before);
  const b = carShare(c.section.after);
  return (
    <motion.article
      className="card"
      initial={{ opacity: 0, y: 18 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-40px' }}
      transition={{ duration: 0.4, delay: Math.min(i, 8) * 0.04 }}
    >
      <a className="card-link" {...linkProps({ view: 'case', case: c.id, problem: from })}>
        <div className="card-art">
          <MiniSection bands={c.section.after} />
        </div>
        <div className="card-body">
          <div className="meta">
            <span>{c.city}, {c.country}</span>
            <span>{c.years}</span>
          </div>
          <h3>{c.name}</h3>
          <p className="en">{c.nameEn}</p>
          <p className="card-insight">{c.insight}</p>
          <div className="chips">
            {c.problems.map((p) => {
              const pr = problemById(p)!;
              return (
                <span key={p} className="chip" style={{ '--c': pr.color } as React.CSSProperties}>
                  {pr.title}
                </span>
              );
            })}
          </div>
          <div className="card-foot">
            <span className="mono">{SCALES.find((s) => s.id === c.scale)?.label}</span>
            {a !== b ? <span className="mono">שטח לרכב {a}% עד {b}%</span> : null}
          </div>
        </div>
      </a>
      <button type="button" className={`save${saved ? ' on' : ''}`} aria-pressed={saved} onClick={() => board.toggle(c.id)}>
        {saved ? 'בלוח' : 'שמירה ללוח'}
      </button>
    </motion.article>
  );
}
