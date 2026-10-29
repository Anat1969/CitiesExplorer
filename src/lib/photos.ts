import type { Photo } from '../data/cases';

const UPLOAD = 'https://upload.wikimedia.org/wikipedia/commons';
// Commons serves thumbnails only in standard widths; other widths are refused.
const STEPS = [500, 960, 1280, 1920];

const enc = (p: Photo) => encodeURIComponent(p.file.replace(/ /g, '_'));

/** Thumbnail of the given standard width, or the original when it is narrower. */
export function photoUrl(p: Photo, width: number) {
  const dir = `${p.hash[0]}/${p.hash}`;
  if (p.width <= width) return `${UPLOAD}/${dir}/${enc(p)}`;
  return `${UPLOAD}/thumb/${dir}/${enc(p)}/${width}px-${enc(p)}`;
}

export function photoSrcSet(p: Photo) {
  return STEPS.filter((w) => w < p.width)
    .map((w) => `${photoUrl(p, w)} ${w}w`)
    .join(', ');
}

/** The file's page on Commons: author, license and full resolution. */
export const photoPage = (p: Photo) => `https://commons.wikimedia.org/wiki/File:${enc(p)}`;

/** Google Maps links and embed by coordinates; no API key needed. */
export const mapsEmbed = (lat: number, lon: number) => `https://maps.google.com/maps?q=${lat},${lon}&t=k&z=17&hl=iw&output=embed`;
export const streetView = (lat: number, lon: number) => `https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${lat},${lon}`;
export const imageSearch = (q: string) => `https://www.google.com/search?tbm=isch&q=${encodeURIComponent(q)}`;
