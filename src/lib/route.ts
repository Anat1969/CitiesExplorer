import { useEffect, useState } from 'react';
import type { Scale } from '../data/cases';

export interface Route {
  view: 'home' | 'problem' | 'case' | 'all' | 'board';
  problem?: string;
  case?: string;
  scale?: Scale;
  q?: string;
}

export function parse(search: string): Route {
  const p = new URLSearchParams(search);
  const r: Route = { view: 'home' };
  if (p.get('problem')) r.problem = p.get('problem')!;
  if (p.get('scale')) r.scale = p.get('scale') as Scale;
  if (p.get('q')) r.q = p.get('q')!;
  if (p.get('case')) {
    r.case = p.get('case')!;
    r.view = 'case';
  } else if (p.get('view') === 'board') r.view = 'board';
  else if (r.problem) r.view = 'problem';
  else if (p.get('view') === 'all' || r.scale || r.q) r.view = 'all';
  return r;
}

export function href(r: Route): string {
  const p = new URLSearchParams();
  if (r.view === 'board') p.set('view', 'board');
  if (r.view === 'all' && !r.scale && !r.q) p.set('view', 'all');
  if (r.problem) p.set('problem', r.problem);
  if (r.case) p.set('case', r.case);
  if (r.scale) p.set('scale', r.scale);
  if (r.q) p.set('q', r.q);
  const s = p.toString();
  return s ? `/?${s}` : '/';
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
