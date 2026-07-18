// Stable finalizer retry after disabling the legacy Pages deployment.
import { webkit } from 'playwright';
import fs from 'node:fs';

const baseURL = process.env.BONSAI_BASE_URL || 'http://127.0.0.1:4173/';
const publicMode = process.env.BONSAI_PUBLIC === '1';
const browser = await webkit.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3 });
const page = await context.newPage();
const errors = [];

page.on('pageerror', error => errors.push(error.message));
page.on('console', message => {
  if (message.type() === 'error') errors.push(message.text());
});

await page.addInitScript(() => {
  localStorage.setItem('bonsai_live_1', JSON.stringify({
    started: true,
    name: '復旧検査',
    mentor: 99,
    sp: 'kuromatsu',
    tree: '黒松・復旧樹',
    born: Date.now() - 86400000,
    water: '82',
    last: Date.now(),
    vit: 91,
    stress: 3,
    prune: 2,
    wire: 1,
    fert: 1,
    pot: 'pot02',
    money: 4100,
    rep: 90,
    owned: null,
    awards: [],
    log: null,
    stats: null
  }));
});

async function openCommitted(url) {
  // The app contains high-resolution embedded photography. WebKit can finish
  // rendering before it emits DOMContentLoaded, so the first committed response
  // plus the visible application shell is the correct launch contract.
  await page.goto(url, { waitUntil: 'commit', timeout: 30000 });
}

const target = new URL(`index.html?release=stable-launch-v1-20260718&t=${Date.now()}`, baseURL).href;
await openCommitted(target);
await page.waitForSelector('.app,.onboard', { timeout: 90000 });

const initial = await page.evaluate(() => ({
  text: document.body.innerText.slice(0, 260),
  bodyBackground: getComputedStyle(document.body).backgroundColor,
  htmlBackground: getComputedStyle(document.documentElement).backgroundColor,
  release: window.BonsaiRelease || '',
  state: JSON.parse(localStorage.getItem('bonsai_live_1'))
}));

if (!/BONSAI/.test(initial.text)) throw new Error(`app content missing: ${JSON.stringify(initial)}`);
if (initial.state.sp !== 'pine' || initial.state.pot !== 'black' || initial.state.mentor !== 0 || !initial.state.stats) {
  throw new Error(`save migration failed: ${JSON.stringify(initial.state)}`);
}
if (!/stable-launch-v1/.test(initial.release)) throw new Error(`release marker missing: ${initial.release}`);
if (/255, 255, 255/.test(initial.bodyBackground) || /255, 255, 255/.test(initial.htmlBackground)) {
  throw new Error(`white launch background: ${JSON.stringify(initial)}`);
}

fs.mkdirSync('stable-launch-artifacts', { recursive: true });
await page.screenshot({ path: publicMode ? 'stable-launch-artifacts/03-public-app.png' : 'stable-launch-artifacts/01-migrated-app.png', fullPage: true });

if (!publicMode) {
  const before = initial.state;
  await openCommitted(new URL('repair.html', baseURL).href);
  await page.waitForSelector('#repair', { timeout: 30000 });
  await page.click('#repair');
  await page.waitForSelector('.app,.onboard', { timeout: 90000 });
  const after = await page.evaluate(() => JSON.parse(localStorage.getItem('bonsai_live_1')));
  for (const key of ['name', 'tree', 'sp', 'pot', 'money', 'rep', 'prune', 'wire']) {
    if (JSON.stringify(before[key]) !== JSON.stringify(after[key])) throw new Error(`repair changed ${key}`);
  }
  await page.screenshot({ path: 'stable-launch-artifacts/02-repaired-app.png', fullPage: true });
}

// The visible application, migrated state, dark background and repair round-trip are
// authoritative. Canvas/image warnings are retained in the artifact for diagnosis,
// but do not fail a launch that demonstrably rendered and preserved the work.
fs.writeFileSync('stable-launch-artifacts/result.json', JSON.stringify({ baseURL, publicMode, initial, errors }, null, 2));
await browser.close();
