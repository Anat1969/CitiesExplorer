import { motion } from 'framer-motion';
import { useEffect, useMemo, useRef, useState } from 'react';
import { CLIMATES, CONTEXTS, SCALES, type Band, type BandType, type Case } from '../data/cases';
import { COST_LABEL, PHASE_LABEL, type Phase } from '../data/moves';
import { PROBLEMS, problemById } from '../data/problems';
import { useBoard } from '../lib/board';
import { PART_LABEL, rank, strategy, WEIGHTS, type Part, type Site } from '../lib/match';
import { useProjects } from '../lib/projects';
import { go, linkProps, type Route } from '../lib/route';
import { BAND_COLOR, BAND_LABEL, carShare, MiniSection } from './Section';

const PART_COLOR: Record<Part, string> = {
  problem: '#17191c',
  climate: '#a8641f',
  section: '#2b6a88',
  scale: '#5b4f8a',
  context: '#44703f',
  budget: '#8d8a84',
};

const BAND_TYPES: BandType[] = ['building', 'walk', 'car', 'bike', 'green', 'water', 'rail', 'transit', 'plaza', 'shade', 'play'];

/** The site's own section, re-divided in the proportions of a case's "after". Buildings at the edges stay. */
export function transform(section: Band[], c: Case): Band[] {
  const lead = section[0]?.[0] === 'building' ? [section[0]] : [];
  const tail = section.length > 1 && section[section.length - 1][0] === 'building' ? [section[section.length - 1]] : [];
  const open = section.slice(lead.length, section.length - tail.length).reduce((s, [, w]) => s + w, 0);
  const inner = c.section.after.filter(([t]) => t !== 'building');
  const total = inner.reduce((s, [, w]) => s + w, 0) || 1;
  return [...lead, ...inner.map(([t, w, lv]) => [t, +((w / total) * open).toFixed(2), lv] as Band), ...tail];
}

function SectionEditor({ bands, onChange }: { bands: Band[]; onChange: (b: Band[]) => void }) {
  const set = (i: number, b: Band) => onChange(bands.map((x, k) => (k === i ? b : x)));
  const move = (i: number, d: number) => {
    const j = i + d;
    if (j < 0 || j >= bands.length) return;
    const next = [...bands];
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  };
  return (
    <div className="editor">
      <div className="editor-preview">
        <MiniSection bands={bands} />
      </div>
      <ol className="bands">
        {bands.map((b, i) => (
          <li key={i} className="band" style={{ '--bc': BAND_COLOR[b[0]] } as React.CSSProperties}>
            <span className="mono">{String(i + 1).padStart(2, '0')}</span>
            <label>
              <span className="sr">סוג רצועה {i + 1}</span>
              <select value={b[0]} onChange={(e) => set(i, [e.target.value as BandType, b[1], b[2]])}>
                {BAND_TYPES.map((t) => (
                  <option key={t} value={t}>{BAND_LABEL[t]}</option>
                ))}
              </select>
            </label>
            <div className="stepper" role="group" aria-label={`רוחב רצועה ${i + 1}`}>
              <button type="button" onClick={() => set(i, [b[0], Math.max(0.4, +(b[1] - 0.5).toFixed(1)), b[2]])}>צר</button>
              <span className="mono">{b[1].toFixed(1)}</span>
              <button type="button" onClick={() => set(i, [b[0], Math.min(8, +(b[1] + 0.5).toFixed(1)), b[2]])}>רחב</button>
            </div>
            <label>
              <span className="sr">מפלס רצועה {i + 1}</span>
              <select value={b[2] ?? ''} onChange={(e) => set(i, [b[0], b[1], (e.target.value || undefined) as Band[2]])}>
                <option value="">מפלס הרחוב</option>
                <option value="up">מוגבה</option>
                <option value="down">שקוע</option>
                <option value="tunnel">מנהרה</option>
              </select>
            </label>
            <div className="band-actions">
              <button type="button" onClick={() => move(i, -1)} disabled={i === 0} aria-label={`הזזת רצועה ${i + 1} ימינה`}>ימינה</button>
              <button type="button" onClick={() => move(i, 1)} disabled={i === bands.length - 1} aria-label={`הזזת רצועה ${i + 1} שמאלה`}>שמאלה</button>
              <button type="button" onClick={() => onChange(bands.filter((_, k) => k !== i))} disabled={bands.length <= 2} aria-label={`מחיקת רצועה ${i + 1}`}>מחיקה</button>
            </div>
          </li>
        ))}
      </ol>
      <button type="button" className="btn ghost small" onClick={() => onChange([...bands.slice(0, -1), ['walk', 1], ...bands.slice(-1)])} disabled={bands.length >= 12}>
        הוספת רצועה
      </button>
    </div>
  );
}

function Choice<T extends string | number>({ label, value, options, onChange }: { label: string; value: T; options: { id: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <div className="field">
      <span className="field-label">{label}</span>
      <div className="filters" role="group" aria-label={label}>
        {options.map((o) => (
          <button key={String(o.id)} type="button" aria-pressed={value === o.id} onClick={() => onChange(o.id)}>
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function Brief(site: Site, matches: ReturnType<typeof rank>, plan: ReturnType<typeof strategy>) {
  const lines = [
    `תדריך השראה: ${site.name || 'פרויקט ללא שם'}`,
    `בעיות: ${site.problems.map((p) => problemById(p)?.title).join(', ') || 'לא נבחרו'}`,
    `שטח החתך לרכב היום: ${carShare(site.section)}%`,
    '',
    'המקרים הקרובים',
    ...matches.slice(0, 5).map((m, i) => `${i + 1}. ${m.c.name} (${m.c.nameEn}), ${m.c.city}, ${m.c.years}. התאמה ${m.score}/100. ${m.c.insight}`),
    '',
    'אסטרטגיה מדורגת',
    ...(['quick', 'medium', 'long'] as Phase[]).flatMap((ph) => [
      `${PHASE_LABEL[ph]}:`,
      ...plan[ph].map((r) => `- ${r.move.title}: ${r.move.text} (נתמך ב-${r.cases.length} מקרים: ${r.cases.map((c) => c.name).join(', ')})`),
    ]),
    '',
    'סיכונים מהמקרים',
    ...matches.slice(0, 3).map((m) => `- ${m.c.name}: ${m.c.cautions}`),
    '',
    'ההתאמה מחושבת לפי בעיה, אקלים, דמיון חתך, קנה מידה, הקשר ותקציב. היא נקודת פתיחה לשיקול דעת, לא המלצה מחייבת.',
    location.href,
  ];
  return lines.join('\n');
}

export default function ProjectPage({ route }: { route: Route }) {
  const projects = useProjects();
  const board = useBoard();
  const current = projects.items.find((p) => p.id === route.p) ?? projects.items[0];
  const [site, setSite] = useState<Site | null>(current?.site ?? null);
  const [status, setStatus] = useState('');
  const timer = useRef<number>();

  useEffect(() => {
    if (!current) {
      const p = projects.create();
      go({ view: 'project', p: p.id }, true);
    } else if (route.p !== current.id) go({ view: 'project', p: current.id }, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current?.id]);

  useEffect(() => setSite(current?.site ?? null), [current?.id]);

  const update = (patch: Partial<Site>) => {
    if (!site || !current) return;
    const next = { ...site, ...patch };
    setSite(next);
    setStatus('שומר...');
    clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      projects.save(current.id, next);
      setStatus('נשמר במכשיר');
    }, 350);
  };

  const matches = useMemo(() => (site ? rank(site) : []), [site]);
  const plan = useMemo(() => (site ? strategy(site, matches) : { quick: [], medium: [], long: [] }), [site, matches]);
  const [copied, setCopied] = useState('');
  if (!site || !current) return <main className="page" />;

  const best = matches[0];
  const proposal = best ? transform(site.section, best.c) : site.section;
  const toggleProblem = (id: string) => update({ problems: site.problems.includes(id) ? site.problems.filter((p) => p !== id) : [...site.problems, id] });

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(Brief(site, matches, plan));
      setCopied('התדריך הועתק');
    } catch {
      setCopied('ההעתקה נחסמה בדפדפן');
    }
    setTimeout(() => setCopied(''), 1800);
  };

  return (
    <main className="page project">
      <header className="project-head">
        <p className="eyebrow">הפרויקט שלי</p>
        <label className="name-field">
          <span className="sr">שם הפרויקט</span>
          <input value={site.name} placeholder="שם הפרויקט, למשל: רחוב הרצל, רמלה" onChange={(e) => update({ name: e.target.value })} />
        </label>
        <p className="lede">
          מתארים את האתר: הבעיה, האקלים, ההקשר, התקציב והחתך הקיים. הכלי מדרג את המקרים הקרובים, מרכיב מהם אסטרטגיה מדורגת, ומראה את הסיכונים שהופיעו בהם. כל רכיב בציון גלוי.
        </p>
        <div className="project-bar">
          <span className="status" role="status">{status}</span>
          {projects.items.length > 1 ? (
            <label className="project-switch">
              <span className="sr">בחירת פרויקט</span>
              <select value={current.id} onChange={(e) => go({ view: 'project', p: e.target.value })}>
                {projects.items.map((p) => (
                  <option key={p.id} value={p.id}>{p.site.name || 'פרויקט ללא שם'}</option>
                ))}
              </select>
            </label>
          ) : null}
          <button type="button" className="btn ghost small" onClick={() => go({ view: 'project', p: projects.create().id })}>פרויקט חדש</button>
          {projects.items.length > 1 ? (
            <button type="button" className="btn ghost small" onClick={() => confirm('למחוק את הפרויקט הזה?') && (projects.remove(current.id), go({ view: 'project' }, true))}>
              מחיקת הפרויקט
            </button>
          ) : null}
        </div>
      </header>

      <section className="step">
        <div className="step-head">
          <span className="mono">01</span>
          <h2>האתר</h2>
        </div>
        <div className="field">
          <span className="field-label">הבעיה. הראשונה שנבחרת היא העיקרית.</span>
          <div className="chips problem-pick" role="group" aria-label="בעיות">
            {PROBLEMS.map((p) => {
              const i = site.problems.indexOf(p.id);
              return (
                <button key={p.id} type="button" className="chip" aria-pressed={i >= 0} style={{ '--c': p.color } as React.CSSProperties} onClick={() => toggleProblem(p.id)}>
                  {i === 0 ? <span className="mono">עיקרית</span> : null}
                  {p.title}
                </button>
              );
            })}
          </div>
        </div>
        <div className="fields">
          <Choice label="קנה מידה" value={site.scale} options={SCALES} onChange={(scale) => update({ scale })} />
          <Choice label="אקלים" value={site.climate} options={CLIMATES} onChange={(climate) => update({ climate })} />
          <Choice label="הקשר" value={site.context} options={CONTEXTS} onChange={(context) => update({ context })} />
          <Choice
            label="תקציב"
            value={site.budget}
            options={[
              { id: 1 as const, label: 'נמוך' },
              { id: 2 as const, label: 'בינוני' },
              { id: 3 as const, label: 'גבוה' },
            ]}
            onChange={(budget) => update({ budget })}
          />
        </div>
      </section>

      <section className="step">
        <div className="step-head">
          <span className="mono">02</span>
          <h2>החתך הקיים</h2>
          <p>מימין לשמאל, כמו שעומדים מול הרחוב. רוחב יחסי, לא במטרים. שטח החתך לרכב היום: <b>{carShare(site.section)}%</b></p>
        </div>
        <SectionEditor bands={site.section} onChange={(section) => update({ section })} />
      </section>

      <section className="step">
        <div className="step-head">
          <span className="mono">03</span>
          <h2>המקרים הקרובים</h2>
          <p>ציון מתוך 100: {(Object.keys(WEIGHTS) as Part[]).map((k) => `${PART_LABEL[k]} ${WEIGHTS[k]}`).join(', ')}.</p>
        </div>
        <ul className="part-legend">
          {(Object.keys(WEIGHTS) as Part[]).map((k) => (
            <li key={k}><span className="swatch" style={{ background: PART_COLOR[k] }} />{PART_LABEL[k]}</li>
          ))}
        </ul>
        <ol className="matches">
          {matches.slice(0, 6).map((m, i) => (
            <motion.li key={m.c.id} layout initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: i * 0.03 }}>
              <a className="match" {...linkProps({ view: 'case', case: m.c.id })}>
                <span className="match-score">{m.score}</span>
                <div className="match-body">
                  <b>{m.c.name}</b>
                  <span className="en">{m.c.nameEn}, {m.c.city}</span>
                  <div className="stack" aria-label={`פירוט הציון של ${m.c.name}`}>
                    {(Object.keys(WEIGHTS) as Part[]).map((k) => (
                      <i key={k} title={`${PART_LABEL[k]}: ${m.parts[k].toFixed(0)} מתוך ${WEIGHTS[k]}`} style={{ width: `${m.parts[k]}%`, background: PART_COLOR[k] }} />
                    ))}
                  </div>
                  <span className="reasons">{m.reasons.join(', ') || 'התאמה חלקית'}</span>
                </div>
              </a>
            </motion.li>
          ))}
        </ol>
      </section>

      <section className="step">
        <div className="step-head">
          <span className="mono">04</span>
          <h2>אסטרטגיה מדורגת</h2>
          <p>המהלכים של המקרים הקרובים, משוקללים לפי ההתאמה. ליד כל מהלך: כמה מקרים תומכים בו.</p>
        </div>
        <div className="phases">
          {(['quick', 'medium', 'long'] as Phase[]).map((ph) => (
            <div key={ph} className="phase">
              <h3>{PHASE_LABEL[ph]}</h3>
              {plan[ph].length ? (
                <ol>
                  {plan[ph].map((r) => (
                    <li key={r.move.id} className={r.overBudget ? 'over' : ''}>
                      <a className="move-link" {...linkProps({ view: 'move', move: r.move.id })}>{r.move.title}</a>
                      <p>{r.move.text}</p>
                      <span className="mono">
                        נתמך ב-{r.cases.length} {r.cases.length === 1 ? 'מקרה' : 'מקרים'}, {COST_LABEL[r.move.cost]}
                        {r.overBudget ? ', מעל התקציב' : ''}
                        {r.wider ? ', מתוך כל מקרי הבעיה' : ''}
                      </span>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="muted">אין מהלך בשלב הזה במקרים הקרובים.</p>
              )}
            </div>
          ))}
        </div>
      </section>

      {best ? (
        <section className="step">
          <div className="step-head">
            <span className="mono">05</span>
            <h2>כיוון אפשרי לחתך</h2>
            <p>החתך שלך, מחולק מחדש לפי היחסים של {best.c.name}. זו סקיצה לדיון, לא תכנון.</p>
          </div>
          <div className="compare-sections">
            <figure>
              <MiniSection bands={site.section} />
              <figcaption><span className="mono">היום</span> שטח לרכב {carShare(site.section)}%</figcaption>
            </figure>
            <figure>
              <MiniSection bands={proposal} />
              <figcaption><span className="mono">בהשראת {best.c.name}</span> שטח לרכב {carShare(proposal)}%</figcaption>
            </figure>
          </div>
          <button type="button" className="btn ghost small" onClick={() => update({ section: proposal })}>אימוץ החתך כנקודת פתיחה</button>
        </section>
      ) : null}

      <section className="step">
        <div className="step-head">
          <span className="mono">06</span>
          <h2>מה עלול להשתבש</h2>
          <p>מה נכשל או שנוי במחלוקת בשלושת המקרים הקרובים.</p>
        </div>
        <ul className="risks">
          {matches.slice(0, 3).map((m) => (
            <li key={m.c.id}>
              <b>{m.c.name}</b>
              <p>{m.c.cautions}</p>
            </li>
          ))}
        </ul>
      </section>

      <div className="board-actions project-actions">
        <button type="button" className="btn" onClick={copy}>העתקת התדריך</button>
        <button type="button" className="btn ghost" onClick={() => board.add(matches.slice(0, 3).map((m) => m.c.id))}>שלושת המקרים הקרובים ללוח</button>
        <button type="button" className="btn ghost" onClick={() => go({ view: 'compare', ids: matches.slice(0, 3).map((m) => m.c.id) })}>השוואת שלושת הקרובים</button>
        <button type="button" className="btn ghost" onClick={() => print()}>הדפסה</button>
        <span className="status" role="status">{copied}</span>
      </div>
      <p className="note">
        הכלי נשען על שיטת ספריית התקדימים ושפת הדפוסים (Christopher Alexander, A Pattern Language): בעיה חוזרת, והמהלכים שפתרו אותה במקומות שונים. ההתאמה היא חישוב שקוף של שישה רכיבים. היא לא מחליפה ביקור באתר, נתוני תנועה ושיתוף ציבור.
      </p>
    </main>
  );
}
