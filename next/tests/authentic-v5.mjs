import { chromium, webkit } from 'playwright';
import fs from 'node:fs';

fs.mkdirSync('test-artifacts', { recursive: true });
const baseURL = process.env.BONSAI_BASE_URL || 'http://127.0.0.1:4173/bonsai-app/';
const DAY = 86_400_000;
const ARTWORK_CAPTURE_STYLE = `
  .topbar, .bottom-nav, .completion-dock, .wire-status-tag,
  .deadwood-status-tag, .dead-tree-status-tag, .wall-caption,
  .wall-mode > button, .toast { visibility: hidden !important; }
`;
const selectedBrowser = process.env.BONSAI_BROWSER === 'chromium' ? chromium : webkit;
const launchOptions = process.env.BONSAI_BROWSER === 'chromium'
  ? { headless: true, executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', args: ['--no-sandbox', '--disable-dev-shm-usage'] }
  : { headless: true };
const browser = await selectedBrowser.launch(launchOptions);
const report = {
  phase: 'start',
  baseURL,
  browser: process.env.BONSAI_BROWSER || 'webkit',
  pageErrors: [],
  consoleErrors: [],
  dangerousPruning: null,
  delayedConsequence: null,
  wire: null,
  deadwood: null,
  offline: null
};

try {
  await auditDangerousPruning();
  await auditPhotographicWorkAndInterruption();

  const fatalConsole = report.consoleErrors.filter(message => /uncaught|typeerror|referenceerror|syntaxerror|failed to load module script|\[BONSAI fatal\]/i.test(message));
  if (report.pageErrors.length || fatalConsole.length) {
    throw new Error(`Browser errors: ${[...report.pageErrors, ...fatalConsole].join(' | ')}`);
  }
  report.phase = 'complete';
} catch (error) {
  report.failure = { name: error.name, message: error.message, stack: error.stack };
  throw error;
} finally {
  fs.writeFileSync('test-artifacts/authentic-v5-result.json', JSON.stringify(report, null, 2));
  await browser.close();
}

console.log('BONSAI photoreal craft v6: PASS');

async function auditDangerousPruning() {
  report.phase = 'dangerous pruning launch';
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3 });
  const page = await context.newPage();
  attachErrors(page);
  const now = Date.now();
  const legacy = legacySeed({
    name: '危険作業検証者',
    tree: '黒松・危険剪定検証樹',
    born: findBornForGameDay(160, now),
    vitality: 39,
    stress: 92,
    water: 18,
    firstHealth: 31
  });
  await installLegacySeed(page, legacy, 'bonsai:authentic-v5-danger-seeded');
  await page.goto(new URL(`index.html?authentic-danger=${Date.now()}`, baseURL).href, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await waitForApp(page);

  report.phase = 'dangerous pruning advice';
  await page.getByRole('button', { name: '部位剪定' }).click();
  await page.waitForSelector('.precision-v4-sheet');
  await page.locator('.precision-group-tabs button').filter({ hasText: '第一枝' }).click();
  await page.locator('.precision-site-grid button').filter({ hasText: '第一枝・先端' }).click();
  const techniqueButton = page.locator('.seasonal-technique-grid button').filter({ hasText: '古葉取り・葉透かし' });
  if (await techniqueButton.isDisabled()) throw new Error('Out-of-season pruning was incorrectly blocked');
  await techniqueButton.click();

  const suitability = page.locator('[data-testid="suitability-card"]');
  await suitability.waitFor();
  const statusClass = await suitability.getAttribute('class');
  const riskScore = Number(await suitability.getAttribute('data-risk-score'));
  const advice = await page.locator('[data-testid="mentor-pruning-advice"]').innerText();
  const suitabilityText = await suitability.innerText();
  const execute = page.getByRole('button', { name: '強い反対を理解して実行する' });
  if (!String(statusClass).includes('danger') || riskScore < 50 || await execute.isDisabled()) {
    throw new Error(`Dangerous pruning was not executable with advice: ${JSON.stringify({ statusClass, riskScore, disabled: await execute.isDisabled(), advice })}`);
  }
  for (const word of ['病気', '害虫', '枯れ込み', '枯死', '生育抑制']) {
    if (!suitabilityText.includes(word)) throw new Error(`Risk forecast is missing ${word}: ${suitabilityText}`);
  }
  await page.screenshot({ path: 'test-artifacts/authentic-v5-danger-advice.png', fullPage: false });

  const before = await activeTreeSnapshot(page);
  page.once('dialog', dialog => dialog.accept());
  await execute.click();
  await page.waitForSelector('.precision-v4-sheet', { state: 'detached', timeout: 10000 });
  await page.waitForTimeout(250);

  const after = await page.evaluate(() => {
    const game = JSON.parse(localStorage.getItem('bonsai:v2'));
    const tree = game.bonsai.find(item => item.id === game.activeBonsaiId);
    const seasonal = JSON.parse(localStorage.getItem(`bonsai:seasonal:v4:${tree.id}`));
    return {
      treeId: tree.id,
      vitality: tree.vitality,
      stress: tree.stress,
      site: tree.craft.sites.firstTip,
      part: tree.parts.firstLeft,
      risks: tree.aftercareRisks,
      response: seasonal.responses[0]
    };
  });
  if (!(after.vitality < before.vitality) || !(after.site.health < before.site.health) || !(after.site.vigor < before.site.vigor)) {
    throw new Error(`Dangerous pruning did not immediately damage the tree: ${JSON.stringify({ before, after })}`);
  }
  if (!after.risks?.length || !after.response?.outcome || after.response.riskScore < 50) {
    throw new Error(`Dangerous pruning did not persist a deterministic consequence: ${JSON.stringify(after)}`);
  }
  report.dangerousPruning = { riskScore, advice, before, after };

  report.phase = 'dangerous pruning deterministic reload';
  const outcomeBeforeReload = after.response.outcome;
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 60000 });
  await waitForApp(page);
  const outcomeAfterReload = await page.evaluate(treeId => {
    const seasonal = JSON.parse(localStorage.getItem(`bonsai:seasonal:v4:${treeId}`));
    return seasonal.responses[0].outcome;
  }, after.treeId);
  if (outcomeAfterReload !== outcomeBeforeReload) throw new Error(`Reload rerolled pruning outcome: ${outcomeBeforeReload} -> ${outcomeAfterReload}`);

  report.phase = 'dangerous pruning delayed consequence';
  await page.evaluate(treeId => {
    const key = `bonsai:seasonal:v4:${treeId}`;
    const seasonal = JSON.parse(localStorage.getItem(key));
    seasonal.responses[0].dueAt = Date.now() - 1000;
    localStorage.setItem(key, JSON.stringify(seasonal));
  }, after.treeId);
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 60000 });
  await waitForApp(page);
  const matured = await page.evaluate(treeId => {
    const game = JSON.parse(localStorage.getItem('bonsai:v2'));
    const tree = game.bonsai.find(item => item.id === treeId);
    const seasonal = JSON.parse(localStorage.getItem(`bonsai:seasonal:v4:${treeId}`));
    return {
      lifeStatus: tree.lifeStatus,
      vitality: tree.vitality,
      part: tree.parts.firstLeft,
      site: tree.craft.sites.firstTip,
      response: seasonal.responses[0],
      log: tree.logs[0]?.text
    };
  }, after.treeId);
  if (!matured.response.completedAt || matured.response.outcome !== outcomeBeforeReload) {
    throw new Error(`Delayed result was not completed deterministically: ${JSON.stringify(matured)}`);
  }
  assertConsequence(matured, after);
  report.delayedConsequence = matured;
  await page.screenshot({ path: 'test-artifacts/authentic-v5-danger-result.png', fullPage: false });
  await context.close();
}

async function auditPhotographicWorkAndInterruption() {
  report.phase = 'photographic work launch';
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, serviceWorkers: 'allow' });
  const page = await context.newPage();
  attachErrors(page);
  const now = Date.now();
  const legacy = legacySeed({
    name: '加工画像検証者',
    tree: '黒松・実写加工検証樹',
    born: findBornForGameDay(160, now),
    vitality: 96,
    stress: 1,
    water: 82,
    firstHealth: 94
  });
  await installLegacySeed(page, legacy, 'bonsai:authentic-v5-visual-seeded');
  await page.goto(new URL(`index.html?authentic-visual=${Date.now()}`, baseURL).href, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await waitForApp(page);
  await page.screenshot({ path: 'test-artifacts/authentic-v5-base.png', fullPage: false });
  await captureArtwork(page, '.bonsai-stage [data-testid="bonsai-photo-canvas"]', 'test-artifacts/authentic-v5-base-artwork.png');
  await page.locator('.bonsai-stage').screenshot({ path: 'test-artifacts/authentic-v5-stage-base.png' });
  await page.getByRole('button', { name: '鑑賞モード' }).click();
  await page.waitForSelector('.wall-mode .wall-stage');
  await captureArtwork(page, '.wall-stage [data-testid="bonsai-photo-canvas"]', 'test-artifacts/photoreal-v6-wall-base-artwork.png');
  await page.getByRole('button', { name: '鑑賞を終了' }).click();

  report.phase = 'photographic wire';
  await page.getByRole('button', { name: '部位針金' }).click();
  await page.getByRole('button', { name: '第二枝を選択' }).click();
  await page.getByRole('button', { name: '強針金' }).click();
  await page.getByRole('button', { name: '右へ' }).click();
  await page.getByRole('button', { name: 'この部位へかける' }).click();
  await page.waitForSelector('[data-testid="photoreal-wire"]');
  const wireVisual = await page.evaluate(() => {
    const stage = document.querySelector('.bonsai-stage');
    const workLayer = stage?.querySelector('.authentic-work-layer');
    const precisionLayer = stage?.querySelector('.precision-prune-svg');
    const groups = [...document.querySelectorAll('[data-testid="photoreal-wire"]')].map(node => {
      const raster = node.querySelector('image.wire-raster');
      return {
        part: node.getAttribute('data-wire-part'),
        intensity: node.getAttribute('data-wire-intensity'),
        direction: node.getAttribute('data-wire-direction'),
        progress: Number(node.getAttribute('data-wire-progress')),
        progressBand: Number(node.getAttribute('data-wire-progress-band')),
        status: node.getAttribute('data-wire-status'),
        asset: node.getAttribute('data-wire-asset'),
        imageHref: raster?.getAttribute('href'),
        rasterCount: node.querySelectorAll('image.wire-raster').length,
        width: raster?.getAttribute('width'),
        height: raster?.getAttribute('height'),
        preserveAspectRatio: raster?.getAttribute('preserveAspectRatio'),
        opacity: raster ? getComputedStyle(raster).opacity : ''
      };
    });
    return {
      renderer: stage?.getAttribute('data-renderer'),
      groups,
      legacySvgTurns: document.querySelectorAll('.wire-turn-front,.wire-turn-back,.wire-coil-metal,[data-testid="wire-back-pass"]').length,
      lineElements: document.querySelectorAll('.authentic-work-layer line').length,
      circleElements: document.querySelectorAll('.precision-prune-svg circle').length,
      workAspect: workLayer?.getAttribute('preserveAspectRatio'),
      precisionAspect: precisionLayer?.getAttribute('preserveAspectRatio'),
      imageFit: getComputedStyle(stage?.querySelector('.bonsai-photo')).objectFit,
      statusText: document.querySelector('.wire-status-tag')?.textContent ?? ''
    };
  });
  const wireGroup = wireVisual.groups[0];
  if (wireVisual.renderer !== 'photoreal-craft-v7' || wireVisual.groups.length !== 1 || wireGroup.part !== 'secondRight' || wireGroup.intensity !== 'strong' || wireGroup.rasterCount !== 1 || wireGroup.width !== '900' || wireGroup.height !== '1500' || wireGroup.preserveAspectRatio !== 'none' || !wireGroup.asset?.includes('/wire-photo-v7/secondRight-strong.webp') || wireGroup.imageHref !== wireGroup.asset || !Number.isFinite(wireGroup.progress) || !Number.isInteger(wireGroup.progressBand) || wireVisual.legacySvgTurns !== 0 || wireVisual.lineElements !== 0 || wireVisual.circleElements !== 0 || wireVisual.workAspect !== 'xMidYMid meet' || wireVisual.precisionAspect !== 'xMidYMid meet' || wireVisual.imageFit !== 'contain') {
    throw new Error(`Photographed wire v7 is incomplete or detached: ${JSON.stringify(wireVisual)}`);
  }
  await page.screenshot({ path: 'test-artifacts/authentic-v5-wire.png', fullPage: false });
  await captureArtwork(page, '.bonsai-stage [data-testid="bonsai-photo-canvas"]', 'test-artifacts/authentic-v5-wire-artwork.png');
  await page.locator('.bonsai-stage').screenshot({ path: 'test-artifacts/authentic-v5-stage-wire.png' });

  report.phase = 'wire time progression';
  await page.evaluate(nowValue => {
    const game = JSON.parse(localStorage.getItem('bonsai:v2'));
    const tree = game.bonsai.find(item => item.id === game.activeBonsaiId);
    const wire = tree.parts.secondRight.wire;
    wire.appliedAt = nowValue - 7 * 86400000;
    wire.readyAt = nowValue + 7 * 86400000;
    localStorage.setItem('bonsai:v2', JSON.stringify(game));
  }, Date.now());
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 60000 });
  await waitForApp(page);
  const wireProgressVisual = await page.evaluate(() => {
    const group = document.querySelector('[data-testid="photoreal-wire"][data-wire-part="secondRight"]');
    const raster = group?.querySelector('image.wire-raster');
    return {
      progress: Number(group?.getAttribute('data-wire-progress')),
      band: Number(group?.getAttribute('data-wire-progress-band')),
      opacity: raster ? getComputedStyle(raster).opacity : '',
      filter: raster ? getComputedStyle(raster).filter : ''
    };
  });
  if (wireProgressVisual.progress < 45 || wireProgressVisual.progress > 55 || wireProgressVisual.band !== 2 || wireProgressVisual.opacity === wireGroup.opacity) {
    throw new Error(`Wire training time did not alter the photographic state: ${JSON.stringify({ wireGroup, wireProgressVisual })}`);
  }
  report.wireProgress = wireProgressVisual;

  report.phase = 'wire interruption';
  await page.getByRole('button', { name: '部位針金' }).click();
  await page.getByRole('button', { name: '第二枝を選択' }).click();
  await page.getByRole('button', { name: '養成を中断して針金を外す' }).click();
  await page.waitForSelector('.wire-status-tag', { state: 'detached', timeout: 5000 });
  const wireSaved = await page.evaluate(() => {
    const game = JSON.parse(localStorage.getItem('bonsai:v2'));
    const tree = game.bonsai.find(item => item.id === game.activeBonsaiId);
    return { wire: tree.parts.secondRight.wire, history: tree.parts.secondRight.wireHistory, retention: tree.parts.secondRight.shapeRetention };
  });
  if (wireSaved.wire || wireSaved.history?.[0]?.result !== 'interrupted' || !(wireSaved.retention > 0 && wireSaved.retention < 90)) {
    throw new Error(`Wire interruption was not persisted: ${JSON.stringify(wireSaved)}`);
  }
  report.wire = { visual: wireVisual, saved: wireSaved };

  report.phase = 'photographic jin';
  await page.getByRole('button', { name: /神・舎利/ }).click();
  page.once('dialog', dialog => dialog.accept());
  await page.getByRole('button', { name: /この枝で神の第1強度を始める/ }).click();
  await page.waitForSelector('[data-testid="photoreal-deadwood"]');

  report.phase = 'photographic shari';
  await page.getByRole('button', { name: /神・舎利/ }).click();
  page.once('dialog', dialog => dialog.accept());
  await page.getByRole('button', { name: /右側・第1強度を始める/ }).click();
  await page.waitForFunction(() => document.querySelectorAll('[data-testid="photoreal-deadwood"]').length === 2, { timeout: 5000 });
  const deadwoodVisual = await page.evaluate(() => ({
    groups: [...document.querySelectorAll('[data-testid="photoreal-deadwood"]')].map(node => {
      const raster = node.querySelector('image.deadwood-raster');
      return {
        kind: node.getAttribute('data-deadwood-kind'),
        stage: node.getAttribute('data-stage'),
        paused: node.getAttribute('data-paused'),
        level: Number(node.getAttribute('data-deadwood-level')),
        progress: Number(node.getAttribute('data-deadwood-progress')),
        progressBand: Number(node.getAttribute('data-deadwood-progress-band')),
        asset: node.getAttribute('data-deadwood-asset'),
        rasterCount: node.querySelectorAll('image.deadwood-raster').length,
        width: raster?.getAttribute('width'),
        height: raster?.getAttribute('height'),
        preserveAspectRatio: raster?.getAttribute('preserveAspectRatio'),
        vectorPieces: node.querySelectorAll('.deadwood-bark-edge, .deadwood-live-edge, .deadwood-wood-core, .deadwood-grain, .deadwood-bark-island, .jin-torn-end, .deadwood-svg-path').length,
        filter: raster ? getComputedStyle(raster).filter : ''
      };
    }),
    lineElements: document.querySelectorAll('.authentic-work-layer line').length,
    circleElements: document.querySelectorAll('.precision-prune-svg circle').length,
    status: document.querySelector('.deadwood-status-tag')?.textContent ?? ''
  }));
  const jinVisual = deadwoodVisual.groups.find(group => group.kind === 'jin');
  const shariVisual = deadwoodVisual.groups.find(group => group.kind === 'shari');
  const invalidRaster = deadwoodVisual.groups.some(group =>
    group.stage !== 'fresh' || group.level !== 1 || group.rasterCount !== 1 || group.width !== '900' || group.height !== '1500' ||
    group.preserveAspectRatio !== 'none' || group.vectorPieces !== 0 || !group.asset?.includes('/deadwood-photo-v6/') ||
    !Number.isFinite(group.progress) || group.progress < 0 || group.progress > 100 || !Number.isInteger(group.progressBand) ||
    !group.filter || group.filter === 'none'
  );
  if (deadwoodVisual.groups.length !== 2 || !jinVisual || !shariVisual || invalidRaster || !jinVisual.asset?.includes('/jin-thirdLeft-l1.webp') || !shariVisual.asset?.includes('/shari-right-l1.webp') || deadwoodVisual.lineElements !== 0 || deadwoodVisual.circleElements !== 0) {
    throw new Error(`Photographed deadwood strength/time state is incomplete: ${JSON.stringify(deadwoodVisual)}`);
  }
  await page.screenshot({ path: 'test-artifacts/authentic-v5-deadwood-fresh.png', fullPage: false });
  await captureArtwork(page, '.bonsai-stage [data-testid="bonsai-photo-canvas"]', 'test-artifacts/authentic-v5-deadwood-fresh-artwork.png');
  await page.locator('.bonsai-stage').screenshot({ path: 'test-artifacts/authentic-v5-stage-deadwood-fresh.png' });

  report.phase = 'deadwood strength and time progression';
  await page.evaluate(nowValue => {
    const game = JSON.parse(localStorage.getItem('bonsai:v2'));
    const tree = game.bonsai.find(item => item.id === game.activeBonsaiId);
    for (const project of tree.craft.deadwoodProjects) {
      project.level = 3;
      project.stage = 'weathering';
      project.stageStartedAt = nowValue - 9 * 86400000;
      project.readyAt = nowValue + 9 * 86400000;
      delete project.pausedAt;
      delete project.remainingMs;
    }
    localStorage.setItem('bonsai:v2', JSON.stringify(game));
  }, Date.now());
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 60000 });
  await waitForApp(page);
  const progressedDeadwood = await page.evaluate(() => [...document.querySelectorAll('[data-testid="photoreal-deadwood"]')].map(node => {
    const raster = node.querySelector('image.deadwood-raster');
    return {
      kind: node.getAttribute('data-deadwood-kind'),
      level: Number(node.getAttribute('data-deadwood-level')),
      progress: Number(node.getAttribute('data-deadwood-progress')),
      band: Number(node.getAttribute('data-deadwood-progress-band')),
      asset: node.getAttribute('data-deadwood-asset'),
      filter: raster ? getComputedStyle(raster).filter : ''
    };
  }));
  if (progressedDeadwood.length !== 2 || progressedDeadwood.some(item => item.level !== 3 || item.progress < 45 || item.progress > 55 || item.band !== 2 || !item.asset?.includes('-l3.webp')) || progressedDeadwood.every(item => deadwoodVisual.groups.some(initial => initial.kind === item.kind && initial.filter === item.filter))) {
    throw new Error(`Deadwood strength/time did not change the photographed state: ${JSON.stringify(progressedDeadwood)}`);
  }
  report.deadwoodStrengthProgress = progressedDeadwood;
  await captureArtwork(page, '.bonsai-stage [data-testid="bonsai-photo-canvas"]', 'test-artifacts/photoreal-v7-deadwood-level3-mid-artwork.png');
  await page.evaluate(nowValue => {
    const game = JSON.parse(localStorage.getItem('bonsai:v2'));
    const tree = game.bonsai.find(item => item.id === game.activeBonsaiId);
    for (const project of tree.craft.deadwoodProjects) {
      project.level = 1;
      project.stage = 'fresh';
      project.stageStartedAt = nowValue;
      project.readyAt = nowValue + 0.7 * 86400000;
      delete project.pausedAt;
      delete project.remainingMs;
    }
    localStorage.setItem('bonsai:v2', JSON.stringify(game));
  }, Date.now());
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 60000 });
  await waitForApp(page);

  report.phase = 'deadwood interruption';
  await page.getByRole('button', { name: /神・舎利/ }).click();
  const pauseButtons = page.getByRole('button', { name: 'この工程を中断する' });
  if (await pauseButtons.count() !== 2) throw new Error(`Expected two interruptible deadwood projects, got ${await pauseButtons.count()}`);
  await pauseButtons.first().click();
  await page.waitForFunction(() => document.querySelectorAll('.deadwood-project[data-project-paused="true"]').length === 1);
  await page.getByRole('button', { name: 'この工程を中断する' }).click();
  await page.waitForFunction(() => document.querySelectorAll('.deadwood-project[data-project-paused="true"]').length === 2);
  const pausedInSheet = await page.locator('.deadwood-project[data-project-paused="true"]').count();
  if (pausedInSheet !== 2) throw new Error(`Deadwood pause UI did not update: ${pausedInSheet}`);
  await page.getByRole('button', { name: '閉じる' }).click();
  await page.waitForSelector('[data-testid="photoreal-deadwood"][data-paused="true"]');
  await page.screenshot({ path: 'test-artifacts/authentic-v5-deadwood-paused.png', fullPage: false });
  await captureArtwork(page, '.bonsai-stage [data-testid="bonsai-photo-canvas"]', 'test-artifacts/authentic-v5-deadwood-paused-artwork.png');
  await page.locator('.bonsai-stage').screenshot({ path: 'test-artifacts/authentic-v5-stage-deadwood-paused.png' });

  const pausedSave = await page.evaluate(() => {
    const game = JSON.parse(localStorage.getItem('bonsai:v2'));
    const tree = game.bonsai.find(item => item.id === game.activeBonsaiId);
    return tree.craft.deadwoodProjects.map(project => ({ id: project.id, kind: project.kind, pausedAt: project.pausedAt, remainingMs: project.remainingMs, interruptionCount: project.interruptionCount }));
  });
  if (pausedSave.length !== 2 || pausedSave.some(project => !project.pausedAt || !(project.remainingMs >= 0) || project.interruptionCount !== 1)) {
    throw new Error(`Deadwood interruption was not persisted: ${JSON.stringify(pausedSave)}`);
  }

  report.phase = 'deadwood reload and resume';
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 60000 });
  await waitForApp(page);
  if (await page.locator('[data-testid="photoreal-deadwood"][data-paused="true"]').count() !== 2) {
    throw new Error('Paused deadwood was lost after reload');
  }
  await page.getByRole('button', { name: /神・舎利/ }).click();
  const resumeButtons = page.getByRole('button', { name: 'この工程を再開する' });
  if (await resumeButtons.count() !== 2) throw new Error(`Expected two resumable deadwood projects, got ${await resumeButtons.count()}`);
  await resumeButtons.first().click();
  await page.getByRole('button', { name: 'この工程を再開する' }).click();
  await page.waitForFunction(() => document.querySelectorAll('.deadwood-project[data-project-paused="true"]').length === 0);
  const resumedSave = await page.evaluate(() => {
    const game = JSON.parse(localStorage.getItem('bonsai:v2'));
    const tree = game.bonsai.find(item => item.id === game.activeBonsaiId);
    return tree.craft.deadwoodProjects.map(project => ({ kind: project.kind, pausedAt: project.pausedAt, remainingMs: project.remainingMs, readyAt: project.readyAt }));
  });
  if (resumedSave.some(project => project.pausedAt || project.remainingMs !== undefined || !(project.readyAt > Date.now()))) {
    throw new Error(`Deadwood resume was not persisted: ${JSON.stringify(resumedSave)}`);
  }
  report.deadwood = { visual: deadwoodVisual, paused: pausedSave, resumed: resumedSave };
  await page.getByRole('button', { name: '閉じる' }).click();

  report.phase = 'combined iPhone wall artwork';
  await page.evaluate(nowValue => {
    const game = JSON.parse(localStorage.getItem('bonsai:v2'));
    const tree = game.bonsai.find(item => item.id === game.activeBonsaiId);
    for (const [partId, direction] of [['apex', 'down'], ['firstLeft', 'left'], ['secondRight', 'right']]) {
      tree.parts[partId].wire = {
        intensity: 'strong', direction, appliedAt: nowValue, readyAt: nowValue + 86400000,
        progress: 0, status: 'training', lastRiskAt: nowValue
      };
    }
    localStorage.setItem('bonsai:v2', JSON.stringify(game));
  }, Date.now());
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 60000 });
  await waitForApp(page);
  await page.waitForFunction(() => document.querySelectorAll('[data-testid="photoreal-wire"]').length === 3);
  await page.getByRole('button', { name: '鑑賞モード' }).click();
  await page.waitForSelector('.wall-mode .wall-stage');
  const combinedVisual = await page.evaluate(() => {
    const stage = document.querySelector('.wall-mode .wall-stage');
    const canvas = stage.querySelector('[data-testid="bonsai-photo-canvas"]');
    const image = stage.querySelector('.bonsai-photo');
    const work = stage.querySelector('.authentic-work-layer');
    return {
      renderer: stage.getAttribute('data-renderer'),
      wireGroups: stage.querySelectorAll('[data-testid="photoreal-wire"]').length,
      deadwoodGroups: stage.querySelectorAll('[data-testid="photoreal-deadwood"]').length,
      deadwoodRasters: stage.querySelectorAll('image.deadwood-raster').length,
      legacyPhotoOcclusions: stage.querySelectorAll('[data-testid="wire-branch-occlusion"]').length,
      circleElements: stage.querySelectorAll('circle').length,
      wireRasters: stage.querySelectorAll('image.wire-raster').length,
      wireAssets: [...stage.querySelectorAll('[data-testid="photoreal-wire"]')].map(node => node.getAttribute('data-wire-asset')),
      canvasRect: canvas.getBoundingClientRect().toJSON(),
      imageRect: image.getBoundingClientRect().toJSON(),
      workRect: work.getBoundingClientRect().toJSON(),
      aspect: work.getAttribute('preserveAspectRatio'),
      natural: [image.naturalWidth, image.naturalHeight],
      status: stage.querySelector('.wire-status-tag')?.textContent ?? ''
    };
  });
  const rectDelta = Math.max(
    Math.abs(combinedVisual.canvasRect.x - combinedVisual.imageRect.x),
    Math.abs(combinedVisual.canvasRect.y - combinedVisual.imageRect.y),
    Math.abs(combinedVisual.canvasRect.width - combinedVisual.imageRect.width),
    Math.abs(combinedVisual.canvasRect.height - combinedVisual.imageRect.height),
    Math.abs(combinedVisual.canvasRect.x - combinedVisual.workRect.x),
    Math.abs(combinedVisual.canvasRect.y - combinedVisual.workRect.y),
    Math.abs(combinedVisual.canvasRect.width - combinedVisual.workRect.width),
    Math.abs(combinedVisual.canvasRect.height - combinedVisual.workRect.height)
  );
  if (combinedVisual.renderer !== 'photoreal-craft-v7' || combinedVisual.wireGroups !== 3 || combinedVisual.wireRasters !== 3 || combinedVisual.deadwoodGroups !== 2 || combinedVisual.deadwoodRasters !== 2 || combinedVisual.legacyPhotoOcclusions !== 0 || combinedVisual.circleElements !== 0 || combinedVisual.wireAssets.some(asset => !asset?.includes('/wire-photo-v7/')) || combinedVisual.aspect !== 'xMidYMid meet' || combinedVisual.natural[0] < 800 || combinedVisual.natural[1] < 1400 || rectDelta > .6 || !combinedVisual.status.includes('3枝')) {
    throw new Error(`Combined iPhone artwork is not registered to one photograph canvas: ${JSON.stringify({ combinedVisual, rectDelta })}`);
  }
  report.combinedVisual = combinedVisual;
  await page.screenshot({ path: 'test-artifacts/photoreal-v6-combined-wall.png', fullPage: false });
  await page.getByRole('button', { name: '鑑賞を終了' }).click();
  await page.waitForSelector('.wall-mode', { state: 'detached', timeout: 5000 });
  await captureArtwork(page, '.bonsai-stage [data-testid="bonsai-photo-canvas"]', 'test-artifacts/photoreal-v6-combined-artwork.png');

  report.phase = 'offline restart';
  await page.waitForFunction(async () => {
    if (!('serviceWorker' in navigator)) return false;
    const registration = await navigator.serviceWorker.getRegistration('/bonsai-app/');
    return Boolean(navigator.serviceWorker.controller && registration?.active);
  }, { timeout: 20000 }).catch(async () => {
    await page.reload({ waitUntil: 'domcontentloaded', timeout: 60000 });
    await waitForApp(page);
    await page.waitForFunction(() => Boolean(navigator.serviceWorker?.controller), { timeout: 20000 });
  });
  await page.waitForTimeout(800);

  const webkitCache = await page.evaluate(async () => {
    const cacheNames = await caches.keys();
    const cacheName = cacheNames.find(name => name === 'bonsai-photoreal-craft-v7-shell');
    const dynamicAssets = [...document.querySelectorAll('script[src],link[rel="stylesheet"][href]')]
      .map(node => new URL(node.getAttribute('src') || node.getAttribute('href'), location.href).pathname)
      .filter(pathname => pathname.startsWith('/bonsai-app/assets/'));
    const required = [...new Set(['/bonsai-app/index.html', '/bonsai-app/assets/kuromatsu/base/black.webp', ...dynamicAssets])];
    const cache = cacheName ? await caches.open(cacheName) : null;
    const cached = cache ? await Promise.all(required.map(async url => Boolean(await cache.match(url)))) : [];
    return { controller: Boolean(navigator.serviceWorker.controller), cacheName, required, cached };
  });
  if (!webkitCache.controller || !webkitCache.cacheName || webkitCache.cached.length !== webkitCache.required.length || webkitCache.cached.some(value => !value)) {
    throw new Error(`WebKit did not retain the offline shell: ${JSON.stringify(webkitCache)}`);
  }

  if (process.env.BONSAI_PUBLIC === '1') {
    report.offline = { webkitCache, mode: 'public-cache-verification' };
    await page.screenshot({ path: 'test-artifacts/authentic-v5-offline.png', fullPage: false });
    await captureArtwork(page, '.bonsai-stage [data-testid="bonsai-photo-canvas"]', 'test-artifacts/authentic-v5-offline-artwork.png');
    await context.close();
  } else {
    let previewPid = 0;
    try {
      previewPid = Number(fs.readFileSync('/tmp/bonsai-photoreal-v6-preview.pid', 'utf8').trim());
    } catch {}
    if (!Number.isInteger(previewPid) || previewPid <= 1) {
      for (const entry of fs.readdirSync('/proc')) {
        if (!/^\d+$/.test(entry)) continue;
        try {
          const command = fs.readFileSync(`/proc/${entry}/cmdline`, 'utf8').replace(/\0/g, ' ');
          if (command.includes('vite') && command.includes('preview')) {
            previewPid = Number(entry);
            break;
          }
        } catch {}
      }
    }
    if (!Number.isInteger(previewPid) || previewPid <= 1) throw new Error(`Invalid preview pid: ${previewPid}`);
    try {
      process.kill(-previewPid, 'SIGTERM');
    } catch {
      process.kill(previewPid, 'SIGTERM');
    }
    let serverReachable = true;
    for (let attempt = 0; attempt < 30; attempt += 1) {
      try {
        await fetch(baseURL, { cache: 'no-store' });
        await new Promise(resolve => setTimeout(resolve, 100));
      } catch {
        serverReachable = false;
        break;
      }
    }
    if (serverReachable) throw new Error('Preview server remained reachable during offline restart audit');

    const offlineURL = page.url();
    await page.close();
    const offlinePage = await context.newPage();
    attachErrors(offlinePage);
    let navigationError = '';
    await offlinePage.goto(offlineURL, { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(error => { navigationError = error.message; });
    await offlinePage.waitForSelector('[data-testid="app-shell"]', { timeout: 20000 });
    await offlinePage.waitForSelector('.bonsai-stage img', { timeout: 10000 });
    const webkitRestart = await offlinePage.evaluate(() => ({
      app: Boolean(document.querySelector('[data-testid="app-shell"]')),
      image: document.querySelector('.bonsai-stage img')?.getAttribute('src'),
      renderer: document.querySelector('.bonsai-stage')?.getAttribute('data-renderer'),
      deadwoodCount: document.querySelectorAll('[data-testid="photoreal-deadwood"]').length,
      wireCount: document.querySelectorAll('[data-testid="photoreal-wire"]').length
    }));
    webkitRestart.navigationError = navigationError;
    webkitRestart.serverReachable = serverReachable;
    if (webkitRestart.serverReachable || !webkitRestart.app || webkitRestart.renderer !== 'photoreal-craft-v7' || webkitRestart.deadwoodCount !== 2 || webkitRestart.wireCount !== 3) {
      throw new Error(`WebKit offline restart did not preserve the work state: ${JSON.stringify(webkitRestart)}`);
    }
    report.offline = { webkitCache, webkitRestart };
    await offlinePage.screenshot({ path: 'test-artifacts/authentic-v5-offline.png', fullPage: false });
    await captureArtwork(offlinePage, '.bonsai-stage [data-testid="bonsai-photo-canvas"]', 'test-artifacts/authentic-v5-offline-artwork.png');
    await context.close();
  }
}

async function captureArtwork(page, selector, path) {
  await page.locator(selector).screenshot({ path, style: ARTWORK_CAPTURE_STYLE });
}

function attachErrors(page) {
  page.on('pageerror', error => report.pageErrors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') report.consoleErrors.push(message.text()); });
}

async function installLegacySeed(page, legacy, marker) {
  await page.addInitScript(({ value, markerName }) => {
    if (sessionStorage.getItem(markerName) === '1') return;
    sessionStorage.setItem(markerName, '1');
    localStorage.clear();
    localStorage.setItem('bonsai_live_1', JSON.stringify(value));
  }, { value: legacy, markerName: marker });
}

async function waitForApp(page) {
  await page.waitForSelector('[data-testid="app-shell"]', { timeout: 45000 });
  await page.waitForSelector('.bonsai-stage img', { timeout: 20000 });
  await page.waitForFunction(() => {
    const image = document.querySelector('.bonsai-stage img');
    return image instanceof HTMLImageElement && image.complete && image.naturalWidth >= 800;
  }, { timeout: 30000 });
}

async function activeTreeSnapshot(page) {
  return page.evaluate(() => {
    const game = JSON.parse(localStorage.getItem('bonsai:v2'));
    const tree = game.bonsai.find(item => item.id === game.activeBonsaiId);
    return {
      vitality: tree.vitality,
      stress: tree.stress,
      site: tree.craft.sites.firstTip,
      part: tree.parts.firstLeft
    };
  });
}

function assertConsequence(matured, before) {
  switch (matured.response.outcome) {
    case 'death':
      if (matured.lifeStatus !== 'dead') throw new Error(`Death outcome did not kill the tree: ${JSON.stringify(matured)}`);
      break;
    case 'disease':
      if (!matured.part.disease) throw new Error(`Disease outcome did not create disease: ${JSON.stringify(matured)}`);
      break;
    case 'pest':
      if (!matured.part.pest) throw new Error(`Pest outcome did not create a pest: ${JSON.stringify(matured)}`);
      break;
    case 'dieback':
      if (!(matured.part.health < before.part.health) && !(matured.part.foliage < before.part.foliage)) throw new Error(`Dieback outcome did not damage foliage/health: ${JSON.stringify(matured)}`);
      break;
    case 'weak':
      if (!(matured.response.healthDelta < 0 || matured.response.vigorDelta < 0 || matured.response.foliageDelta < 0)) throw new Error(`Weak outcome has no negative consequence: ${JSON.stringify(matured)}`);
      break;
    case 'healthy':
      if (!String(matured.log).includes('芽吹きと回復が予定どおり現れた')) throw new Error(`Healthy response was not recorded: ${JSON.stringify(matured)}`);
      break;
    default:
      throw new Error(`Unknown consequence outcome: ${matured.response.outcome}`);
  }
}

function legacySeed({ name, tree, born, vitality, stress, water, firstHealth }) {
  return {
    started: true,
    name,
    mentor: 0,
    sp: 'kuromatsu',
    tree,
    born,
    water,
    last: Date.now(),
    vit: vitality,
    stress,
    prune: 0,
    wire: 0,
    pot: 'pot02',
    money: 12000,
    rep: 135,
    owned: ['pot01', 'pot02'],
    awards: [],
    log: [],
    advanced: {
      parts: {
        first_left: { foliage: 72, health: firstHealth, pruneLevel: 0 },
        second_right: { foliage: 74, health: 94, pruneLevel: 0 },
        third_left: { foliage: 68, health: 94, pruneLevel: 0 }
      }
    }
  };
}

function findBornForGameDay(target, timestamp) {
  let best = timestamp;
  let bestDistance = 999;
  for (let hours = 0; hours <= 24 * 365; hours += 3) {
    const candidate = timestamp - hours * 3_600_000;
    const value = gameDay(candidate, timestamp);
    const distance = Math.min(Math.abs(value - target), 365 - Math.abs(value - target));
    if (distance < bestDistance) {
      bestDistance = distance;
      best = candidate;
      if (distance === 0) break;
    }
  }
  return best;
}

function gameDay(bornAt, timestamp) {
  const bornDate = new Date(bornAt);
  const start = new Date(bornDate.getFullYear(), 0, 1);
  const base = Math.max(0, Math.floor((bornDate.getTime() - start.getTime()) / DAY));
  const elapsed = Math.max(0, (timestamp - bornAt) / DAY * 10);
  return Math.floor((base + elapsed) % 365);
}
