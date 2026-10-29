/**
 * What a street photo is made of, by the colour of its pixels.
 * The green share follows the Green View Index (Li et al. 2015, MIT Senseable City Lab "Treepedia"):
 * pixels in the green hue range with enough saturation count as vegetation. Hard surface and sky use the
 * same HSV idea. It measures colour, not objects: a green car counts as vegetation, a grey sky as surface.
 */
export interface ImageMix {
  green: number;
  hard: number;
  sky: number;
  other: number;
  /** How far the photo can be trusted for this reading. */
  reliability: 'בינונית' | 'נמוכה';
  note: string;
}

function hsv(r: number, g: number, b: number) {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  let h = 0;
  if (d) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  return { h, s: max ? d / max : 0, v: max / 255 };
}

export function analyseImage(dataUrl: string): Promise<ImageMix> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const w = 160;
      const h = Math.max(1, Math.round((img.naturalHeight / img.naturalWidth) * w));
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
      ctx.drawImage(img, 0, 0, w, h);
      const px = ctx.getImageData(0, 0, w, h).data;
      let green = 0;
      let hard = 0;
      let sky = 0;
      let dark = 0;
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const i = (y * w + x) * 4;
          const { h: hu, s, v } = hsv(px[i], px[i + 1], px[i + 2]);
          const top = y < h * 0.55;
          if (hu >= 55 && hu <= 170 && s > 0.16 && v > 0.12) green++;
          else if (top && ((hu >= 180 && hu <= 250 && s > 0.08 && v > 0.45) || (s < 0.1 && v > 0.82))) sky++;
          else if (!top && s < 0.16 && v > 0.18 && v < 0.82) hard++;
          if (v < 0.12) dark++;
        }
      }
      const n = w * h;
      const pct = (k: number) => Math.round((k / n) * 100);
      const mix = { green: pct(green), hard: pct(hard), sky: pct(sky) };
      const lowLight = dark / n > 0.35;
      resolve({
        ...mix,
        other: Math.max(0, 100 - mix.green - mix.hard - mix.sky),
        reliability: lowLight ? 'נמוכה' : 'בינונית',
        note: lowLight ? 'התמונה כהה מדי לקריאת צבע אמינה.' : 'קריאת צבע של הפיקסלים, לא זיהוי עצמים.',
      });
    };
    img.onerror = () => reject(new Error('image'));
    img.src = dataUrl;
  });
}

/** What the mix suggests for the problem, in the planner's terms. */
export function readMix(m: ImageMix): { text: string; tone: 'go' | 'wait' | 'stop'; problem?: string }[] {
  const out: { text: string; tone: 'go' | 'wait' | 'stop'; problem?: string }[] = [];
  if (m.green < 10) out.push({ text: `מעט מאוד צמחייה בתמונה (${m.green}%): סימן לחום ולמחסור בצל.`, tone: 'stop', problem: 'heat' });
  else if (m.green < 25) out.push({ text: `צמחייה חלקית (${m.green}%): יש מה להוסיף.`, tone: 'wait' });
  else out.push({ text: `צמחייה ניכרת (${m.green}%): נקודת פתיחה טובה.`, tone: 'go' });
  if (m.hard > 35) out.push({ text: `משטח קשה ואפור גדול (${m.hard}%): מעיד על רחוב שמוקדש לרכב ועל נגר.`, tone: 'stop', problem: 'car-street' });
  else if (m.hard > 20) out.push({ text: `משטח קשה בינוני (${m.hard}%).`, tone: 'wait' });
  if (m.sky > 30) out.push({ text: `שמיים פתוחים (${m.sky}%): חשיפה לשמש בלי הצללה.`, tone: 'wait', problem: 'heat' });
  return out;
}
