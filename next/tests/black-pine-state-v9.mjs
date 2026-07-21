import { webkit } from 'playwright';
import fs from 'node:fs';

fs.mkdirSync('test-artifacts', { recursive: true });
const baseURL = process.env.BONSAI_BASE_URL || 'http://127.0.0.1:4173/bonsai-app/';
const browser = await webkit.launch({ headless: true });
const report = { phase: 'start', assets: {}, reload: null };

async function capture(page, name) {
  const canvas = page.locator('.bonsai-stage [data-testid="bonsai-photo-canvas"]').first();
  await canvas.screenshot({ path: `test-artifacts/black-pine-v9-${name}.png` });
}

async function assetState(page) {
  return page.evaluate(() => ({
    renderer: document.querySelector('.bonsai-stage')?.getAttribute('data-renderer'),
    pruning: [...document.querySelectorAll('[data-testid="photoreal-pruning"]')].map(node => ({ src: node.getAttribute('src'), width: node.naturalWidth, height: node.naturalHeight, part: node.getAttribute('data-pruning-part'), level: node.getAttribute('data-pruning-level') })),
    wire: [...document.querySelectorAll('[data-testid="photoreal-wire"]')].map(node => ({ src: node.getAttribute('src'), width: node.naturalWidth, height: node.naturalHeight, part: node.getAttribute('data-wire-part') })),
    deadwood: [...document.querySelectorAll('[data-testid="photoreal-deadwood"]')].map(node => ({ src: node.getAttribute('src'), width: node.naturalWidth, height: node.naturalHeight, kind: node.getAttribute('data-deadwood-kind') }))
  }));
}

try {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, serviceWorkers: 'allow' });
  const page = await context.newPage();
  await page.addInitScript(() => localStorage.clear());
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
  const thin = page.locator('.seasonal-technique-grid button').filter({ hasText: '古葉取り・葉透かし' });
  await thin.click();
  const execute = page.getByRole('button', { name: /実行する|理解して実行する/ }).last();
  page.once('dialog', dialog => dialog.accept());
  await execute.click();
  await page.waitForSelector('.precision-v4-sheet', { state: 'detached', timeout: 10000 });
  await page.waitForSelector('[data-testid="photoreal-pruning"]');
  await capture(page, 'pruning');
  report.assets.pruning = await assetState(page);

  report.phase = 'wire';
  await page.getByRole('button', { name: '部位針金' }).click();
  await page.getByRole('button', { name: '第二枝を選択' }).click();
  await page.getByRole('button', { name: '強針金' }).click();
  await page.getByRole('button', { name: '右へ' }).click();
  await page.getByRole('button', { name: 'この部位へかける' }).click();
  await page.waitForSelector('[data-testid="photoreal-wire"]');
  await capture(page, 'wire');
  report.assets.wire = await assetState(page);

  report.phase = 'shari';
  await page.getByRole('button', { name: '神・舎利' }).click();
  await page.getByRole('button', { name: /左側・第1強度を始める/ }).click();
  page.once('dialog', dialog => dialog.accept());
  await page.getByRole('button', { name: /左側・第1強度を始める/ }).click().catch(() => {});
  await page.waitForSelector('[data-testid="photoreal-deadwood"][data-deadwood-kind="shari"]', { timeout: 10000 });
  await page.getByRole('button', { name: '閉じる' }).click();
  await capture(page, 'shari');
  report.assets.shari = await assetState(page);

  for (const [kind, state] of Object.entries(report.assets)) {
    const groups = state[kind === 'shari' ? 'deadwood' : kind];
    if (!groups?.length) throw new Error(`${kind} photographic layer was not rendered`);
    for (const asset of groups) {
      if (asset.width !== 900 || asset.height !== 1500 || !asset.src?.includes('-v9/')) throw new Error(`${kind} v9 image failed to load: ${JSON.stringify(asset)}`);
    }
  }

  report.phase = 'reload';
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForSelector('[data-testid="app-shell"]');
  const reload = await assetState(page);
  if (!reload.pruning.length || !reload.wire.length || !reload.deadwood.some(item => item.kind === 'shari')) throw new Error(`Reload lost work images: ${JSON.stringify(reload)}`);
  report.reload = reload;
  await capture(page, 'reload');
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
