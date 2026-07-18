import { webkit } from 'playwright';
import fs from 'node:fs';

fs.mkdirSync('test-artifacts', { recursive: true });
const baseURL = process.env.BONSAI_BASE_URL || 'http://127.0.0.1:4173/bonsai-app/';
const publicMode = process.env.BONSAI_PUBLIC === '1';
const report = {
  phase: 'launch',
  baseURL,
  publicMode,
  pageErrors: [],
  consoleErrors: [],
  migrated: null,
  afterPrune: null,
  growVisual: null,
  showVisual: null
};
const browser = await webkit.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3 });
const page = await context.newPage();
page.on('pageerror', error => report.pageErrors.push(error.message));
page.on('console', message => { if (message.type() === 'error') report.consoleErrors.push(message.text()); });

async function inspectVisibleArtwork(scopeSelector) {
  return page.evaluate(selector => {
    const scope = document.querySelector(selector);
    const stage = scope?.querySelector('.bonsai-stage');
    const image = stage?.querySelector('img');
    const scopeRect = scope?.getBoundingClientRect();
    const stageRect = stage?.getBoundingClientRect();
    const imageStyle = image ? getComputedStyle(image) : null;
    let variance = 0;
    let mean = 0;
    let sampled = false;

    if (image instanceof HTMLImageElement && image.complete && image.naturalWidth > 0) {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = 40;
        canvas.height = 40;
        const context2d = canvas.getContext('2d', { willReadFrequently: true });
        context2d?.drawImage(image, 0, 0, 40, 40);
        const pixels = context2d?.getImageData(0, 0, 40, 40).data;
        if (pixels) {
          const values = [];
          for (let index = 0; index < pixels.length; index += 4) {
            values.push(pixels[index] * .2126 + pixels[index + 1] * .7152 + pixels[index + 2] * .0722);
          }
          mean = values.reduce((sum, value) => sum + value, 0) / values.length;
          variance = values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length;
          sampled = true;
        }
      } catch {
        sampled = false;
      }
    }

    const centerX = stageRect ? Math.min(innerWidth - 2, Math.max(1, stageRect.left + stageRect.width / 2)) : 0;
    const centerY = stageRect ? Math.min(innerHeight - 2, Math.max(1, stageRect.top + stageRect.height / 2)) : 0;
    const centerStack = stageRect ? document.elementsFromPoint(centerX, centerY) : [];
    const stageAtCenter = Boolean(stage && centerStack.some(element => element === stage || element.closest?.('.bonsai-stage') === stage));

    return {
      scrollY: window.scrollY,
      viewport: { width: innerWidth, height: innerHeight },
      scopeRect: scopeRect ? { top: scopeRect.top, bottom: scopeRect.bottom, width: scopeRect.width, height: scopeRect.height } : null,
      stageRect: stageRect ? { top: stageRect.top, bottom: stageRect.bottom, width: stageRect.width, height: stageRect.height } : null,
      stageAtCenter,
      image: image instanceof HTMLImageElement ? {
        source: image.currentSrc || image.src,
        complete: image.complete,
        naturalWidth: image.naturalWidth,
        naturalHeight: image.naturalHeight,
        display: imageStyle?.display,
        visibility: imageStyle?.visibility,
        opacity: imageStyle?.opacity
      } : null,
      sample: { sampled, mean, variance },
      text: scope?.textContent?.replace(/\s+/g, ' ').trim().slice(0, 280) ?? ''
    };
  }, scopeSelector);
}

function assertVisibleArtwork(visual, label) {
  if (!visual?.scopeRect || !visual.stageRect || !visual.image) throw new Error(`${label}: artwork DOM is incomplete`);
  if (visual.scrollY > 2) throw new Error(`${label}: page did not reset to the top (${visual.scrollY})`);
  if (visual.scopeRect.width < 330 || visual.scopeRect.top >= visual.viewport.height - 120 || visual.scopeRect.bottom <= 150) {
    throw new Error(`${label}: artwork scope is outside the iPhone viewport: ${JSON.stringify(visual.scopeRect)}`);
  }
  if (visual.stageRect.width < 330 || visual.stageRect.height < 280 || visual.stageRect.top >= visual.viewport.height - 80) {
    throw new Error(`${label}: bonsai stage is not visibly laid out: ${JSON.stringify(visual.stageRect)}`);
  }
  if (!visual.stageAtCenter) throw new Error(`${label}: bonsai stage is covered or outside the visible viewport`);
  if (!visual.image.complete || visual.image.naturalWidth < 800 || visual.image.naturalHeight < 1200) {
    throw new Error(`${label}: high-resolution photograph was not decoded: ${JSON.stringify(visual.image)}`);
  }
  if (!visual.image.source.includes('/assets/kuromatsu/base/black.webp')) {
    throw new Error(`${label}: bundled black-pine photograph is not active: ${visual.image.source}`);
  }
  if (visual.image.display === 'none' || visual.image.visibility === 'hidden' || Number(visual.image.opacity) < .8) {
    throw new Error(`${label}: photograph is hidden by CSS: ${JSON.stringify(visual.image)}`);
  }
  if (!visual.sample.sampled || visual.sample.variance < 120 || visual.sample.mean < 10) {
    throw new Error(`${label}: photograph pixels are blank or nearly uniform: ${JSON.stringify(visual.sample)}`);
  }
}

try {
  const legacy = {
    started: true,
    name: publicMode ? '公開検証者' : '復旧検証者',
    mentor: 99,
    sp: 'kuromatsu',
    tree: publicMode ? '黒松・公開検証樹' : '黒松・継承樹',
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

  report.phase = 'legacy seed';
  await page.addInitScript(value => {
    localStorage.setItem('bonsai_live_1', JSON.stringify(value));
    localStorage.removeItem('bonsai:v2');
  }, legacy);

  report.phase = 'launch and migration';
  const target = new URL(`index.html?audit=${publicMode ? 'public' : 'local'}-${Date.now()}`, baseURL).href;
  await page.goto(target, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForSelector('[data-testid="app-shell"]', { timeout: 45000 });
  await page.waitForSelector('.bonsai-stage img', { timeout: 20000 });
  await page.waitForFunction(() => {
    const image = document.querySelector('.bonsai-stage img');
    return image instanceof HTMLImageElement && image.complete && image.naturalWidth >= 800;
  }, { timeout: 30000 });

  const migrated = await page.evaluate(() => JSON.parse(localStorage.getItem('bonsai:v2')));
  report.migrated = migrated;
  if (migrated.version !== 2 || migrated.bonsai[0].species !== 'pine' || migrated.bonsai[0].potId !== 'black') {
    throw new Error(`Legacy migration failed: ${JSON.stringify(migrated).slice(0, 500)}`);
  }
  if (migrated.mentorId !== 'gensai') throw new Error(`Mentor migration failed: ${migrated.mentorId}`);

  const bodyBackground = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  if (/255, 255, 255/.test(bodyBackground)) throw new Error(`White screen background: ${bodyBackground}`);

  await page.evaluate(() => window.scrollTo(0, 0));
  report.growVisual = await inspectVisibleArtwork('.artwork-card');
  assertVisibleArtwork(report.growVisual, 'grow page');
  await page.screenshot({ path: 'test-artifacts/01-grow-visible.png', fullPage: false });
  await page.locator('.artwork-card').screenshot({ path: 'test-artifacts/02-grow-artwork.png' });

  report.phase = 'care actions';
  await page.getByRole('button', { name: '水やり' }).click();
  await page.getByRole('button', { name: '部位剪定' }).click();
  await page.getByRole('button', { name: '第一枝を選択' }).click();
  page.once('dialog', dialog => dialog.accept());
  await page.getByRole('button', { name: /中剪定/ }).click();
  await page.waitForTimeout(300);

  const afterPrune = await page.evaluate(() => JSON.parse(localStorage.getItem('bonsai:v2')));
  const active = afterPrune.bonsai.find(item => item.id === afterPrune.activeBonsaiId);
  report.afterPrune = active.parts.firstLeft;
  if (active.parts.firstLeft.pruneLevel < 2 || active.parts.firstLeft.foliage >= 72) {
    throw new Error(`Pruning was not persisted: ${JSON.stringify(active.parts.firstLeft)}`);
  }

  report.phase = 'show page';
  await page.getByRole('button', { name: /大会/ }).click();
  await page.waitForSelector('.show-card');
  await page.waitForFunction(() => window.scrollY <= 2, { timeout: 5000 });
  await page.waitForFunction(() => {
    const image = document.querySelector('.show-card .bonsai-stage img');
    return image instanceof HTMLImageElement && image.complete && image.naturalWidth >= 800;
  }, { timeout: 20000 });
  await page.waitForFunction(() => !document.querySelector('.toast'), { timeout: 4000 }).catch(() => {});
  await page.waitForTimeout(200);

  report.showVisual = await inspectVisibleArtwork('.show-card');
  assertVisibleArtwork(report.showVisual, 'show page');
  if (!report.showVisual.text.includes('現在の予想評価')) throw new Error(`show card content is missing: ${report.showVisual.text}`);
  await page.screenshot({ path: 'test-artifacts/03-show-visible.png', fullPage: false });
  await page.locator('.show-card').screenshot({ path: 'test-artifacts/04-show-artwork.png' });

  const fatalConsole = report.consoleErrors.filter(message => /uncaught|typeerror|referenceerror|syntaxerror|failed to load module script|\[BONSAI fatal\]/i.test(message));
  if (report.pageErrors.length || fatalConsole.length) {
    throw new Error(`Browser errors: ${[...report.pageErrors, ...fatalConsole].join(' | ')}`);
  }
  report.phase = 'complete';
} catch (error) {
  report.failure = { name: error.name, message: error.message, stack: error.stack };
  try { await page.screenshot({ path: 'test-artifacts/99-failure.png', fullPage: false }); } catch {}
  throw error;
} finally {
  fs.writeFileSync('test-artifacts/smoke-result.json', JSON.stringify(report, null, 2));
  await context.close();
  await browser.close();
}

console.log(`BONSAI React rebuild smoke: PASS (${publicMode ? 'public' : 'local'})`);
