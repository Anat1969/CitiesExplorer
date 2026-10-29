import { CASES, SCALES, type Scale } from '../data/cases';
import { PROBLEMS } from '../data/problems';
import { rank } from '../lib/match';
import { useProjects } from '../lib/projects';
import { go, linkProps, type Route } from '../lib/route';
import { search } from '../lib/search';
import CaseCard from './CaseCard';

export default function AllCases({ route }: { route: Route }) {
  const scoped = route.scale ? CASES.filter((c) => c.scale === route.scale) : CASES;
  const list = search(route.q ?? '', scoped);
  const setScale = (s?: Scale) => go({ ...route, view: 'all', scale: s }, true);
  const mine = useProjects().items.filter((p) => p.site.problems.length || p.site.problemText || p.site.lat != null);
  return (
    <main className="page">
      <header className="block-head page-head">
        <h1>כל המקרים</h1>
        <p>
          {route.q ? <>תוצאות עבור "{route.q}": </> : null}
          {list.length} מתוך {CASES.length} מקרי בוחן
        </p>
      </header>
      {mine.length && !route.q ? (
        <section className="mine-strip" aria-label="הפרויקטים שלך">
          <span className="mono">הפרויקטים שלך, לצד המקרים</span>
          <ul>
            {mine.map((p) => {
              const top = p.site.problems.length ? rank(p.site)[0] : undefined;
              return (
                <li key={p.id}>
                  <a {...linkProps({ view: 'project', p: p.id })}>
                    {p.site.photo ? <img src={p.site.photo} alt="" /> : <span className="ph" />}
                    <span>
                      <b>{p.site.name || 'פרויקט ללא שם'}</b>
                      <span>{p.site.problems.map((x) => PROBLEMS.find((pr) => pr.id === x)?.title).join(', ') || 'הבעיה עוד לא נבחרה'}</span>
                      {top ? <span className="mono">הקרוב ביותר: {top.c.name}, {top.score}%</span> : null}
                    </span>
                  </a>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}
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
