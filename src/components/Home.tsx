import { motion } from 'framer-motion';
import { APPS } from '../data/apps';
import { CASES, casesFor } from '../data/cases';
import { PROBLEMS } from '../data/problems';
import { linkProps } from '../lib/route';
import { MiniSection } from './Section';

export default function Home() {
  const cities = new Set(CASES.map((c) => c.cityEn)).size;
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
            מקרי בוחן של רחובות, כיכרות ושכונות מהעולם, מסודרים לפי הבעיה התכנונית שהם פתרו. בכל מקרה: חתך לפני ואחרי, המהלכים שאפשר להעביר, מה נכשל, ומה מתאים לישראל.
          </p>
          <div className="stats">
            <div><b>{PROBLEMS.length}</b><span>בעיות</span></div>
            <div><b>{CASES.length}</b><span>מקרי בוחן</span></div>
            <div><b>{cities}</b><span>ערים</span></div>
          </div>
        </motion.div>
        <motion.div className="hero-art" initial={{ opacity: 0, rotateX: 18, y: 40 }} animate={{ opacity: 1, rotateX: 0, y: 0 }} transition={{ duration: 0.9, delay: 0.15 }}>
          <div className="layer l3"><MiniSection bands={CASES[0].section.before} /></div>
          <div className="layer l2"><MiniSection bands={CASES[2].section.after} /></div>
          <div className="layer l1"><MiniSection bands={CASES[0].section.after} /></div>
        </motion.div>
      </section>

      <section className="block">
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
                <span className="problem-count">{list.length} מקרים: {list.slice(0, 3).map((c) => c.city).join(', ')}</span>
              </motion.a>
            );
          })}
        </div>
      </section>

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
