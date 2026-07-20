import { webkit } from 'playwright';
import fs from 'node:fs';

fs.mkdirSync('test-artifacts', { recursive: true });
const baseURL = process.env.BONSAI_BASE_URL || 'http://127.0.0.1:4173/bonsai-app/';
const browser = await webkit.launch({ headless: true });
const report = { phase: 'start', slots: null, onboarding: null, visuals: null, directPick: null };

try {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3 });
  const page = await context.newPage();
  await page.addInitScript(() => localStorage.clear());
  await page.goto(new URL(`index.html?gameplay-v8=${Date.now()}`, baseURL).href, { waitUntil: 'domcontentloaded', timeout: 60000 });

  report.phase = 'story onboarding';
  await page.waitForSelector('[data-testid="onboarding"]');
  await page.getByRole('button', { name: '声の主を追う' }).click();
  await page.getByRole('button', { name: '素材棚へ進む' }).click();
  await page.getByRole('button', { name: '最初の講義を受ける' }).click();
  const lessonText = await page.locator('.lesson-card-grid').innerText();
  for (const word of ['剪定', '針金', '神・舎利', '枯死']) {
    if (!lessonText.includes(word)) throw new Error(`Tutorial is missing ${word}`);
  }
  await page.getByRole('button', { name: '一本に名を付ける' }).click();
  await page.getByLabel('盆栽師名').fill('三枠検証者');
  await page.getByLabel('作品の銘').fill('黒松・第一時間軸');
  await page.getByRole('button', { name: 'この一本と始める' }).click();
  await page.waitForSelector('[data-testid="app-shell"]');
  report.onboarding = { lessons: true, storySteps: 5 };

  report.phase = 'artifact cleanup';
  const cleanupCount = await page.locator('[data-testid="photo-cleanup-layer"]').count();
  const photoCleaned = await page.locator('.bonsai-stage').first().getAttribute('data-photo-cleaned');
  if (cleanupCount !== 0 || photoCleaned !== 'true') throw new Error(`The cleaned master photograph is not active: ${JSON.stringify({ cleanupCount, photoCleaned })}`);
  await page.getByRole('button', { name: '鑑賞モード' }).click();
  await page.waitForSelector('.wall-mode');
  const diagnosticCount = await page.locator('.wall-mode .precision-prune-veil, .wall-mode [data-testid="natural-cut-scar"], .wall-mode .part-hotspot').count();
  if (diagnosticCount !== 0) throw new Error(`Editing marks leaked into wall mode: ${diagnosticCount}`);
  await page.screenshot({ path: 'test-artifacts/gameplay-v8-wall-clean.png', fullPage: false });
  await page.getByRole('button', { name: '鑑賞を終了' }).click();
  report.visuals = { cleanupCount, photoCleaned, diagnosticCount };

  report.phase = 'direct pruning pick';
  await page.getByRole('button', { name: '部位剪定' }).click();
  const stage = page.locator('.precision-stage-wrap');
  const box = await stage.boundingBox();
  if (!box) throw new Error('Precision pruning photograph is not visible');
  await page.mouse.click(box.x + box.width * .74, box.y + box.height * .38);
  const selectedText = await page.locator('.precision-inspector').innerText();
  if (!/第二枝|先端|葉棚/.test(selectedText)) throw new Error(`Direct photograph pick did not select the nearby branch: ${selectedText}`);
  await page.screenshot({ path: 'test-artifacts/gameplay-v8-direct-pick.png', fullPage: false });
  await page.getByRole('button', { name: '閉じる' }).click();
  report.directPick = selectedText;

  report.phase = 'three save slots';
  await page.getByRole('button', { name: 'セーブデータと設定' }).click();
  const slotCards = page.locator('.save-slot-list article');
  if (await slotCards.count() !== 3) throw new Error('Exactly three save slots are required');
  await slotCards.nth(1).getByRole('button').click();
  await page.waitForSelector('[data-testid="onboarding"]');
  const slotState = await page.evaluate(() => ({
    active: localStorage.getItem('bonsai:active-slot'),
    slot1: JSON.parse(localStorage.getItem('bonsai:v2:slot:1') || 'null'),
    slot2: localStorage.getItem('bonsai:v2:slot:2'),
    canonical: JSON.parse(localStorage.getItem('bonsai:v2') || 'null')
  }));
  if (slotState.active !== '2' || !slotState.slot1?.started || slotState.canonical?.started) {
    throw new Error(`Slot switching corrupted independent saves: ${JSON.stringify(slotState)}`);
  }
  report.slots = { count: 3, active: slotState.active, slot1Preserved: slotState.slot1.started };

  report.phase = 'reset current slot';
  await page.getByRole('button', { name: 'セーブデータを開く' }).click();
  page.once('dialog', dialog => dialog.accept());
  await page.getByRole('button', { name: '現在のスロットを消去して最初から' }).click();
  await page.waitForSelector('[data-testid="onboarding"]');
  const resetState = await page.evaluate(() => ({
    active: localStorage.getItem('bonsai:active-slot'),
    slot1: JSON.parse(localStorage.getItem('bonsai:v2:slot:1') || 'null'),
    slot2: JSON.parse(localStorage.getItem('bonsai:v2:slot:2') || 'null')
  }));
  if (resetState.active !== '2' || !resetState.slot1?.started || resetState.slot2?.started) {
    throw new Error(`Reset did not preserve other slots: ${JSON.stringify(resetState)}`);
  }

  report.phase = 'complete';
  await context.close();
} catch (error) {
  report.failure = { name: error.name, message: error.message, stack: error.stack };
  throw error;
} finally {
  fs.writeFileSync('test-artifacts/gameplay-v8-result.json', JSON.stringify(report, null, 2));
  await browser.close();
}

console.log('BONSAI Gameplay v8: PASS');
