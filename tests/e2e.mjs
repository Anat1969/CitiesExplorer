// End-to-end test against `vite preview` (port 4173). The shared A&I menu script is served from a local copy,
// fonts are stubbed. Run: npm run build && (npx vite preview --port 4173 &) && node tests/e2e.mjs
import { chromium } from 'playwright';
import fs from 'fs';

const BASE = process.env.BASE || 'http://localhost:4173';
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
ok((await page.locator('.app').count()) === 4, 'four related apps on home');
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
  await page.locator(`.problem[href="/?problem=${id}"]`).click();
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
ok(allIds.length === 22, `all cases listed (${allIds.length})`);
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

// Mobile: no horizontal scroll on every view
const m = await newPage({ width: 375, height: 800 });
for (const u of ['/', '/?problem=car-street', '/?case=superilles', '/?case=metropol-parasol', '/?view=all', '/?view=board']) {
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
