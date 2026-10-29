import { useEffect, useRef, useState } from 'react';
import { DEV_SESSION_URL } from '../data/apps';
import { useBoard } from '../lib/board';
import { go, linkProps, type Route } from '../lib/route';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace JSX {
    interface IntrinsicElements {
      'ai-menu': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> & { chat?: string; research?: string };
    }
  }
}

/** Fixed top bar on every page: the name links home, content navigation, search, and the one A&I logo button. */
export default function TopBar({ route }: { route: Route }) {
  const board = useBoard();
  const [q, setQ] = useState(route.q ?? '');
  const t = useRef<number>();
  useEffect(() => setQ(route.q ?? ''), [route.q]);
  const menu = useRef<HTMLElement & { close?: () => void }>(null);
  useEffect(() => menu.current?.close?.(), [route]);

  const onSearch = (v: string) => {
    setQ(v);
    clearTimeout(t.current);
    t.current = window.setTimeout(() => go({ view: 'all', q: v.trim() || undefined, scale: route.view === 'all' ? route.scale : undefined }, route.view === 'all'), 220);
  };

  return (
    <header className="topbar">
      <a className="brand" {...linkProps({ view: 'home' })}>
        <span className="brand-name">ערים מעוררות השראה</span>
        <span className="brand-sub">URBAN PRECEDENTS</span>
      </a>
      <nav className="topnav" aria-label="ניווט ראשי">
        <a {...linkProps({ view: 'home' })} aria-current={route.view === 'home' || route.view === 'problem' ? 'page' : undefined}>
          בעיות
        </a>
        <a {...linkProps({ view: 'moves' })} aria-current={route.view === 'moves' || route.view === 'move' ? 'page' : undefined}>
          מהלכים
        </a>
        <a {...linkProps({ view: 'map' })} aria-current={route.view === 'map' ? 'page' : undefined}>
          מפה
        </a>
        <a {...linkProps({ view: 'all' })} aria-current={route.view === 'all' || route.view === 'case' || route.view === 'compare' ? 'page' : undefined}>
          כל המקרים
        </a>
        <a {...linkProps({ view: 'project' })} aria-current={route.view === 'project' ? 'page' : undefined}>
          הפרויקט שלי
        </a>
        <a {...linkProps({ view: 'board' })} aria-current={route.view === 'board' || route.view === 'present' ? 'page' : undefined}>
          לוח השראה
          {board.items.length ? <span className="count" title="מספר המקרים ששמרת בלוח">{board.items.length}</span> : null}
        </a>
      </nav>
      <label className="search">
        <span className="sr">חיפוש</span>
        <input type="search" value={q} placeholder="חיפוש: עיר, בעיה, מהלך" onChange={(e) => onSearch(e.target.value)} />
      </label>
      <ai-menu ref={menu} chat={DEV_SESSION_URL} />
    </header>
  );
}
