import { useRef, useState } from 'react';
import type { Band, BandType } from '../data/cases';
import { BAND_COLOR, BAND_LABEL, carShare, MiniSection } from './Section';

const TYPES: BandType[] = ['walk', 'car', 'bike', 'green', 'transit', 'rail', 'plaza', 'shade', 'play', 'water', 'building'];
const MIN = 0.5;
const r2 = (v: number) => Math.round(v * 20) / 20;

/**
 * The section drawn to scale in meters, edited on the drawing itself: dimension lines above every strip,
 * the boundary between two strips dragged sideways, a strip clicked to change its use, width or level.
 * The drawing runs left to right like the street seen from the sidewalk; the editor keeps that order.
 */
export default function SectionCanvas({ bands, onChange }: { bands: Band[]; onChange: (b: Band[]) => void }) {
  const [sel, setSel] = useState<number | null>(null);
  const box = useRef<HTMLDivElement>(null);
  const drag = useRef<{ i: number; x: number; a: number; b: number; px: number } | null>(null);
  const total = bands.reduce((s, [, w]) => s + w, 0);
  const open = bands.filter(([t]) => t !== 'building').reduce((s, [, w]) => s + w, 0);
  let acc = 0;
  const pos = bands.map(([, w]) => {
    const p = { left: (acc / total) * 100, width: (w / total) * 100 };
    acc += w;
    return p;
  });

  const set = (i: number, b: Band) => onChange(bands.map((x, k) => (k === i ? b : x)));
  const onDown = (i: number) => (e: React.PointerEvent) => {
    e.preventDefault();
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    drag.current = { i, x: e.clientX, a: bands[i][1], b: bands[i + 1][1], px: box.current?.getBoundingClientRect().width ?? 1 };
  };
  const onMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const dm = ((e.clientX - d.x) / d.px) * total;
    const a = r2(Math.min(Math.max(d.a + dm, MIN), d.a + d.b - MIN));
    const next = bands.map((x, k) => (k === d.i ? ([x[0], a, x[2]] as Band) : k === d.i + 1 ? ([x[0], r2(d.a + d.b - a), x[2]] as Band) : x));
    onChange(next);
  };
  const onUp = () => {
    drag.current = null;
  };
  const nudge = (i: number, dm: number) => {
    const a = r2(Math.min(Math.max(bands[i][1] + dm, MIN), bands[i][1] + bands[i + 1][1] - MIN));
    const b = r2(bands[i][1] + bands[i + 1][1] - a);
    onChange(bands.map((x, k) => (k === i ? ([x[0], a, x[2]] as Band) : k === i + 1 ? ([x[0], b, x[2]] as Band) : x)));
  };
  const setOpen = (v: number) => {
    if (!(v > 2)) return;
    const k = v / open;
    onChange(bands.map(([t, w, lv]) => (t === 'building' ? [t, w, lv] : [t, r2(w * k), lv]) as Band));
  };
  const move = (i: number, d: number) => {
    const j = i + d;
    if (j < 0 || j >= bands.length) return;
    const next = [...bands];
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
    setSel(j);
  };
  const s = sel !== null && sel < bands.length ? sel : null;
  const b = s !== null ? bands[s] : null;

  return (
    <div className="sc">
      <div className="sc-stage" ref={box} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}>
        <div className="sc-dims" aria-hidden>
          {bands.map(([t, w], i) => (
            <div key={i} className={`sc-dim${t === 'building' ? ' bld' : ''}`} style={{ left: `${pos[i].left}%`, width: `${pos[i].width}%` }}>
              <i />
              <span>{t === 'building' ? 'בניין' : pos[i].width > 6 ? `${+w.toFixed(2)} מ'` : pos[i].width > 3.5 ? String(+w.toFixed(2)) : ''}</span>
            </div>
          ))}
        </div>
        <div className="sc-draw">
          <MiniSection bands={bands} />
          {bands.map(([t, w], i) => (
            <button
              key={i}
              type="button"
              className={`sc-hit${s === i ? ' on' : ''}`}
              style={{ left: `${pos[i].left}%`, width: `${pos[i].width}%` }}
              aria-label={`${BAND_LABEL[t]}, ${w} מטר. לחיצה לעריכה`}
              aria-pressed={s === i}
              onClick={() => setSel(s === i ? null : i)}
            />
          ))}
          {bands.slice(0, -1).map((x, i) =>
            x[0] !== 'building' && bands[i + 1][0] !== 'building' ? (
              <div
                key={`h${i}`}
                className="sc-handle"
                role="slider"
                tabIndex={0}
                aria-label={`הגבול בין ${BAND_LABEL[x[0]]} ל${BAND_LABEL[bands[i + 1][0]]}`}
                aria-valuenow={x[1]}
                aria-valuemin={MIN}
                aria-valuemax={x[1] + bands[i + 1][1] - MIN}
                title="גוררים כדי להעביר רוחב בין שתי הרצועות"
                style={{ left: `${pos[i].left + pos[i].width}%` }}
                onPointerDown={onDown(i)}
                onKeyDown={(e) => {
                  if (e.key === 'ArrowRight') nudge(i, 0.1);
                  if (e.key === 'ArrowLeft') nudge(i, -0.1);
                }}
              />
            ) : null,
          )}
        </div>
        <div className="sc-total">
          <span className="line" />
          <label>
            <span>בין קווי הבניין</span>
            <input type="number" min={3} step={0.5} value={+open.toFixed(2)} onChange={(e) => setOpen(+e.target.value)} aria-label="רוחב בין קווי הבניין במטרים" />
            <span>מ'</span>
          </label>
          <span className="line" />
        </div>
      </div>

      <div className="sc-foot">
        <span className="mono">רכב: <b>{carShare(bands)}%</b> מהחתך</span>
        <span className="sc-hint">גוררים את הקווים שבין הרצועות, או לוחצים על רצועה כדי לשנות שימוש ורוחב.</span>
        <button type="button" className="btn ghost small" onClick={() => onChange([...bands.slice(0, -1), ['green', 1.5], ...bands.slice(-1)])} disabled={bands.length >= 14}>
          הוספת רצועה
        </button>
      </div>

      {b && s !== null ? (
        <div className="sc-panel" style={{ '--bc': BAND_COLOR[b[0]] } as React.CSSProperties}>
          <div className="sc-panel-head">
            <b>רצועה {s + 1}: {BAND_LABEL[b[0]]}</b>
            <button type="button" className="btn ghost small" onClick={() => setSel(null)}>סגירה</button>
          </div>
          <div className="sc-types" role="group" aria-label="שימוש הרצועה">
            {TYPES.map((t) => (
              <button key={t} type="button" aria-pressed={b[0] === t} onClick={() => set(s, [t, b[1], b[2]])} style={{ '--bc': BAND_COLOR[t] } as React.CSSProperties}>
                <i />
                {BAND_LABEL[t]}
              </button>
            ))}
          </div>
          <div className="sc-fields">
            <label>
              <span>רוחב</span>
              <input type="number" min={MIN} step={0.1} value={b[1]} onChange={(e) => +e.target.value >= MIN && set(s, [b[0], r2(+e.target.value), b[2]])} />
              <span>מ'</span>
            </label>
            <label>
              <span>מפלס</span>
              <select value={b[2] ?? ''} onChange={(e) => set(s, [b[0], b[1], (e.target.value || undefined) as Band[2]])}>
                <option value="">מפלס הרחוב</option>
                <option value="up">מוגבה</option>
                <option value="down">שקוע</option>
                <option value="tunnel">מנהרה</option>
              </select>
            </label>
            <div className="sc-actions">
              <button type="button" className="btn ghost small" onClick={() => move(s, -1)} disabled={s === 0}>הזזה שמאלה</button>
              <button type="button" className="btn ghost small" onClick={() => move(s, 1)} disabled={s === bands.length - 1}>הזזה ימינה</button>
              <button
                type="button"
                className="btn ghost small"
                onClick={() => onChange([...bands.slice(0, s), [b[0], r2(b[1] / 2), b[2]], [b[0], r2(b[1] / 2), b[2]], ...bands.slice(s + 1)])}
                disabled={b[1] < 2 * MIN || bands.length >= 14}
              >
                פיצול לשתיים
              </button>
              <button
                type="button"
                className="btn ghost small"
                onClick={() => {
                  onChange(bands.filter((_, k) => k !== s));
                  setSel(null);
                }}
                disabled={bands.length <= 3}
              >
                מחיקה
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
