import { CASES, type Case } from '../data/cases';
import { PROBLEMS } from '../data/problems';

/**
 * Words a planner uses when describing each problem. Matching is by words, not by understanding language:
 * the result is a suggestion the planner confirms, never a decision.
 */
const WORDS: Record<string, string[]> = {
  'car-street': ['רכב', 'מכוניות', 'מכונית', 'חניה', 'חנייה', 'חונים', 'פקק', 'פקקים', 'תנועה', 'נתיב', 'נתיבים', 'כביש', 'מדרכה', 'מדרכות', 'צרה', 'הולכי', 'רגל', 'רעש', 'בטיחות', 'תאונות', 'מהירות', 'חוצים', 'מעבר', 'חציה', 'מסחרי', 'חנויות'],
  'dividing-road': ['עורק', 'עורקי', 'מהיר', 'מחלף', 'גשר', 'מפריד', 'חוצץ', 'מנתק', 'חוצה', 'רוחב', 'רחב', 'נתיבים', 'גדר', 'מעבר', 'תת', 'קרקעי', 'מים', 'ים', 'נחל', 'חוף'],
  'derelict-infra': ['נטוש', 'נטושה', 'מסילה', 'רכבת', 'ישנה', 'ישן', 'גשר', 'תשתית', 'מוזנח', 'מוזנחת', 'מבנה', 'תעשייה', 'מחסן', 'נמל', 'מזבלה', 'פסולת', 'הזנחה', 'שומם'],
  flooding: ['הצפה', 'הצפות', 'מוצף', 'מוצפת', 'נגר', 'גשם', 'גשמים', 'ניקוז', 'מים', 'שלוליות', 'שלולית', 'חלחול', 'אספלט', 'אטום', 'אטומים', 'נחל', 'ביוב', 'סערה'],
  heat: ['חום', 'חם', 'חמה', 'צל', 'צל', 'שמש', 'קרינה', 'עצים', 'עץ', 'הצללה', 'קיץ', 'אי', 'חום', 'לוהט', 'אספלט', 'ירוק', 'צמחייה', 'מזגן', 'טמפרטורה'],
  isolated: ['מנותק', 'מנותקת', 'מבודד', 'מבודדת', 'פריפריה', 'שכונה', 'נגישות', 'תחבורה', 'ציבורית', 'אוטובוס', 'עוני', 'מוחלשת', 'פשיעה', 'מדרון', 'גבעה', 'עלייה', 'הזנחה', 'רחוק'],
  identity: ['זהות', 'משעמם', 'אפור', 'אפורה', 'ריק', 'ריקה', 'אין', 'אופי', 'כיכר', 'מפגש', 'חזיתות', 'חזית', 'מוזנחת', 'קהילה', 'תרבות', 'אמנות', 'צבע', 'ייחודי', 'חיים', 'פעילות'],
  'car-neighborhood': ['חדשה', 'שכונה', 'תכנון', 'תוכנית', 'תלויה', 'תלוי', 'רכב', 'פרטי', 'חניונים', 'חניה', 'הליכה', 'אופניים', 'מגורים', 'בנייה', 'פרבר', 'מרחקים'],
  leisure: ['פנאי', 'פארק', 'גינה', 'גן', 'ילדים', 'משחק', 'ספורט', 'שטח', 'פתוח', 'ירוק', 'בילוי', 'משפחות', 'חוף', 'טיילת', 'מים', 'רחצה', 'מחסור'],
};

const norm = (s: string) => s.toLowerCase().replace(/[֑-ׇ"'׳״.,:;()!?\-]/g, ' ');
/** "ברחובות" also counts as "רחובות", "והמכוניות" as "מכוניות". */
const stems = (w: string) => {
  const out = [w];
  let x = w;
  for (let i = 0; i < 2 && x.length > 3 && /^[הובלמשכ]/.test(x); i++) {
    x = x.slice(1);
    out.push(x);
  }
  return out;
};
const words = (text: string) => norm(text).split(/\s+/).filter((w) => w.length > 1);

export interface ProblemGuess {
  id: string;
  /** Share of the matched words, 0 to 100. */
  pct: number;
  hits: string[];
}

/** Which problems the planner's own words point to, strongest first. */
export function guessProblems(text: string): ProblemGuess[] {
  const ws = words(text);
  if (!ws.length) return [];
  const raw = PROBLEMS.map((p) => {
    const dict = WORDS[p.id] ?? [];
    const hits = [...new Set(ws.filter((w) => stems(w).some((s) => dict.includes(s))))];
    // Words of the problem's own title count double.
    const title = words(p.title);
    const strong = ws.filter((w) => stems(w).some((s) => title.includes(s))).length;
    return { id: p.id, n: hits.length + strong, hits };
  }).filter((g) => g.n > 0);
  const total = raw.reduce((s, g) => s + g.n, 0) || 1;
  return raw
    .map((g) => ({ id: g.id, pct: Math.round((g.n / total) * 100), hits: g.hits }))
    .sort((a, b) => b.pct - a.pct);
}

/** Cases whose own description shares the most words with the planner's text. */
export function casesLike(text: string, n = 3): { c: Case; hits: number }[] {
  const ws = [...new Set(words(text).filter((w) => w.length > 2))];
  if (!ws.length) return [];
  return CASES.map((c) => {
    const h = norm([c.name, c.insight, c.before, c.keywords.join(' ')].join(' '));
    return { c, hits: ws.filter((w) => stems(w).some((s) => s.length > 2 && h.includes(s))).length };
  })
    .filter((x) => x.hits >= 2)
    .sort((a, b) => b.hits - a.hits)
    .slice(0, n);
}
