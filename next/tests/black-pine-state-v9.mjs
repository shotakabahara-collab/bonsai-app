import { webkit } from 'playwright';
import fs from 'node:fs';

fs.mkdirSync('test-artifacts', { recursive: true });
const baseURL = process.env.BONSAI_BASE_URL || 'http://127.0.0.1:4173/bonsai-app/';
const browser = await webkit.launch({ headless: true });
const report = {
  phase: 'start',
  assets: {},
  wireProgress: null,
  reload: null,
  pageErrors: [],
  consoleErrors: []
};
const CAPTURE_STYLE = `
  .topbar, .bottom-nav, .completion-dock, .wire-status-tag,
  .deadwood-status-tag, .dead-tree-status-tag, .toast { visibility: hidden !important; }
`;

async function capture(page, name) {
  const canvas = page.locator('.bonsai-stage [data-testid="bonsai-photo-canvas"]').first();
  await canvas.scrollIntoViewIfNeeded();
  await canvas.screenshot({ path: `test-artifacts/black-pine-v9-${name}.png`, style: CAPTURE_STYLE });
}

async function waitForStateImages(page, selector) {
  await page.waitForFunction(sel => {
    const nodes = [...document.querySelectorAll(sel)];
    return nodes.length > 0 && nodes.every(node =>
      node instanceof HTMLImageElement &&
      node.complete &&
      node.naturalWidth === 900 &&
      node.naturalHeight === 1500
    );
  }, selector, { timeout: 10000 });
}

async function assetState(page) {
  return page.evaluate(() => {
    const stateImage = node => ({
      src: node.getAttribute('src'),
      width: node.naturalWidth,
      height: node.naturalHeight,
      complete: node.complete,
      opacity: getComputedStyle(node).opacity,
      filter: getComputedStyle(node).filter
    });
    return {
      renderer: document.querySelector('.bonsai-stage')?.getAttribute('data-renderer'),
      pruning: [...document.querySelectorAll('[data-testid="photoreal-pruning"]')].map(node => ({
        ...stateImage(node),
        part: node.getAttribute('data-pruning-part'),
        level: Number(node.getAttribute('data-pruning-level'))
      })),
      wire: [...document.querySelectorAll('[data-testid="photoreal-wire"]')].map(node => ({
        ...stateImage(node),
        part: node.getAttribute('data-wire-part'),
        intensity: node.getAttribute('data-wire-intensity'),
        progress: Number(node.getAttribute('data-wire-progress')),
        progressBand: Number(node.getAttribute('data-wire-progress-band'))
      })),
      deadwood: [...document.querySelectorAll('[data-testid="photoreal-deadwood"]')].map(node => ({
        ...stateImage(node),
        kind: node.getAttribute('data-deadwood-kind'),
        level: Number(node.getAttribute('data-deadwood-level')),
        progress: Number(node.getAttribute('data-deadwood-progress')),
        progressBand: Number(node.getAttribute('data-deadwood-progress-band'))
      }))
    };
  });
}

function assertV9Image(asset, label, pathPart) {
  if (!asset || asset.width !== 900 || asset.height !== 1500 || !asset.complete || !asset.src?.includes(pathPart)) {
    throw new Error(`${label} v9 image failed to load: ${JSON.stringify(asset)}`);
  }
}

try {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, serviceWorkers: 'allow' });
  const page = await context.newPage();
  page.on('pageerror', error => report.pageErrors.push(error.message));
  page.on('console', message => {
    if (message.type() === 'error') report.consoleErrors.push(message.text());
  });
  await page.addInitScript(() => {
    if (!sessionStorage.getItem('black-pine-v9-initialized')) {
      localStorage.clear();
      sessionStorage.setItem('black-pine-v9-initialized', '1');
    }
  });
  await page.goto(new URL(`index.html?black-pine-v9=${Date.now()}`, baseURL).href, { waitUntil: 'domcontentloaded', timeout: 60000 });

  report.phase = 'new black pine onboarding';
  await page.waitForSelector('[data-testid="onboarding"]');
  await page.getByRole('button', { name: '声の主を追う' }).click();
  await page.getByRole('button', { name: '素材棚へ進む' }).click();
  await page.getByRole('button', { name: '最初の講義を受ける' }).click();
  await page.getByRole('button', { name: '一本に名を付ける' }).click();
  await page.getByLabel('盆栽師名').fill('状態画像検証者');
  await page.getByLabel('作品の銘').fill('黒松・状態画像検証樹');
  await page.getByRole('button', { name: 'この一本と始める' }).click();
  await page.waitForSelector('[data-testid="app-shell"]');
  await capture(page, 'base');

  report.phase = 'pruning';
  await page.getByRole('button', { name: '部位剪定' }).click();
  await page.locator('.precision-group-tabs button').filter({ hasText: '第二枝' }).click();
  await page.locator('.precision-site-grid button').filter({ hasText: '第二枝・先端' }).click();
  await page.locator('.seasonal-technique-grid button').filter({ hasText: '古葉取り・葉透かし' }).click();
  const execute = page.getByRole('button', { name: /この箇所へ確定する|強い反対を理解して実行する/ }).last();
  page.once('dialog', dialog => dialog.accept());
  await execute.click();
  await page.waitForSelector('.precision-v4-sheet', { state: 'detached', timeout: 10000 });
  await waitForStateImages(page, '[data-testid="photoreal-pruning"]');
  await capture(page, 'pruning');
  report.assets.pruning = await assetState(page);
  const pruning = report.assets.pruning.pruning.find(item => item.part === 'secondRight');
  assertV9Image(pruning, 'pruning', '/pruning-photo-v9/secondRight-');

  report.phase = 'wire';
  await page.getByRole('button', { name: '部位針金' }).click();
  await page.getByRole('button', { name: '第二枝を選択' }).click();
  await page.getByRole('button', { name: '強針金' }).click();
  await page.getByRole('button', { name: '右へ' }).click();
  await page.getByRole('button', { name: 'この部位へかける' }).click();
  await waitForStateImages(page, '[data-testid="photoreal-wire"]');
  await capture(page, 'wire');
  report.assets.wire = await assetState(page);
  const initialWire = report.assets.wire.wire.find(item => item.part === 'secondRight');
  assertV9Image(initialWire, 'wire', '/wire-photo-v9/secondRight-strong.webp');

  report.phase = 'wire time progression';
  await page.evaluate(now => {
    const activeSlot = localStorage.getItem('bonsai:active-slot') || '1';
    const keys = [`bonsai:v2:slot:${activeSlot}`, 'bonsai:v2'];
    const sourceKey = keys.find(key => localStorage.getItem(key));
    if (!sourceKey) throw new Error('Active BONSAI save was not found');
    const game = JSON.parse(localStorage.getItem(sourceKey));
    const tree = game.bonsai.find(item => item.id === game.activeBonsaiId);
    const wire = tree?.parts?.secondRight?.wire;
    if (!wire) throw new Error('Second-right wire was not saved');
    wire.appliedAt = now - 7 * 86400000;
    wire.readyAt = now + 7 * 86400000;
    const serialized = JSON.stringify(game);
    for (const key of keys) {
      if (localStorage.getItem(key)) localStorage.setItem(key, serialized);
    }
  }, Date.now());
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForSelector('[data-testid="app-shell"]');
  await waitForStateImages(page, '[data-testid="photoreal-wire"]');
  const progressed = await assetState(page);
  const progressedWire = progressed.wire.find(item => item.part === 'secondRight');
  if (!progressedWire || progressedWire.progress < 45 || progressedWire.progress > 55 || progressedWire.progressBand !== 2) {
    throw new Error(`Wire time progression was not reflected: ${JSON.stringify(progressedWire)}`);
  }
  if (progressedWire.opacity === initialWire.opacity && progressedWire.filter === initialWire.filter) {
    throw new Error(`Wire time progression did not change the rendered photographic treatment: ${JSON.stringify({ initialWire, progressedWire })}`);
  }
  report.wireProgress = progressedWire;
  await capture(page, 'wire-progress');

  report.phase = 'jin';
  await page.getByRole('button', { name: /神・舎利/ }).click();
  page.once('dialog', dialog => dialog.accept());
  await page.getByRole('button', { name: /この枝で神の第1強度を始める/ }).click();
  await waitForStateImages(page, '[data-testid="photoreal-deadwood"][data-deadwood-kind="jin"]');
  await capture(page, 'jin');

  report.phase = 'shari';
  await page.getByRole('button', { name: /神・舎利/ }).click();
  page.once('dialog', dialog => dialog.accept());
  await page.getByRole('button', { name: /左側・第1強度を始める/ }).click();
  await page.waitForFunction(() => document.querySelectorAll('[data-testid="photoreal-deadwood"]').length === 2, { timeout: 10000 });
  await waitForStateImages(page, '[data-testid="photoreal-deadwood"]');
  await capture(page, 'jin-shari');
  report.assets.deadwood = await assetState(page);
  const jin = report.assets.deadwood.deadwood.find(item => item.kind === 'jin');
  const shari = report.assets.deadwood.deadwood.find(item => item.kind === 'shari');
  assertV9Image(jin, 'jin', '/deadwood-photo-v9/jin-secondRight-l1.webp');
  assertV9Image(shari, 'shari', '/deadwood-photo-v9/shari-left-l1.webp');

  report.phase = 'reload';
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForSelector('[data-testid="app-shell"]');
  await waitForStateImages(page, '[data-testid="photoreal-pruning"], [data-testid="photoreal-wire"], [data-testid="photoreal-deadwood"]');
  const reload = await assetState(page);
  if (!reload.pruning.some(item => item.part === 'secondRight') || !reload.wire.some(item => item.part === 'secondRight') || !reload.deadwood.some(item => item.kind === 'jin') || !reload.deadwood.some(item => item.kind === 'shari')) {
    throw new Error(`Reload lost work images: ${JSON.stringify(reload)}`);
  }
  report.reload = reload;
  await capture(page, 'reload');

  const fatalConsole = report.consoleErrors.filter(message => /uncaught|typeerror|referenceerror|syntaxerror|failed to load module script|\[BONSAI fatal\]/i.test(message));
  if (report.pageErrors.length || fatalConsole.length) {
    throw new Error(`Browser errors: ${[...report.pageErrors, ...fatalConsole].join(' | ')}`);
  }
  report.phase = 'complete';
  await context.close();
} catch (error) {
  report.failure = { name: error.name, message: error.message, stack: error.stack };
  throw error;
} finally {
  fs.writeFileSync('test-artifacts/black-pine-state-v9-result.json', JSON.stringify(report, null, 2));
  await browser.close();
}

console.log('BONSAI Black Pine State Rendering v9: PASS');
