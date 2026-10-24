import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { APPS } from '../data/apps';
import { APPROACHES, CASES, caseById, CLIMATES, CONTEXTS, DURATION_LABEL, SCALES, type Case } from '../data/cases';
import { COST_LABEL, moveById, PHASE_LABEL } from '../data/moves';
import { problemById } from '../data/problems';
import { useBoard } from '../lib/board';
import { go, linkProps } from '../lib/route';
import CaseCard from './CaseCard';
import NotFound from './NotFound';
import Section, { carShare, Legend } from './Section';

/** Cases that share problems and moves with this one. */
export function relatedTo(c: Case, n = 3) {
  return CASES.filter((o) => o.id !== c.id)
    .map((o) => ({ o, s: o.problems.filter((p) => c.problems.includes(p)).length * 2 + o.moves.filter((m) => c.moves.includes(m)).length }))
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s)
    .slice(0, n)
    .map((x) => x.o);
}

export default function CasePage({ id, from }: { id: string; from?: string }) {
  const c = caseById(id);
  const board = useBoard();
  const [mode, setMode] = useState<'before' | 'after'>('after');
  useEffect(() => setMode('after'), [id]);
  if (!c) return <NotFound />;
  const ctx = problemById(from && c.problems.includes(from) ? from : c.problems[0])!;
  const related = relatedTo(c);
  const saved = board.has(c.id);
  const share = { before: carShare(c.section.before), after: carShare(c.section.after) };
  const maps = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${c.nameEn} ${c.cityEn}`)}`;
  const verified = c.facts.filter((f) => f.status === 'verified').length;

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
        <p className="en">{c.nameEn}, {c.cityEn}, {c.countryEn}</p>
        <p className="insight">{c.insight}</p>
        <div className="case-actions">
          <button type="button" className={`btn${saved ? ' on' : ''}`} aria-pressed={saved} onClick={() => board.toggle(c.id)}>
            {saved ? 'שמור בלוח ההשראה' : 'שמירה ללוח ההשראה'}
          </button>
          {related[0] ? (
            <button type="button" className="btn ghost" onClick={() => go({ view: 'compare', ids: [c.id, related[0].id] })}>
              השוואה עם {related[0].name}
            </button>
          ) : null}
          <a className="btn ghost" href={maps} target="_blank" rel="noopener noreferrer">במפות Google</a>
        </div>
      </header>

      <dl className="profile">
        <div><dt>אקלים</dt><dd>{CLIMATES.find((x) => x.id === c.climate)?.label}</dd></div>
        <div><dt>הקשר</dt><dd>{CONTEXTS.find((x) => x.id === c.context)?.label}</dd></div>
        <div><dt>גישה</dt><dd>{APPROACHES[c.approach]}</dd></div>
        <div><dt>עלות</dt><dd>{COST_LABEL[c.cost]}</dd></div>
        <div><dt>משך</dt><dd>{DURATION_LABEL[c.duration]}</dd></div>
      </dl>

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
          <h2>המהלכים</h2>
          <ul className="takeaways">
            {c.moves.map((id) => {
              const m = moveById(id);
              if (!m) return null;
              return (
                <li key={id}>
                  <a {...linkProps({ view: 'move', move: id })}>{m.title}</a>
                  <span className="mono">{PHASE_LABEL[m.phase]}, {COST_LABEL[m.cost]}</span>
                </li>
              );
            })}
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

      <section className="panel evidence">
        <div className="evidence-head">
          <h2>עובדות ומקורות</h2>
          <span className="mono">{verified} מתוך {c.facts.length} עובדות אומתו מול מקור</span>
        </div>
        <ul className="facts">
          {c.facts.map((f) => (
            <li key={f.text} data-status={f.status}>
              <span className="mono status-tag">{f.status === 'verified' ? 'מאומת' : 'משוער'}</span>
              <span>{f.text}</span>
              {f.source ? (
                <a href={f.source} target="_blank" rel="noopener noreferrer" className="src">מקור</a>
              ) : null}
            </li>
          ))}
        </ul>
        <ul className="sources">
          {c.sources.map((s) => (
            <li key={s.url}>
              <a href={s.url} target="_blank" rel="noopener noreferrer">{s.label}</a>
            </li>
          ))}
        </ul>
        <p className="note">"מאומת" פירושו שהעובדה נמצאה במקור המצורף. "משוער" פירושו שהמקורות חלוקים, והנוסח מקורב. לפני שימוש במסמך רשמי יש לבדוק במקור.</p>
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
          <a className="app light" {...linkProps({ view: 'project' })}>
            <b>הפרויקט שלי</b>
            <span>להשוות את האתר שלך למקרה הזה ולמקרים דומים</span>
          </a>
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
