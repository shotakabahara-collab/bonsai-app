import { webkit } from 'playwright';
import fs from 'node:fs';

fs.mkdirSync('test-artifacts', { recursive: true });
const baseURL = process.env.BONSAI_BASE_URL || 'http://127.0.0.1:4173/bonsai-app/';
const browser = await webkit.launch({ headless: true });
const report = { phase: 'start', baseURL, assets: {}, errors: [] };

async function inspectAsset(page, relativePath) {
  return page.evaluate(async ({ base, path }) => {
    const image = new Image();
    image.src = new URL(path, base).href + `?audit=${Date.now()}`;
    await image.decode();
    if (image.naturalWidth !== 900 || image.naturalHeight !== 1500) {
      throw new Error(`Unexpected material image dimensions: ${image.naturalWidth}x${image.naturalHeight}`);
    }
    const canvas = document.createElement('canvas');
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context) throw new Error('Canvas 2D context is unavailable');
    context.drawImage(image, 0, 0);
    const x0 = 30;
    const x1 = 870;
    const y0 = 1130;
    const y1 = 1290;
    const pixels = context.getImageData(x0, y0, x1 - x0, y1 - y0).data;
    let saturationTotal = 0;
    let redTotal = 0;
    let greenTotal = 0;
    let blueTotal = 0;
    let count = 0;
    for (let index = 0; index < pixels.length; index += 4) {
      const redByte = pixels[index];
      const greenByte = pixels[index + 1];
      const blueByte = pixels[index + 2];
      const luminance = .2126 * redByte + .7152 * greenByte + .0722 * blueByte;
      if (luminance <= 120) continue;
      const red = redByte / 255;
      const green = greenByte / 255;
      const blue = blueByte / 255;
      const maximum = Math.max(red, green, blue);
      const minimum = Math.min(red, green, blue);
      saturationTotal += maximum === 0 ? 0 : (maximum - minimum) / maximum;
      redTotal += redByte;
      greenTotal += greenByte;
      blueTotal += blueByte;
      count += 1;
    }
    if (count < 80000) throw new Error(`Too few wall pixels were available for audit: ${count}`);
    const averageRgb = [redTotal / count, greenTotal / count, blueTotal / count];
    return {
      src: image.src,
      width: image.naturalWidth,
      height: image.naturalHeight,
      sample: { x0, x1, y0, y1, count },
      averageSaturation: saturationTotal / count,
      averageRgb,
      maximumChannelDifference: Math.max(...averageRgb) - Math.min(...averageRgb)
    };
  }, { base: baseURL, path: relativePath });
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
  await page.goto(new URL(`index.html?material-preview-v10=${Date.now()}`, baseURL).href, {
    waitUntil: 'domcontentloaded',
    timeout: 60000
  });

  report.phase = 'verify repaired base photographs';
  const assets = {
    starter: 'assets/kuromatsu/base/starter.webp',
    old: 'assets/kuromatsu/base/old.webp',
    blue: 'assets/kuromatsu/base/blue.webp'
  };
  for (const [name, path] of Object.entries(assets)) {
    const metrics = await inspectAsset(page, path);
    report.assets[name] = metrics;
    if (metrics.averageSaturation > .04) {
      throw new Error(`${name} still contains a colored rectangular backdrop: ${JSON.stringify(metrics)}`);
    }
    if (metrics.maximumChannelDifference > 8) {
      throw new Error(`${name} wall remains color-biased: ${JSON.stringify(metrics)}`);
    }
  }

  report.phase = 'capture iPhone material selection';
  await page.waitForSelector('[data-testid="onboarding"]');
  await page.getByRole('button', { name: '声の主を追う' }).click();
  await page.getByRole('button', { name: '素材棚へ進む' }).click();
  const preview = page.locator('.material-preview');
  await preview.waitFor();
  await page.waitForFunction(() => {
    const image = document.querySelector('.material-preview .bonsai-photo');
    return image instanceof HTMLImageElement && image.complete && image.naturalWidth === 900 && image.naturalHeight === 1500;
  });
  const pseudoContent = await page.evaluate(() => {
    const previewNode = document.querySelector('.material-preview');
    return previewNode ? getComputedStyle(previewNode, '::after').content : 'none';
  });
  const paintedPseudo = Boolean(pseudoContent) && !['none', 'normal', '""', "''"].includes(pseudoContent);
  if (paintedPseudo) {
    throw new Error(`A translucent correction rectangle is still painted over the photograph: ${pseudoContent}`);
  }
  report.pseudoContent = pseudoContent;
  await preview.screenshot({ path: 'test-artifacts/material-preview-v10-iphone.png' });

  if (report.errors.length) throw new Error(`Browser errors: ${report.errors.join(' | ')}`);
  report.phase = 'complete';
  await context.close();
} catch (error) {
  report.failure = { name: error.name, message: error.message, stack: error.stack };
  throw error;
} finally {
  fs.writeFileSync('test-artifacts/material-preview-v10-result.json', JSON.stringify(report, null, 2));
  await browser.close();
}

console.log('BONSAI material preview v10 photographic backdrop repair: PASS');
