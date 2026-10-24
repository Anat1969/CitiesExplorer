import { linkProps } from '../lib/route';

export default function NotFound() {
  return (
    <main className="page empty">
      <h1>הדף לא נמצא</h1>
      <p>ייתכן שהקישור ישן.</p>
      <a className="btn" {...linkProps({ view: 'home' })}>לדף הבית</a>
    </main>
  );
}
