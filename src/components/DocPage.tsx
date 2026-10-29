import { useEffect, useMemo, useRef, useState } from 'react';
import { COST_LABEL, PHASE_LABEL, type Phase } from '../data/moves';
import { problemById } from '../data/problems';
import { rank, strategy, type Site } from '../lib/match';
import { photoUrl } from '../lib/photos';
import { useProjects } from '../lib/projects';
import { go, linkProps, type Route } from '../lib/route';
import Flag from './Flag';
import Rich from './Rich';
import SitePhoto from './SitePhoto';

/** A paragraph the planner can rewrite in place; the edit is kept with the project. */
function Editable({ k, text, doc, onEdit, as: Tag = 'p', className }: { k: string; text: string; doc: Record<string, string>; onEdit: (k: string, v: string) => void; as?: 'p' | 'h1' | 'h2'; className?: string }) {
  return (
    <Tag
      className={`editable${className ? ` ${className}` : ''}`}
      contentEditable
      suppressContentEditableWarning
      spellCheck
      onBlur={(e) => {
        const v = e.currentTarget.innerText.trim();
        if (v !== (doc[k] ?? text)) onEdit(k, v);
      }}
    >
      {doc[k] ?? text}
    </Tag>
  );
}

/** "מסמך פתרונות": the site photo and problem, and the possible solutions ranked by relevance, ready to show an engineer. */
export default function DocPage({ route }: { route: Route }) {
  const projects = useProjects();
  const current = projects.items.find((p) => p.id === route.p) ?? projects.items[0];
  const [site, setSite] = useState<Site | null>(current?.site ?? null);
  const [status, setStatus] = useState('');
  const timer = useRef<number>();
  // Follows the stored project, also when the project page saved it a moment after we opened.
  useEffect(() => setSite(current?.site ?? null), [current?.id, current?.updatedAt]);

  const matches = useMemo(() => (site ? rank(site).filter((m) => m.score >= 35).slice(0, 5) : []), [site]);
  const plan = useMemo(() => (site ? strategy(site, rank(site)) : { quick: [], medium: [], long: [] }), [site]);

  if (!site || !current) {
    return (
      <main className="page">
        <p className="lede">אין עדיין פרויקט. מתחילים ב"הפרויקט שלי": מעלים תמונה של הבעיה ובוחרים מהי.</p>
        <a className="btn" {...linkProps({ view: 'project' })}>להפרויקט שלי</a>
      </main>
    );
  }

  const save = (patch: Partial<Site>) => {
    const next = { ...site, ...patch };
    setSite(next);
    setStatus('שומר...');
    clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setStatus(projects.save(current.id, next) ? 'נשמר במכשיר' : 'המכשיר לא שמר: האחסון מלא או חסום'), 300);
  };
  const doc = site.doc ?? {};
  const edit = (k: string, v: string) => save({ doc: { ...doc, [k]: v } });
  const main = problemById(site.problems[0]);
  const today = new Date().toLocaleDateString('he-IL', { day: 'numeric', month: 'long', year: 'numeric' });
  const name = site.name || 'פרויקט ללא שם';

  return (
    <main className="page doc-page">
      <div className="doc-tools">
        <a className="btn ghost small" {...linkProps({ view: 'project', p: current.id })}>חזרה לפרויקט</a>
        <button type="button" className="btn small" onClick={() => print()} title="בחלון ההדפסה אפשר לבחור שמירה כ-PDF">
          הדפסה או PDF
        </button>
        {site.doc && Object.keys(site.doc).length ? (
          <button type="button" className="btn ghost small" onClick={() => confirm('לבטל את כל העריכות במסמך?') && save({ doc: {} })}>
            ביטול העריכות
          </button>
        ) : null}
        <span className="status" role="status">{status}</span>
        <span className="doc-hint">כל טקסט במסמך ניתן לעריכה: לוחצים עליו וכותבים.</span>
      </div>

      <article className="doc">
        <header className="doc-head">
          <span className="mono">מסמך פתרונות לדיון, {today}</span>
          <Editable as="h1" k="title" text={name} doc={doc} onEdit={edit} />
          <Editable k="to" text="לכבוד: המהנדס/ת. הנדון: חלופות תכנוניות לבעיה באתר, מבוססות תקדימים מהעולם ומישראל." doc={doc} onEdit={edit} className="doc-to" />
        </header>

        <section className="doc-sec">
          <h2>המצב הקיים</h2>
          <SitePhoto photo={site.photo} onChange={(photo) => save({ photo })} />
          <Editable k="situation" text="תיאור קצר של מה רואים בתמונה ומה הבעיה בשטח." doc={doc} onEdit={edit} />
        </section>

        <section className="doc-sec">
          <h2>הבעיה</h2>
          {site.problems.length ? (
            <>
              <ul className="doc-problems">
                {site.problems.map((id, i) => {
                  const p = problemById(id)!;
                  return (
                    <li key={id} style={{ '--c': p.color } as React.CSSProperties}>
                      <b>{p.title}</b> {i === 0 ? <span className="mono">עיקרית</span> : null}
                      <span>{p.question}</span>
                    </li>
                  );
                })}
              </ul>
              {main ? <p><mark>{main.summary}</mark></p> : null}
            </>
          ) : (
            <p>
              לא נבחרה בעיה. <a {...linkProps({ view: 'project', p: current.id })}>בוחרים בעיה בפרויקט</a>, והפתרונות מתעדכנים.
            </p>
          )}
        </section>

        <section className="doc-sec">
          <h2>פתרונות אפשריים, מדורגים לפי רלוונטיות</h2>
          <p className="doc-note">הדירוג מחושב מהבעיה, האקלים, החתך, קנה המידה, ההקשר והתקציב שהוגדרו בפרויקט. ציון מתוך 100.</p>
          <ol className="doc-solutions">
            {matches.map((m, i) => {
              const ph = m.c.photos?.find((p) => p.when === 'after');
              return (
                <li key={m.c.id}>
                  <div className="sol-head">
                    <span className="sol-rank">{i + 1}</span>
                    <div>
                      <h3>
                        <Flag country={m.c.countryEn} label={m.c.country} /> {m.c.name}
                      </h3>
                      <span className="en">{m.c.nameEn}, {m.c.cityEn}, {m.c.years}</span>
                    </div>
                    <span className="sol-score" title="ציון התאמה מתוך 100">{m.score}</span>
                  </div>
                  {ph ? <img className="sol-photo" src={photoUrl(ph, 960)} alt={ph.caption} loading="lazy" /> : null}
                  <p className="sol-insight"><mark>{m.c.insight}</mark></p>
                  <dl className="sol-grid">
                    <div>
                      <dt>מה נעשה</dt>
                      <dd><Rich text={m.c.intervention} /></dd>
                    </div>
                    <div data-tone="go">
                      <dt>מה עבד</dt>
                      <dd><Rich text={m.c.result} /></dd>
                    </div>
                    <div data-tone="wait">
                      <dt>מה צריך לבדוק אצלנו</dt>
                      <dd><Rich text={m.c.israel} /></dd>
                    </div>
                    <div data-tone="stop">
                      <dt>מה נכשל או שנוי במחלוקת</dt>
                      <dd><Rich text={m.c.cautions} /></dd>
                    </div>
                  </dl>
                  <p className="sol-why mono">למה דורג כאן: {m.reasons.join(', ') || 'התאמה חלקית'}</p>
                  <Editable k={`note-${m.c.id}`} text="הערה לפרויקט: מה לוקחים מכאן." doc={doc} onEdit={edit} className="sol-note" />
                  <a className="src no-print" {...linkProps({ view: 'case', case: m.c.id })}>המקרה המלא באפליקציה</a>
                </li>
              );
            })}
          </ol>
          {!matches.length ? <p>אין עדיין מקרים קרובים מספיק. בוחרים בעיה ומאפייני אתר בפרויקט.</p> : null}
        </section>

        <section className="doc-sec">
          <h2>הצעה לשלבים</h2>
          <div className="doc-phases">
            {(['quick', 'medium', 'long'] as Phase[]).map((ph) => (
              <div key={ph}>
                <h3>{PHASE_LABEL[ph]}</h3>
                <ul>
                  {plan[ph].map((r) => (
                    <li key={r.move.id}>
                      <b>{r.move.title}</b>. {r.move.text} <span className="mono">({COST_LABEL[r.move.cost]}, {r.cases.length} מקרים)</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>

        <section className="doc-sec">
          <h2>המלצה והצעד הבא</h2>
          <Editable
            k="next"
            text={matches[0] ? `להתחיל בבדיקת הכיוון של ${matches[0].c.name}, כפיילוט זמני, ולמדוד לפני ואחרי.` : 'הצעד הבא.'}
            doc={doc}
            onEdit={edit}
          />
        </section>

        <footer className="doc-foot">
          <p>
            השיטה: ספריית תקדימים ושפת דפוסים (Christopher Alexander, A Pattern Language). העובדות במקרים נבדקו מול מקורות ומסומנות כמאומתות או משוערות. הדירוג הוא נקודת פתיחה לשיקול דעת מקצועי, לא המלצה מחייבת.
          </p>
          <p className="mono">אד' ענת שטיבלמן A&amp;I</p>
        </footer>
      </article>
      <p className="no-print">
        <button type="button" className="btn ghost small" onClick={() => go({ view: 'project', p: current.id })}>
          שינוי הבעיה או מאפייני האתר
        </button>
      </p>
    </main>
  );
}
