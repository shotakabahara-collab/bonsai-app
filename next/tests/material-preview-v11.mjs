import { webkit } from 'playwright';
import fs from 'node:fs';

fs.mkdirSync('test-artifacts', { recursive: true });
const baseURL = process.env.BONSAI_BASE_URL || 'http://127.0.0.1:4173/bonsai-app/';
const browser = await webkit.launch({ headless: true });
const report = { phase: 'start', baseURL, assets: {}, errors: [] };

async function inspectAsset(page, name) {
  return page.evaluate(async ({ name, nonce }) => {
    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.src = new URL(`assets/kuromatsu/base/${name}.webp?v11=${nonce}`, location.href).href;
    await image.decode();
    if (image.naturalWidth !== 900 || image.naturalHeight !== 1500) {
      throw new Error(`${name} has unexpected dimensions ${image.naturalWidth}x${image.naturalHeight}`);
    }

    const canvas = document.createElement('canvas');
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context) throw new Error('Canvas 2D context was not available');
    context.drawImage(image, 0, 0);

    const areas = [
      [20, 1288, 135, 1488],
      [535, 1288, 880, 1488],
      [80, 1435, 820, 1488]
    ];
    let saturationTotal = 0;
    let redTotal = 0;
    let greenTotal = 0;
    let blueTotal = 0;
    let count = 0;

    for (const [x0, y0, x1, y1] of areas) {
      const pixels = context.getImageData(x0, y0, x1 - x0, y1 - y0).data;
      for (let index = 0; index < pixels.length; index += 4) {
        const red = pixels[index];
        const green = pixels[index + 1];
        const blue = pixels[index + 2];
        const light = .2126 * red + .7152 * green + .0722 * blue;
        if (light <= 18) continue;
        const maximum = Math.max(red, green, blue);
        const minimum = Math.min(red, green, blue);
        saturationTotal += maximum === 0 ? 0 : (maximum - minimum) / maximum;
        redTotal += red;
        greenTotal += green;
        blueTotal += blue;
        count += 1;
      }
    }

    if (count < 100000) throw new Error(`${name} floor sample is too small: ${count}`);
    const averageRgb = [redTotal / count, greenTotal / count, blueTotal / count];
    return {
      src: image.src,
      width: image.naturalWidth,
      height: image.naturalHeight,
      count,
      averageSaturation: saturationTotal / count,
      averageRgb,
      maximumChannelDifference: Math.max(...averageRgb) - Math.min(...averageRgb),
      redBlueBias: averageRgb[0] - averageRgb[2]
    };
  }, { name, nonce: Date.now() });
}

try {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 3,
    serviceWorkers: 'allow'
  });
  const page = await context.newPage();
  page.on('pageerror', error => report.errors.push(error.message));
  await page.addInitScript(() => localStorage.clear());
  await page.goto(new URL(`index.html?material-preview-v11=${Date.now()}`, baseURL).href, {
    waitUntil: 'domcontentloaded',
    timeout: 60000
  });

  report.phase = 'asset floor audit';
  for (const name of ['starter', 'old', 'blue', 'black', 'moon']) {
    const metrics = await inspectAsset(page, name);
    if (metrics.averageSaturation > .08) {
      throw new Error(`${name} lower floor remains saturated: ${JSON.stringify(metrics)}`);
    }
    if (metrics.maximumChannelDifference > 8 || metrics.redBlueBias > 4) {
      throw new Error(`${name} lower floor remains red-brown: ${JSON.stringify(metrics)}`);
    }
    report.assets[name] = metrics;
  }

  report.phase = 'material selection screenshot';
  await page.waitForSelector('[data-testid="onboarding"]');
  await page.getByRole('button', { name: '声の主を追う' }).click();
  await page.getByRole('button', { name: '素材棚へ進む' }).click();
  const preview = page.locator('.material-preview');
  await preview.waitFor();
  await page.waitForFunction(() => {
    const image = document.querySelector('.material-preview .bonsai-photo');
    return image instanceof HTMLImageElement && image.complete && image.naturalWidth === 900 && image.naturalHeight === 1500;
  });
  await preview.screenshot({ path: 'test-artifacts/material-preview-v11-iphone.png' });

  const pseudoContent = await page.evaluate(() => {
    const node = document.querySelector('.material-preview');
    return node ? getComputedStyle(node, '::after').content : 'none';
  });
  if (!["", 'none', 'normal'].includes(pseudoContent)) {
    throw new Error(`A painted floor correction overlay is present: ${pseudoContent}`);
  }
  if (report.errors.length) throw new Error(`Browser errors: ${report.errors.join(' | ')}`);

  report.phase = 'complete';
  report.pseudoContent = pseudoContent;
  await context.close();
} catch (error) {
  report.failure = { name: error.name, message: error.message, stack: error.stack };
  throw error;
} finally {
  fs.writeFileSync('test-artifacts/material-preview-v11-result.json', JSON.stringify(report, null, 2));
  await browser.close();
}

console.log('BONSAI Material Preview v11 lower-floor audit: PASS');
