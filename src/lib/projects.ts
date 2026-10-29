import { useEffect, useState } from 'react';
import { DEFAULT_SITE, inMeters, type Site } from './match';

/** Projects in "הפרויקט שלי": several sites, kept on this device. */
export interface Project {
  id: string;
  site: Site;
  updatedAt: string;
}

const KEY = 'cities-projects-v1';

function read(): Project[] {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) || '[]');
    return Array.isArray(v) ? v.map((p: Project) => ({ ...p, site: inMeters(p.site) })) : [];
  } catch {
    return [];
  }
}

/** False when the device refused to store (blocked or full, e.g. a large photo). */
function write(v: Project[]) {
  let ok = true;
  try {
    localStorage.setItem(KEY, JSON.stringify(v));
  } catch {
    ok = false;
  }
  dispatchEvent(new Event('projects'));
  return ok;
}

export function useProjects() {
  const [items, setItems] = useState(read);
  useEffect(() => {
    const f = () => setItems(read());
    addEventListener('projects', f);
    addEventListener('storage', f);
    return () => {
      removeEventListener('projects', f);
      removeEventListener('storage', f);
    };
  }, []);
  return {
    items,
    create(site: Partial<Site> = {}) {
      const p: Project = { id: Math.random().toString(36).slice(2, 9), site: { ...DEFAULT_SITE, createdAt: new Date().toISOString(), ...site }, updatedAt: new Date().toISOString() };
      write([p, ...read()]);
      return p;
    },
    save(id: string, site: Site) {
      return write(read().map((p) => (p.id === id ? { ...p, site, updatedAt: new Date().toISOString() } : p)));
    },
    remove(id: string) {
      write(read().filter((p) => p.id !== id));
    },
  };
}
