import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useEffect, useRef } from 'react';

const STREETS = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
const SATELLITE = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';

/** A map to pin the site: a click sets the location. Streets from OpenStreetMap, satellite from Esri. */
export default function SiteMap({ lat, lon, onPick }: { lat?: number; lon?: number; onPick: (lat: number, lon: number) => void }) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const pin = useRef<L.CircleMarker | null>(null);
  const pick = useRef(onPick);
  pick.current = onPick;

  useEffect(() => {
    if (!el.current || map.current) return;
    const m = L.map(el.current, { zoomControl: true, attributionControl: true }).setView(lat != null && lon != null ? [lat, lon] : [31.6, 34.9], lat != null ? 18 : 8);
    const streets = L.tileLayer(STREETS, { maxZoom: 19, attribution: '&copy; OpenStreetMap' }).addTo(m);
    const sat = L.tileLayer(SATELLITE, { maxZoom: 19, attribution: 'Esri World Imagery' });
    L.control.layers({ מפה: streets, לוויין: sat }, undefined, { position: 'topleft' }).addTo(m);
    m.on('click', (e: L.LeafletMouseEvent) => pick.current(+e.latlng.lat.toFixed(6), +e.latlng.lng.toFixed(6)));
    map.current = m;
    return () => {
      m.remove();
      map.current = null;
      pin.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const m = map.current;
    if (!m || lat == null || lon == null) return;
    if (!pin.current) pin.current = L.circleMarker([lat, lon], { radius: 10, color: '#fff', weight: 3, fillColor: '#17191c', fillOpacity: 1 }).addTo(m);
    else pin.current.setLatLng([lat, lon]);
    if (!m.getBounds().pad(-0.2).contains([lat, lon]) || m.getZoom() < 16) m.setView([lat, lon], Math.max(m.getZoom(), 18));
  }, [lat, lon]);

  return <div ref={el} className="site-map" role="application" aria-label="מפה לבחירת מיקום האתר. לחיצה קובעת את המיקום" />;
}
