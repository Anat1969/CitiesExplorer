import { CASES, type Band, type BandType, type Case, type Climate, type Context, type Scale } from '../data/cases';
import { MOVES, type Move, type Phase } from '../data/moves';
import type { StreetData } from './gis';
import type { ImageMix } from './imageAnalysis';

/** A planner's own site, as entered in "הפרויקט שלי". */
export interface Site {
  name: string;
  problems: string[];
  scale: Scale;
  climate: Climate;
  context: Context;
  /** 1 low, 2 medium, 3 high. */
  budget: 1 | 2 | 3;
  section: Band[];
  /** Photo of the existing situation, resized to a JPEG data URL. */
  photo?: string;
  /** The planner's edits in the solutions document, by field key. */
  doc?: Record<string, string>;
  /** The problem in the planner's own words. */
  problemText?: string;
  /** Location picked on the map or found by address. */
  lat?: number;
  lon?: number;
  address?: string;
  /** Street data read from OpenStreetMap at the location. */
  street?: StreetData | null;
  /** Colour reading of the photo. */
  mix?: ImageMix;
  /** Section widths are in meters (older projects kept relative widths). */
  meters?: boolean;
  createdAt?: string;
  /** When the check last ran: the results stay visible after a reload. */
  checkedAt?: string;
}

export const DEFAULT_SITE: Site = {
  name: '',
  problems: [],
  scale: 'street',
  climate: 'mediterranean',
  context: 'center',
  budget: 2,
  section: [['building', 4], ['walk', 2.5], ['car', 2.2], ['car', 3.25], ['car', 3.25], ['car', 2.2], ['walk', 2.5], ['building', 4]],
  meters: true,
};

/** Older projects kept relative widths: scale the open part to 20 m, buildings to 4 m. */
export function inMeters(site: Site): Site {
  if (site.meters) return site;
  const open = site.section.filter(([t]) => t !== 'building').reduce((s, [, w]) => s + w, 0) || 1;
  const k = 20 / open;
  return { ...site, meters: true, section: site.section.map(([t, w, lv]) => (t === 'building' ? [t, 4, lv] : [t, +(w * k).toFixed(2), lv]) as Band) };
}

/** Weights of the score, out of 100. Shown to the user as they are. */
export const WEIGHTS = { problem: 40, climate: 15, section: 15, scale: 10, context: 10, budget: 10 } as const;
export type Part = keyof typeof WEIGHTS;

export const PART_LABEL: Record<Part, string> = {
  problem: 'בעיה',
  climate: 'אקלים',
  section: 'דמיון חתך',
  scale: 'קנה מידה',
  context: 'הקשר',
  budget: 'תקציב',
};

const SCALE_ORDER: Scale[] = ['street', 'square', 'neighborhood', 'city'];
const NEAR_CLIMATE: Record<Climate, Climate[]> = {
  'hot-dry': ['mediterranean'],
  mediterranean: ['hot-dry', 'temperate'],
  temperate: ['mediterranean', 'cold'],
  cold: ['temperate'],
  tropical: ['hot-dry'],
};
const NEAR_CONTEXT: Record<Context, Context[]> = {
  center: ['residential'],
  residential: ['center', 'hillside'],
  waterfront: ['industrial'],
  hillside: ['residential'],
  industrial: ['waterfront'],
};

const TYPES: BandType[] = ['building', 'walk', 'car', 'bike', 'green', 'water', 'rail', 'transit', 'plaza', 'shade', 'play'];

/** Share of the open width per band type (buildings and tunnels excluded). */
export function profile(bands: Band[]): number[] {
  const open = bands.filter(([t, , lv]) => t !== 'building' && lv !== 'tunnel');
  const total = open.reduce((s, [, w]) => s + w, 0) || 1;
  return TYPES.map((t) => open.filter(([x]) => x === t).reduce((s, [, w]) => s + w, 0) / total);
}

/** Cosine similarity of two section profiles, 0 to 1. */
export function similarity(a: Band[], b: Band[]) {
  const p = profile(a);
  const q = profile(b);
  const dot = p.reduce((s, v, i) => s + v * q[i], 0);
  const n = Math.hypot(...p) * Math.hypot(...q);
  return n ? dot / n : 0;
}

export interface Match {
  c: Case;
  score: number;
  parts: Record<Part, number>;
  reasons: string[];
}

export function score(site: Site, c: Case): Match {
  const parts = {} as Record<Part, number>;
  const reasons: string[] = [];

  if (site.problems.length) {
    const hit = site.problems.filter((p) => c.problems.includes(p)).length / site.problems.length;
    const main = c.problems[0] === site.problems[0] ? 1 : 0.75;
    parts.problem = WEIGHTS.problem * hit * (hit ? main : 1);
    if (hit) reasons.push(hit === 1 ? 'פתר את אותה בעיה' : 'פתר חלק מהבעיות');
  } else parts.problem = WEIGHTS.problem * 0.5;

  parts.climate = c.climate === site.climate ? WEIGHTS.climate : NEAR_CLIMATE[site.climate].includes(c.climate) ? WEIGHTS.climate * 0.55 : 0;
  if (c.climate === site.climate) reasons.push('אותו אקלים');

  const sim = similarity(site.section, c.section.before);
  parts.section = WEIGHTS.section * sim;
  if (sim > 0.8) reasons.push('חתך פתיחה דומה');

  const d = Math.abs(SCALE_ORDER.indexOf(site.scale) - SCALE_ORDER.indexOf(c.scale));
  parts.scale = WEIGHTS.scale * (d === 0 ? 1 : d === 1 ? 0.5 : 0);

  parts.context = c.context === site.context ? WEIGHTS.context : NEAR_CONTEXT[site.context].includes(c.context) ? WEIGHTS.context * 0.5 : 0;
  if (c.context === site.context) reasons.push('הקשר דומה');

  const over = c.cost - site.budget;
  parts.budget = WEIGHTS.budget * (over <= 0 ? 1 : over === 1 ? 0.4 : 0);
  if (over > 0) reasons.push('יקר מהתקציב');

  const total = Object.values(parts).reduce((s, v) => s + v, 0);
  return { c, score: Math.round(total), parts, reasons };
}

export function rank(site: Site, list: Case[] = CASES): Match[] {
  return list.map((c) => score(site, c)).sort((a, b) => b.score - a.score);
}

export interface Recommended {
  move: Move;
  /** Score-weighted support across the top matches. */
  weight: number;
  cases: Case[];
  overBudget: boolean;
  /** Not from the closest cases but from all cases of the same problem. */
  wider?: boolean;
}

/**
 * The strategy: moves of the top matches, weighted by how well each case fits the site,
 * grouped by phase. A move counts only when at least one strong match used it.
 */
export function strategy(site: Site, matches: Match[], top = 8): Record<Phase, Recommended[]> {
  const pool = matches.slice(0, top).filter((m) => m.score >= 45);
  const by = new Map<string, Recommended>();
  for (const m of pool) {
    m.c.moves.forEach((id, i) => {
      const move = MOVES.find((x) => x.id === id);
      if (!move) return;
      const r = by.get(id) ?? { move, weight: 0, cases: [], overBudget: move.cost > site.budget };
      r.weight += m.score * (i === 0 ? 1.3 : 1);
      r.cases.push(m.c);
      by.set(id, r);
    });
  }
  const all = [...by.values()].sort((a, b) => b.weight - a.weight);
  const out: Record<Phase, Recommended[]> = { quick: [], medium: [], long: [] };
  for (const r of all) if (out[r.move.phase].length < 4) out[r.move.phase].push(r);

  // A phase the closest cases left empty is filled from all cases of the same problem, marked as wider support.
  const wider = matches.filter((m) => !site.problems.length || m.c.problems.some((p) => site.problems.includes(p)));
  for (const ph of ['quick', 'medium', 'long'] as Phase[]) {
    if (out[ph].length >= 2) continue;
    const extra = new Map<string, Recommended>();
    for (const m of wider)
      for (const id of m.c.moves) {
        const move = MOVES.find((x) => x.id === id);
        if (!move || move.phase !== ph || out[ph].some((r) => r.move.id === id)) continue;
        const r = extra.get(id) ?? { move, weight: 0, cases: [], overBudget: move.cost > site.budget, wider: true };
        r.weight += m.score;
        r.cases.push(m.c);
        extra.set(id, r);
      }
    out[ph].push(...[...extra.values()].sort((a, b) => b.weight - a.weight).slice(0, 2 - out[ph].length));
  }
  return out;
}

/** The site's own section, re-divided in the proportions of a case's "after". Buildings at the edges stay. */
export function transform(section: Band[], c: Case): Band[] {
  const lead = section[0]?.[0] === 'building' ? [section[0]] : [];
  const tail = section.length > 1 && section[section.length - 1][0] === 'building' ? [section[section.length - 1]] : [];
  const open = section.slice(lead.length, section.length - tail.length).reduce((s, [, w]) => s + w, 0);
  const inner = c.section.after.filter(([t]) => t !== 'building');
  const total = inner.reduce((s, [, w]) => s + w, 0) || 1;
  return [...lead, ...inner.map(([t, w, lv]) => [t, +((w / total) * open).toFixed(2), lv] as Band), ...tail];
}
