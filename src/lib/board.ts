import { useEffect, useState } from 'react';

/** The personal inspiration board: saved case ids with a note each. Kept on this device. */
export interface BoardEntry {
  id: string;
  note: string;
  at: string;
}

const KEY = 'cities-board-v1';

function read(): BoardEntry[] {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) || '[]');
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

function write(v: BoardEntry[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(v));
  } catch {
    /* storage blocked: the board lives for this visit only */
  }
  dispatchEvent(new Event('board'));
}

export function useBoard() {
  const [items, setItems] = useState(read);
  useEffect(() => {
    const f = () => setItems(read());
    addEventListener('board', f);
    addEventListener('storage', f);
    return () => {
      removeEventListener('board', f);
      removeEventListener('storage', f);
    };
  }, []);
  return {
    items,
    has: (id: string) => items.some((e) => e.id === id),
    // Read storage fresh on every write, so several writes in a row do not overwrite each other.
    toggle: (id: string) => {
      const cur = read();
      write(cur.some((e) => e.id === id) ? cur.filter((e) => e.id !== id) : [...cur, { id, note: '', at: new Date().toISOString() }]);
    },
    add: (ids: string[]) => {
      const cur = read();
      write([...cur, ...ids.filter((id) => !cur.some((e) => e.id === id)).map((id) => ({ id, note: '', at: new Date().toISOString() }))]);
    },
    setNote: (id: string, note: string) => write(read().map((e) => (e.id === id ? { ...e, note } : e))),
    clear: () => write([]),
  };
}
