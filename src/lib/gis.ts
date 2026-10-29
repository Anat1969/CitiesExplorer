import type { Band, Climate, Context } from '../data/cases';

/**
 * Real data about a point, from OpenStreetMap: the street (Overpass API) and the address (Nominatim).
 * Every value says where it came from: a tag mapped in OSM, or an estimate from the road type.
 */
export type Source = 'osm' | 'est';
export interface Valued<T> {
  v: T;
  src: Source;
}

export interface StreetData {
  name: string;
  highway: string;
  lanes: Valued<number>;
  /** Carriageway width in meters. */
  width: Valued<number>;
  sidewalk: Valued<'both' | 'one' | 'none'>;
  sidewalkWidth: Valued<number>;
  cycleway: Valued<boolean>;
  parking: Valued<boolean>;
  maxspeed?: Valued<number>;
  oneway: boolean;
  /** Mapped trees within 40 m. */
  trees: number;
  /** Sea, lake or stream within 300 m. */
  water: boolean;
  /** Distance from the clicked point to the street, meters. */
  dist: number;
}

export interface Place {
  lat: number;
  lon: number;
  label: string;
}

const NOMINATIM = 'https://nominatim.openstreetmap.org';
const OVERPASS = 'https://overpass-api.de/api/interpreter';

export async function searchPlace(q: string): Promise<Place[]> {
  const r = await fetch(`${NOMINATIM}/search?format=jsonv2&limit=5&accept-language=he&q=${encodeURIComponent(q)}`);
  if (!r.ok) throw new Error('search');
  const j = (await r.json()) as { lat: string; lon: string; display_name: string }[];
  return j.map((x) => ({ lat: +x.lat, lon: +x.lon, label: x.display_name }));
}

export async function reversePlace(lat: number, lon: number): Promise<string> {
  const r = await fetch(`${NOMINATIM}/reverse?format=jsonv2&zoom=17&accept-language=he&lat=${lat}&lon=${lon}`);
  if (!r.ok) throw new Error('reverse');
  const j = (await r.json()) as { display_name?: string };
  return j.display_name ?? '';
}

const LANES: Record<string, number> = { motorway: 6, trunk: 4, primary: 4, secondary: 2, tertiary: 2, unclassified: 2, residential: 2, living_street: 1, service: 1, pedestrian: 0 };
const IGNORE = 'footway|path|steps|cycleway|track|corridor|elevator|construction|proposed|platform|bridleway';

type Geom = { lat: number; lon: number }[];
type El = { type: string; tags?: Record<string, string>; geometry?: Geom };

/** Distance in meters from a point to a polyline, on a local flat projection. */
function distTo(lat: number, lon: number, g: Geom) {
  const k = Math.cos((lat * Math.PI) / 180) * 111320;
  const P = (p: { lat: number; lon: number }) => [(p.lon - lon) * k, (p.lat - lat) * 110540];
  let best = Infinity;
  for (let i = 0; i < g.length - 1; i++) {
    const [ax, ay] = P(g[i]);
    const [bx, by] = P(g[i + 1]);
    const dx = bx - ax;
    const dy = by - ay;
    const t = Math.max(0, Math.min(1, -(ax * dx + ay * dy) / (dx * dx + dy * dy || 1)));
    best = Math.min(best, Math.hypot(ax + t * dx, ay + t * dy));
  }
  return g.length === 1 ? Math.hypot(...P(g[0])) : best;
}

const num = (s?: string) => {
  const n = parseFloat((s ?? '').replace(',', '.'));
  return Number.isFinite(n) && n > 0 ? n : undefined;
};

export async function streetAt(lat: number, lon: number): Promise<StreetData | null> {
  const q = `[out:json][timeout:20];
way(around:40,${lat},${lon})[highway][highway!~"^(${IGNORE})$"];
out tags geom;
node(around:40,${lat},${lon})[natural=tree];
out count;
(way(around:300,${lat},${lon})[natural~"^(coastline|water)$"];way(around:300,${lat},${lon})[waterway~"^(river|stream|canal)$"];);
out count;`;
  const r = await fetch(OVERPASS, { method: 'POST', body: 'data=' + encodeURIComponent(q), headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });
  if (!r.ok) throw new Error('overpass');
  const j = (await r.json()) as { elements: El[] };
  const ways = j.elements.filter((e) => e.type === 'way' && e.geometry);
  const counts = j.elements.filter((e) => e.type === 'count').map((e) => +(e.tags?.total ?? 0));
  if (!ways.length) return null;
  const near = ways.map((w) => ({ w, d: distTo(lat, lon, w.geometry!) })).sort((a, b) => a.d - b.d)[0];
  const t = near.w.tags ?? {};
  const hw = t.highway;
  const lanesTag = num(t.lanes);
  const lanes: Valued<number> = lanesTag ? { v: Math.round(lanesTag), src: 'osm' } : { v: LANES[hw] ?? 2, src: 'est' };
  const widthTag = num(t.width) ?? num(t['width:carriageway']);
  const sw = t.sidewalk ?? t['sidewalk:both'];
  const sidewalk: Valued<'both' | 'one' | 'none'> = sw
    ? { v: sw === 'both' || sw === 'yes' ? 'both' : sw === 'left' || sw === 'right' ? 'one' : sw === 'no' || sw === 'none' ? 'none' : 'both', src: 'osm' }
    : { v: ['motorway', 'trunk'].includes(hw) ? 'none' : 'both', src: 'est' };
  const swW = num(t['sidewalk:width']) ?? num(t['sidewalk:both:width']);
  const cyc = Object.keys(t).some((k) => k.startsWith('cycleway') && !/^(no|none|separate)$/.test(t[k]));
  const park = Object.keys(t).some((k) => k.startsWith('parking') && !/^(no|none|no_parking|no_stopping)$/.test(t[k]));
  const hasParkTag = Object.keys(t).some((k) => k.startsWith('parking'));
  const parking: Valued<boolean> = hasParkTag ? { v: park, src: 'osm' } : { v: ['residential', 'tertiary', 'secondary', 'unclassified'].includes(hw), src: 'est' };
  const cycleway: Valued<boolean> = Object.keys(t).some((k) => k.startsWith('cycleway')) ? { v: cyc, src: 'osm' } : { v: false, src: 'est' };
  const laneW = hw === 'residential' || hw === 'living_street' ? 3 : 3.25;
  const est = lanes.v * laneW + (parking.v ? 2.2 * (sidewalk.v === 'both' ? 2 : 1) : 0) + (cycleway.v ? 1.6 * 2 : 0);
  const speed = num(t.maxspeed);
  return {
    name: t.name ?? t['name:he'] ?? '',
    highway: hw,
    lanes,
    width: widthTag ? { v: widthTag, src: 'osm' } : { v: +est.toFixed(1), src: 'est' },
    sidewalk,
    sidewalkWidth: swW ? { v: swW, src: 'osm' } : { v: hw === 'residential' ? 2 : 2.5, src: 'est' },
    cycleway,
    parking,
    maxspeed: speed ? { v: speed, src: 'osm' } : undefined,
    oneway: t.oneway === 'yes',
    trees: counts[0] ?? 0,
    water: (counts[1] ?? 0) > 0,
    dist: Math.round(near.d),
  };
}

/** The existing section, in meters, built from the street data. Buildings are drawn 4 m wide at the edges. */
export function sectionFrom(s: StreetData): Band[] {
  if (s.highway === 'pedestrian') return [['building', 4], ['plaza', s.width.src === 'osm' ? s.width.v : 12], ['building', 4]];
  const side: Band[] = [];
  if (s.sidewalk.v !== 'none') side.push(['walk', s.sidewalkWidth.v]);
  if (s.trees >= 4) side.push(['green', 1.5]);
  if (s.parking.v) side.push(['car', 2.2]);
  if (s.cycleway.v) side.push(['bike', 1.6]);
  const parkW = s.parking.v ? 2.2 * (s.sidewalk.v === 'both' ? 2 : 1) : 0;
  const bikeW = s.cycleway.v ? 3.2 : 0;
  const n = Math.max(1, s.lanes.v);
  const laneW = +Math.max(2.75, (s.width.v - parkW - bikeW) / n).toFixed(2);
  const lanes: Band[] = Array.from({ length: n }, () => ['car', laneW] as Band);
  // A wide road with four lanes or more gets its median.
  if (n >= 4 && ['primary', 'trunk', 'secondary'].includes(s.highway)) lanes.splice(n / 2, 0, ['green', 2]);
  // The far side mirrors the near one; with a sidewalk on one side only, the far side keeps a narrow shoulder.
  const other: Band[] = s.sidewalk.v === 'both' ? [...side].reverse() : [['walk', 1]];
  const all: Band[] = [['building', 4], ...side, ...lanes, ...other, ['building', 4]];
  return all.map(([t, w, lv]) => (lv ? [t, +w.toFixed(2), lv] : [t, +w.toFixed(2)]) as Band);
}

/** A rough climate from the coordinates: said to be an estimate wherever it is shown. */
export function climateAt(lat: number, lon: number): Climate {
  if (lat > 29.4 && lat < 33.4 && lon > 34.2 && lon < 35.9) return lat < 31.35 ? 'hot-dry' : 'mediterranean';
  const a = Math.abs(lat);
  if (a < 23) return 'tropical';
  if (a > 55) return 'cold';
  if (lat > 30 && lat < 45 && lon > -10 && lon < 42) return 'mediterranean';
  if (lat > 15 && lat < 32 && lon > -15 && lon < 60) return 'hot-dry';
  return 'temperate';
}

export function contextFrom(s: StreetData | null): Context | null {
  return s?.water ? 'waterfront' : null;
}

export const HIGHWAY_LABEL: Record<string, string> = {
  motorway: 'כביש מהיר',
  trunk: 'דרך ראשית',
  primary: 'דרך עורקית ראשית',
  secondary: 'דרך עורקית משנית',
  tertiary: 'רחוב מאסף',
  residential: 'רחוב מגורים',
  living_street: 'רחוב משולב',
  pedestrian: 'מדרחוב',
  unclassified: 'דרך מקומית',
  service: 'דרך שירות',
};
