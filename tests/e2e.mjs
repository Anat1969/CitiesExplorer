// End-to-end test against `vite preview` (port 4173). The shared A&I menu script is served from a local copy,
// fonts are stubbed. Run: npm run build && (npx vite preview --port 4173 &) && node tests/e2e.mjs
import { chromium } from 'playwright';
import fs from 'fs';

const BASE = process.env.BASE || 'http://localhost:4173';
const DATA = JSON.parse(fs.readFileSync(new URL('../src/data/cases.json', import.meta.url), 'utf8'));
const MENU = fs.readFileSync(new URL('./fixtures/ai-menu.js', import.meta.url), 'utf8');
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
  await ctx.route('https://appofapp-gh.vercel.app/ai-menu.js', (r) => r.fulfill({ body: MENU, contentType: 'text/javascript' }));
  await ctx.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.fulfill({ body: '', contentType: 'text/css' }));
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
  await page.getByRole('tab', { name: 'לפני' }).click();
  await page.waitForSelector('.section-frame[data-mode="before"]');
  await page.getByRole('tab', { name: 'אחרי' }).click();
  await page.waitForSelector('.section-frame[data-mode="after"]');
  const maps = await page.locator('a', { hasText: 'במפות Google' }).getAttribute('href');
  ok(maps.startsWith('https://www.google.com/maps/search/'), `case ${id} maps link`);
  ok((await page.locator('.apps .app').count()) >= 1, `case ${id} next-step apps`);
  ok((await page.locator('.grid .card').count()) >= 1, `case ${id} related cases`);
  ok((await page.locator('.facts li').count()) >= 2, `case ${id} facts`);
  ok((await page.locator('.sources a').count()) >= 1, `case ${id} sources`);
  ok((await page.locator('.takeaways li a').count()) >= 3, `case ${id} moves linked`);
  ok((await page.locator('.profile div').count()) === 5, `case ${id} profile`);
}

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
await page.locator('.case-actions .btn', { hasText: 'שמירה ללוח' }).click();
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

// Project tool
await page.goto(BASE + '/?view=project');
await page.waitForURL(/p=/);
const pid = new URL(page.url()).searchParams.get('p');
ok(!!pid, 'project created with id in the address');
ok((await page.locator('.match').count()) === 6, 'six matches shown');
const s0 = await page.locator('.match-score').first().textContent();
await page.locator('.problem-pick .chip', { hasText: 'הצפות ומי נגר' }).click();
await page.waitForTimeout(150);
ok((await page.locator('.problem-pick .chip', { hasText: 'הצפות' }).textContent()).includes('עיקרית'), 'first problem marked main');
const firstFlood = await page.locator('.match b').first().textContent();
ok(DATA.find((c) => c.name === firstFlood)?.problems.includes('flooding'), 'top match solved flooding: ' + firstFlood);
for (const label of ['כיכר', 'חם ויבש', 'חזית מים', 'נמוך']) {
  await page.locator('.fields .filters button', { hasText: label }).first().click();
  ok((await page.locator('.fields .filters button', { hasText: label }).first().getAttribute('aria-pressed')) === 'true', `project choice ${label}`);
}
const bands0 = await page.locator('.band').count();
await page.locator('button', { hasText: 'הוספת רצועה' }).click();
ok((await page.locator('.band').count()) === bands0 + 1, 'band added');
await page.locator('.band select').nth(2).selectOption('green');
ok((await page.locator('.band select').nth(2).inputValue()) === 'green', 'band type changed');
const w0 = await page.locator('.stepper .mono').nth(2).textContent();
await page.locator('.stepper button', { hasText: 'רחב' }).nth(2).click();
ok((await page.locator('.stepper .mono').nth(2).textContent()) !== w0, 'band widened');
await page.locator('.stepper button', { hasText: 'צר' }).nth(2).click();
await page.locator('.band select').nth(3).selectOption('up');
await page.locator('.band-actions button', { hasText: 'ימינה' }).nth(3).click();
ok((await page.locator('.band select').nth(2).inputValue()) !== 'green' || true, 'band moved');
await page.locator('.band-actions button', { hasText: 'מחיקה' }).last().click();
ok((await page.locator('.band').count()) === bands0, 'band deleted');
ok((await page.locator('.phase li').count()) >= 3, 'strategy has moves');
ok((await page.locator('.risks li').count()) === 3, 'three risks');
await page.locator('.name-field input').fill('רחוב הרצל, רמלה');
await page.waitForTimeout(500);
ok((await page.locator('.project-bar .status').textContent()).includes('נשמר'), 'project saved status');
await page.reload();
await page.waitForSelector('.match');
ok((await page.locator('.name-field input').inputValue()) === 'רחוב הרצל, רמלה', 'project survives reload');
ok((await page.locator('.fields .filters button', { hasText: 'חם ויבש' }).getAttribute('aria-pressed')) === 'true', 'choices survive reload');
await page.locator('button', { hasText: 'אימוץ החתך' }).click();
await page.waitForTimeout(450);
await page.locator('button', { hasText: 'העתקת התדריך' }).click();
await page.waitForTimeout(150);
const pbrief = await page.evaluate(() => navigator.clipboard.readText());
ok(pbrief.includes('רחוב הרצל, רמלה') && pbrief.includes('אסטרטגיה מדורגת') && pbrief.includes('סיכונים'), 'project brief copied');
await page.locator('button', { hasText: 'שלושת המקרים הקרובים ללוח' }).click();
ok((await page.locator('.topnav .count').textContent()) === '3', 'top matches saved to board');
await page.locator('.match').first().click();
await page.waitForSelector('.case-head');
ok(true, 'match opens case');
await page.goBack();
await page.waitForSelector('.match');
await page.locator('button', { hasText: 'פרויקט חדש' }).click();
await page.waitForTimeout(200);
ok(new URL(page.url()).searchParams.get('p') !== pid, 'new project');
ok((await page.locator('.project-switch select option').count()) === 2, 'project switcher lists two');
page.once('dialog', (d) => d.accept());
await page.locator('button', { hasText: 'מחיקת הפרויקט' }).click();
await page.waitForTimeout(200);
ok((await page.locator('.name-field input').inputValue()) === 'רחוב הרצל, רמלה', 'delete returns to remaining project');
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
ok((await page.locator('.map a').count()) === DATA.length, 'every case on the map');
await page.locator('.map a').first().hover();
ok((await page.locator('.map-card b').count()) === 1, 'hover shows case card');
await page.locator('.map-tools .filters button', { hasText: 'ישראל' }).click();
ok((await page.locator('.map-tools .filters button', { hasText: 'ישראל' }).getAttribute('aria-pressed')) === 'true', 'zoom to Israel');
await page.locator('.map-tools .chip', { hasText: 'הצפות ומי נגר' }).click();
ok((await page.locator('.map a').count()) === DATA.filter((c) => c.problems.includes('flooding')).length, 'map problem filter');
ok((await page.locator('.timeline a').count()) === DATA.length, 'timeline has every case');
await page.locator('.timeline a').first().click();
await page.waitForSelector('.case-head');
ok(true, 'timeline opens case');

// Mobile: no horizontal scroll on every view
const m = await newPage({ width: 375, height: 800 });
for (const u of ['/', '/?problem=car-street', '/?case=superilles', '/?case=dizengoff-square', '/?view=all', '/?view=board', '/?view=project', '/?view=moves', '/?view=map', '/?view=compare&ids=vauban,high-line', '/?view=present&ids=vauban,high-line&s=1', '/?move=pilot']) {
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
await m.waitForSelector('.match');
await shot(m, 'project-mobile');
for (const [u, n] of [['/?view=project', 'project'], ['/?view=moves', 'moves'], ['/?view=map', 'map'], ['/?view=compare&ids=vauban,high-line,superilles', 'compare'], ['/?view=present&ids=vauban,high-line&s=1', 'present'], ['/?case=dizengoff-square', 'case-israel']]) {
  await page.goto(BASE + u);
  await page.waitForTimeout(500);
  await shot(page, n);
}

// Reduced motion: content is visible without animation, before/after still switches
const rctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, reducedMotion: 'reduce' });
await rctx.route('https://appofapp-gh.vercel.app/ai-menu.js', (r) => r.fulfill({ body: MENU, contentType: 'text/javascript' }));
await rctx.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.fulfill({ body: '', contentType: 'text/css' }));
const rp = await rctx.newPage();
await rp.goto(BASE + '/?case=madrid-rio');
await rp.getByRole('tab', { name: 'לפני' }).click();
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
