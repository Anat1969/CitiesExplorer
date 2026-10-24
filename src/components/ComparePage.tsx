import { APPROACHES, CASES, caseById, CLIMATES, CONTEXTS, DURATION_LABEL, SCALES, type Case } from '../data/cases';
import { COST_LABEL, moveById } from '../data/moves';
import { problemById } from '../data/problems';
import { go, linkProps, type Route } from '../lib/route';
import { carShare, MiniSection } from './Section';

const ROWS: { label: string; get: (c: Case) => React.ReactNode }[] = [
  { label: 'מקום', get: (c) => `${c.city}, ${c.country}` },
  { label: 'שנים', get: (c) => c.years },
  { label: 'קנה מידה', get: (c) => SCALES.find((s) => s.id === c.scale)?.label },
  { label: 'אקלים', get: (c) => CLIMATES.find((s) => s.id === c.climate)?.label },
  { label: 'הקשר', get: (c) => CONTEXTS.find((s) => s.id === c.context)?.label },
  { label: 'גישה', get: (c) => APPROACHES[c.approach] },
  { label: 'עלות', get: (c) => COST_LABEL[c.cost] },
  { label: 'משך', get: (c) => DURATION_LABEL[c.duration] },
  { label: 'שטח לרכב', get: (c) => `${carShare(c.section.before)}% לפני, ${carShare(c.section.after)}% אחרי` },
];

export default function ComparePage({ route }: { route: Route }) {
  const list = (route.ids ?? []).map(caseById).filter(Boolean).slice(0, 3) as Case[];
  const shared = list.length > 1 ? list[0].moves.filter((m) => list.every((c) => c.moves.includes(m))) : [];
  const set = (ids: string[]) => go({ view: 'compare', ids }, true);
  const options = CASES.filter((c) => !list.some((x) => x.id === c.id));

  return (
    <main className="page">
      <header className="block-head page-head">
        <p className="eyebrow">השוואה</p>
        <h1>מקרה מול מקרה</h1>
        <p>עד שלושה מקרים זה לצד זה. מהלכים משותפים לכולם מודגשים: הם הליבה שחוזרת.</p>
      </header>
      {list.length < 3 ? (
        <label className="add-compare">
          <span className="field-label">הוספת מקרה להשוואה</span>
          <select value="" onChange={(e) => e.target.value && set([...list.map((c) => c.id), e.target.value])}>
            <option value="">בחירת מקרה</option>
            {options.map((c) => (
              <option key={c.id} value={c.id}>{c.name}, {c.city}</option>
            ))}
          </select>
        </label>
      ) : null}
      {list.length ? (
        <div className="compare" style={{ '--n': list.length } as React.CSSProperties}>
          {list.map((c) => (
            <article key={c.id} className="compare-col" style={{ '--c': problemById(c.problems[0])?.color } as React.CSSProperties}>
              <header>
                <a className="compare-title" {...linkProps({ view: 'case', case: c.id })}>{c.name}</a>
                <span className="en">{c.nameEn}</span>
                <button type="button" className="btn ghost small" onClick={() => set(list.filter((x) => x.id !== c.id).map((x) => x.id))}>הסרה מההשוואה</button>
              </header>
              <p className="insight-sm">{c.insight}</p>
              <figure><MiniSection bands={c.section.before} /><figcaption className="mono">לפני</figcaption></figure>
              <figure><MiniSection bands={c.section.after} /><figcaption className="mono">אחרי</figcaption></figure>
              <dl>
                {ROWS.map((r) => (
                  <div key={r.label}><dt>{r.label}</dt><dd>{r.get(c)}</dd></div>
                ))}
              </dl>
              <h3>מהלכים</h3>
              <ul className="takeaways">
                {c.moves.map((m) => (
                  <li key={m} className={shared.includes(m) ? 'shared' : ''}>
                    <a {...linkProps({ view: 'move', move: m })}>{moveById(m)?.title}</a>
                    {shared.includes(m) ? <span className="mono">משותף</span> : null}
                  </li>
                ))}
              </ul>
              <h3>מה נכשל</h3>
              <p className="muted-p">{c.cautions}</p>
            </article>
          ))}
        </div>
      ) : (
        <div className="empty-box">
          <p>עוד לא נבחרו מקרים. אפשר לבחור מהרשימה למעלה, מלוח ההשראה או מעמוד של מקרה.</p>
        </div>
      )}
    </main>
  );
}
