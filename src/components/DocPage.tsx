import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { CLIMATES } from '../data/cases';
import { moveById, PHASE_LABEL, type Phase } from '../data/moves';
import { problemById } from '../data/problems';
import { HIGHWAY_LABEL } from '../lib/gis';
import { rank, strategy, transform, type Site } from '../lib/match';
import { photoUrl } from '../lib/photos';
import { useProjects } from '../lib/projects';
import { linkProps, type Route } from '../lib/route';
import Flag from './Flag';
import Rich from './Rich';
import { carShare, MiniSection } from './Section';

/** First sentence: the report is a distillation, the case page holds the rest. */
const first = (t: string) => t.split(/(?<=[.!?])\s+/)[0];

/** A paragraph the planner can rewrite in place; the edit is kept with the project. */
function Editable({ k, text, doc, onEdit, as: Tag = 'p', className }: { k: string; text: string; doc: Record<string, string>; onEdit: (k: string, v: string) => void; as?: 'p' | 'h1' | 'span'; className?: string }) {
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

const tone = (score: number) => (score >= 70 ? 'go' : score >= 50 ? 'wait' : 'stop');

/** The report: two A4 pages, from the site and its problem to ranked solutions, ready for the engineer. */
export default function DocPage({ route }: { route: Route }) {
  const projects = useProjects();
  const current = projects.items.find((p) => p.id === route.p) ?? projects.items[0];
  const [site, setSite] = useState<Site | null>(current?.site ?? null);
  const [status, setStatus] = useState('');
  const timer = useRef<number>();
  // Follows the stored project, also when the project page saved it a moment after we opened.
  useEffect(() => setSite(current?.site ?? null), [current?.id, current?.updatedAt]);

  const all = useMemo(() => (site ? rank(site) : []), [site]);
  const top = all.filter((m) => m.score >= 35).slice(0, 3);
  const plan = useMemo(() => (site ? strategy(site, all) : { quick: [], medium: [], long: [] }), [site, all]);
  // The third solution stays on page 1 while the page fits its A4 sheet; otherwise it opens page 2.
  const page1 = useRef<HTMLElement>(null);
  const [onFirst, setOnFirst] = useState(3);
  useLayoutEffect(() => setOnFirst(3), [site]);
  useLayoutEffect(() => {
    const el = page1.current;
    if (!el || onFirst !== 3) return;
    const sheet = (297 / 25.4) * 96;
    if (el.scrollHeight > sheet + 1 && innerWidth > 860) setOnFirst(2);
  });

  if (!site || !current) {
    return (
      <main className="page">
        <p className="lede">אין עדיין פרויקט. מתחילים ב"הפרויקט שלי": מקום, תמונה וניסוח הבעיה.</p>
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
  const open = site.section.filter(([t]) => t !== 'building').reduce((s, [, w]) => s + w, 0);
  const best = top[0];
  const proposal = best ? transform(site.section, best.c) : site.section;
  const st = site.street;
  const osmN = st ? [st.lanes, st.width, st.sidewalk, st.sidewalkWidth, st.parking, st.cycleway].filter((x) => x.src === 'osm').length : 0;

  // One solution: the case, the link from our problem to its move, then pro, con and the upgrade for this site.
  const chain = (m: (typeof top)[number], i: number) => {
                const mv = moveById(m.c.moves[0]);
                const ph = m.c.photos?.find((p) => p.when === 'after');
                const prop = transform(site.section, m.c);
                return (
                  <li key={m.c.id}>
                    <div className="r-case">
                      <span className="r-rank">{i + 1}</span>
                      {ph ? <img src={photoUrl(ph, 500)} alt={ph.caption} /> : null}
                      <div>
                        <b><Flag country={m.c.countryEn} label={m.c.country} /> {m.c.name}</b>
                        <span className="en">{m.c.cityEn}, {m.c.years}</span>
                      </div>
                      <span className="r-score" data-tone={tone(m.score)}>{m.score}%</span>
                    </div>
                    <p className="r-link">
                      <span className="k">הבעיה אצלנו</span> {problemById(site.problems.find((p) => m.c.problems.includes(p)) ?? site.problems[0])?.title}
                      <span className="sep" />
                      <span className="k">המהלך</span> <b>{mv?.title}</b>
                      <span className="sep" />
                      <span className="k">התובנה</span> <mark>{m.c.insight}</mark>
                    </p>
                    <div className="r-cells">
                      <div data-tone="go"><span>יתרון</span><Rich text={first(m.c.result)} /></div>
                      <div data-tone="stop"><span>חיסרון</span><Rich text={first(m.c.cautions)} /></div>
                      <div data-tone="wait">
                        <span>שדרוג לאתר שלך</span>
                        <Editable
                          as="span"
                          k={`up-${m.c.id}`}
                          text={
                            carShare(prop) < carShare(site.section)
                              ? `ב-${+open.toFixed(1)} מ' שבין קווי הבניין, לפי היחסים של המקרה: הרכב יורד מ-${carShare(site.section)}% ל-${carShare(prop)}% מהחתך, והשאר עובר להולכים, לצל ולירוק.`
                              : `החתך כבר קרוב ליחסים של המקרה. השדרוג הוא באיכות: ${moveById(m.c.moves[1] ?? m.c.moves[0])?.title ?? 'ריהוט, צל ופעילות'}.`
                          }
                          doc={doc}
                          onEdit={edit}
                        />
                      </div>
                    </div>
                  </li>
                );
              };

  return (
    <main className="page doc-page">
      <div className="doc-tools">
        <a className="btn ghost small" {...linkProps({ view: 'project', p: current.id })}>חזרה לפרויקט</a>
        <button type="button" className="btn small" onClick={() => print()} title="בחלון ההדפסה: גודל A4, ואפשר לשמור כ-PDF">
          הדפסה או PDF
        </button>
        {site.doc && Object.keys(site.doc).length ? (
          <button type="button" className="btn ghost small" onClick={() => confirm('לבטל את כל העריכות בדוח?') && save({ doc: {} })}>
            ביטול העריכות
          </button>
        ) : null}
        <span className="status" role="status">{status}</span>
        <span className="doc-hint">כל טקסט בדוח ניתן לעריכה: לוחצים וכותבים.</span>
      </div>

      <div className="a4-stack">
        <article className="a4" aria-label="עמוד 1" ref={page1}>
          <header className="r-head">
            <div>
              <span className="mono">דוח התאמת תקדימים, {today}</span>
              <Editable as="h1" k="title" text={name} doc={doc} onEdit={edit} />
              {site.address ? <span className="r-addr">{site.address}</span> : null}
            </div>
            <Editable k="to" text="לכבוד: המהנדס/ת. לדיון בחלופות לאתר." doc={doc} onEdit={edit} className="r-to" />
          </header>

          <section className="r-diag">
            <div className="r-photo">
              {site.photo ? <img src={site.photo} alt="המצב הקיים באתר" /> : <div className="r-nophoto">אין תמונה</div>}
              {site.mix ? (
                <div className="r-mix">
                  <div className="mix-bar">
                    <i className="g" style={{ width: `${site.mix.green}%` }} />
                    <i className="h" style={{ width: `${site.mix.hard}%` }} />
                    <i className="s" style={{ width: `${site.mix.sky}%` }} />
                    <i className="o" style={{ width: `${site.mix.other}%` }} />
                  </div>
                  <span>צמחייה <b>{site.mix.green}%</b>, משטח קשה <b>{site.mix.hard}%</b>, שמיים <b>{site.mix.sky}%</b></span>
                </div>
              ) : null}
            </div>
            <div className="r-what">
              <h2>האבחון</h2>
              {site.problemText ? (
                <blockquote>
                  <mark>{site.problemText}</mark>
                </blockquote>
              ) : null}
              <ul className="r-problems">
                {site.problems.map((id, i) => {
                  const p = problemById(id)!;
                  return (
                    <li key={id} style={{ '--c': p.color } as React.CSSProperties}>
                      <b>{p.title}</b>
                      {i === 0 ? <span className="mono">עיקרית</span> : null}
                    </li>
                  );
                })}
              </ul>
              <dl className="r-facts">
                <div><dt>בין קווי הבניין</dt><dd><b>{+open.toFixed(1)} מ'</b></dd></div>
                <div><dt>שטח החתך לרכב</dt><dd data-tone={carShare(site.section) > 50 ? 'stop' : 'go'}><b>{carShare(site.section)}%</b></dd></div>
                {st ? (
                  <>
                    <div><dt>הדרך</dt><dd>{HIGHWAY_LABEL[st.highway] ?? st.highway}, <b>{st.lanes.v} נתיבים</b></dd></div>
                    <div><dt>עצים ממופים</dt><dd data-tone={st.trees < 4 ? 'stop' : 'go'}><b>{st.trees}</b> ב-40 מ'</dd></div>
                  </>
                ) : null}
                <div><dt>אקלים</dt><dd>{CLIMATES.find((c) => c.id === site.climate)?.label}</dd></div>
              </dl>
              {main ? <p className="r-q"><b>השאלה:</b> {main.question}</p> : null}
            </div>
          </section>

          <section className="r-sec">
            <h2>
              מהבעיה לפתרון <span className="r-sub">שלושת התקדימים הקרובים, לפי אחוז ההתאמה לאתר</span>
            </h2>
            <ol className="r-chain">{top.slice(0, onFirst).map((m, i) => chain(m, i))}</ol>
            {!top.length ? <p>אין עדיין מקרים קרובים מספיק. בוחרים בעיה ומאפייני אתר בפרויקט.</p> : null}
          </section>
          <footer className="r-page">1 / 2</footer>
        </article>

        <article className="a4" aria-label="עמוד 2">
          {top[2] && onFirst < 3 ? (
            <section className="r-sec">
              <ol className="r-chain" start={3}>{chain(top[2], 2)}</ol>
            </section>
          ) : null}
          {best ? (
            <section className="r-sec">
              <h2>החתך: היום ומוצע</h2>
              <div className="r-sections">
                <figure>
                  <MiniSection bands={site.section} />
                  <figcaption><span className="mono">היום</span> רכב <b data-tone="stop">{carShare(site.section)}%</b></figcaption>
                </figure>
                <figure>
                  <MiniSection bands={proposal} />
                  <figcaption><span className="mono">בהשראת {best.c.name}</span> רכב <b data-tone="go">{carShare(proposal)}%</b></figcaption>
                </figure>
              </div>
            </section>
          ) : null}

          <section className="r-sec">
            <h2>תוכנית בשלבים</h2>
            <div className="r-phases">
              {(['quick', 'medium', 'long'] as Phase[]).map((ph) => (
                <div key={ph}>
                  <h3>{PHASE_LABEL[ph]}</h3>
                  <ul>
                    {plan[ph].slice(0, 2).map((r) => (
                      <li key={r.move.id}>
                        <b>{r.move.title}</b>
                        <span>{first(r.move.text)}</span>
                        <span className="mono">{r.cases.length} מקרים</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </section>


          <section className="r-sec r-reco">
            <h2>המלצה והצעד הבא</h2>
            <Editable
              k="next"
              text={best ? `להתחיל בכיוון של ${best.c.name} כפיילוט זמני ברחוב אחד: ${moveById(best.c.moves[0])?.title ?? 'ניסוי'}. למדוד לפני ואחרי: שוהים, הולכים, תנועה וטמפרטורה, ואז להחליט על ביצוע קבוע.` : 'הצעד הבא.'}
              doc={doc}
              onEdit={edit}
              className="r-reco-text"
            />
          </section>

          <footer className="r-foot">
            <p>
              <b>על מה הדוח נשען.</b> נתוני הרחוב: OpenStreetMap ({st ? `${osmN} מתוך 6 שדות מופו, השאר משוערים לפי סוג הדרך` : 'לא נבחר מיקום'}). קריאת התמונה: מדד המבט הירוק (GVI){site.mix ? `, אמינות ${site.mix.reliability}` : ''}. ההתאמה: ציון שקוף משישה רכיבים מול {all.length} מקרים, שעובדותיהם נבדקו מול מקורות. נקודת פתיחה לשיקול דעת מקצועי, לא המלצה מחייבת.
            </p>
            <span className="mono">אד' ענת שטיבלמן A&amp;I</span>
            <span className="r-page">2 / 2</span>
          </footer>
        </article>
      </div>
    </main>
  );
}
