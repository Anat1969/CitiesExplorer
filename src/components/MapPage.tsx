import { geoDistance, geoGraticule10, geoOrthographic, geoPath } from 'd3-geo';
import { useEffect, useMemo, useRef, useState } from 'react';
import { feature } from 'topojson-client';
import world from 'world-atlas/countries-110m.json';
import { CASES, type Case } from '../data/cases';
import { PROBLEMS, problemById } from '../data/problems';
import { go, linkProps } from '../lib/route';
import Flag from './Flag';

const W = 960;
const H = 600;
const R = 280;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const LAND = feature(world as any, (world as any).objects.countries) as unknown as GeoJSON.FeatureCollection;
const GRID = geoGraticule10();

type Zoom = 'world' | 'europe' | 'israel';
/** Each view is a rotation of the globe (the point that faces us) and a zoom factor. */
const ZOOM: Record<Zoom, { label: string; lon: number; lat: number; k: number }> = {
  world: { label: 'העולם', lon: 20, lat: 25, k: 1 },
  europe: { label: 'אירופה', lon: 8, lat: 49, k: 3.4 },
  israel: { label: 'ישראל', lon: 34.9, lat: 31.6, k: 26 },
};

const YEARS = CASES.map((c) => c.yearStart).filter(Boolean);
const FIRST = Math.min(...YEARS);
const LAST = 2026;

function Timeline({ onHover, onPick, active, year }: { onHover: (c: Case | null) => void; onPick: (c: Case) => void; active: string | null; year: number }) {
  const from = Math.floor(FIRST / 10) * 10;
  const to = 2030;
  const TW = 960;
  const lane = 30;
  const TH = PROBLEMS.length * lane + 40;
  // Time runs right to left, like the Hebrew text around it.
  const x = (y: number) => TW - 190 - ((y - from) / (to - from)) * (TW - 220);
  return (
    <svg viewBox={`0 0 ${TW} ${TH}`} direction="rtl" className="timeline" role="img" aria-label="ציר זמן של המקרים לפי בעיה">
      <rect x={x(year)} y={6} width={x(from) - x(year)} height={TH - 28} fill="url(#past)" />
      <defs>
        <linearGradient id="past" x1="1" y1="0" x2="0" y2="0">
          <stop offset="0" stopColor="#e9e6df" stopOpacity="0.2" />
          <stop offset="1" stopColor="#d9d4c9" stopOpacity="0.55" />
        </linearGradient>
      </defs>
      {Array.from({ length: (to - from) / 10 + 1 }, (_, i) => from + i * 10).map((y) => (
        <g key={y}>
          <line x1={x(y)} x2={x(y)} y1={10} y2={TH - 24} stroke="#d6d3cc" />
          <text x={x(y)} y={TH - 8} textAnchor="middle" className="axis">{y}</text>
        </g>
      ))}
      {PROBLEMS.map((p, i) => (
        <g key={p.id}>
          <text x={TW - 10} y={22 + i * lane + 4} textAnchor="start" className="lane-label" style={{ fill: p.color }}>{p.title}</text>
          <line x1={20} x2={TW - 180} y1={22 + i * lane} y2={22 + i * lane} stroke={p.color} strokeOpacity={0.18} />
        </g>
      ))}
      {CASES.map((c) => {
        const i = PROBLEMS.findIndex((p) => p.id === c.problems[0]);
        const p = PROBLEMS[i];
        if (!p) return null;
        const future = c.yearStart > year;
        return (
          <a
            key={c.id}
            {...linkProps({ view: 'case', case: c.id })}
            onClick={(e) => {
              // A click turns the globe to the case; the card beside it links to the case page.
              e.preventDefault();
              onPick(c);
            }}
            onMouseEnter={() => onHover(c)}
            onFocus={() => onHover(c)}
            aria-label={`${c.name}, ${c.years}`}
            className={future ? 'future' : undefined}
          >
            <circle cx={x(c.yearStart)} cy={22 + i * lane} r={active === c.id ? 9 : 6} fill={p.color} stroke="#fbfaf8" strokeWidth={2} />
          </a>
        );
      })}
      <g className="playhead" transform={`translate(${x(year)},0)`}>
        <line y1={4} y2={TH - 24} stroke="#17191c" strokeWidth={2} />
        <rect x={-24} y={TH - 24} width={48} height={20} fill="#17191c" />
        <text y={TH - 9} textAnchor="middle" fill="#fff" className="axis">{year}</text>
      </g>
    </svg>
  );
}

export default function MapPage() {
  const [zoom, setZoom] = useState<Zoom>('world');
  const [hover, setHover] = useState<Case | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [year, setYear] = useState(LAST);
  const [playing, setPlaying] = useState(false);
  const [view, setView] = useState({ lon: ZOOM.world.lon, lat: ZOOM.world.lat, k: 1 });
  const [spin, setSpin] = useState(true);
  const target = useRef<{ lon: number; lat: number; k: number } | null>(null);
  const drag = useRef<{ x: number; y: number; lon: number; lat: number } | null>(null);
  const svg = useRef<SVGSVGElement>(null);
  const reduced = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;

  // One animation loop: ease toward a target view, or turn slowly like the earth (west to east).
  useEffect(() => {
    let raf = 0;
    let t0 = performance.now();
    const tick = (t: number) => {
      const dt = Math.min(t - t0, 50);
      t0 = t;
      setView((v) => {
        const g = target.current;
        if (g) {
          const dLon = ((g.lon - v.lon + 540) % 360) - 180;
          const n = { lon: v.lon + dLon * 0.12, lat: v.lat + (g.lat - v.lat) * 0.12, k: v.k + (g.k - v.k) * 0.12 };
          if (Math.abs(dLon) < 0.05 && Math.abs(g.lat - v.lat) < 0.05 && Math.abs(g.k - v.k) < 0.01) {
            target.current = null;
            return g;
          }
          return n;
        }
        if (spin && !drag.current && !reduced) return { ...v, lon: v.lon + dt * 0.006 };
        return v;
      });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [spin, reduced]);

  // The playhead runs through the years; the globe shows what existed by then.
  useEffect(() => {
    if (!playing) return;
    const id = window.setInterval(() => {
      setYear((y) => {
        if (y >= LAST) {
          setPlaying(false);
          return LAST;
        }
        return y + 1;
      });
    }, 160);
    return () => clearInterval(id);
  }, [playing]);

  const flyTo = (lon: number, lat: number, k: number) => {
    target.current = { lon, lat, k };
    setSpin(false);
  };
  const pickZoom = (z: Zoom) => {
    setZoom(z);
    const { lon, lat, k } = ZOOM[z];
    flyTo(lon, lat, k);
    if (z === 'world') setSpin(true);
  };
  const pickCase = (c: Case) => {
    setHover(c);
    flyTo(c.lon, c.lat, Math.max(view.k, 2.4));
  };

  const proj = useMemo(
    () => geoOrthographic().scale(R * view.k).translate([W / 2, H / 2]).rotate([-view.lon, -view.lat]).clipAngle(90),
    [view],
  );
  const path = geoPath(proj);
  const center: [number, number] = [view.lon, view.lat];

  const shown = CASES.filter((c) => c.lat || c.lon).filter((c) => !problem || c.problems.includes(problem));
  // Cases in the same city fan out into a small ring, so every point can be reached.
  const placed = useMemo(() => {
    const pts = shown.map((c) => ({ c, xy: proj([c.lon, c.lat]) as [number, number], far: geoDistance([c.lon, c.lat], center) > Math.PI / 2 - 0.02 }));
    const groups: { x: number; y: number; items: typeof pts }[] = [];
    for (const p of pts) {
      const g = !p.far && groups.find((g) => !g.items[0].far && Math.hypot(g.x - p.xy[0], g.y - p.xy[1]) < 12);
      if (g) g.items.push(p);
      else groups.push({ x: p.xy[0], y: p.xy[1], items: [p] });
    }
    return groups.flatMap((g) =>
      g.items.map((p, k) => {
        if (g.items.length === 1) return { c: p.c, far: p.far, x: g.x, y: g.y, ring: null as null | { x: number; y: number } };
        const a = (k / g.items.length) * Math.PI * 2 - Math.PI / 2;
        const r = 9 + g.items.length * 1.6;
        return { c: p.c, far: p.far, x: g.x + Math.cos(a) * r, y: g.y + Math.sin(a) * r, ring: { x: g.x, y: g.y } };
      }),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [proj, problem]);

  const onDown = (e: React.PointerEvent) => {
    drag.current = { x: e.clientX, y: e.clientY, lon: view.lon, lat: view.lat };
    target.current = null;
    setSpin(false);
  };
  const onMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const box = svg.current?.getBoundingClientRect();
    const s = (box ? W / box.width : 1) * (0.32 / view.k);
    if (Math.hypot(e.clientX - d.x, e.clientY - d.y) > 3) svg.current?.setPointerCapture?.(e.pointerId);
    setView((v) => ({ ...v, lon: d.lon - (e.clientX - d.x) * s, lat: Math.max(-80, Math.min(80, d.lat + (e.clientY - d.y) * s)) }));
  };
  const onUp = () => {
    drag.current = null;
  };

  const counts = PROBLEMS.map((p) => ({ p, n: CASES.filter((c) => c.problems[0] === p.id).length }));

  return (
    <main className="page">
      <header className="block-head page-head">
        <p className="eyebrow">איפה ומתי</p>
        <h1>מפה וזמן</h1>
        <p>כל נקודה היא מקרה, וצבעה לפי הבעיה העיקרית שהמקרה פתר. הגלובוס מסתובב, ואפשר לגרור אותו. בציר הזמן אפשר להפעיל את השנים ולראות איך הרעיונות התפשטו: מסגירת רחובות בשנות השישים, דרך פירוק כבישים, ועד הסתגלות לאקלים.</p>
      </header>
      <div className="map-tools">
        <div className="filters" role="group" aria-label="תצוגה">
          {(Object.keys(ZOOM) as Zoom[]).map((z) => (
            <button key={z} type="button" aria-pressed={zoom === z} onClick={() => pickZoom(z)}>{ZOOM[z].label}</button>
          ))}
          <button type="button" aria-pressed={spin} title="הגלובוס מסתובב לאט, כמו כדור הארץ" onClick={() => setSpin(!spin)}>
            {spin ? 'עצירת הסיבוב' : 'סיבוב'}
          </button>
        </div>
        <div className="chips" role="group" aria-label="סינון לפי בעיה">
          <button type="button" className="chip" aria-pressed={!problem} onClick={() => setProblem(null)}>כל הבעיות</button>
          {PROBLEMS.map((p) => (
            <button key={p.id} type="button" className="chip" aria-pressed={problem === p.id} style={{ '--c': p.color } as React.CSSProperties} onClick={() => setProblem(problem === p.id ? null : p.id)}>
              {p.title}
            </button>
          ))}
        </div>
      </div>
      <div className="map-layout">
        <div className="map-frame">
          <svg
            ref={svg}
            viewBox={`0 0 ${W} ${H}`}
            className="map globe"
            role="img"
            aria-label="גלובוס עם המקרים"
            onPointerDown={onDown}
            onPointerMove={onMove}
            onPointerUp={onUp}
            onPointerCancel={onUp}
            onMouseEnter={() => zoom === 'world' && !target.current && setSpin(false)}
            onMouseLeave={() => zoom === 'world' && setSpin(true)}
          >
            <defs>
              <radialGradient id="ocean" cx="0.38" cy="0.32" r="0.75">
                <stop offset="0" stopColor="#f6f7f6" />
                <stop offset="0.7" stopColor="#dfe3e1" />
                <stop offset="1" stopColor="#c4cac7" />
              </radialGradient>
              <radialGradient id="shade" cx="0.38" cy="0.32" r="0.72">
                <stop offset="0.55" stopColor="#000" stopOpacity="0" />
                <stop offset="1" stopColor="#000" stopOpacity="0.22" />
              </radialGradient>
              <filter id="halo" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="14" />
              </filter>
            </defs>
            <circle cx={W / 2 + 10} cy={H / 2 + 18} r={R * view.k} fill="#1d2024" opacity={0.18} filter="url(#halo)" />
            <path d={path({ type: 'Sphere' } as unknown as GeoJSON.Feature) ?? ''} fill="url(#ocean)" />
            <path d={path(GRID) ?? ''} fill="none" stroke="#cfd4d1" strokeWidth={0.5} />
            <g>
              {LAND.features.map((f, i) => (
                <path key={i} d={path(f) ?? ''} fill={(f.properties as { name?: string })?.name === 'Israel' ? '#cbbf9f' : '#d2cdc2'} stroke="#f6f5f2" strokeWidth={0.6} />
              ))}
            </g>
            <path d={path({ type: 'Sphere' } as unknown as GeoJSON.Feature) ?? ''} fill="url(#shade)" pointerEvents="none" />
            {placed.map(({ c, x, y, ring, far }) => {
              const p = problemById(c.problems[0]);
              const on = hover?.id === c.id;
              const future = c.yearStart > year;
              return (
                <a
                  key={c.id}
                  {...linkProps({ view: 'case', case: c.id })}
                  className={[far ? 'far' : '', future ? 'future' : ''].join(' ').trim() || undefined}
                  onMouseEnter={() => setHover(c)}
                  onFocus={() => setHover(c)}
                  aria-label={`${c.name}, ${c.city}`}
                  aria-hidden={far || undefined}
                  tabIndex={far ? -1 : undefined}
                >
                  {ring ? <line x1={ring.x} y1={ring.y} x2={x} y2={y} stroke="#6f6c66" strokeWidth={0.8} /> : null}
                  <circle cx={x} cy={y} r={on ? 10 : 6} fill={p?.color} stroke="#fff" strokeWidth={2} />
                </a>
              );
            })}
          </svg>
        </div>
        <aside className="map-side">
          <div className="map-card" role="status">
            {hover ? (
              <>
                <span className="mono">{hover.city}, {hover.country}, {hover.years}</span>
                <b><Flag country={hover.countryEn} label={hover.country} /> {hover.name}</b>
                <p>{hover.insight}</p>
                <button type="button" className="btn small" onClick={() => go({ view: 'case', case: hover.id })}>למקרה</button>
              </>
            ) : (
              <span>{shown.filter((c) => c.yearStart <= year).length} מקרים. מעבר על נקודה מציג את המקרה, לחיצה פותחת אותו.</span>
            )}
          </div>
          <div className="legend map-legend" aria-label="מקרא">
            <span className="mono">מקרא</span>
            <ul>
              {counts.map(({ p, n }) => (
                <li key={p.id}>
                  <i style={{ background: p.color }} />
                  {p.title} <span className="mono">{n}</span>
                </li>
              ))}
              <li>
                <i className="ring-key" />
                קו מהמרכז: כמה מקרים באותה עיר
              </li>
              <li>
                <i className="future-key" />
                שקוף: מקרה שהתחיל אחרי השנה בציר הזמן
              </li>
            </ul>
          </div>
        </aside>
      </div>
      <section className="block">
        <div className="block-head">
          <h2>ציר הזמן</h2>
          <p>לפי שנת ההתחלה של כל מקרה. ההפעלה מריצה את השנים, והגלובוס מציג רק את מה שכבר התחיל. לחיצה על נקודה מסובבת את הגלובוס אליה.</p>
        </div>
        <div className="play-bar">
          <button
            type="button"
            className="btn small"
            onClick={() => {
              if (!playing && year >= LAST) setYear(FIRST);
              setPlaying(!playing);
            }}
          >
            {playing ? 'השהיה' : 'הפעלת ציר הזמן'}
          </button>
          <input
            type="range"
            min={FIRST}
            max={LAST}
            value={year}
            aria-label="שנה"
            onChange={(e) => {
              setPlaying(false);
              setYear(Number(e.target.value));
            }}
          />
          <span className="mono year">{year}</span>
        </div>
        <div className="timeline-wrap">
          <Timeline onHover={setHover} onPick={pickCase} active={hover?.id ?? null} year={year} />
        </div>
      </section>
    </main>
  );
}
