import { webkit } from 'playwright';

const browser = await webkit.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 3,
});
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
    stats: null,
  }));
});

await page.goto('http://127.0.0.1:4173/index.html?repair=1', {
  waitUntil: 'domcontentloaded',
  timeout: 30000,
});
await page.waitForURL(/app\.html/, { timeout: 30000 });
await page.waitForSelector('.app, .onboard', { timeout: 30000 });

const result = await page.evaluate(() => ({
  url: location.href,
  text: document.body.innerText.slice(0, 220),
  htmlBackground: getComputedStyle(document.documentElement).backgroundColor,
  bodyBackground: getComputedStyle(document.body).backgroundColor,
  state: JSON.parse(localStorage.getItem('bonsai_live_1')),
}));

if (!/BONSAI/.test(result.text)) {
  throw new Error(`BONSAI content is missing: ${JSON.stringify(result)}`);
}
if (
  result.state.sp !== 'pine' ||
  result.state.pot !== 'black' ||
  result.state.mentor !== 0 ||
  !result.state.stats ||
  !Array.isArray(result.state.owned) ||
  !Array.isArray(result.state.log)
) {
  throw new Error(`legacy save migration failed: ${JSON.stringify(result.state)}`);
}
if (
  /255, 255, 255/.test(result.htmlBackground) ||
  /255, 255, 255/.test(result.bodyBackground)
) {
  throw new Error(`white launch background: ${JSON.stringify(result)}`);
}
if (errors.length) {
  throw new Error(`browser errors: ${errors.join(' | ')}`);
}

await page.screenshot({ path: 'ios-launch-v2.png', fullPage: true });
console.log(JSON.stringify(result));
await browser.close();
