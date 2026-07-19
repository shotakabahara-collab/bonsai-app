import { webkit } from 'playwright';
import fs from 'node:fs';

fs.mkdirSync('test-artifacts', { recursive: true });
const baseURL = process.env.BONSAI_BASE_URL || 'http://127.0.0.1:4173/bonsai-app/';
const browser = await webkit.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3 });
const page = await context.newPage();
const report = { phase: 'start', pageErrors: [], consoleErrors: [], seasonal: null, response: null };
page.on('pageerror', error => report.pageErrors.push(error.message));
page.on('console', message => { if (message.type() === 'error') report.consoleErrors.push(message.text()); });

const DAY = 86_400_000;
const now = Date.now();
const born = findBornForGameDay(145, now);
const legacy = {
  started: true,
  name: '季節検証者',
  mentor: 0,
  sp: 'kuromatsu',
  tree: '黒松・季節応答樹',
  born,
  water: 78,
  last: now,
  vit: 92,
  stress: 3,
  prune: 0,
  wire: 0,
  pot: 'pot02',
  money: 8200,
  rep: 135,
  owned: ['pot01', 'pot02'],
  awards: [],
  log: []
};

try {
  report.phase = 'seed and launch';
  await page.addInitScript(value => {
    if (sessionStorage.getItem('bonsai:seasonal-v4-seeded') === '1') return;
    sessionStorage.setItem('bonsai:seasonal-v4-seeded', '1');
    localStorage.setItem('bonsai_live_1', JSON.stringify(value));
    localStorage.removeItem('bonsai:v2');
    for (const key of Object.keys(localStorage)) {
      if (key.startsWith('bonsai:seasonal:v4:')) localStorage.removeItem(key);
    }
  }, legacy);
  await page.goto(new URL(`index.html?seasonal-v4=${Date.now()}`, baseURL).href, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForSelector('[data-testid="app-shell"]', { timeout: 45000 });
  await page.waitForSelector('.bonsai-stage img', { timeout: 20000 });

  report.phase = 'open precision pruning';
  await page.getByRole('button', { name: '部位剪定' }).click();
  await page.waitForSelector('.precision-v4-sheet');
  const total = Number(await page.locator('.precision-v4-sheet').getAttribute('data-total-sites'));
  if (total !== 26) throw new Error(`Expected 26 precision sites, got ${total}`);
  const seasonalText = await page.locator('[data-testid="seasonal-banner"]').innerText();
  if (!seasonalText.includes('標準温帯設定') || !seasonalText.includes('ロウソク芽')) {
    throw new Error(`Seasonal banner is incomplete: ${seasonalText}`);
  }

  await page.locator('.precision-group-tabs button').filter({ hasText: '第一枝' }).click();
  await page.locator('.precision-site-grid button').filter({ hasText: '第一枝・先端' }).click();
  const budButton = page.locator('.seasonal-technique-grid button').filter({ hasText: '芽摘み' });
  if (await budButton.isDisabled()) throw new Error('Bud pinching should be available in the seeded ideal window');
  await budButton.click();
  const suitability = await page.locator('[data-testid="suitability-card"]').innerText();
  if (!suitability.includes('適期')) throw new Error(`Ideal suitability was not shown: ${suitability}`);
  await page.screenshot({ path: 'test-artifacts/seasonal-v4-before.png', fullPage: false });

  report.phase = 'apply and persist response';
  page.once('dialog', dialog => dialog.accept());
  await page.locator('.precision-v4-sheet > .primary-button').click();
  await page.waitForSelector('.precision-v4-sheet', { state: 'detached', timeout: 10000 });
  await page.waitForTimeout(300);

  const afterApply = await page.evaluate(() => {
    const game = JSON.parse(localStorage.getItem('bonsai:v2'));
    const tree = game.bonsai.find(item => item.id === game.activeBonsaiId);
    const seasonal = JSON.parse(localStorage.getItem(`bonsai:seasonal:v4:${tree.id}`));
    return {
      treeId: tree.id,
      budCount: tree.craft.sites.firstTip.budCount,
      responses: seasonal.responses,
      log: tree.logs[0]?.text
    };
  });
  if (!afterApply.responses?.length) throw new Error('Delayed seasonal response was not persisted');
  if (!String(afterApply.log).includes('後の芽吹き')) throw new Error(`Delayed response log is missing: ${afterApply.log}`);
  report.seasonal = afterApply;

  report.phase = 'mature delayed response';
  await page.evaluate(treeId => {
    const key = `bonsai:seasonal:v4:${treeId}`;
    const seasonal = JSON.parse(localStorage.getItem(key));
    seasonal.responses[0].dueAt = Date.now() - 1000;
    localStorage.setItem(key, JSON.stringify(seasonal));
  }, afterApply.treeId);
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForSelector('[data-testid="app-shell"]', { timeout: 45000 });

  const afterMature = await page.evaluate(treeId => {
    const game = JSON.parse(localStorage.getItem('bonsai:v2'));
    const tree = game.bonsai.find(item => item.id === treeId);
    const seasonal = JSON.parse(localStorage.getItem(`bonsai:seasonal:v4:${treeId}`));
    return {
      budCount: tree.craft.sites.firstTip.budCount,
      completedAt: seasonal.responses[0].completedAt,
      log: tree.logs[0]?.text
    };
  }, afterApply.treeId);
  if (!afterMature.completedAt) throw new Error('Delayed response was not completed on reload');
  if (afterMature.budCount <= afterApply.budCount) throw new Error(`Bud response did not appear: ${afterApply.budCount} -> ${afterMature.budCount}`);
  if (!String(afterMature.log).includes('結果が現れた')) throw new Error(`Completion log is missing: ${afterMature.log}`);
  report.response = afterMature;
  await page.screenshot({ path: 'test-artifacts/seasonal-v4-after.png', fullPage: false });

  const fatalConsole = report.consoleErrors.filter(message => /uncaught|typeerror|referenceerror|syntaxerror|failed to load module script|\[BONSAI fatal\]/i.test(message));
  if (report.pageErrors.length || fatalConsole.length) throw new Error(`Browser errors: ${[...report.pageErrors, ...fatalConsole].join(' | ')}`);
  report.phase = 'complete';
} catch (error) {
  report.failure = { name: error.name, message: error.message, stack: error.stack };
  try { await page.screenshot({ path: 'test-artifacts/seasonal-v4-failure.png', fullPage: false }); } catch {}
  throw error;
} finally {
  fs.writeFileSync('test-artifacts/seasonal-v4-result.json', JSON.stringify(report, null, 2));
  await context.close();
  await browser.close();
}

console.log('BONSAI seasonal response v4: PASS');

function findBornForGameDay(target, timestamp) {
  let best = timestamp;
  let bestDistance = 999;
  for (let hours = 0; hours <= 24 * 365; hours += 3) {
    const candidate = timestamp - hours * 3_600_000;
    const value = gameDay(candidate, timestamp);
    const distance = Math.min(Math.abs(value - target), 365 - Math.abs(value - target));
    if (distance < bestDistance) {
      bestDistance = distance;
      best = candidate;
      if (distance === 0) break;
    }
  }
  return best;
}

function gameDay(bornAt, timestamp) {
  const bornDate = new Date(bornAt);
  const start = new Date(bornDate.getFullYear(), 0, 1);
  const base = Math.max(0, Math.floor((bornDate.getTime() - start.getTime()) / DAY));
  const elapsed = Math.max(0, (timestamp - bornAt) / DAY * 10);
  return Math.floor((base + elapsed) % 365);
}
