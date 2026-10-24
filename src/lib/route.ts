import { useEffect, useState } from 'react';
import type { Scale } from '../data/cases';

export type View = 'home' | 'problem' | 'case' | 'all' | 'board' | 'moves' | 'move' | 'map' | 'project' | 'compare' | 'present';

export interface Route {
  view: View;
  problem?: string;
  case?: string;
  move?: string;
  scale?: Scale;
  q?: string;
  /** Project id in "הפרויקט שלי". */
  p?: string;
  /** Case ids for comparison. */
  ids?: string[];
  /** Slide index in presentation mode. */
  s?: number;
}

const PLAIN_VIEWS: View[] = ['board', 'moves', 'map', 'project', 'compare', 'present'];

export function parse(search: string): Route {
  const p = new URLSearchParams(search);
  const r: Route = { view: 'home' };
  const v = p.get('view') as View | null;
  if (p.get('problem')) r.problem = p.get('problem')!;
  if (p.get('scale')) r.scale = p.get('scale') as Scale;
  if (p.get('q')) r.q = p.get('q')!;
  if (p.get('p')) r.p = p.get('p')!;
  if (p.get('ids')) r.ids = p.get('ids')!.split(',').filter(Boolean);
  if (p.get('s')) r.s = Number(p.get('s')) || 0;
  if (p.get('case')) {
    r.case = p.get('case')!;
    r.view = 'case';
  } else if (p.get('move')) {
    r.move = p.get('move')!;
    r.view = 'move';
  } else if (v && PLAIN_VIEWS.includes(v)) r.view = v;
  else if (r.problem) r.view = 'problem';
  else if (v === 'all' || r.scale || r.q) r.view = 'all';
  return r;
}

/** The app's base path: '/' on Vercel, '/CitiesExplorer/' on GitHub Pages. */
export const BASE = import.meta.env.BASE_URL;

export function href(r: Route): string {
  const p = new URLSearchParams();
  if (PLAIN_VIEWS.includes(r.view)) p.set('view', r.view);
  if (r.view === 'all' && !r.scale && !r.q) p.set('view', 'all');
  if (r.problem) p.set('problem', r.problem);
  if (r.case) p.set('case', r.case);
  if (r.move) p.set('move', r.move);
  if (r.scale) p.set('scale', r.scale);
  if (r.q) p.set('q', r.q);
  if (r.p) p.set('p', r.p);
  if (r.ids?.length) p.set('ids', r.ids.join(','));
  if (r.s) p.set('s', String(r.s));
  const s = p.toString().replace(/%2C/g, ',');
  return s ? `${BASE}?${s}` : BASE;
}

export function go(r: Route, replace = false) {
  const url = href(r);
  if (url === location.pathname + location.search) return;
  history[replace ? 'replaceState' : 'pushState'](null, '', url);
  dispatchEvent(new Event('route'));
  if (!replace) scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
}

export function useRoute(): Route {
  const [r, setR] = useState(() => parse(location.search));
  useEffect(() => {
    const f = () => setR(parse(location.search));
    addEventListener('popstate', f);
    addEventListener('route', f);
    return () => {
      removeEventListener('popstate', f);
      removeEventListener('route', f);
    };
  }, []);
  return r;
}

/** Internal link: real href for copy and new tab, client navigation on plain click. */
export function linkProps(r: Route) {
  return {
    href: href(r),
    onClick: (e: React.MouseEvent) => {
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
      e.preventDefault();
      go(r);
    },
  };
}
