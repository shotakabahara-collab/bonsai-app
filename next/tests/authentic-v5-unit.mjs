import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { rmSync, mkdirSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import path from 'node:path';

const root = process.cwd();
const out = path.join(root, '.test-cjs');
rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });
execFileSync(path.join(root, 'node_modules', '.bin', 'tsc'), [
  '--ignoreConfig',
  'src/model.ts', 'src/craft-v3.ts', 'src/seasonal-craft-v4.ts',
  '--outDir', out,
  '--module', 'commonjs',
  '--target', 'es2022',
  '--esModuleInterop',
  '--skipLibCheck',
  '--strict',
  '--lib', 'ES2023,DOM'
], { stdio: 'inherit' });
writeFileSync(path.join(out, 'package.json'), '{"type":"commonjs"}\n');

const store = new Map();
globalThis.localStorage = {
  getItem: key => store.has(key) ? store.get(key) : null,
  setItem: (key, value) => store.set(key, String(value)),
  removeItem: key => store.delete(key),
  clear: () => store.clear(),
  key: index => [...store.keys()][index] ?? null,
  get length() { return store.size; }
};

const model = await import(pathToFileURL(path.join(out, 'model.js')).href);
const craft = await import(pathToFileURL(path.join(out, 'craft-v3.js')).href);
const seasonal = await import(pathToFileURL(path.join(out, 'seasonal-craft-v4.js')).href);

const now = Date.UTC(2026, 6, 19, 12, 0, 0);
const game = model.createGame();
const tree = model.createBonsai('pine', '危険剪定試験木');
game.started = true;
game.bonsai = [tree];
game.activeBonsaiId = tree.id;
tree.bornAt = now;
tree.lastUpdatedAt = now;
tree.vitality = 20;
tree.stress = 94;
tree.water = 20;
tree.craft.sites.apexLeftPad.health = 28;
tree.craft.sites.apexLeftPad.vigor = 25;

const danger = seasonal.pruningSuitability(tree, 'apexLeftPad', 'needleThin', now);
assert.equal(danger.status, 'danger', 'poor season/health must warn, not block');
assert.ok(danger.risk.score >= 50);
assert.ok(danger.risk.diseaseChance > 0);
assert.match(danger.mentorAdvice, /師匠/);

const beforeVitality = tree.vitality;
const applied = seasonal.applySeasonalPruningToGame(game, 'apexLeftPad', 'needleThin', now);
assert.equal(applied.applied, true, 'dangerous pruning remains executable');
const workedTree = model.activeBonsai(applied.game);
assert.ok(workedTree.vitality < beforeVitality, 'dangerous work immediately damages vitality');
assert.equal(workedTree.aftercareRisks.length, 1, 'aftercare risk persists in the main save');
const savedResponse = seasonal.loadSeasonalState(workedTree).responses[0];
assert.ok(savedResponse);
assert.ok(['healthy', 'weak', 'disease', 'pest', 'dieback', 'death'].includes(savedResponse.outcome));
const persistedOutcome = savedResponse.outcome;
savedResponse.dueAt = now - 1;
seasonal.saveSeasonalState(workedTree.id, { version: 5, responses: [savedResponse], lastAdvancedAt: now });
const advanced = seasonal.advanceSeasonalGame(applied.game, now + 1000);
assert.equal(advanced.changed, true);
const completed = seasonal.loadSeasonalState(model.activeBonsai(advanced.game)).responses[0];
assert.equal(completed.outcome, persistedOutcome, 'reload/advance must not reroll the work outcome');
assert.ok(completed.completedAt);

const noBudTree = model.createBonsai('pine');
noBudTree.craft.sites.apexLeader.budCount = 0;
assert.equal(seasonal.pruningSuitability(noBudTree, 'apexLeader', 'budPinch', now).status, 'blocked', 'structurally impossible work remains blocked');

const wireTree = model.createBonsai('pine', '針金中断試験木');
craft.applyWireTraining(wireTree, 'firstLeft', 'light', 'down', now);
assert.ok(wireTree.parts.firstLeft.wire);
craft.removeWireTraining(wireTree, 'firstLeft', now + 60_000);
assert.equal(wireTree.parts.firstLeft.wire, undefined);
assert.equal(wireTree.parts.firstLeft.wireHistory?.[0]?.result, 'interrupted');
assert.match(wireTree.logs[0].text, /途中で中断/);

const deadwoodGame = model.createGame();
const deadwoodTree = model.createBonsai('pine', '神中断試験木');
deadwoodGame.started = true;
deadwoodGame.bonsai = [deadwoodTree];
deadwoodGame.activeBonsaiId = deadwoodTree.id;
const started = craft.startJinProjectInGame(deadwoodGame, 'thirdLeft', now);
const projectId = model.activeBonsai(started).craft.deadwoodProjects[0].id;
const paused = craft.pauseDeadwoodProjectInGame(started, projectId, now + 1000);
const pausedProject = model.activeBonsai(paused).craft.deadwoodProjects[0];
assert.ok(pausedProject.pausedAt);
assert.ok(craft.deadwoodStatus(pausedProject, now + 5000).paused);
assert.equal(craft.exhibitionEligibility(model.activeBonsai(paused), now + 5000).eligible, false);
const progressBeforeResume = craft.deadwoodStatus(pausedProject, now + 5000).progress;
const resumed = craft.resumeDeadwoodProjectInGame(paused, projectId, now + 10_000);
const resumedProject = model.activeBonsai(resumed).craft.deadwoodProjects[0];
assert.equal(resumedProject.pausedAt, undefined);
assert.ok(resumedProject.readyAt > now + 10_000);
assert.ok(Math.abs(craft.deadwoodStatus(resumedProject, now + 10_000).progress - progressBeforeResume) < .01, 'resume must preserve stage progress');

function finishProject(inputGame, id, clock) {
  let result = inputGame;
  let at = clock;
  for (let index = 0; index < 5; index += 1) {
    const active = model.activeBonsai(result).craft.deadwoodProjects.find(item => item.id === id);
    at = active.readyAt + 1;
    result = craft.advanceDeadwoodProjectInGame(result, id, at);
  }
  return { game: result, at };
}

let strengthGame = craft.startJinProjectInGame(deadwoodGame, 'firstLeft', now);
let strengthProject = model.activeBonsai(strengthGame).craft.deadwoodProjects[0];
assert.equal(strengthProject.level, 1);
({ game: strengthGame } = finishProject(strengthGame, strengthProject.id, now));
strengthGame = craft.startJinProjectInGame(strengthGame, 'firstLeft', now + 2_000_000_000);
strengthProject = model.activeBonsai(strengthGame).craft.deadwoodProjects[0];
assert.equal(strengthProject.level, 2, 'completed jin can be strengthened to level 2');
({ game: strengthGame } = finishProject(strengthGame, strengthProject.id, now));
strengthGame = craft.startJinProjectInGame(strengthGame, 'firstLeft', now + 4_000_000_000);
strengthProject = model.activeBonsai(strengthGame).craft.deadwoodProjects[0];
assert.equal(strengthProject.level, 3, 'completed jin can be strengthened to level 3');
({ game: strengthGame } = finishProject(strengthGame, strengthProject.id, now));
const refusedFourthJin = craft.startJinProjectInGame(strengthGame, 'firstLeft', now + 6_000_000_000);
assert.equal(model.activeBonsai(refusedFourthJin).craft.deadwoodProjects.length, model.activeBonsai(strengthGame).craft.deadwoodProjects.length, 'jin strength is capped at 3');

let shariGame = craft.startShariProjectInGame(deadwoodGame, 'right', now);
let shariProject = model.activeBonsai(shariGame).craft.deadwoodProjects[0];
assert.equal(shariProject.level, 1);
({ game: shariGame } = finishProject(shariGame, shariProject.id, now));
shariGame = craft.startShariProjectInGame(shariGame, 'right', now + 2_000_000_000);
shariProject = model.activeBonsai(shariGame).craft.deadwoodProjects[0];
assert.equal(shariProject.level, 2, 'completed shari can be widened to level 2');

const wireAssetDir = path.join(root, 'public', 'assets', 'kuromatsu', 'wire-photo-v7');
const deadwoodAssetDir = path.join(root, 'public', 'assets', 'kuromatsu', 'deadwood-photo-v6');
assert.ok(existsSync(wireAssetDir));
assert.equal(readdirSync(wireAssetDir).filter(name => name.endsWith('.webp')).length, 12, 'wire v7 has six parts × two strengths');
assert.equal(readdirSync(deadwoodAssetDir).filter(name => name.endsWith('.webp')).length, 24, 'deadwood has six jin parts × three strengths plus six shari states');

model.markBonsaiDead(deadwoodTree, '試験上の全身衰弱', now);
assert.equal(deadwoodTree.lifeStatus, 'dead');
assert.equal(craft.exhibitionEligibility(deadwoodTree, now).eligible, false);

console.log(JSON.stringify({
  dangerousRisk: danger.risk,
  storedOutcome: persistedOutcome,
  wireOutcome: wireTree.parts.firstLeft.wireHistory?.[0],
  deadwoodPaused: Boolean(pausedProject.pausedAt),
  deadwoodProgress: progressBeforeResume,
  jinStrength: strengthProject.level,
  shariStrength: shariProject.level,
  saveVersion: 2
}, null, 2));
