import { geoGraticule10, geoNaturalEarth1, geoPath } from 'd3-geo';
import { motion } from 'framer-motion';
import { useMemo, useState } from 'react';
import { feature } from 'topojson-client';
import world from 'world-atlas/countries-110m.json';
import { CASES, type Case } from '../data/cases';
import { PROBLEMS, problemById } from '../data/problems';
import { go, linkProps } from '../lib/route';

const W = 960;
const H = 500;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const LAND = feature(world as any, (world as any).objects.countries) as unknown as GeoJSON.FeatureCollection;

type Zoom = 'world' | 'europe' | 'israel';
const ZOOM: Record<Zoom, { label: string; box?: [[number, number], [number, number]] }> = {
  world: { label: 'העולם' },
  europe: { label: 'אירופה', box: [[-10, 36], [25, 60]] },
  israel: { label: 'ישראל', box: [[34.2, 29.4], [35.9, 33.4]] },
};

function Timeline({ onHover, active }: { onHover: (c: Case | null) => void; active: string | null }) {
  const years = CASES.map((c) => c.yearStart).filter(Boolean);
  const from = Math.floor(Math.min(...years) / 10) * 10;
  const to = 2030;
  const TW = 960;
  const lane = 30;
  const TH = PROBLEMS.length * lane + 40;
  // Time runs right to left, like the Hebrew text around it.
  const x = (y: number) => TW - 190 - ((y - from) / (to - from)) * (TW - 220);
  return (
    <svg viewBox={`0 0 ${TW} ${TH}`} direction="rtl" className="timeline" role="img" aria-label="ציר זמן של המקרים לפי בעיה">
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
        return (
          <a key={c.id} {...linkProps({ view: 'case', case: c.id })} onMouseEnter={() => onHover(c)} onMouseLeave={() => onHover(null)} onFocus={() => onHover(c)} aria-label={`${c.name}, ${c.years}`}>
            <circle cx={x(c.yearStart)} cy={22 + i * lane} r={active === c.id ? 9 : 6} fill={p.color} stroke="#fbfaf8" strokeWidth={2} />
          </a>
        );
      })}
    </svg>
  );
}

export default function MapPage() {
  const [zoom, setZoom] = useState<Zoom>('world');
  const [hover, setHover] = useState<Case | null>(null);
  const [problem, setProblem] = useState<string | null>(null);

  const { path, proj } = useMemo(() => {
    const proj = geoNaturalEarth1();
    const box = ZOOM[zoom].box;
    if (box) {
      const [[x0, y0], [x1, y1]] = box;
      proj.fitExtent(
        [[20, 20], [W - 20, H - 20]],
        { type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [[[x0, y0], [x1, y0], [x1, y1], [x0, y1], [x0, y0]]] } } as GeoJSON.Feature,
      );
    } else proj.fitExtent([[10, 10], [W - 10, H - 10]], { type: 'Sphere' } as unknown as GeoJSON.Feature);
    return { path: geoPath(proj), proj };
  }, [zoom]);

  const shown = CASES.filter((c) => c.lat || c.lon).filter((c) => !problem || c.problems.includes(problem));
  // Cases in the same city fan out into a small ring, so every point can be reached.
  const placed = useMemo(() => {
    const pts = shown.map((c) => ({ c, xy: proj([c.lon, c.lat]) })).filter((p): p is { c: Case; xy: [number, number] } => !!p.xy);
    const groups: { x: number; y: number; items: typeof pts }[] = [];
    for (const p of pts) {
      const g = groups.find((g) => Math.hypot(g.x - p.xy[0], g.y - p.xy[1]) < 12);
      if (g) g.items.push(p);
      else groups.push({ x: p.xy[0], y: p.xy[1], items: [p] });
    }
    return groups.flatMap((g) =>
      g.items.map((p, k) => {
        if (g.items.length === 1) return { c: p.c, x: g.x, y: g.y, ring: null as null | { x: number; y: number } };
        const a = (k / g.items.length) * Math.PI * 2 - Math.PI / 2;
        const r = 9 + g.items.length * 1.6;
        return { c: p.c, x: g.x + Math.cos(a) * r, y: g.y + Math.sin(a) * r, ring: { x: g.x, y: g.y } };
      }),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [proj, problem]);

  return (
    <main className="page">
      <header className="block-head page-head">
        <p className="eyebrow">איפה ומתי</p>
        <h1>מפה וזמן</h1>
        <p>כל נקודה היא מקרה, וצבעה לפי הבעיה העיקרית שהמקרה פתר. בציר הזמן אפשר לראות איך הרעיונות התפתחו: מסגירת רחובות בשנות השישים, דרך פירוק כבישים, ועד הסתגלות לאקלים.</p>
      </header>
      <div className="map-tools">
        <div className="filters" role="group" aria-label="תצוגה">
          {(Object.keys(ZOOM) as Zoom[]).map((z) => (
            <button key={z} type="button" aria-pressed={zoom === z} onClick={() => setZoom(z)}>{ZOOM[z].label}</button>
          ))}
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
      <div className="map-frame">
        <svg viewBox={`0 0 ${W} ${H}`} className="map" role="img" aria-label="מפת העולם עם המקרים">
          <defs>
            <linearGradient id="sea" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#eef0ef" />
              <stop offset="1" stopColor="#e2e4e2" />
            </linearGradient>
          </defs>
          <rect width={W} height={H} fill="url(#sea)" />
          <path d={path(geoGraticule10()) ?? ''} fill="none" stroke="#d3d6d4" strokeWidth={0.5} />
          <g>
            {LAND.features.map((f, i) => (
              <path key={i} d={path(f) ?? ''} fill={(f.properties as { name?: string })?.name === 'Israel' ? '#d9d3c4' : '#d6d2c9'} stroke="#f6f5f2" strokeWidth={0.6} />
            ))}
          </g>
          {placed.map(({ c, x, y, ring }) => {
            const xy = [x, y];
            const p = problemById(c.problems[0]);
            const on = hover?.id === c.id;
            return (
              <motion.a
                key={c.id}
                {...linkProps({ view: 'case', case: c.id })}
                onMouseEnter={() => setHover(c)}
                onMouseLeave={() => setHover(null)}
                onFocus={() => setHover(c)}
                aria-label={`${c.name}, ${c.city}`}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
              >
                {ring ? <line x1={ring.x} y1={ring.y} x2={xy[0]} y2={xy[1]} stroke="#8d8a84" strokeWidth={0.8} /> : null}
                <circle cx={xy[0]} cy={xy[1]} r={on ? 10 : 6} fill={p?.color} stroke="#fff" strokeWidth={2} style={{ filter: 'drop-shadow(0 2px 3px rgba(0,0,0,.35))' }} />
              </motion.a>
            );
          })}
        </svg>
        <div className="map-card" role="status">
          {hover ? (
            <>
              <span className="mono">{hover.city}, {hover.country}, {hover.years}</span>
              <b>{hover.name}</b>
              <p>{hover.insight}</p>
              <button type="button" className="btn small" onClick={() => go({ view: 'case', case: hover.id })}>למקרה</button>
            </>
          ) : (
            <span>{shown.length} מקרים. מעבר על נקודה מציג את המקרה.</span>
          )}
        </div>
      </div>
      <section className="block">
        <div className="block-head">
          <h2>ציר הזמן</h2>
          <p>לפי שנת ההתחלה של כל מקרה.</p>
        </div>
        <div className="timeline-wrap">
          <Timeline onHover={setHover} active={hover?.id ?? null} />
        </div>
      </section>
    </main>
  );
}
