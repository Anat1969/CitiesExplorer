import { useState } from 'react';
import { resizeImage } from '../lib/image';

/** Upload of a photo of the existing situation: shown, replaced or removed. */
export default function SitePhoto({ photo, onChange }: { photo?: string; onChange: (p: string | undefined) => void }) {
  const [msg, setMsg] = useState('');
  const pick = async (f?: File) => {
    if (!f) return;
    try {
      setMsg('מעבד את התמונה...');
      onChange(await resizeImage(f));
      setMsg('');
    } catch {
      setMsg('הקובץ אינו תמונה');
    }
  };
  return (
    <div className="site-photo">
      {photo ? <img src={photo} alt="המצב הקיים באתר" /> : <div className="site-photo-empty">אין עדיין תמונה של האתר</div>}
      <div className="site-photo-actions">
        <label className="btn small">
          {photo ? 'החלפת התמונה' : 'העלאת תמונה של הבעיה'}
          <input type="file" accept="image/*" className="sr" onChange={(e) => pick(e.target.files?.[0])} />
        </label>
        {photo ? (
          <button type="button" className="btn ghost small" onClick={() => onChange(undefined)}>
            הסרה
          </button>
        ) : null}
        <span className="status" role="status">{msg}</span>
      </div>
    </div>
  );
}
