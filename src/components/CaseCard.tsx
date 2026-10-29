import { motion } from 'framer-motion';
import { useState } from 'react';
import { SCALES, type Case } from '../data/cases';
import { problemById } from '../data/problems';
import { useBoard } from '../lib/board';
import { photoUrl } from '../lib/photos';
import { linkProps } from '../lib/route';
import { carShare, MiniSection } from './Section';
import Flag from './Flag';

export default function CaseCard({ c, from, i = 0 }: { c: Case; from?: string; i?: number }) {
  const board = useBoard();
  const saved = board.has(c.id);
  const a = carShare(c.section.before);
  const b = carShare(c.section.after);
  const photo = c.photos?.find((p) => p.when === 'after');
  const [broken, setBroken] = useState(false);
  return (
    <motion.article
      className="card"
      initial={{ opacity: 0, y: 18 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-40px' }}
      transition={{ duration: 0.4, delay: Math.min(i, 8) * 0.04 }}
    >
      <a className="card-link" {...linkProps({ view: 'case', case: c.id, problem: from })}>
        {photo && !broken ? (
          <div className="card-art photo">
            <img src={photoUrl(photo, 500)} alt={photo.caption} loading="lazy" onError={() => setBroken(true)} />
            <div className="card-inset">
              <MiniSection bands={c.section.after} />
            </div>
          </div>
        ) : (
          <div className="card-art">
            <MiniSection bands={c.section.after} />
          </div>
        )}
        <div className="card-body">
          <div className="meta">
            <span>{c.city}, {c.country}</span>
            <span>{c.years}</span>
          </div>
          <h3><Flag country={c.countryEn} label={c.country} /> {c.name}</h3>
          <p className="en">{c.nameEn}</p>
          <p className="card-insight"><mark>{c.insight}</mark></p>
          <div className="chips">
            {c.problems.map((p) => {
              const pr = problemById(p)!;
              return (
                <span key={p} className="chip" style={{ '--c': pr.color } as React.CSSProperties}>
                  {pr.title}
                </span>
              );
            })}
          </div>
          <div className="card-foot">
            <span className="mono">{SCALES.find((s) => s.id === c.scale)?.label}</span>
            {a !== b ? <span className="mono">שטח לרכב {a}% עד {b}%</span> : null}
          </div>
        </div>
      </a>
      <button type="button" className={`save${saved ? ' on' : ''}`} aria-pressed={saved} title={saved ? 'שמור בלוח ההשראה. לחיצה מסירה אותו' : 'שומר את המקרה בלוח ההשראה שלך, במכשיר הזה בלבד, כדי לאסוף מקרים לפרויקט ולהעתיק אותם כתקציר'} onClick={() => board.toggle(c.id)}>
        {saved ? 'נשמר בלוח' : 'שמירה ללוח'}
      </button>
    </motion.article>
  );
}
