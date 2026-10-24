import { useState } from 'react';
import { caseById } from '../data/cases';
import { moveById } from '../data/moves';
import { problemById } from '../data/problems';
import { useBoard } from '../lib/board';
import { go, linkProps } from '../lib/route';

/** The personal board: saved cases with a note on what to take from each, copied as a design brief. */
export default function Board() {
  const board = useBoard();
  const [copied, setCopied] = useState('');
  const [savedId, setSavedId] = useState('');
  const entries = board.items.map((e) => ({ e, c: caseById(e.id) })).filter((x) => x.c);

  const brief = () =>
    [
      'לוח השראה: מקרי בוחן עירוניים',
      '',
      ...entries.flatMap(({ e, c }) => [
        `${c!.name} (${c!.nameEn}), ${c!.city}, ${c!.years}`,
        `בעיה: ${c!.problems.map((p) => problemById(p)?.title).join(', ')}`,
        `תובנה: ${c!.insight}`,
        e.note ? `מה לוקחים: ${e.note}` : `מהלכים: ${c!.moves.map((m) => moveById(m)?.title).join(', ')}`,
        `לבדוק: ${c!.cautions}`,
        '',
      ]),
      location.origin + '/?view=board',
    ].join('\n');

  const copy = async () => {
    const text = brief();
    try {
      await navigator.clipboard.writeText(text);
      setCopied('הלוח הועתק כתדריך');
    } catch {
      setCopied('ההעתקה נחסמה בדפדפן');
    }
    setTimeout(() => setCopied(''), 1800);
  };

  return (
    <main className="page">
      <header className="block-head page-head">
        <h1>לוח השראה</h1>
        <p>המקרים השמורים, עם הערה על מה לקחת מכל אחד. הלוח נשמר במכשיר הזה.</p>
      </header>
      {entries.length ? (
        <>
          <div className="board-actions">
            <button type="button" className="btn" onClick={copy}>העתקת הלוח כתדריך</button>
            <button type="button" className="btn ghost" onClick={() => go({ view: 'present' })}>מצגת</button>
            {entries.length > 1 ? (
              <button type="button" className="btn ghost" onClick={() => go({ view: 'compare', ids: entries.slice(0, 3).map((x) => x.e.id) })}>השוואה</button>
            ) : null}
            <button type="button" className="btn ghost" onClick={() => print()}>הדפסה</button>
            <button type="button" className="btn ghost" onClick={() => confirm('לרוקן את לוח ההשראה?') && board.clear()}>ריקון הלוח</button>
            <span className="status" role="status">{copied}</span>
          </div>
          <ol className="board">
            {entries.map(({ e, c }, i) => (
              <li key={e.id} className="board-item">
                <span className="mono">{String(i + 1).padStart(2, '0')}</span>
                <div>
                  <a className="board-title" {...linkProps({ view: 'case', case: c!.id })}>{c!.name}</a>
                  <p className="en">{c!.nameEn}, {c!.city}</p>
                  <p>{c!.insight}</p>
                  <label>
                    <span className="mono">מה לוקחים מכאן לפרויקט</span>
                    <textarea value={e.note} rows={2} placeholder="למשל: ניסוי בצבע ועציצים לפני תכנון קבוע"
                      onChange={(ev) => {
                        board.setNote(e.id, ev.target.value);
                        setSavedId(e.id);
                      }}
                    />
                    <span className="saved-hint" role="status">{savedId === e.id ? 'נשמר במכשיר' : ''}</span>
                  </label>
                </div>
                <button type="button" className="btn ghost small" onClick={() => board.toggle(e.id)}>הסרה</button>
              </li>
            ))}
          </ol>
        </>
      ) : (
        <div className="empty-box">
          <p>הלוח ריק. בכל מקרה בוחן יש כפתור "שמירה ללוח". אחרי שאוספים כמה מקרים, אפשר להעתיק את הלוח כתדריך לפרויקט.</p>
          <a className="btn" {...linkProps({ view: 'home' })}>לבחירת בעיה</a>
        </div>
      )}
    </main>
  );
}
