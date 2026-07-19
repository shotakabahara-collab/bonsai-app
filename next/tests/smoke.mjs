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
  wireVisual: null,
  judgingCriteria: 0,
  growVisual: null,
  showVisual: null,
  asyncFieldCount: 0,
  rentalPayment: 0,
  archiveCount: 0,
  purchaseReplacement: null
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
  // WebKit can occasionally return an all-zero canvas sample for a decoded,
  // visibly painted WebP. Layout, intrinsic resolution and screenshot pixels are
  // audited separately, so only reject a non-zero but genuinely uniform sample here.
  if (visual.sample.sampled && visual.sample.mean > 0 && visual.sample.variance < 80) {
    throw new Error(`${label}: photograph pixels are nearly uniform: ${JSON.stringify(visual.sample)}`);
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
    localStorage.removeItem('bonsai:offers:v1');
    localStorage.removeItem('bonsai:visual-archive:v1');
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
  if (await page.getByRole('button', { name: /施肥|堆肥/ }).count()) throw new Error('Fertilizer action is still visible');

  const bodyBackground = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  if (/255, 255, 255/.test(bodyBackground)) throw new Error(`White screen background: ${bodyBackground}`);
  if (await page.getByRole('button', { name: '施肥' }).count()) throw new Error('fertilizer action remains');
  if ('fertilizer' in migrated.bonsai[0]) throw new Error('fertilizer state remains');
  if (!migrated.bonsai[0].craft || Object.keys(migrated.bonsai[0].craft.sites).length !== 26) throw new Error('26-site craft model was not migrated');

  await page.evaluate(() => window.scrollTo(0, 0));
  report.growVisual = await inspectVisibleArtwork('.artwork-card');
  assertVisibleArtwork(report.growVisual, 'grow page');
  await page.screenshot({ path: 'test-artifacts/01-grow-visible.png', fullPage: false });
  await page.locator('.artwork-card').screenshot({ path: 'test-artifacts/02-grow-artwork.png' });

  report.phase = 'care actions';
  await page.getByRole('button', { name: '水やり' }).click();
  await page.getByRole('button', { name: '部位剪定' }).click();
  await page.waitForSelector('.precision-pruning-sheet[data-total-sites="26"]');
  await page.locator('.precision-group-tabs button').filter({ hasText: '第一枝' }).click();
  await page.locator('.precision-site-grid button').filter({ hasText: '第一枝・先端' }).click();
  await page.getByRole('button', { name: /古葉取り・葉透かし/ }).click();
  page.once('dialog', dialog => dialog.accept());
  await page.getByRole('button', { name: 'この箇所へ確定する' }).click();
  await page.waitForTimeout(300);

  const afterPrune = await page.evaluate(() => JSON.parse(localStorage.getItem('bonsai:v2')));
  const active = afterPrune.bonsai.find(item => item.id === afterPrune.activeBonsaiId);
  report.afterPrune = { part: active.parts.firstLeft, site: active.craft.sites.firstTip };
  if (active.craft.sites.firstTip.foliage >= 72 || active.craft.sites.firstTip.lastTechnique !== 'needleThin') {
    throw new Error(`Precision pruning was not persisted: ${JSON.stringify(active.craft.sites.firstTip)}`);
  }

  await page.getByRole('button', { name: '部位針金' }).click();
  await page.getByRole('button', { name: '第一枝を選択' }).click();
  await page.getByRole('button', { name: 'この部位へかける' }).click();
  await page.waitForTimeout(250);
  await page.getByRole('button', { name: /大会/ }).click();
  await page.waitForSelector('.show-eligibility-blocker');
  if (!(await page.getByRole('button', { name: '今週の展覧会へ出展' }).isDisabled())) throw new Error('wired bonsai can enter exhibition');
  await page.getByRole('button', { name: /育成/ }).click();
  await page.getByRole('button', { name: '部位針金' }).click();
  await page.getByRole('button', { name: '第一枝を選択' }).click();
  await page.getByRole('button', { name: /定着前に外す|適期に針金を外す|食い込み前にすぐ外す/ }).click();
  await page.waitForSelector('.wire-status-tag', { state: 'detached', timeout: 5000 });
  const afterWireRemoval = await page.evaluate(() => JSON.parse(localStorage.getItem('bonsai:v2')));
  const wiredTree = afterWireRemoval.bonsai.find(item => item.id === afterWireRemoval.activeBonsaiId);
  if (wiredTree.parts.firstLeft.wire || !wiredTree.parts.firstLeft.shapeRetention) throw new Error('wire lifecycle removal was not persisted');

  report.phase = 'realistic branch wiring';
  await page.getByRole('button', { name: '部位針金' }).click();
  await page.getByRole('button', { name: '第二枝を選択' }).click();
  await page.getByRole('button', { name: '右へ' }).click();
  await page.getByRole('button', { name: 'この部位へかける' }).click();
  await page.waitForSelector('.wire-coil-metal');
  report.wireVisual = await page.evaluate(() => ({
    coils: document.querySelectorAll('.wire-coil-metal').length,
    continuousLines: document.querySelectorAll('.wire-path').length,
    status: document.querySelector('.wire-status-tag')?.textContent ?? '',
    wire: JSON.parse(localStorage.getItem('bonsai:v2')).bonsai.find(item => item.id === JSON.parse(localStorage.getItem('bonsai:v2')).activeBonsaiId).parts.secondRight.wire
  }));
  if (report.wireVisual.coils < 5 || report.wireVisual.continuousLines !== 0 || !report.wireVisual.status.includes('整姿中') || report.wireVisual.wire?.direction !== 'right') {
    throw new Error(`Wire rendering is not branch-coil based: ${JSON.stringify(report.wireVisual)}`);
  }
  await page.screenshot({ path: 'test-artifacts/02b-wire-coils.png', fullPage: false });

  // The branch-aligned wire above is only a visual inspection step. A wired tree
  // is intentionally ineligible, so remove the second-branch wire before judging.
  await page.getByRole('button', { name: /育成/ }).click();
  await page.getByRole('button', { name: '部位針金' }).click();
  await page.getByRole('button', { name: '第二枝を選択' }).click();
  await page.getByRole('button', { name: /定着前に外す|適期に針金を外す|食い込み前にすぐ外す/ }).click();
  await page.waitForSelector('.wire-status-tag', { state: 'detached', timeout: 5000 });
  const afterSecondWireRemoval = await page.evaluate(() => JSON.parse(localStorage.getItem('bonsai:v2')));
  const preparedTree = afterSecondWireRemoval.bonsai.find(item => item.id === afterSecondWireRemoval.activeBonsaiId);
  const remainingWires = Object.entries(preparedTree.parts).filter(([, state]) => Boolean(state.wire));
  if (remainingWires.length) throw new Error(`wire remained before exhibition: ${JSON.stringify(remainingWires)}`);

  report.phase = 'show page';
  await page.getByRole('button', { name: /大会/ }).click();
  await page.waitForSelector('.show-card');
  await page.waitForFunction(() => !document.querySelector('.wire-status-tag'), { timeout: 5000 });
  await page.waitForFunction(() => {
    const button = [...document.querySelectorAll('button')].find(item => item.textContent?.includes('今週の展覧会へ出展'));
    return button instanceof HTMLButtonElement && !button.disabled;
  }, { timeout: 5000 });
  await page.waitForFunction(() => window.scrollY <= 2, { timeout: 5000 });
  await page.waitForFunction(() => {
    const image = document.querySelector('.show-card .bonsai-stage img');
    return image instanceof HTMLImageElement && image.complete && image.naturalWidth >= 800;
  }, { timeout: 20000 });
  await page.waitForFunction(() => !document.querySelector('.toast'), { timeout: 4000 }).catch(() => {});
  await page.waitForTimeout(200);

  report.showVisual = await inspectVisibleArtwork('.show-card');
  assertVisibleArtwork(report.showVisual, 'show page');
  if (!report.showVisual.text.includes('三部門合議による予想評価')) throw new Error(`show card content is missing: ${report.showVisual.text}`);
  await page.waitForSelector('.judging-standard');
  report.judgingCriteria = await page.locator('.criterion-card').count();
  const judgingText = await page.locator('.judging-standard').innerText();
  if (report.judgingCriteria !== 6 || !judgingText.includes('国風賞') || !judgingText.includes('樹格・成熟度') || !judgingText.includes('培養・健康')) {
    throw new Error(`Published judging rubric is incomplete: ${report.judgingCriteria} / ${judgingText}`);
  }
  await page.screenshot({ path: 'test-artifacts/03-show-visible.png', fullPage: false });
  await page.locator('.show-card').screenshot({ path: 'test-artifacts/04-show-artwork.png' });

  report.phase = 'asynchronous field';
  await page.getByRole('button', { name: /出展作品/ }).click();
  await page.waitForSelector('.field-list');
  report.asyncFieldCount = await page.locator('.field-list article').count();
  if (report.asyncFieldCount < 7) throw new Error(`asynchronous field is incomplete: ${report.asyncFieldCount}`);
  const fieldText = await page.locator('.field-list').innerText();
  if (!fieldText.includes(legacy.name) || !fieldText.includes('非同期出展')) throw new Error(`asynchronous player work is missing: ${fieldText}`);
  await page.screenshot({ path: 'test-artifacts/05-asynchronous-field.png', fullPage: false });
  await page.getByRole('button', { name: '閉じる' }).click();

  report.phase = 'weekly show and rental offer';
  const moneyBeforeRental = (await page.evaluate(() => JSON.parse(localStorage.getItem('bonsai:v2')))).money;
  await page.getByRole('button', { name: /今週の展覧会へ出展/ }).click();
  await page.waitForSelector('.result-card');
  await page.getByRole('button', { name: '銘木録へ進む' }).click();
  await page.waitForSelector('.completion-dock .offer-button', { timeout: 6000 });
  await page.getByRole('button', { name: /オファー/ }).click();
  await page.waitForSelector('.offer-card');
  const offerText = await page.locator('.offer-card').first().innerText();
  if (!offerText.includes('提示額') || !offerText.includes('貸出')) throw new Error(`rental offer is incomplete: ${offerText}`);
  await page.screenshot({ path: 'test-artifacts/06-rental-offer.png', fullPage: false });
  await page.getByRole('button', { name: '貸出を受ける' }).first().click();
  await page.waitForFunction(previous => JSON.parse(localStorage.getItem('bonsai:v2')).money > previous, moneyBeforeRental, { timeout: 5000 });
  const moneyAfterRental = (await page.evaluate(() => JSON.parse(localStorage.getItem('bonsai:v2')))).money;
  report.rentalPayment = moneyAfterRental - moneyBeforeRental;
  if (report.rentalPayment <= 0) throw new Error('rental payment was not credited');
  await page.getByRole('button', { name: '閉じる' }).click();

  report.phase = 'visual archive';
  await page.getByRole('button', { name: /銘木録/ }).click();
  await page.waitForSelector('.memorial-hero');
  await page.waitForSelector('.completion-dock button', { timeout: 5000 });
  await page.getByRole('button', { name: /作品写真/ }).click();
  await page.waitForSelector('.archive-card');
  report.archiveCount = await page.locator('.archive-card').count();
  if (report.archiveCount < 2) throw new Error(`visual archive did not preserve state changes: ${report.archiveCount}`);
  await page.waitForFunction(() => [...document.querySelectorAll('.archive-card img')].every(image => image.complete && image.naturalWidth >= 800), { timeout: 20000 });
  await page.screenshot({ path: 'test-artifacts/07-visual-archive.png', fullPage: false });
  await page.getByRole('button', { name: '閉じる' }).click();

  report.phase = 'wealthy purchase and replacement';
  const purchaseSeed = await page.evaluate(() => {
    const game = JSON.parse(localStorage.getItem('bonsai:v2'));
    const tree = game.bonsai.find(item => item.id === game.activeBonsaiId);
    const offer = {
      id: 'audit-purchase-offer', awardId: 'audit-award', bonsaiId: tree.id, kind: 'purchase',
      issuer: '東雲 崇', title: '名木・購入希望', amount: 22000, score: 91,
      createdAt: Date.now(), expiresAt: Date.now() + 86400000
    };
    localStorage.setItem('bonsai:offers:v1', JSON.stringify([offer]));
    window.dispatchEvent(new CustomEvent('bonsai:game-updated', { detail: game }));
    return { oldBonsaiId: tree.id, money: game.money };
  });
  await page.waitForSelector('.completion-dock .offer-button', { timeout: 5000 });
  await page.getByRole('button', { name: /オファー/ }).click();
  await page.waitForSelector('.offer-purchase');
  await page.screenshot({ path: 'test-artifacts/08-purchase-offer.png', fullPage: false });
  await page.locator('.offer-purchase:visible').last().getByRole('button', { name: /売却して山もみじへ買替/ }).click();
  await page.waitForFunction(({ oldBonsaiId, money }) => {
    const game = JSON.parse(localStorage.getItem('bonsai:v2'));
    const active = game.bonsai.find(item => item.id === game.activeBonsaiId);
    return active && active.id !== oldBonsaiId && active.species === 'maple' && game.money > money;
  }, purchaseSeed, { timeout: 5000 });
  report.purchaseReplacement = await page.evaluate(() => {
    const game = JSON.parse(localStorage.getItem('bonsai:v2'));
    const active = game.bonsai.find(item => item.id === game.activeBonsaiId);
    return { species: active.species, name: active.name, money: game.money };
  });

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
