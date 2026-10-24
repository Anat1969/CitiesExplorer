import data from './cases.json';

/** Band types of the parametric cross-section. */
export type BandType = 'building' | 'walk' | 'car' | 'bike' | 'green' | 'water' | 'rail' | 'transit' | 'plaza' | 'shade' | 'play';

/** One band of a section: type, relative width, and level (raised structure, sunk channel or tunnel). */
export type Band = [BandType, number, ('up' | 'down' | 'tunnel')?];

export type Scale = 'street' | 'square' | 'neighborhood' | 'city';
export type Climate = 'hot-dry' | 'mediterranean' | 'temperate' | 'cold' | 'tropical';
export type Context = 'center' | 'residential' | 'waterfront' | 'hillside' | 'industrial';
export type Approach = 'tactical' | 'permanent' | 'policy' | 'mixed';
export type AppLink = 'n360' | 'renewal' | 'biomimicry' | 'interior';

export const SCALES: { id: Scale; label: string }[] = [
  { id: 'street', label: 'רחוב' },
  { id: 'square', label: 'כיכר' },
  { id: 'neighborhood', label: 'שכונה' },
  { id: 'city', label: 'עיר' },
];

export const CLIMATES: { id: Climate; label: string }[] = [
  { id: 'hot-dry', label: 'חם ויבש' },
  { id: 'mediterranean', label: 'ים תיכוני' },
  { id: 'temperate', label: 'ממוזג' },
  { id: 'cold', label: 'קר' },
  { id: 'tropical', label: 'טרופי' },
];

export const CONTEXTS: { id: Context; label: string }[] = [
  { id: 'center', label: 'מרכז עיר' },
  { id: 'residential', label: 'שכונת מגורים' },
  { id: 'waterfront', label: 'חזית מים' },
  { id: 'hillside', label: 'מדרון' },
  { id: 'industrial', label: 'אזור תעשייה או תשתית' },
];

export const APPROACHES: Record<Approach, string> = {
  tactical: 'טקטי וזמני',
  permanent: 'בנייה קבועה',
  policy: 'מדיניות',
  mixed: 'משולב',
};

export const DURATION_LABEL = ['', 'פחות משנתיים', 'שנתיים עד שמונה', 'יותר משמונה שנים'] as const;

export interface Fact {
  text: string;
  status: 'verified' | 'approx';
  source?: string;
}

export interface Case {
  id: string;
  name: string;
  /** Full name in the original language, searchable on Google. */
  nameEn: string;
  city: string;
  cityEn: string;
  country: string;
  countryEn: string;
  lat: number;
  lon: number;
  years: string;
  yearStart: number;
  scale: Scale;
  problems: string[];
  climate: Climate;
  context: Context;
  approach: Approach;
  cost: 1 | 2 | 3;
  duration: 1 | 2 | 3;
  insight: string;
  before: string;
  intervention: string;
  result: string;
  /** Move ids from moves.ts, most characteristic first. */
  moves: string[];
  cautions: string;
  israel: string;
  team: string;
  section: { before: Band[]; after: Band[] };
  apps: AppLink[];
  keywords: string[];
  sources: { label: string; url: string }[];
  facts: Fact[];
}

export const CASES = data as unknown as Case[];

export const caseById = (id: string) => CASES.find((c) => c.id === id);
export const casesFor = (problemId: string) => CASES.filter((c) => c.problems.includes(problemId));
export const isIsrael = (c: Case) => c.countryEn === 'Israel';
