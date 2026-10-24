import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import type { Band, BandType } from '../data/cases';

export const BAND_LABEL: Record<BandType, string> = {
  building: 'מבנים',
  walk: 'הולכי רגל',
  car: 'רכב',
  bike: 'אופניים',
  green: 'צמחייה',
  water: 'מים',
  rail: 'מסילה',
  transit: 'תחבורה ציבורית',
  plaza: 'רחבה',
  shade: 'צל בנוי',
  play: 'משחק וספורט',
};

export const BAND_COLOR: Record<BandType, string> = {
  building: '#c9c6bf',
  walk: '#e4e0d6',
  car: '#4a4e55',
  bike: '#b88a3e',
  green: '#5f8d52',
  water: '#3b7fa0',
  rail: '#7d6033',
  transit: '#a24a33',
  plaza: '#d8d2c4',
  shade: '#9b7b55',
  play: '#933f64',
};

const W = 640;
const H = 200;
const G = 140; // ground line

/** Share of the open (non-building) section given to cars: a schematic estimate. */
export function carShare(bands: Band[]) {
  const open = bands.filter(([t]) => t !== 'building');
  const total = open.reduce((s, [, w, lv]) => s + (lv === 'tunnel' ? 0 : w), 0);
  const car = open.reduce((s, [t, w, lv]) => s + (t === 'car' && lv !== 'tunnel' ? w : 0), 0);
  return total ? Math.round((car / total) * 100) : 0;
}

function Person({ x, y, s = 1 }: { x: number; y: number; s?: number }) {
  return (
    <g fill="#2a2d31">
      <circle cx={x} cy={y - 13 * s} r={2.6 * s} />
      <rect x={x - 1.8 * s} y={y - 10 * s} width={3.6 * s} height={10 * s} rx={1.6 * s} />
    </g>
  );
}

function Tree({ x, y, r }: { x: number; y: number; r: number }) {
  return (
    <g>
      <line x1={x} y1={y} x2={x} y2={y - r * 1.4} stroke="#5b4a35" strokeWidth={2} />
      <circle cx={x} cy={y - r * 1.9} r={r} fill="url(#leaf)" />
    </g>
  );
}

function BandShape({ band, x, w, i }: { band: Band; x: number; w: number; i: number }) {
  const [t, , lv] = band;
  const up = lv === 'up';
  const down = lv === 'down';
  const tunnel = lv === 'tunnel';
  const deck = up ? G - 62 : down ? G + 18 : G;
  const slab = (fill: string, y = deck, h = 7) => <rect x={x} y={y - h} width={w} height={h} fill={fill} />;
  const pillars = up ? (
    <g fill="#8d8a84">
      <rect x={x + w * 0.2} y={deck} width={5} height={G - deck} />
      <rect x={x + w * 0.8 - 5} y={deck} width={5} height={G - deck} />
    </g>
  ) : null;
  const pit = down ? <rect x={x} y={G} width={w} height={deck - G} fill="#b9b3a6" /> : null;

  switch (t) {
    case 'building': {
      const h = 78 + ((i * 37) % 40) + (up ? 30 : 0) - (down ? 20 : 0);
      const base = up ? G - 30 : down ? G + 18 : G;
      return (
        <g>
          <rect x={x} y={base - h} width={w} height={h} fill="url(#bld)" stroke="#a9a59d" strokeWidth={0.6} />
          {Array.from({ length: Math.floor(h / 16) }, (_, k) => (
            <line key={k} x1={x + 6} x2={x + w - 6} y1={base - h + 12 + k * 16} y2={base - h + 12 + k * 16} stroke="#b3afa7" strokeWidth={0.8} />
          ))}
          {up || down ? <rect x={x} y={base} width={w} height={Math.max(0, G - base + 40)} fill="#cfc9bc" /> : null}
        </g>
      );
    }
    case 'car':
      if (tunnel)
        return (
          <g>
            <rect x={x} y={G} width={w} height={44} fill="#cfc9bc" />
            <rect x={x + 4} y={G + 12} width={w - 8} height={26} rx={10} fill="#3a3d42" />
            <rect x={x + w / 2 - 12} y={G + 24} width={24} height={9} rx={2} fill="#c7c3bb" />
          </g>
        );
      return (
        <g>
          {pillars}
          {pit}
          {slab('#4a4e55')}
          <rect x={x + w / 2 - 13} y={deck - 18} width={26} height={11} rx={3} fill="#2d3035" />
          <rect x={x + w / 2 - 8} y={deck - 23} width={16} height={6} rx={2} fill="#2d3035" />
        </g>
      );
    case 'walk':
      return (
        <g>
          {pit}
          {slab('#e4e0d6', deck, 5)}
          <Person x={x + w * 0.5} y={deck - 5} />
        </g>
      );
    case 'bike':
      return (
        <g>
          {slab('#b88a3e', deck, 5)}
          <circle cx={x + w / 2 - 6} cy={deck - 10} r={5} fill="none" stroke="#2a2d31" strokeWidth={1.4} />
          <circle cx={x + w / 2 + 6} cy={deck - 10} r={5} fill="none" stroke="#2a2d31" strokeWidth={1.4} />
          <Person x={x + w / 2} y={deck - 12} s={0.8} />
        </g>
      );
    case 'green':
      return (
        <g>
          {pillars}
          {pit}
          {slab('#5f8d52', deck, up ? 9 : 7)}
          <Tree x={x + w * 0.35} y={deck - 7} r={Math.min(14, w * 0.3)} />
          {w > 40 ? <Tree x={x + w * 0.75} y={deck - 7} r={Math.min(11, w * 0.22)} /> : null}
          {up ? <Person x={x + w * 0.55} y={deck - 9} /> : null}
        </g>
      );
    case 'water':
      return (
        <g>
          {down ? <rect x={x} y={G} width={w} height={deck - G + 6} fill="url(#water)" /> : slab('#3b7fa0', deck, 7)}
          <path
            d={`M${x} ${(down ? G + 8 : deck - 4)} q ${w / 8} -4 ${w / 4} 0 t ${w / 4} 0 t ${w / 4} 0 t ${w / 4} 0`}
            fill="none"
            stroke="#a9d2e3"
            strokeWidth={1.2}
          />
        </g>
      );
    case 'rail':
      return (
        <g>
          {pillars}
          {slab('#7d6033', deck, 7)}
          {Array.from({ length: Math.max(2, Math.floor(w / 10)) }, (_, k) => (
            <rect key={k} x={x + 3 + k * 10} y={deck - 10} width={6} height={3} fill="#4d3b20" />
          ))}
        </g>
      );
    case 'transit':
      return up ? (
        <g>
          <line x1={x} y1={deck - 40} x2={x + w} y2={deck - 52} stroke="#2a2d31" strokeWidth={1.2} />
          <line x1={x + w / 2} y1={deck - 46} x2={x + w / 2} y2={deck - 36} stroke="#2a2d31" strokeWidth={1.2} />
          <rect x={x + w / 2 - 9} y={deck - 36} width={18} height={14} rx={3} fill="#a24a33" />
          {slab('#e4e0d6', deck, 5)}
        </g>
      ) : (
        <g>
          {slab('#a24a33', deck, 6)}
          <rect x={x + 4} y={deck - 26} width={w - 8} height={18} rx={4} fill="#a24a33" />
          <rect x={x + 8} y={deck - 22} width={w - 16} height={6} fill="#f0e6dd" />
        </g>
      );
    case 'plaza':
      return (
        <g>
          {pit}
          {slab('#d8d2c4', deck, 5)}
          {Array.from({ length: Math.max(1, Math.floor(w / 34)) }, (_, k) => (
            <Person key={k} x={x + 14 + k * 34} y={deck - 5} s={k % 2 ? 0.9 : 1} />
          ))}
        </g>
      );
    case 'shade':
      return (
        <g>
          {slab('#d8d2c4', deck, 5)}
          {Array.from({ length: Math.max(2, Math.floor(w / 70)) }, (_, k) => {
            const n = Math.max(2, Math.floor(w / 70));
            const cx = x + (w / n) * (k + 0.5);
            return (
              <g key={k}>
                <rect x={cx - 4} y={deck - 74} width={8} height={70} fill="#9b7b55" />
                <path d={`M${cx - w / n / 2 + 2} ${deck - 82} Q ${cx} ${deck - 104} ${cx + w / n / 2 - 2} ${deck - 82} Z`} fill="url(#wood)" />
              </g>
            );
          })}
          <rect x={x} y={deck - 86} width={w} height={5} fill="#86663f" />
          {Array.from({ length: Math.floor(w / 40) }, (_, k) => (
            <Person key={k} x={x + 20 + k * 40} y={deck - 5} />
          ))}
        </g>
      );
    case 'play':
      return (
        <g>
          {pit}
          {slab('#933f64', deck, 5)}
          <circle cx={x + w * 0.3} cy={deck - 10} r={4} fill="#e2b33b" />
          <Person x={x + w * 0.6} y={deck - 5} s={0.75} />
          {w > 50 ? <Person x={x + w * 0.8} y={deck - 5} s={0.9} /> : null}
        </g>
      );
  }
}

function Drawing({ bands, label }: { bands: Band[]; label: string }) {
  const total = bands.reduce((s, [, w]) => s + w, 0);
  let x = 0;
  const parts = bands.map((b, i) => {
    const w = (b[1] / total) * W;
    const el = { b, x, w, i };
    x += w;
    return el;
  });
  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label} className="section-svg">
      <defs>
        <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#f7f6f3" />
          <stop offset="1" stopColor="#e9e6df" />
        </linearGradient>
        <linearGradient id="bld" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#dedad3" />
          <stop offset="1" stopColor="#bdb8af" />
        </linearGradient>
        <linearGradient id="water" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#5c9bb8" />
          <stop offset="1" stopColor="#2b6a88" />
        </linearGradient>
        <linearGradient id="wood" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#c9a676" />
          <stop offset="1" stopColor="#9b7b55" />
        </linearGradient>
        <radialGradient id="leaf" cx="0.35" cy="0.35" r="0.8">
          <stop offset="0" stopColor="#86b277" />
          <stop offset="1" stopColor="#4c7642" />
        </radialGradient>
      </defs>
      <rect width={W} height={H} fill="url(#sky)" />
      <rect y={G} width={W} height={H - G} fill="#cfc9bc" />
      {parts.map(({ b, x, w, i }) => (
        <BandShape key={i} band={b} x={x} w={w} i={i} />
      ))}
      <line x1={0} x2={W} y1={G} y2={G} stroke="#8d8a84" strokeWidth={0.8} />
    </svg>
  );
}

export default function Section({ before, after, mode }: { before: Band[]; after: Band[]; mode: 'before' | 'after' }) {
  const reduce = useReducedMotion();
  const bands = mode === 'before' ? before : after;
  return (
    <div className="section-frame" data-mode={mode}>
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={mode}
          initial={reduce ? false : { opacity: 0, y: 14, rotateX: 8 }}
          animate={{ opacity: 1, y: 0, rotateX: 0 }}
          exit={reduce ? undefined : { opacity: 0, y: -10, rotateX: -6 }}
          transition={{ duration: 0.35, ease: [0.2, 0.7, 0.2, 1] }}
          style={{ transformPerspective: 900 }}
        >
          <Drawing bands={bands} label={mode === 'before' ? 'חתך לפני ההתערבות' : 'חתך אחרי ההתערבות'} />
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

export function Legend({ bands }: { bands: Band[] }) {
  const types = [...new Set(bands.map(([t]) => t))];
  return (
    <ul className="legend">
      {types.map((t) => (
        <li key={t}>
          <span className="swatch" style={{ background: BAND_COLOR[t] }} />
          {BAND_LABEL[t]}
        </li>
      ))}
    </ul>
  );
}

/** Small static section for cards. */
export function MiniSection({ bands }: { bands: Band[] }) {
  return <Drawing bands={bands} label="חתך סכמטי" />;
}
