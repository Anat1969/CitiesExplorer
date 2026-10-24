import { CASES, SCALES, type Scale } from '../data/cases';
import { PROBLEMS } from '../data/problems';
import { go, type Route } from '../lib/route';
import { search } from '../lib/search';
import CaseCard from './CaseCard';

export default function AllCases({ route }: { route: Route }) {
  const scoped = route.scale ? CASES.filter((c) => c.scale === route.scale) : CASES;
  const list = search(route.q ?? '', scoped);
  const setScale = (s?: Scale) => go({ ...route, view: 'all', scale: s }, true);
  return (
    <main className="page">
      <header className="block-head page-head">
        <h1>כל המקרים</h1>
        <p>
          {route.q ? <>תוצאות עבור "{route.q}": </> : null}
          {list.length} מתוך {CASES.length} מקרי בוחן
        </p>
      </header>
      <div className="filters" role="group" aria-label="קנה מידה">
        <button type="button" aria-pressed={!route.scale} onClick={() => setScale(undefined)}>הכול</button>
        {SCALES.map((s) => (
          <button key={s.id} type="button" aria-pressed={route.scale === s.id} onClick={() => setScale(s.id)}>
            {s.label}
          </button>
        ))}
      </div>
      {list.length ? (
        <div className="grid">
          {list.map((c, i) => (
            <CaseCard key={c.id} c={c} i={i} />
          ))}
        </div>
      ) : (
        <div className="empty-box">
          <p>לא נמצא מקרה. אפשר לחפש לפי עיר (ברצלונה), בעיה (הצפות), מהלך (פירוק כביש) או שם באנגלית.</p>
          <div className="chips">
            {PROBLEMS.slice(0, 5).map((p) => (
              <button key={p.id} type="button" className="chip" style={{ '--c': p.color } as React.CSSProperties} onClick={() => go({ view: 'problem', problem: p.id })}>
                {p.title}
              </button>
            ))}
          </div>
        </div>
      )}
    </main>
  );
}
