import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { caseById, type Case } from '../data/cases';
import { moveById } from '../data/moves';
import { problemById } from '../data/problems';
import { useBoard } from '../lib/board';
import { go, linkProps, type Route } from '../lib/route';
import Section, { carShare } from './Section';
import Flag from './Flag';

/** The board as a presentation for a committee or a class: one case per slide, keyboard and buttons. */
export default function PresentPage({ route }: { route: Route }) {
  const board = useBoard();
  const ids = route.ids?.length ? route.ids : board.items.map((e) => e.id);
  const notes = Object.fromEntries(board.items.map((e) => [e.id, e.note]));
  const list = ids.map(caseById).filter(Boolean) as Case[];
  const total = list.length + 1;
  const s = Math.min(Math.max(route.s ?? 0, 0), total - 1);
  const [mode, setMode] = useState<'before' | 'after'>('before');
  const to = (n: number) => go({ view: 'present', ids: route.ids, s: Math.min(Math.max(n, 0), total - 1) || undefined }, true);

  useEffect(() => {
    setMode('before');
    const t = setTimeout(() => setMode('after'), 1400);
    return () => clearTimeout(t);
  }, [s]);

  useEffect(() => {
    const f = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.closest('input, textarea, select')) return;
      if (e.key === 'ArrowLeft' || e.key === 'PageDown' || e.key === ' ') to(s + 1);
      if (e.key === 'ArrowRight' || e.key === 'PageUp') to(s - 1);
    };
    addEventListener('keydown', f);
    return () => removeEventListener('keydown', f);
  });

  if (!list.length)
    return (
      <main className="page">
        <div className="empty-box">
          <p>אין מקרים למצגת. שומרים מקרים בלוח ההשראה, ואז המצגת נבנית מהם.</p>
          <a className="btn" {...linkProps({ view: 'board' })}>ללוח ההשראה</a>
        </div>
      </main>
    );

  const c = s > 0 ? list[s - 1] : null;
  const p = c ? problemById(c.problems[0]) : null;

  return (
    <main className="present" style={{ '--c': p?.color ?? '#17191c' } as React.CSSProperties}>
      <AnimatePresence mode="wait">
        <motion.section key={s} className="slide" initial={{ opacity: 0, x: -40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 40 }} transition={{ duration: 0.35 }}>
          {c ? (
            <>
              <div className="slide-text">
                <span className="mono">{p?.title}</span>
                <h1><Flag country={c.countryEn} label={c.country} /> {c.name}</h1>
                <p className="en">{c.nameEn}, {c.city}, {c.years}</p>
                <p className="slide-insight">{c.insight}</p>
                <ul className="takeaways">
                  {c.moves.slice(0, 4).map((m) => (
                    <li key={m}>{moveById(m)?.title}</li>
                  ))}
                </ul>
                {notes[c.id] ? <p className="slide-note"><span className="mono">מה לוקחים</span> {notes[c.id]}</p> : null}
                <p className="slide-caution"><span className="mono">לבדוק</span> {c.cautions}</p>
              </div>
              <div className="slide-art">
                <Section before={c.section.before} after={c.section.after} mode={mode} />
                <span className="mono">{mode === 'before' ? 'לפני' : 'אחרי'}: שטח לרכב {carShare(mode === 'before' ? c.section.before : c.section.after)}%</span>
              </div>
            </>
          ) : (
            <div className="slide-title">
              <span className="mono">ערים מעוררות השראה</span>
              <h1>{list.length} תקדימים לדיון</h1>
              <ol>
                {list.map((x) => (
                  <li key={x.id}>{x.name} <span className="en">{x.city}</span></li>
                ))}
              </ol>
            </div>
          )}
        </motion.section>
      </AnimatePresence>
      <nav className="slide-nav" aria-label="ניווט במצגת">
        <button type="button" className="btn ghost" onClick={() => to(s - 1)} disabled={s === 0}>הקודם</button>
        <span className="mono">{s + 1} / {total}</span>
        <button type="button" className="btn" onClick={() => to(s + 1)} disabled={s === total - 1}>הבא</button>
        <a className="btn ghost" {...linkProps({ view: 'board' })}>יציאה מהמצגת</a>
      </nav>
    </main>
  );
}
