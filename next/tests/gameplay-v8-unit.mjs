import fs from 'node:fs';
import assert from 'node:assert/strict';

const storage = fs.readFileSync(new URL('../src/storage.ts', import.meta.url), 'utf8');
const stage = fs.readFileSync(new URL('../src/BonsaiStage.tsx', import.meta.url), 'utf8');
const app = fs.readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8');
const gameplay = fs.readFileSync(new URL('../src/GameplayV8.tsx', import.meta.url), 'utf8');
const css = fs.readFileSync(new URL('../src/gameplay-v8.css', import.meta.url), 'utf8');
const sw = fs.readFileSync(new URL('../public/sw.js', import.meta.url), 'utf8');

assert.match(storage, /bonsai:v2:slot:/, 'slot-specific save prefix is missing');
assert.match(storage, /SaveSlotId = 1 \| 2 \| 3/, 'exactly three save slots are required');
assert.match(storage, /resetSaveSlot/, 'reset-current-game API is missing');
assert.match(storage, /bonsai:v2.*slot 1/s, 'legacy bonsai:v2 adoption into slot 1 is missing');
assert.match(gameplay, /師匠との出会い/);
assert.match(gameplay, /剪定は、未来を選ぶ/);
assert.match(gameplay, /針金は、時間を掛ける/);
assert.match(gameplay, /神・舎利は、古さを育てる/);
assert.match(gameplay, /SaveSlotSheet/);
assert.match(gameplay, /JourneyCard/);
assert.match(gameplay, /journey-action/, 'chapter actions must lead directly into play');
assert.match(app, /StoryOnboarding/);
assert.match(app, /switchSaveSlot/);
assert.match(app, /resetSaveSlot/);
assert.doesNotMatch(stage, /photo-cleanup-layer/, 'painted cleanup overlays must not return');
assert.match(stage, /data-photo-cleaned/, 'cleaned master-photo marker is missing');
assert.match(stage, /\{interactive && \(\s*<svg className="precision-prune-svg"/s, 'precision diagnostics must be editing-only');
assert.match(stage, /selectPartFromPhoto/, 'direct photograph part selection is missing');
assert.match(stage, /direct-part-selection/, 'selected-part feedback is missing');
assert.match(css, /\.photoreal-craft-v7 \.part-hotspot\{[^}]*opacity:\.01/s, 'non-paint hit areas are missing');
assert.match(sw, /bonsai-black-pine-state-v9/, 'service worker release id is stale');

console.log('BONSAI Gameplay v8 unit contracts: PASS');
