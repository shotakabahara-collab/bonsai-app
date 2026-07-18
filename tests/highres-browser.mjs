import { chromium } from 'playwright';
import fs from 'node:fs';

const report = { phase: 'launch', console: [], failedRequests: [], responses: [] };
let browser;
let page;

const inspectPage = async () => page.evaluate(() => {
  const image = document.querySelector('.photo-bonsai img');
  const canvas = document.querySelector('.bonsai-state-canvas');
  return {
    readyState: document.readyState,
    rootLength: document.querySelector('#root')?.innerHTML.length || 0,
    hasPhoto: Boolean(image),
    imageComplete: Boolean(image?.complete),
    imageWidth: image?.naturalWidth || 0,
    imageHeight: image?.naturalHeight || 0,
    imageCrossOrigin: image?.crossOrigin || '',
    imageSrc: image?.currentSrc || image?.src || '',
    hasCanvas: Boolean(canvas),
    canvasWidth: canvas?.width || 0,
    canvasHeight: canvas?.height || 0,
    frameReady: Boolean(image?.closest('.photo-bonsai')?.classList.contains('bonsai-state-ready')),
    hasPhotoSource: Boolean(window.BonsaiPhotoSource),
    hasRuntime: Boolean(window.BonsaiStateRuntime),
    hasAdvancedCare: Boolean(window.BonsaiAdvancedCare),
    savedStarted: Boolean(JSON.parse(localStorage.getItem('bonsai_live_1') || '{}').started),
    credit: document.querySelector('#bonsai-photo-credit')?.textContent || ''
  };
});

try {
  browser = await chromium.launch({ headless: true });
  page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });

  page.on('console', message => {
    if (message.type() === 'error' || message.type() === 'warning') {
      report.console.push(`${message.type()}: ${message.text()}`);
    }
  });
  page.on('pageerror', error => report.console.push(`pageerror: ${error.message}`));
  page.on('requestfailed', request => report.failedRequests.push({
    url: request.url(),
    error: request.failure()?.errorText || ''
  }));
  page.on('response', response => {
    if (/wikimedia|photo-source-v2|state-image-runtime/.test(response.url())) {
      report.responses.push({
        url: response.url(),
        status: response.status(),
        serviceWorker: response.fromServiceWorker()
      });
    }
  });

  const now = Date.now();
  const seedState = {
    started: true,
    name: '検証者', mentor: 0, sp: 'pine', tree: '黒松・検証樹',
    born: now - 1728000000, water: 84, last: now, vit: 91, stress: 4,
    prune: 0, wire: 0, fert: 2, pot: 'black', money: 9000, rep: 180,
    owned: ['starter', 'black'], awards: [], log: [], lastWeek: '',
    stats: { water: 5, prune: 0, wire: 0, shows: 0 }
  };

  report.phase = 'seed';
  await page.addInitScript(state => {
    localStorage.setItem('bonsai_live_1', JSON.stringify(state));
  }, seedState);
  await page.goto('http://127.0.0.1:4173/', { waitUntil: 'commit', timeout: 30000 });

  report.phase = 'source-ready';
  await page.waitForFunction(() => {
    const image = document.querySelector('.photo-bonsai img');
    return image?.complete && image.naturalWidth >= 900 && window.BonsaiStateRuntime && window.BonsaiAdvancedCare;
  }, null, { timeout: 60000 });
  report.beforeRender = await inspectPage();

  report.phase = 'automatic-render';
  report.automaticReady = await page.waitForFunction(() => {
    const frame = document.querySelector('.photo-bonsai');
    return Boolean(frame?.querySelector('.bonsai-state-canvas') && frame.classList.contains('bonsai-state-ready'));
  }, null, { timeout: 6000 }).then(() => true).catch(() => false);

  if (!report.automaticReady) {
    report.phase = 'manual-render-diagnostic';
    await page.evaluate(async () => {
      window.BonsaiPhotoSource?.prepareImage?.();
      await window.BonsaiStateRuntime?.render?.();
    });
  }

  await page.waitForFunction(() => {
    const frame = document.querySelector('.photo-bonsai');
    return Boolean(frame?.querySelector('.bonsai-state-canvas') && frame.classList.contains('bonsai-state-ready'));
  }, null, { timeout: 20000 });

  report.phase = 'base';
  report.base = await inspectPage();
  if (report.base.imageWidth < 900 || report.base.imageHeight < 1200) {
    throw new Error(`source resolution too low: ${JSON.stringify(report.base)}`);
  }
  if (report.base.imageCrossOrigin !== 'anonymous') {
    throw new Error(`source image is not CORS-enabled: ${JSON.stringify(report.base)}`);
  }
  if (!/Sage Ross/.test(report.base.credit) || !/CC BY-SA 3.0/.test(report.base.credit)) {
    throw new Error('attribution missing');
  }

  await page.screenshot({ path: 'test-artifacts/01-home-base.png', fullPage: true });
  await page.locator('.stage').screenshot({ path: 'test-artifacts/02-stage-base.png' });

  report.phase = 'prune-wire';
  report.action = await page.evaluate(() => {
    let state = window.BonsaiAdvancedCare.migrateState(JSON.parse(localStorage.getItem('bonsai_live_1')));
    const pruned = window.BonsaiAdvancedCare.applyAction(state, 'first_left', 'prune_medium');
    if (!pruned.ok) return pruned;
    const wired = window.BonsaiAdvancedCare.applyAction(pruned.state, 'second_right', 'wire_light', 'down');
    localStorage.setItem('bonsai_live_1', JSON.stringify(wired.state));
    return { ok: wired.ok, signature: window.BonsaiAdvancedCare.visualSignature(wired.state) };
  });
  if (!report.action.ok) throw new Error(`advanced action failed: ${JSON.stringify(report.action)}`);
  await page.waitForTimeout(2400);
  await page.locator('.stage').screenshot({ path: 'test-artifacts/03-stage-pruned-wired.png' });

  report.phase = 'export';
  report.export = await page.evaluate(async () => {
    const state = JSON.parse(localStorage.getItem('bonsai_live_1'));
    const image = document.querySelector('.photo-bonsai img');
    const canvas = await window.BonsaiStateRuntime.compose(state, 1200, 1600, image.currentSrc || image.src);
    const blob = await new Promise((resolve, reject) => {
      canvas.toBlob(value => value ? resolve(value) : reject(new Error('toBlob null')), 'image/jpeg', 0.91);
    });
    return { width: canvas.width, height: canvas.height, size: blob.size };
  });
  if (report.export.width !== 1200 || report.export.height !== 1600 || report.export.size < 120000) {
    throw new Error(`high-resolution export failed: ${JSON.stringify(report.export)}`);
  }

  report.phase = 'disease-deadwood';
  await page.evaluate(() => {
    const state = window.BonsaiAdvancedCare.migrateState(JSON.parse(localStorage.getItem('bonsai_live_1')));
    state.advanced.parts.apex.disease = 'needle_blight';
    state.advanced.parts.third_left.pest = 'spider_mite';
    state.advanced.parts.front_branch.deadwood = 'jin';
    state.advanced.shari = { level: 2, side: 'left', createdAt: Date.now() };
    localStorage.setItem('bonsai_live_1', JSON.stringify(state));
  });
  await page.waitForTimeout(2400);
  await page.locator('.stage').screenshot({ path: 'test-artifacts/04-stage-pathology-deadwood.png' });

  if (report.console.some(message => /state image source failed|tainted|securityerror/i.test(message))) {
    throw new Error(`browser console errors: ${report.console.join(' | ')}`);
  }
  if (!report.automaticReady) throw new Error('state image required a manual render call');
  report.phase = 'complete';
} catch (error) {
  report.failure = { name: error.name, message: error.message, stack: error.stack };
  if (page) {
    try { report.onFailure = await inspectPage(); } catch {}
    try { await page.screenshot({ path: 'test-artifacts/99-failure-page.png', fullPage: true }); } catch {}
  }
  throw error;
} finally {
  fs.mkdirSync('test-artifacts', { recursive: true });
  fs.writeFileSync('test-artifacts/browser-result.json', JSON.stringify(report, null, 2));
  if (browser) await browser.close();
}
