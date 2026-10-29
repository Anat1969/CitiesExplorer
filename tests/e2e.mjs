// End-to-end test against `vite preview` (port 4173). The shared A&I menu script is served from a local copy,
// fonts are stubbed. Run: npm run build && (npx vite preview --port 4173 &) && node tests/e2e.mjs
import { chromium } from 'playwright';
import fs from 'fs';

const BASE = process.env.BASE || 'http://localhost:4173';
const DATA = JSON.parse(fs.readFileSync(new URL('../src/data/cases.json', import.meta.url), 'utf8'));
const MENU = fs.readFileSync(new URL('./fixtures/ai-menu.js', import.meta.url), 'utf8');
const PHOTO = fs.readFileSync(new URL('./fixtures/photo.jpg', import.meta.url));
const TILE = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGN49OAWAAVEAp2bl6lcAAAAAElFTkSuQmCC', 'base64');
// A secondary street in Ashdod, as OpenStreetMap returns it: some values mapped, the rest left to estimate.
const OVERPASS = {
  elements: [
    { type: 'way', tags: { highway: 'secondary', name: 'הרצל', lanes: '4', sidewalk: 'both', 'parking:both': 'lane', maxspeed: '50' }, geometry: [{ lat: 31.7965, lon: 34.6445 }, { lat: 31.7980, lon: 34.6462 }] },
    { type: 'count', tags: { total: '2' } },
    { type: 'count', tags: { total: '0' } },
  ],
};
// Photos come from Wikimedia Commons and the view from above from Google Maps: both stubbed, so the test runs offline.
const stubExternal = async (ctx) => {
  await ctx.route('https://appofapp-gh.vercel.app/ai-menu.js', (r) => r.fulfill({ body: MENU, contentType: 'text/javascript' }));
  await ctx.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.fulfill({ body: '', contentType: 'text/css' }));
  await ctx.route(/upload\.wikimedia\.org/, (r) => r.fulfill({ body: PHOTO, contentType: 'image/jpeg' }));
  await ctx.route(/tile\.openstreetmap\.org|arcgisonline\.com/, (r) => r.fulfill({ body: TILE, contentType: 'image/png' }));
  await ctx.route(/nominatim\.openstreetmap\.org\/search/, (r) => r.fulfill({ json: [{ lat: '31.7972', lon: '34.6453', display_name: 'הרצל, אשדוד, ישראל' }] }));
  await ctx.route(/nominatim\.openstreetmap\.org\/reverse/, (r) => r.fulfill({ json: { display_name: 'הרצל 20, אשדוד, ישראל' } }));
  await ctx.route(/overpass-api\.de/, (r) => r.fulfill({ json: OVERPASS }));
  await ctx.route(/maps\.google\.com/, (r) => r.fulfill({ body: '<html><body style="background:#8a9a7a"></body></html>', contentType: 'text/html' }));
};
fs.mkdirSync(new URL('./shots/', import.meta.url), { recursive: true });
const shot = async (p, n) => {
  await p.evaluate(async () => {
    for (let y = 0; y < document.body.scrollHeight; y += 400) {
      scrollTo(0, y);
      await new Promise((r) => setTimeout(r, 60));
    }
    scrollTo(0, 0);
  });
  await p.waitForTimeout(900);
  return p.screenshot({ path: new URL(`./shots/${n}.png`, import.meta.url).pathname, fullPage: true });
};

let fails = 0;
let passes = 0;
const ok = (cond, msg) => {
  if (cond) passes++;
  else {
    fails++;
    console.log('FAIL', msg);
  }
};

const browser = await chromium.launch();
const errors = [];

async function newPage(viewport = { width: 1360, height: 900 }) {
  const ctx = await browser.newContext({ viewport, locale: 'he-IL' });
  await ctx.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: BASE });
  await stubExternal(ctx);
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  return page;
}

const noHScroll = (p) => p.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1);

// Home
const page = await newPage();
await page.goto(BASE + '/');
await page.waitForSelector('.problem');
ok((await page.locator('.problem').count()) === 9, 'nine problems on home');
ok(await page.locator('ai-menu .logo').isVisible(), 'A&I logo button in the top bar');
ok(!(await page.locator('header >> text=העתקת קישור').first().isVisible().catch(() => false)), 'no loose development buttons in the bar');
ok((await page.locator('.apps-block .app').count()) === 4, 'four related apps on home');
ok((await page.locator('.way').count()) === 3, 'three ways in on home');
ok((await page.locator('.transform .section-svg').count()) === 1, 'hero transformation drawn');
await page.locator('.dots button').nth(2).click();
ok((await page.locator('.dots button').nth(2).getAttribute('aria-pressed')) === 'true', 'hero dot selects a case');
ok((await page.locator('.grid .card').count()) === DATA.filter((c) => c.countryEn === 'Israel').length, 'Israeli cases strip on home');
await shot(page, 'home');

// Install readiness
const cdp = await page.context().newCDPSession(page);
const inst = await cdp.send('Page.getInstallabilityErrors');
ok(inst.installabilityErrors.length === 0, 'installable: ' + JSON.stringify(inst.installabilityErrors));
ok(await page.evaluate(async () => !!(await navigator.serviceWorker.getRegistration())), 'service worker registered');

// A&I menu: copy link copies the current state
await page.goto(BASE + '/?problem=flooding');
await page.locator('ai-menu .logo').click();
const panelItems = await page.locator('ai-menu .item').allTextContents();
ok(panelItems.some((t) => t.includes('העתקת קישור')), 'copy link inside the menu');
ok(panelItems.some((t) => t.includes('שיחת הפיתוח')), 'dev chat inside the menu');
ok(panelItems.some((t) => t.includes('התקנת האפליקציה')), 'install inside the menu');
await page.locator('ai-menu .item', { hasText: 'העתקת קישור' }).click();
ok((await page.evaluate(() => navigator.clipboard.readText())).includes('?problem=flooding'), 'copied link keeps the state');

// Every problem page and every case card on it
await page.goto(BASE + '/');
const problemIds = await page.locator('.problem').evaluateAll((els) => els.map((e) => new URL(e.href).searchParams.get('problem')));
for (const id of problemIds) {
  await page.goto(BASE + '/');
  await page.locator(`.problem[href$="?problem=${id}"]`).click();
  await page.waitForSelector('.problem-head');
  ok(page.url().includes(`problem=${id}`), `problem ${id} opens`);
  ok((await page.locator('.moves li').count()) >= 2, `problem ${id} has synthesis moves`);
  const n = await page.locator('.card').count();
  ok(n >= 2, `problem ${id} has at least two cases (${n})`);
  ok(await page.locator('.topbar').isVisible(), `top bar on problem ${id}`);
}

// Every case page
await page.goto(BASE + '/?view=all');
await page.waitForSelector('.card');
const allIds = await page.locator('.card-link').evaluateAll((els) => els.map((e) => new URL(e.href).searchParams.get('case')));
ok(allIds.length === DATA.length, `all cases listed (${allIds.length})`);
for (const id of allIds) {
  await page.goto(BASE + `/?case=${id}`);
  await page.waitForSelector('.case-head h1');
  ok((await page.locator('.story section').count()) === 3, `case ${id} story`);
  ok((await page.locator('.section-frame .section-svg').count()) === 1, `case ${id} section drawing`);
  await page.getByRole('tab', { name: 'לפני', exact: true }).click();
  await page.waitForSelector('.section-frame[data-mode="before"]');
  await page.getByRole('tab', { name: 'אחרי', exact: true }).click();
  await page.waitForSelector('.section-frame[data-mode="after"]');
  const maps = await page.locator('a', { hasText: 'במפות Google' }).getAttribute('href');
  ok(maps.startsWith('https://www.google.com/maps/search/'), `case ${id} maps link`);
  ok((await page.locator('.apps .app').count()) >= 1, `case ${id} next-step apps`);
  ok((await page.locator('.grid .card').count()) >= 1, `case ${id} related cases`);
  ok((await page.locator('.facts li').count()) >= 2, `case ${id} facts`);
  ok((await page.locator('.sources a').count()) >= 1, `case ${id} sources`);
  ok((await page.locator('.takeaways li a').count()) >= 3, `case ${id} moves linked`);
  ok((await page.locator('.profile div').count()) === 5, `case ${id} profile`);
  ok((await page.locator('h1 .flag').count()) === 1, `case ${id} flag`);
  const c = DATA.find((x) => x.id === id);
  if (c.photos?.length) {
    await page.waitForSelector('.photo-frame img');
    ok((await page.locator('.photo-thumbs img').count()) === c.photos.length, `case ${id} photos (${c.photos.length})`);
    ok((await page.locator('.photo-credit a').getAttribute('href')).startsWith('https://commons.wikimedia.org/wiki/File:'), `case ${id} photo credit`);
  }
  ok((await page.locator('.photo-links a', { hasText: 'עוד תמונות' }).getAttribute('href')).startsWith('https://www.google.com/search?tbm=isch'), `case ${id} more photos link`);
  ok((await page.locator('.photo-links a', { hasText: 'Street View' }).getAttribute('href')).includes('map_action=pano'), `case ${id} street view`);
}
const withPhotos = DATA.filter((c) => c.photos?.length).length;
ok(withPhotos >= 45, `most cases have photos (${withPhotos} of ${DATA.length})`);

// Photos: thumbnails switch, the view from above opens Google Maps
await page.goto(BASE + '/?case=high-line');
await page.waitForSelector('.photo-frame img');
await page.locator('.photo-thumbs button').nth(1).click();
ok((await page.locator('.photo-thumbs button').nth(1).getAttribute('aria-selected')) === 'true', 'photo thumbnail selects');
await page.locator('.photo-thumbs .map-tab').click();
ok((await page.locator('.photo-frame iframe').getAttribute('src')).includes('output=embed'), 'view from above embeds Google Maps');
ok((await page.locator('.story section[data-tone="go"]').count()) === 1 && (await page.locator('.panel[data-tone="stop"]').count()) === 1, 'traffic light on result and cautions');
ok((await page.locator('.case-head mark').count()) === 1, 'insight highlighted');
ok((await page.locator('.story strong').count()) >= 1, 'key figures in bold');
const saveH = await page.locator('.case-actions .save').evaluate((e) => e.getBoundingClientRect().height);
const rowH = await page.locator('.case-actions > *').evaluateAll((els) => els.map((e) => Math.round(e.getBoundingClientRect().height)));
ok(new Set(rowH).size === 1, `case actions share one height (${rowH})`);
ok(saveH <= 36 && (await page.locator('.case-actions .save').getAttribute('title')).length > 20, 'save button small and explained');

// Case navigation from a problem keeps the context in the crumbs
await page.goto(BASE + '/?problem=heat');
await page.locator('.card-link').first().click();
await page.waitForSelector('.case-head');
ok(page.url().includes('problem=heat'), 'case opened from a problem keeps the problem in the address');
ok((await page.locator('.crumbs').textContent()).includes('חום'), 'crumbs show the problem');
await page.locator('.crumbs a').nth(1).click();
await page.waitForSelector('.problem-head');
ok(page.url().endsWith('?problem=heat'), 'crumb back to problem');
await page.goBack();
await page.waitForSelector('.case-head');
ok(page.url().includes('case='), 'browser back works');

// Name links home
await page.locator('.brand').click();
await page.waitForSelector('.hero');
ok(new URL(page.url()).search === '', 'app name links home');

// Scale filters and search
await page.goto(BASE + '/?view=all');
for (const label of ['רחוב', 'כיכר', 'שכונה', 'עיר']) {
  await page.locator('.filters button', { hasText: label }).click();
  await page.waitForTimeout(80);
  const n = await page.locator('.card').count();
  ok(n >= 3, `scale ${label} shows cases (${n})`);
  ok((await page.locator('.filters button', { hasText: label }).getAttribute('aria-pressed')) === 'true', `scale ${label} pressed`);
}
await page.locator('.filters button', { hasText: 'הכול' }).click();
await page.locator('.search input').fill('ברצלונה');
await page.waitForURL(/q=/);
await page.waitForTimeout(100);
ok((await page.locator('.card').count()) >= 1, 'search by city');
ok((await page.locator('.card h3').first().textContent()).includes('ברצלונה'), 'search finds Barcelona');
await page.locator('.search input').fill('בהצפות');
await page.waitForTimeout(400);
ok((await page.locator('.card').count()) >= 3, 'search strips Hebrew prefix and finds flooding');
await page.locator('.search input').fill('Superkilen');
await page.waitForTimeout(400);
ok((await page.locator('.card').count()) === 1, 'search by English name');
await page.locator('.search input').fill('קשקשת');
await page.waitForTimeout(400);
ok(await page.locator('.empty-box').isVisible(), 'empty search explains what to search');
await page.locator('.empty-box .chip').first().click();
await page.waitForSelector('.problem-head');
ok(true, 'empty search suggestion opens a problem');

// Board: save, count, note, copy brief, remove, clear
await page.goto(BASE + '/?view=board');
ok(await page.locator('.empty-box').isVisible(), 'empty board explains');
await page.goto(BASE + '/?problem=car-street');
await page.locator('.card .save').nth(0).click();
await page.locator('.card .save').nth(1).click();
ok((await page.locator('.topnav .count').textContent()) === '2', 'board count in the bar');
ok((await page.locator('.card .save').nth(0).getAttribute('aria-pressed')) === 'true', 'save toggles pressed');
await page.goto(BASE + '/?case=benthemplein');
await page.locator('.case-actions .save', { hasText: 'שמירה ללוח' }).click();
ok((await page.locator('.topnav .count').textContent()) === '3', 'save from case page');
await page.locator('.topnav a', { hasText: 'לוח השראה' }).click();
await page.waitForSelector('.board-item');
ok((await page.locator('.board-item').count()) === 3, 'board lists saved cases');
await page.locator('.board-item textarea').first().fill('ניסוי בצבע בצומת ביאליק');
ok((await page.locator('.saved-hint').first().textContent()).includes('נשמר'), 'note shows saved');
await page.reload();
await page.waitForSelector('.board-item');
ok((await page.locator('.board-item textarea').first().inputValue()) === 'ניסוי בצבע בצומת ביאליק', 'note survives reload');
await page.locator('button', { hasText: 'העתקת הלוח כתדריך' }).click();
await page.waitForTimeout(150);
const brief = await page.evaluate(() => navigator.clipboard.readText());
ok(brief.includes('לוח השראה') && brief.includes('ניסוי בצבע בצומת ביאליק') && brief.includes('Waterplein'), 'brief copied with note');
ok((await page.locator('.board-actions .status').textContent()).includes('הועתק'), 'copy status shown');
await shot(page, 'board');
await page.locator('.board-item .btn', { hasText: 'הסרה' }).first().click();
ok((await page.locator('.board-item').count()) === 2, 'remove from board');
page.once('dialog', (d) => d.accept());
await page.locator('button', { hasText: 'ריקון הלוח' }).click();
await page.waitForSelector('.empty-box');
ok(!(await page.locator('.topnav .count').isVisible().catch(() => false)), 'board cleared');

// Unknown ids
await page.goto(BASE + '/?case=nope');
ok(await page.locator('text=הדף לא נמצא').isVisible(), 'unknown case shows not found');

await page.goto(BASE + '/?case=cheonggyecheon');
await page.waitForSelector('.case-head');
await shot(page, 'case-desktop');

// Project tool: place, problem in words, photo, section in meters, the check, results
await page.goto(BASE + '/?view=project');
await page.waitForURL(/p=/);
const pid = new URL(page.url()).searchParams.get('p');
ok(!!pid, 'project created with id in the address');
ok((await page.locator('.name-field input').getAttribute('placeholder')).includes('אשדוד'), 'example name is in Ashdod');
ok((await page.locator('.pipeline li').count()) === 6, 'the process is shown as six steps');
ok((await page.locator('.results-wait').count()) === 1, 'results wait for the check');
// Place: address search reads the street from OpenStreetMap
await page.locator('.place-search input').fill('הרצל אשדוד');
await page.locator('.place-search .btn').click();
await page.waitForSelector('.facts-grid');
ok((await page.locator('.facts-grid').textContent()).includes('הרצל'), 'street read from OSM');
ok((await page.locator('.facts-grid .src-tag.osm').count()) >= 3 && (await page.locator('.facts-grid .src-tag.est').count()) >= 1, 'each value says if it was mapped or estimated');
ok((await page.locator('.fields .filters button[aria-pressed="true"]', { hasText: 'ים תיכוני' }).count()) === 1, 'climate set from the location');
await page.waitForSelector('.site-map .leaflet-container, .site-map.leaflet-container');
const mapBox = await page.locator('.site-map').boundingBox();
await page.mouse.click(mapBox.x + mapBox.width / 2 + 30, mapBox.y + mapBox.height / 2 + 20);
await page.waitForTimeout(400);
ok((await page.locator('.place-data .address').count()) === 1, 'a click on the map sets the place');
const carBands = await page.locator('.sc-dim').count();
ok(carBands >= 7, `section built from the street data (${carBands} strips)`);
// Problem in words
await page.locator('#ptext').fill('הרחוב מלא ברכבים חונים, המדרכות צרות ואין צל. בקיץ חם מאוד ובגשם הצומת מוצף.');
await page.waitForSelector('.guess');
const g = await page.locator('.guess b').allTextContents();
ok(g.some((t) => t.includes('הרכב')) && g.some((t) => t.includes('חום')), `words point to problems (${g.join(' | ')})`);
await page.locator('.guess').first().click();
ok((await page.locator('.guess').first().getAttribute('aria-pressed')) === 'true', 'a guess becomes a project problem');
await page.locator('.problem-pick .chip', { hasText: 'הצפות ומי נגר' }).click();
// Photo: colour reading
await page.locator('.problem-photo input[type=file]').setInputFiles(new URL('./fixtures/photo.jpg', import.meta.url).pathname);
await page.waitForSelector('.mix-legend');
ok((await page.locator('.reading li').count()) >= 1, 'photo read: green, hard surface, sky');
for (const label of ['רחוב', 'נמוך']) {
  await page.locator('.fields .filters button', { hasText: label }).first().click();
  ok((await page.locator('.fields .filters button', { hasText: label }).first().getAttribute('aria-pressed')) === 'true', `project choice ${label}`);
}
// Section on the drawing: drag a boundary, click a strip, change use and width
const handle = page.locator('.sc-handle').nth(1);
await handle.scrollIntoViewIfNeeded();
const before = await page.locator('.sc-dim span').allTextContents();
const total0 = await page.locator('.sc-total input').inputValue();
const hb = await handle.boundingBox();
await page.mouse.move(hb.x + hb.width / 2, hb.y + hb.height / 2);
await page.mouse.down();
await page.mouse.move(hb.x + hb.width / 2 + 60, hb.y + hb.height / 2, { steps: 6 });
await page.mouse.up();
const after = await page.locator('.sc-dim span').allTextContents();
ok(before.join() !== after.join(), 'dragging a boundary changes the widths');
ok(Math.abs(Number(total0) - Number(await page.locator('.sc-total input').inputValue())) < 0.01, 'drag keeps the total width');
await page.locator('.sc-hit').nth(2).click();
await page.waitForSelector('.sc-panel');
await page.locator('.sc-types button', { hasText: 'צמחייה' }).click();
ok((await page.locator('.sc-panel b').textContent()).includes('צמחייה'), 'strip use changed on the drawing');
await page.locator('.sc-fields input').fill('3.5');
ok((await page.locator('.sc-dim span').nth(2).textContent()).startsWith('3.5'), 'strip width typed in meters');
const n0 = await page.locator('.sc-hit').count();
await page.locator('.sc-actions button', { hasText: 'פיצול' }).click();
ok((await page.locator('.sc-hit').count()) === n0 + 1, 'strip split');
await page.locator('.sc-actions button', { hasText: 'מחיקה' }).click();
ok((await page.locator('.sc-hit').count()) === n0, 'strip deleted');
await page.locator('.sc-total input').fill('30');
ok(Math.abs(Number(await page.locator('.sc-total input').inputValue()) - 30) < 0.3, 'total width scales the section');
// The check: five steps, then results in percent
await page.locator('.btn.run').click();
await page.waitForSelector('.checks li[data-state="run"]');
ok(true, 'the check runs step by step');
await page.waitForSelector('#results .match', { timeout: 8000 });
ok((await page.locator('.checks li[data-state="done"]').count()) === 5, 'all five checks done');
ok((await page.locator('.checks .tool').count()) === 5, 'every check names its tool');
ok((await page.locator('.match').count()) === 6, 'six matches shown');
ok((await page.locator('.match-score').first().textContent()).endsWith('%'), 'match in percent');
ok((await page.locator('.phase li').count()) >= 3, 'strategy has moves');
ok((await page.locator('.risks li').count()) === 3, 'three risks');
ok((await page.locator('.pipeline li[data-ok="true"]').count()) >= 5, 'pipeline shows the steps done');
await page.locator('.name-field input').fill('רחוב הרצל, אשדוד');
await page.waitForTimeout(500);
ok((await page.locator('.project-bar .status').textContent()).includes('נשמר'), 'project saved status');
await page.reload();
await page.waitForSelector('.match');
ok((await page.locator('.name-field input').inputValue()) === 'רחוב הרצל, אשדוד', 'project survives reload');
ok((await page.locator('.mix-legend').count()) === 1 && (await page.locator('.facts-grid').count()) === 1, 'photo reading and street data survive reload');
await page.locator('button', { hasText: 'אימוץ החתך' }).click();
await page.waitForTimeout(450);
await page.locator('button', { hasText: 'העתקת תקציר' }).click();
await page.waitForTimeout(150);
const pbrief = await page.evaluate(() => navigator.clipboard.readText());
ok(pbrief.includes('רחוב הרצל, אשדוד') && pbrief.includes('התאמה'), 'project brief copied');
await page.locator('button', { hasText: 'שלושת הקרובים ללוח' }).click();
ok((await page.locator('.topnav .count').textContent()) === '3', 'top matches saved to board');
await page.locator('.match').first().click();
await page.waitForSelector('.case-head');
ok(true, 'match opens case');
await page.goBack();
await page.waitForSelector('.match');
await shot(page, 'project');
// The A4 report
await page.locator('.report-cta .btn').click();
await page.waitForSelector('.a4');
ok(page.url().includes('view=doc'), 'report opens');
ok((await page.locator('.a4').count()) === 2, 'report is two A4 pages');
const a4 = await page.locator('.a4').first().boundingBox();
ok(Math.abs(a4.height / a4.width - 297 / 210) < 0.03, `page has A4 proportions (${(a4.height / a4.width).toFixed(3)})`);
ok((await page.locator('.r-photo img').count()) === 1, 'report shows the photo of the problem');
ok((await page.locator('.r-what blockquote mark').count()) === 1, 'the problem in the planner\'s words, highlighted');
const rs = await page.locator('.r-score').allTextContents();
ok(rs.length === 3 && rs.every((v, i) => i === 0 || parseInt(v) <= parseInt(rs[i - 1])), `three solutions ordered by match (${rs})`);
ok((await page.locator('.r-cells [data-tone="go"]').count()) === 3 && (await page.locator('.r-cells [data-tone="stop"]').count()) === 3 && (await page.locator('.r-cells [data-tone="wait"]').count()) === 3, 'pro, con and upgrade for each solution');
ok((await page.locator('.r-link mark').count()) === 3 && (await page.locator('.a4 b').count()) >= 10, 'highlights and bold key words');
await page.locator('.r-head h1').click();
await page.keyboard.press('Control+A');
await page.keyboard.type('רחוב הרצל, אשדוד: חלופות');
await page.locator('.r-to').click();
await page.waitForTimeout(500);
await page.reload();
await page.waitForSelector('.a4');
ok((await page.locator('.r-head h1').textContent()) === 'רחוב הרצל, אשדוד: חלופות', 'report edits are kept');
await page.emulateMedia({ media: 'print' });
const fits = await page.locator('.a4').evaluateAll((els) => els.map((e) => e.scrollHeight <= e.clientHeight + 2));
ok(fits.every(Boolean), `each page fits its A4 sheet in print (${fits})`);
await page.emulateMedia({ media: 'screen' });
await shot(page, 'doc');
// The project on the map, the timeline and the list of cases
await page.goto(BASE + '/?view=all');
await page.waitForSelector('.mine-strip');
ok((await page.locator('.mine-strip li').count()) === 1, 'project listed beside the cases');
await page.goto(BASE + '/?view=map');
await page.waitForSelector('.map a circle');
ok((await page.locator('.timeline a.mine').count()) === 1, 'project on the timeline');
await page.locator('.timeline a.mine').focus();
ok((await page.locator('.map-card .btn').textContent()) === 'לפרויקט', 'project card on the map');
await page.waitForTimeout(1500);
ok((await page.locator('.map a.mine').count()) === 1, 'project on the globe');
await page.goto(BASE + '/?view=project&p=' + pid);
await page.waitForSelector('.match');
await page.locator('button', { hasText: 'פרויקט חדש' }).click();
await page.waitForTimeout(200);
ok(new URL(page.url()).searchParams.get('p') !== pid, 'new project');
ok((await page.locator('.project-switch select option').count()) === 2, 'project switcher lists two');
page.once('dialog', (d) => d.accept());
await page.locator('button', { hasText: 'מחיקת הפרויקט' }).click();
await page.waitForTimeout(200);
ok((await page.locator('.name-field input').inputValue()) === 'רחוב הרצל, אשדוד', 'delete returns to remaining project');
await page.waitForSelector('.match');
await page.locator('button', { hasText: 'השוואת שלושת הקרובים' }).click();
await page.waitForSelector('.compare-col');
ok((await page.locator('.compare-col').count()) === 3, 'compare three from project');

// Compare: remove, add
await page.locator('.compare-col .btn', { hasText: 'הסרה' }).first().click();
ok((await page.locator('.compare-col').count()) === 2, 'compare remove');
await page.locator('.add-compare select').selectOption('vauban');
ok((await page.locator('.compare-col').count()) === 3, 'compare add');
ok(page.url().includes('vauban'), 'compare in the address');

// Present from board
await page.goto(BASE + '/?view=board');
await page.locator('.board-actions button', { hasText: 'מצגת' }).click();
await page.waitForSelector('.slide-title');
ok((await page.locator('.slide-title li').count()) === 3, 'title slide lists cases');
await page.keyboard.press('ArrowLeft');
await page.waitForSelector('.slide-text');
ok(page.url().includes('s=1'), 'keyboard next slide');
await page.locator('.slide-nav .btn', { hasText: 'הבא' }).click();
await page.waitForTimeout(400);
ok(page.url().includes('s=2'), 'button next slide');
await page.locator('.slide-nav .btn', { hasText: 'הקודם' }).click();
await page.waitForTimeout(400);
ok(page.url().includes('s=1'), 'button previous slide');
await page.locator('.slide-nav a', { hasText: 'יציאה' }).click();
await page.waitForSelector('.board-item');
ok(true, 'exit presentation');
await page.locator('.board-actions button', { hasText: 'השוואה' }).click();
await page.waitForSelector('.compare-col');
ok((await page.locator('.compare-col').count()) === 3, 'compare from board');
await page.goto(BASE + '/?view=board');
page.once('dialog', (d) => d.accept());
await page.locator('button', { hasText: 'ריקון הלוח' }).click();

// Moves matrix and move page
await page.goto(BASE + '/?view=moves');
await page.waitForSelector('.matrix');
const rows = await page.locator('.matrix tbody tr').count();
ok(rows >= 30, `matrix rows (${rows})`);
await page.locator('.cell').first().click();
ok((await page.locator('.cell-panel li').count()) >= 1, 'matrix cell lists cases');
await page.locator('.filters button', { hasText: 'צעד מהיר' }).click();
ok((await page.locator('.matrix tbody tr').count()) < rows, 'matrix phase filter');
await page.locator('.matrix tbody th a').first().click();
await page.waitForSelector('.problem-head');
ok(page.url().includes('move='), 'move page opens');
ok((await page.locator('.grid .card').count()) >= 1, 'move page lists cases');
await page.locator('.crumbs a').first().click();
await page.waitForSelector('.matrix');

// Problem page tally
await page.goto(BASE + '/?problem=car-street');
ok((await page.locator('.tally li').count()) >= 3, 'problem tally of moves');

// Map
await page.goto(BASE + '/?view=map');
await page.waitForSelector('.map a circle');
ok((await page.locator('.map a:not(.mine)').count()) === DATA.length, 'every case on the map');
ok((await page.locator('.map-legend li').count()) >= 10, 'map has a legend');
// Grid: the side column shares the globe's top and bottom lines, and its frames share one width
for (const w of [1920, 1360]) {
  await page.setViewportSize({ width: w, height: 1000 });
  await page.waitForTimeout(200);
  const [f, side, card, leg] = await Promise.all(['.map-frame', '.map-side', '.map-card', '.map-legend'].map((q) => page.locator(q).boundingBox()));
  const near = (a, b) => Math.abs(a - b) < 1.5;
  ok(near(f.y, side.y) && near(f.y + f.height, side.y + side.height), `map row: top and bottom lines align (${w})`);
  ok(near(card.x, leg.x) && near(card.width, leg.width), `map side: card and legend share one width (${w})`);
  ok(near(card.y, f.y) && near(leg.y + leg.height, f.y + f.height), `map side: frames fill the column (${w})`);
}
await page.setViewportSize({ width: 1360, height: 900 });
await page.locator('.map a:not(.far):not(.mine)').first().focus();
ok((await page.locator('.map-card b').count()) === 1, 'hover shows case card');
const rot0 = await page.locator('.map path').nth(1).getAttribute('d');
await page.mouse.move(10, 10);
await page.waitForTimeout(600);
ok((await page.locator('.map path').nth(1).getAttribute('d')) !== rot0, 'globe turns by itself');
// Melbourne was hidden under the card on the flat map: now it is reachable
await page.locator('.timeline a:not(.mine)').nth(DATA.findIndex((c) => c.id === 'melbourne-laneways')).click();
await page.waitForTimeout(1500);
ok((await page.locator('.map-card b').textContent()).includes(DATA.find((c) => c.id === 'melbourne-laneways').name), 'timeline click picks Melbourne');
const mel = page.locator(`.map a[href*="case=melbourne-laneways"]`);
ok(!(await mel.getAttribute('class'))?.includes('far'), 'Melbourne faces the viewer after the turn');
await mel.click();
await page.waitForSelector('.case-head');
ok(page.url().includes('melbourne-laneways'), 'Melbourne point opens its case');
await page.goBack();
await page.waitForSelector('.map a circle');
await page.locator('.play-bar .btn').click();
await page.waitForTimeout(700);
const y1 = Number(await page.locator('.play-bar .year').textContent());
ok(y1 < 2000, `timeline plays from the first year (${y1})`);
await page.waitForTimeout(700);
ok(Number(await page.locator('.play-bar .year').textContent()) > y1, 'playhead moves through the years');
ok((await page.locator('.map a.future').count()) > 0, 'globe hides cases that had not started yet');
await page.locator('.play-bar .btn').click();
await page.locator('.play-bar input').fill('2026');
await page.locator('.map-tools .filters button', { hasText: 'ישראל' }).click();
ok((await page.locator('.map-tools .filters button', { hasText: 'ישראל' }).getAttribute('aria-pressed')) === 'true', 'zoom to Israel');
await page.locator('.map-tools .chip', { hasText: 'הצפות ומי נגר' }).click();
ok((await page.locator('.map a:not(.mine)').count()) === DATA.filter((c) => c.problems.includes('flooding')).length, 'map problem filter');
ok((await page.locator('.timeline a:not(.mine)').count()) === DATA.length, 'timeline has every case');
await page.locator('.timeline a:not(.mine)').first().click();
await page.locator('.map-card .btn').click();
await page.waitForSelector('.case-head');
ok(true, 'timeline opens case');

// Mobile: no horizontal scroll on every view
const m = await newPage({ width: 375, height: 800 });
for (const u of ['/', '/?view=doc', '/?problem=car-street', '/?case=superilles', '/?case=dizengoff-square', '/?view=all', '/?view=board', '/?view=project', '/?view=moves', '/?view=map', '/?view=compare&ids=vauban,high-line', '/?view=present&ids=vauban,high-line&s=1', '/?move=pilot']) {
  await m.goto(BASE + u);
  await m.waitForTimeout(250);
  ok(await noHScroll(m), `no horizontal scroll on mobile: ${u}`);
  ok(await m.locator('ai-menu .logo').isVisible(), `logo visible on mobile: ${u}`);
}
await m.goto(BASE + '/?case=superilles');
await m.locator('ai-menu .logo').click();
const box = await m.locator('ai-menu .panel').boundingBox().catch(() => null);
ok(!box || box.x >= 0, 'menu panel inside the screen on mobile');
await m.keyboard.press('Escape');
await shot(m, 'case-mobile');
await m.goto(BASE + '/');
await shot(m, 'home-mobile');
await m.goto(BASE + '/?view=project');
await m.waitForSelector('.pipeline');
await shot(m, 'project-mobile');
for (const [u, n] of [['/?view=moves', 'moves'], ['/?view=map', 'map'], ['/?view=compare&ids=vauban,high-line,superilles', 'compare'], ['/?view=present&ids=vauban,high-line&s=1', 'present'], ['/?case=dizengoff-square', 'case-israel']]) {
  await page.goto(BASE + u);
  await page.waitForTimeout(500);
  await shot(page, n);
}

// Reduced motion: content is visible without animation, before/after still switches
const rctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, reducedMotion: 'reduce' });
await stubExternal(rctx);
const rp = await rctx.newPage();
await rp.goto(BASE + '/?case=madrid-rio');
await rp.getByRole('tab', { name: 'לפני', exact: true }).click();
await rp.waitForSelector('.section-frame[data-mode="before"]');
ok(true, 'reduced motion: section switches');
await rp.goto(BASE + '/');
await rp.waitForSelector('.problem');
ok((await rp.locator('h1').evaluate((e) => getComputedStyle(e.closest('div')).opacity)) !== '0', 'reduced motion: hero visible');

// The A&I menu closes on page change
await page.goto(BASE + '/?view=all');
await page.locator('ai-menu .logo').click();
await page.locator('.brand').click();
await page.waitForSelector('.hero');
ok(await page.locator('ai-menu .panel').isHidden(), 'menu closes on page change');

const real = errors.filter((e) => !/favicon|ERR_|Failed to load resource/.test(e));
ok(real.length === 0, 'no console errors: ' + real.join(' | '));

await browser.close();
console.log(`${passes} passed, ${fails} failed`);
process.exit(fails ? 1 : 0);
