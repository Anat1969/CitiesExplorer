import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { APPS } from '../data/apps';
import { CASES, caseById, SCALES } from '../data/cases';
import { problemById } from '../data/problems';
import { useBoard } from '../lib/board';
import { linkProps } from '../lib/route';
import CaseCard from './CaseCard';
import NotFound from './NotFound';
import Section, { carShare, Legend } from './Section';

export default function CasePage({ id, from }: { id: string; from?: string }) {
  const c = caseById(id);
  const board = useBoard();
  const [mode, setMode] = useState<'before' | 'after'>('after');
  useEffect(() => setMode('after'), [id]);
  if (!c) return <NotFound />;
  const ctx = problemById(from && c.problems.includes(from) ? from : c.problems[0])!;
  const related = CASES.filter((o) => o.id !== c.id && o.problems.some((p) => c.problems.includes(p)))
    .sort((a, b) => b.problems.filter((p) => c.problems.includes(p)).length - a.problems.filter((p) => c.problems.includes(p)).length)
    .slice(0, 3);
  const saved = board.has(c.id);
  const share = { before: carShare(c.section.before), after: carShare(c.section.after) };
  const maps = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${c.nameEn} ${c.cityEn}`)}`;
  const sources = `https://www.google.com/search?q=${encodeURIComponent(`${c.nameEn} ${c.cityEn} case study`)}`;

  return (
    <main className="page case" style={{ '--c': ctx.color } as React.CSSProperties}>
      <nav className="crumbs" aria-label="מיקום">
        <a {...linkProps({ view: 'home' })}>בעיות</a>
        <span>/</span>
        <a {...linkProps({ view: 'problem', problem: ctx.id })}>{ctx.title}</a>
        <span>/</span>
        <span>{c.name}</span>
      </nav>

      <header className="case-head">
        <div className="meta">
          <span>{c.city}, {c.country}</span>
          <span>{c.years}</span>
          <span>{SCALES.find((s) => s.id === c.scale)?.label}</span>
        </div>
        <h1>{c.name}</h1>
        <p className="en">{c.nameEn}, {c.cityEn}</p>
        <p className="insight">{c.insight}</p>
        <div className="case-actions">
          <button type="button" className={`btn${saved ? ' on' : ''}`} aria-pressed={saved} onClick={() => board.toggle(c.id)}>
            {saved ? 'שמור בלוח ההשראה' : 'שמירה ללוח ההשראה'}
          </button>
          <a className="btn ghost" href={maps} target="_blank" rel="noopener noreferrer">במפות Google</a>
          <a className="btn ghost" href={sources} target="_blank" rel="noopener noreferrer">מקורות לבדיקה</a>
        </div>
      </header>

      <section className="section-block">
        <div className="toggle" role="tablist" aria-label="חתך">
          <button type="button" role="tab" aria-selected={mode === 'before'} onClick={() => setMode('before')}>לפני</button>
          <button type="button" role="tab" aria-selected={mode === 'after'} onClick={() => setMode('after')}>אחרי</button>
        </div>
        <Section before={c.section.before} after={c.section.after} mode={mode} />
        <div className="section-foot">
          <Legend bands={[...c.section.before, ...c.section.after]} />
          <div className="ratio" aria-label="שטח החתך שמוקדש לרכב">
            <span className="mono">שטח החתך לרכב</span>
            <div className="bars">
              <div><span>לפני</span><i style={{ width: `${share.before}%` }} /><b>{share.before}%</b></div>
              <div><span>אחרי</span><i style={{ width: `${share.after}%` }} /><b>{share.after}%</b></div>
            </div>
          </div>
        </div>
        <p className="note">החתך סכמטי ומבוסס על תיאור המקרה, לא על מדידה. הוא מראה איך חולק הרוחב בין השימושים, לא מידות מדויקות.</p>
      </section>

      <div className="story">
        {[
          ['לפני', c.before],
          ['מה נעשה', c.intervention],
          ['התוצאה', c.result],
        ].map(([h, t], i) => (
          <motion.section key={h} initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.06 }}>
            <span className="mono">{String(i + 1).padStart(2, '0')}</span>
            <h2>{h}</h2>
            <p>{t}</p>
          </motion.section>
        ))}
      </div>

      <div className="two">
        <section className="panel">
          <h2>מהלכים להעברה</h2>
          <ul className="takeaways">
            {c.moves.map((m) => (
              <li key={m}>{m}</li>
            ))}
          </ul>
        </section>
        <section className="panel warn">
          <h2>מה נכשל או שנוי במחלוקת</h2>
          <p>{c.cautions}</p>
        </section>
      </div>

      <section className="panel israel">
        <h2>ובישראל</h2>
        <p>{c.israel}</p>
        <p className="team"><span className="mono">צוות ויוזמים</span> {c.team}</p>
      </section>

      <section className="block">
        <div className="block-head">
          <h2>הצעד הבא</h2>
        </div>
        <div className="apps">
          {c.apps.map((k) => (
            <a key={k} className="app" href={APPS[k].url} target="_blank" rel="noopener noreferrer">
              <b>{APPS[k].name}</b>
              <span>{APPS[k].why}</span>
            </a>
          ))}
        </div>
      </section>

      <section className="block">
        <div className="block-head">
          <h2>פתרו בעיה דומה</h2>
          <div className="chips">
            {c.problems.map((p) => {
              const pr = problemById(p)!;
              return (
                <a key={p} className="chip" style={{ '--c': pr.color } as React.CSSProperties} {...linkProps({ view: 'problem', problem: p })}>
                  {pr.title}
                </a>
              );
            })}
          </div>
        </div>
        <div className="grid">
          {related.map((o, i) => (
            <CaseCard key={o.id} c={o} from={ctx.id} i={i} />
          ))}
        </div>
      </section>
    </main>
  );
}
