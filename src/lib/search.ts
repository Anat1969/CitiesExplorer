import { CASES, type Case } from '../data/cases';
import { moveById } from '../data/moves';
import { problemById } from '../data/problems';

const norm = (s: string) => s.toLowerCase().replace(/[֑-ׇ"'׳״.,:;()-]/g, ' ');
/** Strip one Hebrew prefix letter so "ברחובות" finds "רחובות". */
const stems = (w: string) => (w.length > 3 && /^[הובלמשכ]/.test(w) ? [w, w.slice(1)] : [w]);

function haystack(c: Case) {
  return norm(
    [c.name, c.nameEn, c.city, c.cityEn, c.country, c.insight, c.before, c.intervention, c.result, c.team, c.countryEn, c.israel, ...c.moves.map((m) => moveById(m)?.title ?? ''), ...c.keywords, ...c.problems.map((p) => problemById(p)?.title ?? '')].join(' '),
  );
}

const INDEX = new Map(CASES.map((c) => [c.id, haystack(c)]));

/** Every word must match (in any of its stems). */
export function search(q: string, list: Case[] = CASES): Case[] {
  const words = norm(q).split(/\s+/).filter(Boolean);
  if (!words.length) return list;
  return list.filter((c) => {
    const h = INDEX.get(c.id)!;
    return words.every((w) => stems(w).some((s) => h.includes(s)));
  });
}
