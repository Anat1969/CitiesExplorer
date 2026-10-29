import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import type { Case } from '../data/cases';
import { imageSearch, mapsEmbed, photoPage, photoSrcSet, photoUrl, streetView } from '../lib/photos';

/** Photos of the place from Wikimedia Commons, with credit, and the site from above on Google Maps. */
export default function Photos({ c }: { c: Case }) {
  const [failed, setFailed] = useState<string[]>([]);
  const photos = (c.photos ?? []).filter((p) => !failed.includes(p.file));
  const [i, setI] = useState(0);
  const [view, setView] = useState<'photo' | 'map'>('photo');
  useEffect(() => {
    setI(0);
    setFailed([]);
    setView('photo');
  }, [c.id]);
  const p = photos[Math.min(i, photos.length - 1)];
  const mode = p ? view : 'map';

  return (
    <section className="photos" aria-label="תמונות המקום">
      <div className="photo-frame" data-view={mode}>
        {mode === 'photo' && p ? (
          <AnimatePresence mode="wait">
            <motion.figure key={p.file} initial={{ opacity: 0, scale: 1.02 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.35 }}>
              <img
                src={photoUrl(p, 1280)}
                srcSet={photoSrcSet(p) || undefined}
                sizes="(max-width: 1100px) 100vw, 1100px"
                alt={p.caption}
                onError={() => setFailed((f) => [...f, p.file])}
              />
              {p.when === 'before' ? <span className="photo-tag mono">לפני ההתערבות</span> : null}
            </motion.figure>
          </AnimatePresence>
        ) : (
          <iframe title={`${c.name} ממבט על`} src={mapsEmbed(c.lat, c.lon)} loading="lazy" referrerPolicy="no-referrer-when-downgrade" />
        )}
      </div>
      <div className="photo-bar">
        <div className="photo-thumbs" role="tablist" aria-label="בחירת תמונה">
          {photos.map((ph, k) => (
            <button
              key={ph.file}
              type="button"
              role="tab"
              aria-selected={mode === 'photo' && k === i}
              aria-label={ph.caption}
              onClick={() => {
                setI(k);
                setView('photo');
              }}
            >
              <img src={photoUrl(ph, 500)} alt="" loading="lazy" />
            </button>
          ))}
          <button type="button" role="tab" className="map-tab" aria-selected={mode === 'map'} onClick={() => setView('map')}>
            ממבט על
          </button>
        </div>
        <div className="photo-links">
          <a className="btn ghost small" href={imageSearch(`${c.nameEn} ${c.cityEn}`)} target="_blank" rel="noopener noreferrer" title="חיפוש תמונות של המקרה בגוגל, לצפייה ולשמירה">
            עוד תמונות
          </a>
          <a className="btn ghost small" href={streetView(c.lat, c.lon)} target="_blank" rel="noopener noreferrer" title="הליכה וירטואלית ברחוב, במפות Google">
            Street View
          </a>
        </div>
      </div>
      <p className="photo-credit">
        {mode === 'photo' && p ? (
          <>
            <span>{p.caption}</span>
            <span className="mono">
              צילום: {p.author}, {p.license},{' '}
              <a href={photoPage(p)} target="_blank" rel="noopener noreferrer">
                Wikimedia Commons
              </a>
            </span>
          </>
        ) : (
          <span>מבט לוויין לפי הקואורדינטות של המקרה, ממפות Google. אפשר לגרור ולהתקרב.</span>
        )}
      </p>
    </section>
  );
}
