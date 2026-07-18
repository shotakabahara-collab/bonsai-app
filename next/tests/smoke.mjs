import { webkit } from 'playwright';
import fs from 'node:fs';

fs.mkdirSync('test-artifacts', { recursive: true });
const browser = await webkit.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3 });
const page = await context.newPage();
const errors = [];
page.on('pageerror', error => errors.push(error.message));
page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });

const legacy = {
  started: true,
  name: '復旧検証者',
  mentor: 99,
  sp: 'kuromatsu',
  tree: '黒松・継承樹',
  born: Date.now() - 86400000 * 60,
  water: '77',
  last: Date.now(),
  vit: 88,
  stress: 3,
  prune: 1,
  wire: 0,
  fert: 0,
  pot: 'pot02',
  money: 8200,
  rep: 135,
  owned: ['pot01', 'pot02'],
  awards: [],
  log: ['旧版から引き継いだ記録'],
  stats: null,
  advanced: {
    parts: {
      first_left: { foliage: 72, health: 87, pruneLevel: 1 },
      second_right: { foliage: 70, health: 90 }
    }
  }
};

await page.addInitScript(value => {
  localStorage.setItem('bonsai_live_1', JSON.stringify(value));
  localStorage.removeItem('bonsai:v2');
}, legacy);

await page.goto('http://127.0.0.1:4173/bonsai-app/', { waitUntil: 'domcontentloaded', timeout: 45000 });
await page.waitForSelector('[data-testid="app-shell"]', { timeout: 30000 });
await page.waitForSelector('.bonsai-stage img', { timeout: 15000 });

const migrated = await page.evaluate(() => JSON.parse(localStorage.getItem('bonsai:v2')));
if (migrated.version !== 2 || migrated.bonsai[0].species !== 'pine' || migrated.bonsai[0].potId !== 'black') {
  throw new Error(`Legacy migration failed: ${JSON.stringify(migrated).slice(0, 500)}`);
}
if (migrated.mentorId !== 'gensai') throw new Error(`Mentor migration failed: ${migrated.mentorId}`);

const bodyBackground = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
if (/255, 255, 255/.test(bodyBackground)) throw new Error(`White screen background: ${bodyBackground}`);

await page.getByRole('button', { name: '水やり' }).click();
await page.getByRole('button', { name: '部位剪定' }).click();
await page.getByRole('button', { name: '第一枝を選択' }).click();
page.once('dialog', dialog => dialog.accept());
await page.getByRole('button', { name: /中剪定/ }).click();
await page.waitForTimeout(250);

const afterPrune = await page.evaluate(() => JSON.parse(localStorage.getItem('bonsai:v2')));
const active = afterPrune.bonsai.find(item => item.id === afterPrune.activeBonsaiId);
if (active.parts.firstLeft.pruneLevel < 2 || active.parts.firstLeft.foliage >= 72) {
  throw new Error(`Pruning was not persisted: ${JSON.stringify(active.parts.firstLeft)}`);
}

await page.getByRole('button', { name: /大会/ }).click();
await page.waitForSelector('.show-card');
await page.screenshot({ path: 'test-artifacts/iphone-home.png', fullPage: true });

if (errors.some(message => !/favicon/i.test(message))) throw new Error(`Browser errors: ${errors.join(' | ')}`);
fs.writeFileSync('test-artifacts/smoke-result.json', JSON.stringify({ migrated, afterPrune: active.parts.firstLeft, errors }, null, 2));

await browser.close();
console.log('BONSAI React rebuild smoke: PASS');
