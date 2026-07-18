import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const REMOTE = 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/01/Japanese_Black_Pine_bonsai_135%2C_October_10%2C_2008.jpg/960px-Japanese_Black_Pine_bonsai_135%2C_October_10%2C_2008.jpg';
const ARTIFACT_DIR = 'test-artifacts';
const FIXTURE = path.join(ARTIFACT_DIR, 'source-pine.jpg');
const report = { phase: 'prepare', errors: [], failedRequests: [], responses: [] };
let browser;

const delay = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));

async function downloadFixture() {
  fs.mkdirSync(ARTIFACT_DIR, { recursive: true });
  if (fs.existsSync(FIXTURE) && fs.statSync(FIXTURE).size > 100000) return;
  let lastError;
  for (let attempt = 1; attempt <= 5; attempt += 1) {
    try {
      const response = await fetch(REMOTE, {
        headers: { 'user-agent': 'BONSAI visual validation/1.0' },
        redirect: 'follow',
        signal: AbortSignal.timeout(45000)
      });
      if (!response.ok) throw new Error(`fixture HTTP ${response.status}`);
      const bytes = Buffer.from(await response.arrayBuffer());
      if (bytes.length < 100000 || bytes[0] !== 0xff || bytes[1] !== 0xd8 || bytes.at(-2) !== 0xff || bytes.at(-1) !== 0xd9) {
        throw new Error(`invalid fixture JPEG (${bytes.length} bytes)`);
      }
      fs.writeFileSync(FIXTURE, bytes);
      report.fixtureBytes = bytes.length;
      return;
    } catch (error) {
      lastError = error;
      await delay(attempt * 1000);
    }
  }
  throw lastError || new Error('fixture download failed');
}

try {
  await downloadFixture();
  report.phase = 'launch';
  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    serviceWorkers: 'block'
  });
  const page = await context.newPage();

  await page.route(REMOTE, async route => {
    const body = fs.readFileSync(FIXTURE);
    await route.fulfill({
      status: 200,
      contentType: 'image/jpeg',
      headers: {
        'access-control-allow-origin': '*',
        'cache-control': 'no-store',
        'cross-origin-resource-policy': 'cross-origin'
      },
      body
    });
  });

  page.on('console', message => {
    if (message.type() === 'error') report.errors.push(message.text());
  });
  page.on('pageerror', error => report.errors.push(error.message));
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
    name: '検証者',
    mentor: 0,
    sp: 'pine',
    tree: '黒松・検証樹',
    born: now - 1728000000,
    water: 84,
    last: now,
    vit: 91,
    stress: 4,
    prune: 0,
    wire: 0,
    fert: 2,
    pot: 'black',
    money: 9000,
    rep: 180,
    owned: ['starter', 'black'],
    awards: [],
    log: [],
    lastWeek: '',
    stats: { water: 5, prune: 0, wire: 0, shows: 0 }
  };

  report.phase = 'seed';
  await page.addInitScript(state => {
    localStorage.setItem('bonsai_live_1', JSON.stringify(state));
  }, seedState);
  await page.goto('http://127.0.0.1:4173/', { waitUntil: 'domcontentloaded', timeout: 30000 });

  report.phase = 'base';
  await page.waitForFunction(() => {
    const image = document.querySelector('.photo-bonsai img');
    return image?.complete
      && image.naturalWidth >= 900
      && document.querySelector('.bonsai-state-canvas')
      && image.closest('.photo-bonsai')?.classList.contains('bonsai-state-ready');
  }, null, { timeout: 60000 });

  report.base = await page.evaluate(() => {
    const image = document.querySelector('.photo-bonsai img');
    const canvas = document.querySelector('.bonsai-state-canvas');
    return {
      width: image.naturalWidth,
      height: image.naturalHeight,
      crossOrigin: image.crossOrigin,
      src: image.currentSrc,
      canvasWidth: canvas.width,
      canvasHeight: canvas.height,
      ready: image.closest('.photo-bonsai')?.classList.contains('bonsai-state-ready'),
      credit: document.querySelector('#bonsai-photo-credit')?.textContent || ''
    };
  });

  if (report.base.width < 900 || report.base.height < 900) {
    throw new Error(`source resolution too low: ${JSON.stringify(report.base)}`);
  }
  if (report.base.crossOrigin !== 'anonymous') {
    throw new Error(`source image is not CORS-enabled: ${JSON.stringify(report.base)}`);
  }
  if (!report.base.ready) throw new Error('state canvas did not become visible');
  if (!/Sage Ross/.test(report.base.credit) || !/CC BY-SA 3.0/.test(report.base.credit)) {
    throw new Error('attribution missing');
  }

  await page.screenshot({ path: `${ARTIFACT_DIR}/01-home-base.png`, fullPage: true });
  await page.locator('.stage').screenshot({ path: `${ARTIFACT_DIR}/02-stage-base.png` });

  report.phase = 'prune-wire';
  report.action = await page.evaluate(() => {
    let state = window.BonsaiAdvancedCare.migrateState(JSON.parse(localStorage.getItem('bonsai_live_1')));
    const pruned = window.BonsaiAdvancedCare.applyAction(state, 'first_left', 'prune_medium');
    if (!pruned.ok) return pruned;
    const wired = window.BonsaiAdvancedCare.applyAction(pruned.state, 'second_right', 'wire_light', 'down');
    localStorage.setItem('bonsai_live_1', JSON.stringify(wired.state));
    window.BonsaiStateRuntime?.render?.();
    return {
      ok: wired.ok,
      signature: window.BonsaiAdvancedCare.visualSignature(wired.state)
    };
  });

  if (!report.action.ok) throw new Error(`advanced action failed: ${JSON.stringify(report.action)}`);
  await page.waitForTimeout(2600);
  await page.locator('.stage').screenshot({ path: `${ARTIFACT_DIR}/03-stage-pruned-wired.png` });

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

  if (report.export.width !== 1200 || report.export.height !== 1600 || report.export.size < 100000) {
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
    window.BonsaiStateRuntime?.render?.();
  });
  await page.waitForTimeout(2600);
  await page.locator('.stage').screenshot({ path: `${ARTIFACT_DIR}/04-stage-pathology-deadwood.png` });

  if (report.errors.some(message => /state image source failed|tainted|securityerror/i.test(message))) {
    throw new Error(`browser errors: ${report.errors.join(' | ')}`);
  }
  report.phase = 'complete';
} catch (error) {
  report.failure = { name: error.name, message: error.message, stack: error.stack };
  throw error;
} finally {
  fs.mkdirSync(ARTIFACT_DIR, { recursive: true });
  fs.writeFileSync(`${ARTIFACT_DIR}/browser-result.json`, JSON.stringify(report, null, 2));
  if (browser) await browser.close();
}
