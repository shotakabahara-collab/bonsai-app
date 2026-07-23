import { webkit } from 'playwright';
import fs from 'node:fs';

fs.mkdirSync('test-artifacts', { recursive: true });
const baseURL = process.env.BONSAI_BASE_URL || 'http://127.0.0.1:4173/bonsai-app/';
const browser = await webkit.launch({ headless: true });
const report = { phase: 'start', baseURL, visual: null, errors: [] };

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

  report.phase = 'open material selection';
  await page.waitForSelector('[data-testid="onboarding"]');
  await page.getByRole('button', { name: '声の主を追う' }).click();
  await page.getByRole('button', { name: '素材棚へ進む' }).click();
  const preview = page.locator('.material-preview');
  await preview.waitFor();
  await page.waitForFunction(() => {
    const image = document.querySelector('.material-preview .bonsai-photo');
    return image instanceof HTMLImageElement && image.complete && image.naturalWidth > 0;
  });

  const correction = await page.evaluate(() => {
    const node = document.querySelector('.material-preview');
    const style = node ? getComputedStyle(node, '::after') : null;
    return style ? {
      content: style.content,
      top: style.top,
      left: style.left,
      width: style.width,
      height: style.height,
      backdropFilter: style.backdropFilter,
      webkitBackdropFilter: style.webkitBackdropFilter,
      backgroundColor: style.backgroundColor
    } : null;
  });
  if (!correction || correction.content === 'none' || correction.content === 'normal') {
    throw new Error(`Black-pine material correction is not active: ${JSON.stringify(correction)}`);
  }
  const activeFilter = correction.backdropFilter || correction.webkitBackdropFilter || '';
  if (!/saturate\(/.test(activeFilter) || !/brightness\(/.test(activeFilter)) {
    throw new Error(`Texture-preserving backdrop correction is missing: ${JSON.stringify(correction)}`);
  }

  const imagePath = 'test-artifacts/material-preview-v10-iphone.png';
  const png = await preview.screenshot({ path: imagePath });
  const visual = await page.evaluate(async dataUrl => {
    const image = new Image();
    image.src = dataUrl;
    await image.decode();
    const canvas = document.createElement('canvas');
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    context.drawImage(image, 0, 0);
    const x0 = Math.floor(canvas.width * .13);
    const x1 = Math.floor(canvas.width * .88);
    const y0 = Math.floor(canvas.height * .785);
    const y1 = Math.floor(canvas.height * .853);
    const pixels = context.getImageData(x0, y0, x1 - x0, y1 - y0).data;
    let saturationTotal = 0;
    let redTotal = 0;
    let greenTotal = 0;
    let blueTotal = 0;
    let count = 0;
    for (let index = 0; index < pixels.length; index += 4) {
      const red = pixels[index] / 255;
      const green = pixels[index + 1] / 255;
      const blue = pixels[index + 2] / 255;
      const maximum = Math.max(red, green, blue);
      const minimum = Math.min(red, green, blue);
      saturationTotal += maximum === 0 ? 0 : (maximum - minimum) / maximum;
      redTotal += pixels[index];
      greenTotal += pixels[index + 1];
      blueTotal += pixels[index + 2];
      count += 1;
    }
    return {
      width: canvas.width,
      height: canvas.height,
      averageSaturation: saturationTotal / count,
      averageRgb: [redTotal / count, greenTotal / count, blueTotal / count]
    };
  }, `data:image/png;base64,${png.toString('base64')}`);

  if (visual.averageSaturation > .18) {
    throw new Error(`The brown photographed backdrop remains too saturated: ${JSON.stringify(visual)}`);
  }
  const [red, green, blue] = visual.averageRgb;
  if (red - blue > 24 || red - green > 18) {
    throw new Error(`The corrected band still reads as a brown rectangle: ${JSON.stringify(visual)}`);
  }

  report.phase = 'complete';
  report.visual = { correction, ...visual };
  await context.close();
} catch (error) {
  report.failure = { name: error.name, message: error.message, stack: error.stack };
  throw error;
} finally {
  fs.writeFileSync('test-artifacts/material-preview-v10-result.json', JSON.stringify(report, null, 2));
  await browser.close();
}

console.log('BONSAI material preview v10 brown neutralization: PASS');
