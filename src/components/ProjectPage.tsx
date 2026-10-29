import { AnimatePresence, motion } from 'framer-motion';
import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { CASES, CLIMATES, CONTEXTS, SCALES, type Band } from '../data/cases';
import { COST_LABEL, PHASE_LABEL, type Phase } from '../data/moves';
import { PROBLEMS, problemById } from '../data/problems';
import { useBoard } from '../lib/board';
import { climateAt, contextFrom, HIGHWAY_LABEL, reversePlace, searchPlace, sectionFrom, streetAt, type Place, type StreetData } from '../lib/gis';
import { analyseImage, readMix } from '../lib/imageAnalysis';
import { DEFAULT_SITE, PART_LABEL, rank, similarity, strategy, transform, WEIGHTS, type Part, type Site } from '../lib/match';
import { useProjects } from '../lib/projects';
import { go, linkProps, type Route } from '../lib/route';
import { casesLike, guessProblems } from '../lib/textProblem';
import Flag from './Flag';
import { carShare, MiniSection } from './Section';
import SectionCanvas from './SectionCanvas';
import SitePhoto from './SitePhoto';

// Leaflet and its tiles load only when the project page is opened.
const SiteMap = lazy(() => import('./SiteMap'));

export const PART_COLOR: Record<Part, string> = {
  problem: '#17191c',
  climate: '#a8641f',
  section: '#2b6a88',
  scale: '#5b4f8a',
  context: '#44703f',
  budget: '#8d8a84',
};

function Choice<T extends string | number>({ label, value, options, onChange, hint }: { label: string; value: T; options: { id: T; label: string }[]; onChange: (v: T) => void; hint?: string }) {
  return (
    <div className="field">
      <span className="field-label">
        {label}
        {hint ? <span className="hint-tag">{hint}</span> : null}
      </span>
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

const SRC = { osm: 'OSM', est: 'משוער' } as const;
function Fact({ k, v, src }: { k: string; v: React.ReactNode; src?: 'osm' | 'est' }) {
  return (
    <div className="fact-row">
      <dt>{k}</dt>
      <dd>
        <b>{v}</b>
        {src ? <span className={`src-tag ${src}`} title={src === 'osm' ? 'נמדד או מופה ב-OpenStreetMap' : 'הערכה לפי סוג הדרך, לבדוק בשטח'}>{SRC[src]}</span> : null}
      </dd>
    </div>
  );
}

function StreetFacts({ s }: { s: StreetData }) {
  return (
    <dl className="facts-grid">
      <Fact k="רחוב" v={s.name || 'ללא שם במפה'} />
      <Fact k="סוג הדרך" v={HIGHWAY_LABEL[s.highway] ?? s.highway} src="osm" />
      <Fact k="נתיבי נסיעה" v={s.lanes.v} src={s.lanes.src} />
      <Fact k="רוחב המיסעה" v={`${s.width.v} מ'`} src={s.width.src} />
      <Fact k="מדרכות" v={s.sidewalk.v === 'both' ? 'משני הצדדים' : s.sidewalk.v === 'one' ? 'בצד אחד' : 'אין'} src={s.sidewalk.src} />
      <Fact k="רוחב מדרכה" v={`${s.sidewalkWidth.v} מ'`} src={s.sidewalkWidth.src} />
      <Fact k="חניה ברחוב" v={s.parking.v ? 'יש' : 'אין'} src={s.parking.src} />
      <Fact k="שביל אופניים" v={s.cycleway.v ? 'יש' : 'אין'} src={s.cycleway.src} />
      {s.maxspeed ? <Fact k="מהירות מותרת" v={`${s.maxspeed.v} קמ"ש`} src="osm" /> : null}
      <Fact k="עצים ממופים ב-40 מ'" v={s.trees} src="osm" />
      <Fact k="מים בטווח 300 מ'" v={s.water ? 'כן' : 'לא'} src="osm" />
    </dl>
  );
}

const sameBands = (a: Band[], b: Band[]) => JSON.stringify(a) === JSON.stringify(b);

type CheckState = 'idle' | 'running' | 'done';

export default function ProjectPage({ route }: { route: Route }) {
  const projects = useProjects();
  const board = useBoard();
  const current = projects.items.find((p) => p.id === route.p) ?? projects.items[0];
  const [site, setSite] = useState<Site | null>(current?.site ?? null);
  const [status, setStatus] = useState('');
  const timer = useRef<number>();
  const siteRef = useRef(site);
  siteRef.current = site;

  useEffect(() => {
    if (!current) {
      const p = projects.create();
      go({ view: 'project', p: p.id }, true);
    } else if (route.p !== current.id) go({ view: 'project', p: current.id }, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current?.id]);

  useEffect(() => setSite(current?.site ?? null), [current?.id]);

  // Reads the latest site, so async results (map, photo) never overwrite a newer edit.
  const update = (patch: Partial<Site>) => {
    const base = siteRef.current;
    if (!base || !current) return;
    const next = { ...base, ...patch };
    siteRef.current = next;
    setSite(next);
    setStatus('שומר...');
    clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      setStatus(projects.save(current.id, next) ? 'נשמר במכשיר' : 'המכשיר לא שמר: האחסון מלא או חסום. נסו תמונה קטנה יותר');
    }, 350);
  };
  const flush = () => {
    if (!current || !siteRef.current) return;
    clearTimeout(timer.current);
    projects.save(current.id, siteRef.current);
  };

  // Place: search by address or click on the map; then the street is read from OpenStreetMap.
  const [query, setQuery] = useState('');
  const [found, setFound] = useState<Place[]>([]);
  const [gisMsg, setGisMsg] = useState('');
  const placeAt = async (lat: number, lon: number, label?: string) => {
    const s0 = siteRef.current;
    if (!s0) return;
    update({ lat, lon, address: label ?? s0.address, climate: climateAt(lat, lon), street: undefined });
    setFound([]);
    setGisMsg('קורא את נתוני הרחוב מ-OpenStreetMap...');
    if (!label) reversePlace(lat, lon).then((a) => a && update({ address: a })).catch(() => undefined);
    try {
      const street = await streetAt(lat, lon);
      const s1 = siteRef.current!;
      const patch: Partial<Site> = { street };
      const ctx = contextFrom(street);
      if (ctx) patch.context = ctx;
      // The section is rebuilt from the data only while it is still the default one.
      if (street && sameBands(s1.section, DEFAULT_SITE.section)) patch.section = sectionFrom(street);
      update(patch);
      setGisMsg(street ? '' : 'לא נמצא רחוב ממופה ליד הנקודה. אפשר ללחוץ קרוב יותר לציר הרחוב.');
    } catch {
      update({ street: null });
      setGisMsg('שירות הנתונים של OpenStreetMap לא ענה. המיקום נשמר, ואפשר לנסות שוב.');
    }
  };
  const doSearch = async () => {
    if (!query.trim()) return;
    setGisMsg('מחפש כתובת...');
    try {
      const r = await searchPlace(query);
      setFound(r);
      setGisMsg(r.length ? '' : 'לא נמצאה כתובת כזו.');
      if (r.length === 1) placeAt(r[0].lat, r[0].lon, r[0].label);
    } catch {
      setGisMsg('חיפוש הכתובות לא ענה. אפשר ללחוץ על המפה.');
    }
  };

  // Photo: read its colours as soon as it is added.
  useEffect(() => {
    if (!site?.photo || site.mix) return;
    analyseImage(site.photo)
      .then((mix) => update({ mix }))
      .catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [site?.photo]);

  const guesses = useMemo(() => guessProblems(site?.problemText ?? ''), [site?.problemText]);
  const alike = useMemo(() => casesLike(site?.problemText ?? ''), [site?.problemText]);
  const matches = useMemo(() => (site ? rank(site) : []), [site]);
  const plan = useMemo(() => (site ? strategy(site, matches) : { quick: [], medium: [], long: [] }), [site, matches]);

  // The check: real computations shown one after the other, so the planner sees the input turn into output.
  const [check, setCheck] = useState<CheckState>(current?.site.checkedAt ? 'done' : 'idle');
  useEffect(() => setCheck(current?.site.checkedAt ? 'done' : 'idle'), [current?.id]);
  const [stepN, setStepN] = useState(0);
  const runCheck = () => {
    setCheck('running');
    setStepN(0);
    let n = 0;
    const id = window.setInterval(() => {
      n++;
      setStepN(n);
      if (n >= 5) {
        clearInterval(id);
        setCheck('done');
        // Problems the words and the photo point to are added if the planner chose none.
        const s = siteRef.current;
        update({ checkedAt: new Date().toISOString() });
        if (s && !s.problems.length) {
          const fromText = guesses.filter((g) => g.pct >= 25).map((g) => g.id);
          const fromPhoto = s.mix ? readMix(s.mix).flatMap((r) => (r.problem ? [r.problem] : [])) : [];
          const pick = [...new Set([...fromText, ...fromPhoto])].slice(0, 3);
          if (pick.length) update({ problems: pick });
        }
        setTimeout(() => document.getElementById('results')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 120);
      }
    }, 480);
  };

  const [copied, setCopied] = useState('');
  if (!site || !current) return <main className="page" />;

  const best = matches[0];
  const proposal = best ? transform(site.section, best.c) : site.section;
  const toggleProblem = (id: string) => update({ problems: site.problems.includes(id) ? site.problems.filter((p) => p !== id) : [...site.problems, id] });
  const mixRead = site.mix ? readMix(site.mix) : [];
  const sims = CASES.map((c) => ({ c, s: similarity(site.section, c.section.before) })).sort((a, b) => b.s - a.s);
  const placed = site.lat != null;

  const steps: { title: string; ok: boolean; note: string }[] = [
    { title: 'המקום', ok: placed, note: placed ? (site.street ? `${site.street.name || 'רחוב'}: נתונים מהמפה` : 'מיקום נקבע') : 'חסר מיקום' },
    { title: 'הבעיה', ok: !!(site.problems.length || site.problemText), note: site.problems.length ? `${site.problems.length} בעיות נבחרו` : site.problemText ? 'ניסוח בלבד' : 'חסר ניסוח' },
    { title: 'התמונה', ok: !!site.photo, note: site.mix ? `צמחייה ${site.mix.green}%` : site.photo ? 'נקראת' : 'אופציונלי' },
    { title: 'החתך', ok: !sameBands(site.section, DEFAULT_SITE.section), note: `רכב ${carShare(site.section)}%` },
    { title: 'הבדיקה', ok: check === 'done', note: check === 'done' && best ? `התאמה עליונה ${best.score}%` : 'טרם הורצה' },
  ];

  const checks = [
    { title: 'קריאת התמונה', tool: 'מדד המבט הירוק (GVI, Treepedia, MIT)', res: site.mix ? `צמחייה ${site.mix.green}%, משטח קשה ${site.mix.hard}%, שמיים ${site.mix.sky}%. אמינות ${site.mix.reliability}.` : 'לא הועלתה תמונה: הבדיקה ממשיכה בלעדיה.', tone: site.mix ? 'go' : 'wait' },
    { title: 'נתוני המיקום', tool: 'OpenStreetMap, Overpass API', res: site.street ? `${HIGHWAY_LABEL[site.street.highway] ?? site.street.highway}, ${site.street.lanes.v} נתיבים, ${site.street.trees} עצים ממופים. אקלים: ${CLIMATES.find((c) => c.id === site.climate)?.label}.` : placed ? 'המיקום נקבע, נתוני הרחוב לא התקבלו.' : 'לא נבחר מיקום: אקלים והקשר לפי הבחירה הידנית.', tone: site.street ? 'go' : 'wait' },
    { title: 'זיהוי הבעיה מהניסוח', tool: 'התאמת מילים למילון הבעיות', res: guesses.length ? guesses.slice(0, 3).map((g) => `${problemById(g.id)?.title} ${g.pct}%`).join(', ') : site.problems.length ? 'לפי הבעיות שנבחרו.' : 'אין ניסוח ואין בחירה.', tone: guesses.length || site.problems.length ? 'go' : 'stop' },
    { title: `השוואת החתך ל-${CASES.length} מקרים`, tool: 'דמיון קוסינוס של פרופיל הרוחב', res: `הכי דומה: ${sims[0].c.name} (${Math.round(sims[0].s * 100)}%). שטח הרכב אצלך: ${carShare(site.section)}%.`, tone: 'go' },
    { title: 'דירוג ההתאמה', tool: 'ציון שקוף משישה רכיבים', res: best ? `${best.c.name}: ${best.score}%. אחריו ${matches[1]?.c.name} ${matches[1]?.score}%.` : '', tone: best && best.score >= 60 ? 'go' : 'wait' },
  ] as const;

  const copyBrief = async () => {
    const lines = [
      `תדריך השראה: ${site.name || 'פרויקט ללא שם'}`,
      site.problemText ? `הבעיה: ${site.problemText}` : '',
      `בעיות: ${site.problems.map((p) => problemById(p)?.title).join(', ') || 'לא נבחרו'}`,
      ...matches.slice(0, 5).map((m, i) => `${i + 1}. ${m.c.name} (${m.c.nameEn}), ${m.c.city}. התאמה ${m.score}%. ${m.c.insight}`),
      location.href,
    ].filter(Boolean);
    try {
      await navigator.clipboard.writeText(lines.join('\n'));
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
          <input value={site.name} placeholder="למשל: רחוב הרצל, אשדוד" onChange={(e) => update({ name: e.target.value })} />
        </label>
        <p className="lede">
          <b>מהקלט לדוח.</b> מסמנים את המקום במפה, מעלים תמונה, מנסחים את הבעיה ומודדים את החתך. <mark>הבדיקה קוראת את כל אלה, משווה ל-{CASES.length} מקרים ומדרגת אותם באחוזי התאמה</mark>, ומהם נבנה דוח A4 להצגה בפני המהנדס.
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

      <ol className="pipeline" aria-label="שלבי התהליך">
        {steps.map((s, i) => (
          <li key={s.title} data-ok={s.ok}>
            <span className="mono">{String(i + 1).padStart(2, '0')}</span>
            <b>{s.title}</b>
            <span>{s.note}</span>
          </li>
        ))}
        <li data-ok={check === 'done'} className="out">
          <span className="mono">06</span>
          <b>הדוח</b>
          <span>{check === 'done' ? 'מוכן להפקה' : 'אחרי הבדיקה'}</span>
        </li>
      </ol>

      <section className="step">
        <div className="step-head">
          <span className="mono">01</span>
          <h2>המקום</h2>
          <p>מחפשים כתובת או לוחצים על המפה, על ציר הרחוב. <b>הנקודה מביאה נתונים אמיתיים</b>: סוג הדרך, נתיבים, רוחב, מדרכות, חניה, עצים ומים, ומהם גם את האקלים.</p>
        </div>
        <div className="place-search">
          <input
            type="search"
            value={query}
            placeholder="כתובת, למשל: הרצל, אשדוד"
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && doSearch()}
            aria-label="חיפוש כתובת"
          />
          <button type="button" className="btn small" onClick={doSearch}>חיפוש</button>
        </div>
        {found.length > 1 ? (
          <ul className="place-results">
            {found.map((f) => (
              <li key={`${f.lat},${f.lon}`}>
                <button type="button" onClick={() => placeAt(f.lat, f.lon, f.label)}>{f.label}</button>
              </li>
            ))}
          </ul>
        ) : null}
        <div className="place-grid">
          <Suspense fallback={<div className="site-map" />}>
            <SiteMap lat={site.lat} lon={site.lon} onPick={(la, lo) => placeAt(la, lo)} />
          </Suspense>
          <div className="place-data">
            {placed ? <p className="address"><span className="mono">מיקום</span> {site.address || `${site.lat}, ${site.lon}`}</p> : <p className="muted">לא נבחר מיקום.</p>}
            {gisMsg ? <p className="status" role="status">{gisMsg}</p> : null}
            {site.street ? (
              <>
                <StreetFacts s={site.street} />
                <p className="src-note">
                  <span className="src-tag osm">OSM</span> מופה ב-OpenStreetMap. <span className="src-tag est">משוער</span> הערכה לפי סוג הדרך: לבדוק בשטח.
                </p>
                <button type="button" className="btn ghost small" onClick={() => update({ section: sectionFrom(site.street!) })} title="מחליף את החתך בשלב 04 בחתך שנבנה מנתוני המפה">
                  בניית החתך מנתוני המפה
                </button>
              </>
            ) : null}
          </div>
        </div>
      </section>

      <section className="step">
        <div className="step-head">
          <span className="mono">02</span>
          <h2>הבעיה</h2>
          <p>במילים שלך, כמו שהיית מסבירה למהנדס. <b>הניסוח מזהה את סוג הבעיה</b>, והתמונה נקראת לפי הצבעים שבה.</p>
        </div>
        <div className="problem-grid">
          <div className="problem-text">
            <label className="field-label" htmlFor="ptext">ניסוח הבעיה</label>
            <textarea
              id="ptext"
              rows={5}
              value={site.problemText ?? ''}
              placeholder="למשל: הרחוב מלא ברכבים חונים, המדרכות צרות ואין צל. בקיץ אי אפשר ללכת, ובגשם הצומת מוצף."
              onChange={(e) => update({ problemText: e.target.value })}
            />
            {guesses.length ? (
              <div className="guesses">
                <span className="field-label">הניסוח מצביע על</span>
                <ul>
                  {guesses.slice(0, 4).map((g) => {
                    const p = problemById(g.id)!;
                    const on = site.problems.includes(g.id);
                    return (
                      <li key={g.id} style={{ '--c': p.color } as React.CSSProperties}>
                        <button type="button" className="guess" aria-pressed={on} onClick={() => toggleProblem(g.id)} title={on ? 'נבחרה. לחיצה מסירה' : 'לחיצה מוסיפה לבעיות הפרויקט'}>
                          <span className="bar"><i style={{ width: `${g.pct}%` }} /></span>
                          <b>{p.title}</b>
                          <span className="mono">{g.pct}%</span>
                        </button>
                        <span className="hits">לפי המילים: {g.hits.slice(0, 5).join(', ')}</span>
                      </li>
                    );
                  })}
                </ul>
                <p className="src-note">התאמת מילים למילון הבעיות, לא הבנת שפה. הבחירה הסופית שלך.</p>
              </div>
            ) : null}
            {alike.length ? (
              <div className="alike">
                <span className="field-label">מקרים שתוארו במילים דומות</span>
                <ul>
                  {alike.map(({ c }) => (
                    <li key={c.id}>
                      <a {...linkProps({ view: 'case', case: c.id })}><Flag country={c.countryEn} label={c.country} /> {c.name}</a>
                      <span>{c.insight}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
          <div className="problem-photo">
            <span className="field-label">תמונה של הבעיה</span>
            <SitePhoto photo={site.photo} onChange={(photo) => update({ photo, mix: undefined })} />
            {site.mix ? (
              <div className="mix">
                <div className="mix-bar" aria-label="הרכב התמונה">
                  <i className="g" style={{ width: `${site.mix.green}%` }} title={`צמחייה ${site.mix.green}%`} />
                  <i className="h" style={{ width: `${site.mix.hard}%` }} title={`משטח קשה ${site.mix.hard}%`} />
                  <i className="s" style={{ width: `${site.mix.sky}%` }} title={`שמיים ${site.mix.sky}%`} />
                  <i className="o" style={{ width: `${site.mix.other}%` }} title={`אחר ${site.mix.other}%`} />
                </div>
                <ul className="mix-legend">
                  <li><i className="g" />צמחייה <b>{site.mix.green}%</b></li>
                  <li><i className="h" />משטח קשה <b>{site.mix.hard}%</b></li>
                  <li><i className="s" />שמיים <b>{site.mix.sky}%</b></li>
                  <li><i className="o" />מבנים ואחר <b>{site.mix.other}%</b></li>
                </ul>
                <ul className="reading">
                  {mixRead.map((r) => (
                    <li key={r.text} data-tone={r.tone}>{r.text}</li>
                  ))}
                </ul>
                <p className="src-note">שיטת מדד המבט הירוק (Green View Index, MIT Treepedia): צבע הפיקסלים, לא זיהוי עצמים. אמינות {site.mix.reliability}. {site.mix.note}</p>
              </div>
            ) : null}
          </div>
        </div>
        <div className="field">
          <span className="field-label">הבעיות של הפרויקט. הראשונה שנבחרת היא העיקרית.</span>
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
      </section>

      <section className="step">
        <div className="step-head">
          <span className="mono">03</span>
          <h2>המאפיינים</h2>
          <p>מה שהמיקום כבר קבע מסומן <span className="hint-tag">לפי המיקום</span>. אפשר לשנות.</p>
        </div>
        <div className="fields">
          <Choice label="קנה מידה" value={site.scale} options={SCALES} onChange={(scale) => update({ scale })} />
          <Choice label="אקלים" value={site.climate} options={CLIMATES} onChange={(climate) => update({ climate })} hint={placed && site.climate === climateAt(site.lat!, site.lon!) ? 'לפי המיקום' : undefined} />
          <Choice label="הקשר" value={site.context} options={CONTEXTS} onChange={(context) => update({ context })} hint={site.street?.water && site.context === 'waterfront' ? 'לפי המיקום' : undefined} />
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
          <span className="mono">04</span>
          <h2>החתך הקיים, במטרים</h2>
          <p>{site.street ? <>נבנה מנתוני המפה. </> : null}המידות על השרטוט עצמו: <b>גוררים גבול בין רצועות</b>, לוחצים על רצועה כדי לשנות שימוש ורוחב, או משנים את הרוחב הכולל.</p>
        </div>
        <SectionCanvas bands={site.section} onChange={(section) => update({ section })} />
      </section>

      <section className="step check-step">
        <div className="step-head">
          <span className="mono">05</span>
          <h2>הבדיקה</h2>
          <p>חמש בדיקות, כל אחת על כלי מוכר. <b>כל שורה מראה מה נקרא מהקלט ומה יצא ממנו.</b></p>
        </div>
        <button type="button" className="btn run" onClick={runCheck} disabled={check === 'running'}>
          {check === 'running' ? 'בודק...' : check === 'done' ? 'הרצת הבדיקה מחדש' : 'הרצת הבדיקה'}
        </button>
        <ol className="checks">
          {checks.map((c, i) => {
            const state = check === 'done' || (check === 'running' && stepN > i) ? 'done' : check === 'running' && stepN === i ? 'run' : 'wait';
            return (
              <li key={c.title} data-state={state} data-tone={state === 'done' ? c.tone : undefined}>
                <span className="mono">{String(i + 1).padStart(2, '0')}</span>
                <div>
                  <b>{c.title}</b>
                  <span className="tool">{c.tool}</span>
                  <AnimatePresence>
                    {state === 'done' ? (
                      <motion.p initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
                        {c.res}
                      </motion.p>
                    ) : null}
                  </AnimatePresence>
                </div>
                <span className="state">{state === 'done' ? 'הושלם' : state === 'run' ? 'רץ' : 'ממתין'}</span>
              </li>
            );
          })}
        </ol>
      </section>

      {check === 'done' ? (
        <div id="results" className="results">
          <section className="step">
            <div className="step-head">
              <span className="mono">06</span>
              <h2>התוצאות: המקרים הקרובים</h2>
              <p>אחוז ההתאמה מורכב משישה רכיבים: {(Object.keys(WEIGHTS) as Part[]).map((k) => `${PART_LABEL[k]} ${WEIGHTS[k]}`).join(', ')}. <b>ההתאמה מתעדכנת עם כל שינוי בקלט.</b></p>
            </div>
            <ul className="part-legend">
              {(Object.keys(WEIGHTS) as Part[]).map((k) => (
                <li key={k}><span className="swatch" style={{ background: PART_COLOR[k] }} />{PART_LABEL[k]}</li>
              ))}
            </ul>
            <ol className="matches">
              {matches.slice(0, 6).map((m, i) => (
                <motion.li key={m.c.id} layout initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: i * 0.05 }}>
                  <a className="match" {...linkProps({ view: 'case', case: m.c.id })}>
                    <span className="match-score" data-tone={m.score >= 70 ? 'go' : m.score >= 50 ? 'wait' : 'stop'}>{m.score}%</span>
                    <div className="match-body">
                      <b><Flag country={m.c.countryEn} label={m.c.country} /> {m.c.name}</b>
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
              <span className="mono">07</span>
              <h2>אסטרטגיה מדורגת</h2>
              <p>המהלכים של המקרים הקרובים, משוקללים לפי ההתאמה.</p>
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
                <span className="mono">08</span>
                <h2>כיוון אפשרי לחתך</h2>
                <p>החתך שלך, מחולק מחדש לפי היחסים של {best.c.name}. סקיצה לדיון, לא תכנון.</p>
              </div>
              <div className="compare-sections">
                <figure>
                  <MiniSection bands={site.section} />
                  <figcaption><span className="mono">היום</span> רכב <b>{carShare(site.section)}%</b></figcaption>
                </figure>
                <figure>
                  <MiniSection bands={proposal} />
                  <figcaption><span className="mono">בהשראת {best.c.name}</span> רכב <b>{carShare(proposal)}%</b></figcaption>
                </figure>
              </div>
              <button type="button" className="btn ghost small" onClick={() => update({ section: proposal })}>אימוץ החתך כנקודת פתיחה</button>
            </section>
          ) : null}

          <section className="step">
            <div className="step-head">
              <span className="mono">09</span>
              <h2>מה עלול להשתבש</h2>
              <p>מה נכשל או שנוי במחלוקת בשלושת המקרים הקרובים.</p>
            </div>
            <ul className="risks">
              {matches.slice(0, 3).map((m) => (
                <li key={m.c.id} data-tone="stop">
                  <b><Flag country={m.c.countryEn} label={m.c.country} /> {m.c.name}</b>
                  <p>{m.c.cautions}</p>
                </li>
              ))}
            </ul>
          </section>

          <div className="report-cta">
            <div>
              <b>הדוח</b>
              <p>שני עמודי A4: האבחון, מהבעיה לפתרון עם יתרונות, חסרונות ושדרוג לאתר שלך, החתך המוצע, שלבים והמלצה. כל טקסט בו ניתן לעריכה.</p>
            </div>
            <button
              type="button"
              className="btn"
              onClick={() => {
                flush();
                go({ view: 'doc', p: current.id });
              }}
              disabled={!site.problems.length}
              title={site.problems.length ? 'דוח A4 מזוקק להצגה בפני המהנדס' : 'בחרו קודם בעיה'}
            >
              הפקת דוח A4
            </button>
          </div>
          <div className="board-actions project-actions">
            <button type="button" className="btn ghost small" onClick={copyBrief} title="מעתיק תקציר טקסט של הפרויקט והמקרים הקרובים">העתקת תקציר</button>
            <button type="button" className="btn ghost small" onClick={() => board.add(matches.slice(0, 3).map((m) => m.c.id))} title="שומר את שלושת המקרים הקרובים בלוח ההשראה">שלושת הקרובים ללוח</button>
            <button type="button" className="btn ghost small" onClick={() => go({ view: 'compare', ids: matches.slice(0, 3).map((m) => m.c.id) })}>השוואת שלושת הקרובים</button>
            <span className="status" role="status">{copied}</span>
          </div>
        </div>
      ) : (
        <p className="results-wait">התוצאות, אחוזי ההתאמה והדוח יופיעו אחרי הבדיקה.</p>
      )}
      <p className="note">
        השיטה: ספריית תקדימים ושפת דפוסים (Christopher Alexander, A Pattern Language). נתוני המקום מ-OpenStreetMap, קריאת התמונה בשיטת מדד המבט הירוק. ההתאמה היא חישוב שקוף, לא המלצה מחייבת: היא לא מחליפה ביקור באתר, ספירות תנועה ושיתוף ציבור.
      </p>
    </main>
  );
}
