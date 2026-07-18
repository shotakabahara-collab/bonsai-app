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
  await page.goto(url, { waitUntil: 'commit', timeout: 30000 });
}

async function waitForPlayable(label) {
  try {
    await page.waitForSelector('.app,.onboard', { timeout: 45000 });
  } catch (error) {
    const diagnostic = await page.evaluate(() => ({
      readyState: document.readyState,
      title: document.title,
      text: document.body?.innerText?.slice(0, 1000) || '',
      root: document.getElementById('root')?.innerHTML?.slice(0, 2000) || '',
      release: window.BonsaiRelease || '',
      bootFailure: typeof window.__BonsaiLaunchFailure,
      advanced: typeof window.BonsaiAdvancedCare,
      stateRuntime: typeof window.BonsaiStateRuntime,
      scripts: [...document.scripts].map(script => script.src || script.id || 'inline')
    }));
    fs.mkdirSync('stable-launch-artifacts', { recursive: true });
    fs.writeFileSync('stable-launch-artifacts/failure-diagnostic.json', JSON.stringify({ label, diagnostic, errors }, null, 2));
    try { await page.screenshot({ path: 'stable-launch-artifacts/99-launch-failure.png', fullPage: true }); } catch {}
    throw new Error(`${label} did not render: ${JSON.stringify({ diagnostic, errors })}`);
  }
}

const target = new URL(`index.html?release=stable-launch-v1-20260718&t=${Date.now()}`, baseURL).href;
await openCommitted(target);
await waitForPlayable('initial launch');

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
  await waitForPlayable('repaired launch');
  const after = await page.evaluate(() => JSON.parse(localStorage.getItem('bonsai_live_1')));
  for (const key of ['name', 'tree', 'sp', 'pot', 'money', 'rep', 'prune', 'wire']) {
    if (JSON.stringify(before[key]) !== JSON.stringify(after[key])) throw new Error(`repair changed ${key}`);
  }
  await page.screenshot({ path: 'stable-launch-artifacts/02-repaired-app.png', fullPage: true });
}

fs.writeFileSync('stable-launch-artifacts/result.json', JSON.stringify({ baseURL, publicMode, initial, errors }, null, 2));
await browser.close();
