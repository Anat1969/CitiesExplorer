import { Fragment } from 'react';

// Numbers with their unit or noun (years, lengths, sums, shares) are the words a planner scans for.
const KEY = /(כ-)?\d[\d,.]*(\s?%|\s(?:ק"מ|מטר|מ"ר|דונם|הקטאר|מיליון|מיליארד|אלף|שנים|שנה|דולר|יורו|ש"ח|וון|נוסעים|רוכבים|מכוניות|רחובות|עצים|גשרים|דקות|מעלות)(?:\s(?:דולר|יורו|ש"ח|וון|נוסעים|ביום|בשנה))?)?/g;

/** Plain text with its key figures in bold. */
export default function Rich({ text }: { text: string }) {
  const out: React.ReactNode[] = [];
  let last = 0;
  for (const m of text.matchAll(KEY)) {
    const i = m.index ?? 0;
    if (i > last) out.push(text.slice(last, i));
    out.push(<strong key={i}>{m[0]}</strong>);
    last = i + m[0].length;
  }
  out.push(text.slice(last));
  return <>{out.map((x, k) => <Fragment key={k}>{x}</Fragment>)}</>;
}
