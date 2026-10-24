import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { APPS } from '../data/apps';
import { CASES, casesFor, isIsrael } from '../data/cases';
import { MOVES } from '../data/moves';
import { PROBLEMS, problemById } from '../data/problems';
import { linkProps } from '../lib/route';
import CaseCard from './CaseCard';
import Section, { carShare } from './Section';

const SHOWCASE = ['cheonggyecheon', 'superilles', 'dizengoff-square', 'high-line', 'benthemplein', 'madrid-rio'];

/** Hero: real cases transform from before to after, one after another. */
function Transform() {
  const reduce = useReducedMotion();
  const list = SHOWCASE.map((id) => CASES.find((c) => c.id === id)).filter(Boolean) as typeof CASES;
  const [i, setI] = useState(0);
  const [mode, setMode] = useState<'before' | 'after'>('before');
  useEffect(() => {
    if (reduce) return;
    const t = setTimeout(() => (mode === 'before' ? setMode('after') : (setMode('before'), setI((i + 1) % list.length))), mode === 'before' ? 1600 : 3200);
    return () => clearTimeout(t);
  }, [mode, i, reduce, list.length]);
  const c = list[i];
  const p = problemById(c.problems[0])!;
  return (
    <div className="transform">
      <div className="transform-stage">
        <Section before={c.section.before} after={c.section.after} mode={reduce ? 'after' : mode} />
      </div>
      <AnimatePresence mode="wait">
        <motion.a key={c.id} className="transform-label" {...linkProps({ view: 'case', case: c.id })} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} style={{ '--c': p.color } as React.CSSProperties}>
          <span className="mono">{p.title}</span>
          <b>{c.name}</b>
          <span className="en">{c.city}, {c.years}</span>
          <span className="mono share">
            {mode === 'before' && !reduce ? 'לפני' : 'אחרי'}: שטח לרכב {carShare(mode === 'before' && !reduce ? c.section.before : c.section.after)}%
          </span>
        </motion.a>
      </AnimatePresence>
      <div className="dots" role="group" aria-label="בחירת מקרה בתצוגה">
        {list.map((x, k) => (
          <button key={x.id} type="button" aria-pressed={k === i} aria-label={x.name} onClick={() => (setI(k), setMode('before'))} />
        ))}
      </div>
    </div>
  );
}

export default function Home() {
  const cities = new Set(CASES.map((c) => c.cityEn)).size;
  const israel = CASES.filter(isIsrael);
  return (
    <main className="page">
      <section className="hero">
        <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
          <p className="eyebrow">אטלס תקדימים לפי בעיה</p>
          <h1>
            כל בעיה עירונית
            <br />
            כבר נפתרה איפשהו.
          </h1>
          <p className="lede">
            רחובות, כיכרות ושכונות מהעולם ומישראל, מסודרים לפי הבעיה התכנונית שהם פתרו. מתארים את האתר שלך, ומקבלים את המקרים הקרובים, אסטרטגיה מדורגת והסיכונים שכדאי לבדוק.
          </p>
          <div className="hero-actions">
            <a className="btn" {...linkProps({ view: 'project' })}>להתחיל מהאתר שלי</a>
            <a className="btn ghost" href="#problems">לבחור בעיה</a>
          </div>
          <div className="stats">
            <div><b>{PROBLEMS.length}</b><span>בעיות</span></div>
            <div><b>{CASES.length}</b><span>מקרי בוחן</span></div>
            <div><b>{MOVES.length}</b><span>מהלכים</span></div>
            <div><b>{cities}</b><span>ערים</span></div>
            <div><b>{israel.length}</b><span>בישראל</span></div>
          </div>
        </motion.div>
        <motion.div className="hero-art" initial={{ opacity: 0, rotateX: 14, y: 40 }} animate={{ opacity: 1, rotateX: 0, y: 0 }} transition={{ duration: 0.9, delay: 0.15 }}>
          <Transform />
        </motion.div>
      </section>

      <section className="block">
        <div className="block-head">
          <h2>שלוש דרכים להתחיל</h2>
        </div>
        <div className="ways">
          <a className="way primary" {...linkProps({ view: 'project' })}>
            <span className="mono">01 כלי</span>
            <b>הפרויקט שלי</b>
            <p>משרטטים את החתך הקיים, בוחרים בעיה, אקלים ותקציב. מקבלים דירוג שקוף של המקרים הקרובים ותדריך מוכן.</p>
          </a>
          <a className="way" {...linkProps({ view: 'moves' })}>
            <span className="mono">02 שפת דפוסים</span>
            <b>מטריצת המהלכים</b>
            <p>{MOVES.length} מהלכים מול {PROBLEMS.length} בעיות. מה מוכח, מה בא יחד, ואיפה יש פער שעוד לא נוסה.</p>
          </a>
          <a className="way" {...linkProps({ view: 'map' })}>
            <span className="mono">03 מקום וזמן</span>
            <b>מפה וציר זמן</b>
            <p>איך הרעיונות נדדו בין ערים, מסגירת סטרויט ב-1962 ועד ערים ספוגיות.</p>
          </a>
        </div>
      </section>

      <section className="block" id="problems">
        <div className="block-head">
          <h2>מאיזו בעיה מתחילים?</h2>
          <p>בוחרים בעיה, וקוראים קודם את המהלכים שחוזרים בכל המקרים שפתרו אותה.</p>
        </div>
        <div className="problems">
          {PROBLEMS.map((p, i) => {
            const list = casesFor(p.id);
            return (
              <motion.a
                key={p.id}
                className="problem"
                style={{ '--c': p.color } as React.CSSProperties}
                {...linkProps({ view: 'problem', problem: p.id })}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: i * 0.04 }}
                whileHover={{ y: -4 }}
              >
                <span className="code">{p.code}</span>
                <h3>{p.title}</h3>
                <p>{p.question}</p>
                <span className="problem-count">{list.length} מקרים: {[...new Set(list.map((c) => c.city))].slice(0, 3).join(', ')}</span>
              </motion.a>
            );
          })}
        </div>
      </section>

      {israel.length ? (
        <section className="block">
          <div className="block-head">
            <h2>מישראל</h2>
            <p>מקרים מקומיים, עם מה שאפשר ללמוד מהם בערים אחרות בארץ.</p>
          </div>
          <div className="grid">
            {israel.map((c, i) => (
              <CaseCard key={c.id} c={c} i={i} />
            ))}
          </div>
        </section>
      ) : null}

      <section className="block apps-block">
        <div className="block-head">
          <h2>מההשראה לעבודה</h2>
          <p>אפליקציות משלימות: למדוד את המקום שלך, לבדוק מסלול התחדשות, ולמצוא פתרון בטבע.</p>
        </div>
        <div className="apps">
          {Object.values(APPS).map((a) => (
            <a key={a.name} className="app" href={a.url} target="_blank" rel="noopener noreferrer">
              <b>{a.name}</b>
              <span>{a.why}</span>
            </a>
          ))}
        </div>
      </section>
    </main>
  );
}
