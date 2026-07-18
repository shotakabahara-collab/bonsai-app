(() => {
  'use strict';

  const ROOT = typeof window !== 'undefined' ? window : globalThis;
  const DOC = typeof document !== 'undefined' ? document : null;
  const STORAGE_KEY = 'bonsai_live_1';
  const VERSION = 1;
  const MAX_MEMORIALS = 18;
  const DAY = 86400000;
  const PART_IDS = ['apex', 'first_left', 'second_right', 'third_left', 'back_branch', 'front_branch', 'trunk', 'nebari'];
  const BRANCH_IDS = ['apex', 'first_left', 'second_right', 'third_left', 'back_branch', 'front_branch'];
  const POT_RATING = { starter: 72, blue: 88, black: 92, moon: 95, old: 98 };
  const SEASON_RATING = {
    pine: [86, 78, 82, 92],
    maple: [94, 72, 100, 84],
    azalea: [100, 80, 74, 68]
  };
  const POT_NAME = {
    starter: '素焼き入門鉢', blue: '青嵐釉楕円鉢', black: '黒土長方鉢', moon: '月光白釉鉢', old: '古渡・琥珀鉢'
  };
  const SPECIES_NAME = { pine: '黒松', maple: '山もみじ', azalea: '皐月' };
  const SEASON_NAME = ['春', '夏', '秋', '冬'];

  let rawSet = null;
  let rawGet = null;
  let internalWrite = false;
  let snapshotQueue = Promise.resolve();

  const clamp = (value, min, max) => Math.max(min, Math.min(max, Number(value) || 0));
  const round = value => Math.round(Number(value) || 0);
  const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[char]));

  function advancedApi() {
    return ROOT.BonsaiAdvancedCare || null;
  }

  function migrateState(input) {
    const state = input && typeof input === 'object' ? input : {};
    const api = advancedApi();
    const migrated = api?.migrateState ? api.migrateState(state) : state;
    migrated.stats = migrated.stats && typeof migrated.stats === 'object'
      ? migrated.stats
      : { water: 0, prune: 0, wire: 0, shows: 0 };
    migrated.awards = Array.isArray(migrated.awards) ? migrated.awards : [];
    migrated.log = Array.isArray(migrated.log) ? migrated.log : [];
    migrated.memorials = Array.isArray(migrated.memorials) ? migrated.memorials.slice(0, MAX_MEMORIALS) : [];
    return migrated;
  }

  function readState() {
    if (typeof localStorage === 'undefined') return migrateState({});
    try {
      return migrateState(JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'));
    } catch {
      return migrateState({});
    }
  }

  function safeWrite(state) {
    if (typeof localStorage === 'undefined') return state;
    const payload = JSON.stringify(migrateState(state));
    internalWrite = true;
    try {
      if (rawSet) rawSet.call(localStorage, STORAGE_KEY, payload);
      else localStorage.setItem(STORAGE_KEY, payload);
    } finally {
      internalWrite = false;
    }
    return state;
  }

  function gameContext(state, now = Date.now()) {
    const born = Number(state.born || now);
    const gameDays = Math.max(0, (now - born) / DAY * 10);
    const season = Math.floor((gameDays % 360) / 90);
    const dryRate = { pine: 1.7, maple: 2.3, azalea: 2.1 }[state.sp] || 2;
    const elapsedHours = Math.max(0, (now - Number(state.last || now)) / 3600000);
    const water = clamp(Number(state.water ?? 80) - elapsedHours * dryRate, 0, 100);
    const stress = Math.max(0, Number(state.stress || 0) - gameDays * 0.02);
    const vitality = clamp(Number(state.vit ?? 84) - Math.max(0, 35 - water) * 0.34 - stress * 0.13 + Number(state.fert || 0), 0, 100);
    return { gameDays, season, water, stress, vitality };
  }

  function fallbackPart(kind = 'branch') {
    return {
      foliage: kind === 'root' ? 0 : 100,
      health: 100,
      pruneLevel: 0,
      angle: 0,
      wire: { level: 0, direction: 'down', since: null },
      disease: null,
      pest: null,
      deadwood: null,
      scars: 0
    };
  }

  function partsFor(state) {
    const parts = state.advanced?.parts || {};
    return Object.fromEntries(PART_IDS.map(id => [id, {
      ...fallbackPart(id === 'trunk' ? 'trunk' : id === 'nebari' ? 'root' : 'branch'),
      ...(parts[id] || {}),
      wire: { ...fallbackPart().wire, ...(parts[id]?.wire || {}) }
    }]));
  }

  function exhibitionEvaluation(input, now = Date.now()) {
    const state = migrateState(structuredCloneSafe(input));
    const parts = partsFor(state);
    const context = gameContext(state, now);
    const branches = BRANCH_IDS.map(id => parts[id]);
    const living = branches.filter(part => part.deadwood !== 'jin');
    const issues = BRANCH_IDS.concat(['nebari']).reduce((total, id) => {
      const part = parts[id];
      return total + (part.disease ? 1 : 0) + (part.pest ? 1 : 0);
    }, 0);
    const diseases = PART_IDS.reduce((sum, id) => sum + (parts[id].disease ? 1 : 0), 0);
    const pests = PART_IDS.reduce((sum, id) => sum + (parts[id].pest ? 1 : 0), 0);
    const activeWire = branches.reduce((sum, part) => sum + Number(part.wire?.level || 0), 0);
    const scars = PART_IDS.reduce((sum, id) => sum + Number(parts[id].scars || 0), 0);
    const jinCount = branches.filter(part => part.deadwood === 'jin').length;
    const shariLevel = clamp(state.advanced?.shari?.level || 0, 0, 3);
    const averageHealth = PART_IDS.reduce((sum, id) => sum + clamp(parts[id].health, 0, 100), 0) / PART_IDS.length;

    const leftFoliage = (clamp(parts.first_left.foliage, 0, 100) + clamp(parts.third_left.foliage, 0, 100)) / 2;
    const rightFoliage = (clamp(parts.second_right.foliage, 0, 100) + clamp(parts.back_branch.foliage, 0, 100)) / 2;
    const lowerFoliage = (leftFoliage + rightFoliage) / 2;
    const apexFoliage = clamp(parts.apex.foliage, 0, 100);
    const frontFoliage = clamp(parts.front_branch.foliage, 0, 100);
    const lateralDifference = Math.abs(leftFoliage - rightFoliage);
    const apexDifference = Math.abs(apexFoliage - lowerFoliage * 0.78);
    const frontDifference = Math.abs(frontFoliage - lowerFoliage * 0.72);
    const balanceIndex = clamp(100 - lateralDifference * 0.75 - apexDifference * 0.35 - frontDifference * 0.22, 0, 100);

    const livingAngles = living.map(part => Number(part.angle || 0));
    const angleSpread = livingAngles.length
      ? Math.max(...livingAngles) - Math.min(...livingAngles)
      : 0;
    const extremeAngles = livingAngles.filter(angle => Math.abs(angle) > 36).length;
    const flowIndex = clamp(72 + Math.min(18, angleSpread * 0.55) - extremeAngles * 8, 0, 100);

    const pruneLevels = living.map(part => clamp(part.pruneLevel, 0, 3));
    const styledBranches = pruneLevels.filter(level => level > 0).length;
    const overPruned = living.filter(part => part.pruneLevel >= 3 && part.foliage < 30).length;
    const techniqueIndex = clamp(54 + styledBranches * 7 + jinCount * 5 + shariLevel * 4 - overPruned * 9 - scars * 4, 0, 100);

    const healthIndex = clamp(context.vitality * 0.55 + averageHealth * 0.35 + context.water * 0.10, 0, 100);
    const potIndex = POT_RATING[state.pot] || 72;
    const seasonIndex = (SEASON_RATING[state.sp] || SEASON_RATING.pine)[context.season] || 75;
    const presentationIndex = clamp(potIndex * 0.58 + seasonIndex * 0.42 - activeWire * 3.5, 0, 100);

    const deadwoodTaste = jinCount <= 2 ? jinCount * 2.4 : 4.8 - (jinCount - 2) * 5;
    const issuePenalty = diseases * 10 + pests * 6;
    const raw = healthIndex * 0.20
      + balanceIndex * 0.20
      + flowIndex * 0.13
      + techniqueIndex * 0.17
      + presentationIndex * 0.20
      + clamp(62 + deadwoodTaste * 4 + shariLevel * 3, 0, 100) * 0.10
      - issuePenalty
      - activeWire * 1.4;
    const score = clamp(Math.round(raw), 20, 99);

    const strengths = [];
    const cautions = [];
    if (healthIndex >= 82) strengths.push('樹勢と葉の張りが安定している');
    if (balanceIndex >= 82) strengths.push('左右の葉棚と頂部の量感が整っている');
    if (flowIndex >= 82) strengths.push('枝の方向に自然な流れがある');
    if (potIndex >= 92) strengths.push('鉢が木の格をよく支えている');
    if (jinCount || shariLevel) strengths.push('枯れの表現が来歴と古木感を生んでいる');
    if (issues) cautions.push(`病害虫が${issues}件あり、展示前の処置が必要`);
    if (activeWire) cautions.push(`展示時に針金が${activeWire}段階分見えている`);
    if (lateralDifference > 22) cautions.push('左右の葉量差が大きく、重心が偏って見える');
    if (overPruned) cautions.push('強剪定した部位の回復がまだ十分ではない');
    if (scars) cautions.push(`針金跡が${scars}箇所あり、近接審査で減点対象になる`);
    if (context.water < 35) cautions.push('用土が乾いており、葉の張りが落ちている');
    if (!strengths.length) strengths.push('骨格の方向性は見え始めている');
    if (!cautions.length) cautions.push('大きな欠点はなく、細部の詰めが評価を分ける');

    const readiness = score >= 88 ? '優勝候補'
      : score >= 80 ? '受賞圏'
        : score >= 72 ? '入選圏'
          : score >= 62 ? '出展可能'
            : '養生・再調整推奨';

    const modifier = clamp(Math.round((score - 74) * 0.45), -14, 11);
    return {
      version: VERSION,
      score,
      modifier,
      readiness,
      strengths,
      cautions,
      metrics: {
        health: round(healthIndex),
        balance: round(balanceIndex),
        flow: round(flowIndex),
        technique: round(techniqueIndex),
        presentation: round(presentationIndex),
        issues,
        activeWire,
        scars,
        jinCount,
        shariLevel
      },
      context: {
        water: round(context.water),
        vitality: round(context.vitality),
        season: context.season,
        pot: state.pot
      }
    };
  }

  function structuredCloneSafe(value) {
    if (typeof structuredClone === 'function') {
      try { return structuredClone(value); } catch { /* fall through */ }
    }
    try { return JSON.parse(JSON.stringify(value ?? {})); } catch { return {}; }
  }

  function weekKey(now = new Date()) {
    const start = new Date(now.getFullYear(), 0, 1);
    const week = Math.ceil((((now - start) / DAY) + start.getDay() + 1) / 7);
    return `${now.getFullYear()}-${week}`;
  }

  function rankTitle(rep = 0, fallback = '若木の友') {
    return rep >= 450 ? '名匠'
      : rep >= 250 ? '盆栽作家'
        : rep >= 120 ? '一級盆栽師'
          : rep >= 60 ? '若手盆栽師'
            : fallback || '若木の友';
  }

  function entrants(week = weekKey()) {
    const names = [
      ['橘 蓮', '現代の余白', 3], ['岩城 岳斗', '幹を読む者', 5],
      ['翠川みのり', '紅葉を待つ人', 0], ['風間宗樹', '松柏の旅人', 2],
      ['花守あかり', '季節の編者', -2], ['遠野景一', '根景の研究者', 1],
      ['朔庭ユウ', '余白の実験者', 4], ['結城庵', '古鉢蒐集家', 3]
    ];
    const seed = [...week].reduce((sum, char) => sum + char.charCodeAt(0), 0);
    return names.map((item, index) => ({
      name: item[0], title: item[1], score: 60 + ((seed * (index + 3) * 17) % 29) + item[2]
    }));
  }

  function rewardFor(rank, score) {
    if (rank === 1) return { money: 5000, rep: 45 };
    if (rank <= 3) return { money: 2500, rep: 25 };
    if (score >= 72) return { money: 900, rep: 10 };
    return { money: 250, rep: 3 };
  }

  function exhibitionEntry(input, now = Date.now()) {
    const state = migrateState(structuredCloneSafe(input));
    const week = weekKey(new Date(now));
    if (state.lastWeek === week) return { ok: false, state, message: '今週は出展済みです。' };
    const evaluation = exhibitionEvaluation(state, now);
    const field = [
      ...entrants(week),
      { name: state.name || 'あなた', title: rankTitle(state.rep, state.title), score: evaluation.score, you: true }
    ].sort((a, b) => b.score - a.score || Number(Boolean(b.you)) - Number(Boolean(a.you)));
    const rank = field.findIndex(entry => entry.you) + 1;
    const awardName = rank === 1 ? '金賞' : rank <= 3 ? '優秀賞' : evaluation.score >= 72 ? '入選' : '選外';
    const reward = rewardFor(rank, evaluation.score);
    const context = gameContext(state, now);
    const record = {
      at: now,
      score: evaluation.score,
      rank,
      award: awardName,
      field,
      pot: state.pot || 'starter',
      season: SEASON_NAME[context.season],
      evaluation,
      visualSignature: advancedApi()?.visualSignature?.(state) || ''
    };
    state.money = Number(state.money || 0) + reward.money;
    state.rep = Number(state.rep || 0) + reward.rep;
    state.stats.shows = Number(state.stats.shows || 0) + 1;
    state.lastWeek = week;
    state.awards.unshift(record);
    state.log.unshift({ at: now, x: `${awardName}。${field.length}作品中${rank}位、部位審査${evaluation.score}点。` });
    state.log = state.log.slice(0, 80);
    if (state.advanced?.history) {
      state.advanced.history.unshift({
        at: now,
        action: 'exhibition',
        part: 'whole',
        detail: `${awardName}; score=${evaluation.score}; rank=${rank}`,
        visualSignature: record.visualSignature
      });
      state.advanced.history = state.advanced.history.slice(0, 120);
    }
    return { ok: true, state, record, reward, message: `${awardName}・${evaluation.score}点・${rank}位` };
  }

  function actionLabel(history) {
    const action = history?.action || '';
    const map = {
      prune_light: '軽剪定後', prune_medium: '中剪定後', prune_hard: '強剪定後',
      wire_light: '軽針金後', wire_strong: '強針金後', wire_remove: '針金取り外し後',
      jin: '神の制作後', shari: '舎利の制作後', disease_event: '病気発生時',
      pest_event: '害虫発生時', treat_disease: '病気治療後', treat_pest: '害虫駆除後',
      exhibition: '展覧会出展時'
    };
    return map[action] || '手入れ後';
  }

  function detectCapture(previousInput, nextInput) {
    const previous = migrateState(structuredCloneSafe(previousInput));
    const next = migrateState(structuredCloneSafe(nextInput));
    if (next.awards.length > previous.awards.length) {
      const award = next.awards[0];
      return { reason: 'award', label: `${award.award}受賞時`, award };
    }
    if (next.pot && previous.pot && next.pot !== previous.pot) {
      return { reason: 'pot', label: `${POT_NAME[next.pot] || '新しい鉢'}へ鉢替え後` };
    }
    const beforeHistory = previous.advanced?.history?.[0];
    const afterHistory = next.advanced?.history?.[0];
    if (afterHistory?.at && afterHistory.at !== beforeHistory?.at) {
      const important = /^(prune_|wire_|jin$|shari$|disease_event$|pest_event$|treat_)/.test(afterHistory.action || '');
      if (important) return { reason: afterHistory.action, label: actionLabel(afterHistory), history: afterHistory };
    }
    return null;
  }

  function loadImage(source) {
    return new Promise((resolve, reject) => {
      if (!source || typeof Image === 'undefined') return reject(new Error('image unavailable'));
      const image = new Image();
      try {
        const resolved = new URL(source, location.href);
        if (resolved.origin !== location.origin && !String(source).startsWith('data:')) image.crossOrigin = 'anonymous';
      } catch { /* data/blob URL or non-browser validation */ }
      image.decoding = 'async';
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error('image load failed'));
      image.src = source;
    });
  }

  function drawContain(context, image, width, height) {
    const scale = Math.min(width / image.naturalWidth, height / image.naturalHeight);
    const drawWidth = image.naturalWidth * scale;
    const drawHeight = image.naturalHeight * scale;
    const x = (width - drawWidth) / 2;
    const y = (height - drawHeight) / 2;
    context.drawImage(image, x, y, drawWidth, drawHeight);
  }

  async function renderSnapshot(stateInput) {
    if (!DOC || typeof document.createElement !== 'function') return null;
    const state = migrateState(structuredCloneSafe(stateInput));
    const source = ROOT.BonsaiPhotos?.pine || DOC.querySelector('.photo-bonsai img')?.src || '';
    if (!source || state.sp !== 'pine') return null;
    const base = await loadImage(source);
    const width = 420;
    const height = 746;
    const canvas = DOC.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d', { alpha: false });
    if (!context) return null;
    const evaluation = exhibitionEvaluation(state);
    const health = evaluation.metrics.health;
    const water = evaluation.context.water;
    context.fillStyle = '#07100b';
    context.fillRect(0, 0, width, height);
    context.filter = `saturate(${clamp(0.80 + health / 500 + water / 900, 0.76, 1.06).toFixed(2)}) contrast(1.05) brightness(${clamp(0.80 + health / 600, 0.78, 0.98).toFixed(2)})`;
    drawContain(context, base, width, height);
    context.filter = 'none';

    const overlay = advancedApi()?.overlaySvg?.(state);
    if (overlay) {
      try {
        const prepared = overlay
          .replace('<svg ', `<svg width="${width}" height="${height}" `)
          .replace('viewBox="0 0 100 100"', `viewBox="0 0 100 100"`);
        const blob = new Blob([prepared], { type: 'image/svg+xml' });
        const url = URL.createObjectURL(blob);
        try {
          const overlayImage = await loadImage(url);
          context.drawImage(overlayImage, 0, 0, width, height);
        } finally {
          URL.revokeObjectURL(url);
        }
      } catch { /* keep base snapshot */ }
    }
    return canvas.toDataURL('image/jpeg', 0.68);
  }

  async function captureMemorial(trigger = { reason: 'manual', label: '現在の姿' }, suppliedState = null) {
    const state = migrateState(structuredCloneSafe(suppliedState || readState()));
    const signature = advancedApi()?.visualSignature?.(state) || '';
    const duplicate = state.memorials[0]
      && state.memorials[0].signature === signature
      && state.memorials[0].reason === trigger.reason
      && Date.now() - state.memorials[0].at < 30000;
    if (duplicate) return state.memorials[0];
    const image = await renderSnapshot(state).catch(() => null);
    const memorial = {
      id: `mem-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      at: Date.now(),
      reason: trigger.reason || 'manual',
      label: trigger.label || '現在の姿',
      tree: state.tree || `${SPECIES_NAME[state.sp] || '盆栽'}・若樹`,
      species: state.sp || 'pine',
      pot: state.pot || 'starter',
      signature,
      image,
      award: trigger.award ? {
        name: trigger.award.award,
        score: trigger.award.score,
        rank: trigger.award.rank
      } : null
    };
    state.memorials.unshift(memorial);
    state.memorials = state.memorials.slice(0, MAX_MEMORIALS);
    try {
      safeWrite(state);
    } catch (error) {
      state.memorials = state.memorials.slice(0, Math.max(4, Math.floor(MAX_MEMORIALS / 2)));
      if (state.memorials[0]) state.memorials[0].image = null;
      safeWrite(state);
    }
    return memorial;
  }

  function queueCapture(trigger, state) {
    snapshotQueue = snapshotQueue
      .catch(() => null)
      .then(() => new Promise(resolve => setTimeout(resolve, 40)))
      .then(() => captureMemorial(trigger, state))
      .then(() => { if (DOC) enhance(); })
      .catch(() => null);
    return snapshotQueue;
  }

  function installStorageObserver() {
    if (!ROOT.Storage || !ROOT.localStorage) return;
    const proto = ROOT.Storage.prototype;
    if (proto.__bonsaiCompletionObserver) return;
    rawSet = proto.setItem;
    rawGet = proto.getItem;
    Object.defineProperty(proto, '__bonsaiCompletionObserver', { value: true });
    proto.setItem = function completionObservedSetItem(key, value) {
      if (this === ROOT.localStorage && key === STORAGE_KEY && !internalWrite) {
        let previous = {};
        let next = {};
        try { previous = JSON.parse(rawGet.call(this, key) || '{}'); } catch { previous = {}; }
        try { next = JSON.parse(String(value)); } catch { return rawSet.call(this, key, value); }
        const trigger = detectCapture(previous, next);
        const result = rawSet.call(this, key, JSON.stringify(migrateState(next)));
        if (trigger) queueCapture(trigger, next);
        return result;
      }
      return rawSet.call(this, key, value);
    };
  }

  function injectStyles() {
    if (!DOC || DOC.getElementById('bonsai-completion-style')) return;
    const style = DOC.createElement('style');
    style.id = 'bonsai-completion-style';
    style.textContent = `
      .stage.photo-stage{height:min(132vw,620px);max-height:620px;background:#07100b}
      .stage.photo-stage .photo-bonsai img{object-fit:contain;object-position:center center}
      .completion-tools{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:10px 0}
      .completion-tools button{border:1px solid rgba(217,183,123,.35);border-radius:14px;background:linear-gradient(145deg,rgba(217,183,123,.13),rgba(255,255,255,.035));color:#eee8da;padding:12px 8px;font-size:10px}
      .completion-diagnosis{margin:10px 0;padding:13px;border:1px solid rgba(217,183,123,.28);border-radius:18px;background:linear-gradient(145deg,rgba(27,43,32,.96),rgba(11,19,14,.98))}
      .completion-diagnosis-head{display:flex;justify-content:space-between;gap:12px;align-items:flex-start}
      .completion-diagnosis h3{font:20px Georgia,"Yu Mincho",serif;margin:0;color:#ead3a3}
      .completion-score{font:25px Georgia,serif;color:#e4c58e;white-space:nowrap}
      .completion-metrics{display:grid;grid-template-columns:repeat(5,1fr);gap:5px;margin-top:10px}
      .completion-metric{padding:7px 3px;text-align:center;border-radius:10px;background:rgba(255,255,255,.045);font-size:8px;color:#99a69c}
      .completion-metric b{display:block;color:#eee8da;font-size:13px;margin-bottom:2px}
      .completion-modal{position:fixed;inset:0;z-index:260;background:rgba(0,0,0,.78);backdrop-filter:blur(12px);display:flex;align-items:flex-end;justify-content:center}
      .completion-sheet{width:100%;max-width:700px;max-height:92dvh;overflow:auto;padding:18px 16px calc(22px + env(safe-area-inset-bottom));border-radius:27px 27px 0 0;background:#101a14;border:1px solid rgba(255,255,255,.12);box-shadow:0 -28px 80px rgba(0,0,0,.55)}
      .completion-sheet h2{font:27px Georgia,"Yu Mincho",serif;margin:5px 0}
      .completion-breakdown{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:12px 0}
      .completion-breakdown>div{padding:11px;border-radius:14px;background:rgba(255,255,255,.045)}
      .completion-breakdown b{display:block;color:#e4c58e;font-size:18px}
      .completion-section-title{font:16px Georgia,"Yu Mincho",serif;margin:15px 2px 7px;color:#e4c58e}
      .completion-list{font-size:10px;line-height:1.75;color:#b6c0b7;padding-left:18px}
      .completion-gallery{margin-top:18px}
      .completion-gallery-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px}
      .completion-memory{position:relative;overflow:hidden;border:1px solid rgba(255,255,255,.12);border-radius:16px;background:#111d16}
      .completion-memory img{display:block;width:100%;aspect-ratio:9/16;object-fit:cover;background:#07100b}
      .completion-memory-info{padding:9px}
      .completion-memory-info b{display:block;font:14px Georgia,"Yu Mincho",serif;color:#e8d5ae}
      .completion-memory-info small{display:block;color:#8e9b91;font-size:8px;margin-top:4px}
      .completion-memory button{position:absolute;right:6px;top:6px;border:1px solid rgba(255,255,255,.18);border-radius:999px;background:rgba(0,0,0,.58);color:#fff;padding:4px 7px}
      .completion-viewer{position:fixed;inset:0;z-index:300;background:#020503f2;display:grid;place-items:center;padding:18px}
      .completion-viewer img{max-width:100%;max-height:88vh;border-radius:18px;box-shadow:0 30px 100px #000}
      .completion-viewer button{position:fixed;top:calc(15px + env(safe-area-inset-top));right:15px;border:1px solid #ffffff3a;background:#0d1711;color:white;border-radius:999px;padding:10px 14px}
      @media(max-width:380px){.completion-metrics{grid-template-columns:repeat(3,1fr)}}
    `;
    DOC.head.appendChild(style);
  }

  function diagnosisHtml(evaluation) {
    const metric = evaluation.metrics;
    return `
      <div class="completion-diagnosis-head">
        <div><div class="small">部位別展示診断</div><h3>${esc(evaluation.readiness)}</h3></div>
        <div class="completion-score">${evaluation.score}<small>点</small></div>
      </div>
      <div class="completion-metrics">
        <div class="completion-metric"><b>${metric.health}</b>健康</div>
        <div class="completion-metric"><b>${metric.balance}</b>重心</div>
        <div class="completion-metric"><b>${metric.flow}</b>枝流れ</div>
        <div class="completion-metric"><b>${metric.technique}</b>技法</div>
        <div class="completion-metric"><b>${metric.presentation}</b>鉢・季節</div>
      </div>
    `;
  }

  function openDiagnosis() {
    if (!DOC) return;
    const evaluation = exhibitionEvaluation(readState());
    DOC.getElementById('bonsai-completion-modal')?.remove();
    const modal = DOC.createElement('div');
    modal.id = 'bonsai-completion-modal';
    modal.className = 'completion-modal';
    modal.innerHTML = `
      <div class="completion-sheet">
        <div class="small">EXHIBITION READINESS</div>
        <h2>${esc(evaluation.readiness)} — ${evaluation.score}点</h2>
        <div class="completion-breakdown">
          <div><small>健康・樹勢</small><b>${evaluation.metrics.health}</b></div>
          <div><small>葉棚と重心</small><b>${evaluation.metrics.balance}</b></div>
          <div><small>枝の流れ</small><b>${evaluation.metrics.flow}</b></div>
          <div><small>技法完成度</small><b>${evaluation.metrics.technique}</b></div>
        </div>
        <div class="completion-section-title">評価される点</div>
        <ul class="completion-list">${evaluation.strengths.map(item => `<li>${esc(item)}</li>`).join('')}</ul>
        <div class="completion-section-title">出展前に整える点</div>
        <ul class="completion-list">${evaluation.cautions.map(item => `<li>${esc(item)}</li>`).join('')}</ul>
        <button class="primary" data-completion-close>閉じる</button>
      </div>`;
    DOC.body.appendChild(modal);
  }

  function showResult(result) {
    if (!DOC) return;
    const { record, reward } = result;
    DOC.getElementById('bonsai-completion-result')?.remove();
    const modal = DOC.createElement('div');
    modal.id = 'bonsai-completion-result';
    modal.className = 'completion-modal';
    modal.innerHTML = `
      <div class="completion-sheet">
        <div class="small">PART-SPECIFIC EXHIBITION RESULT</div>
        <h2>${esc(record.award)}</h2>
        <div class="completion-score">${record.score}点・${record.rank}位</div>
        <p class="adv-note">賞金 ¥${reward.money.toLocaleString()} ／ 名声 +${reward.rep}</p>
        <div class="completion-diagnosis">${diagnosisHtml(record.evaluation)}</div>
        <div class="completion-section-title">審査講評</div>
        <ul class="completion-list">${record.evaluation.strengths.slice(0, 2).map(item => `<li>${esc(item)}</li>`).join('')}${record.evaluation.cautions.slice(0, 2).map(item => `<li>${esc(item)}</li>`).join('')}</ul>
        <div class="list">${record.field.slice(0, 6).map((entry, index) => `<div class="item rankrow ${entry.you ? 'you' : ''}"><b>${index + 1}</b><div><strong>${esc(entry.name)}</strong><small>${esc(entry.title)}</small></div><em>${entry.score}</em></div>`).join('')}</div>
        <button class="primary" data-completion-result-close>銘木録へ保存して閉じる</button>
      </div>`;
    DOC.body.appendChild(modal);
  }

  function interceptExhibition(event) {
    const button = event.target.closest?.('[data-enter]');
    if (!button) return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    const result = exhibitionEntry(readState());
    if (!result.ok) {
      if (typeof alert === 'function') alert(result.message);
      return;
    }
    safeWrite(result.state);
    queueCapture({ reason: 'award', label: `${result.record.award}受賞時`, award: result.record }, result.state);
    showResult(result);
  }

  function memorialCard(memory) {
    const image = memory.image
      ? `<img src="${memory.image}" alt="${esc(memory.label)}">`
      : `<div style="aspect-ratio:9/16;display:grid;place-items:center;color:#7f8d83">画像なし</div>`;
    const award = memory.award ? `・${memory.award.name} ${memory.award.score}点` : '';
    return `<article class="completion-memory" data-memory-id="${esc(memory.id)}">
      <button type="button" data-memory-delete="${esc(memory.id)}">×</button>
      <div data-memory-view="${esc(memory.id)}">${image}</div>
      <div class="completion-memory-info"><b>${esc(memory.label)}</b><small>${new Date(memory.at).toLocaleString('ja-JP')}・${esc(POT_NAME[memory.pot] || memory.pot)}${esc(award)}</small></div>
    </article>`;
  }

  function enhanceMemorial() {
    if (!DOC) return;
    const heading = [...DOC.querySelectorAll('h1')].find(node => node.textContent?.includes('銘木録'));
    if (!heading) return;
    const page = heading.closest('.page') || heading.parentElement;
    if (!page) return;
    let gallery = page.querySelector('.completion-gallery');
    const state = readState();
    const renderKey = state.memorials.map(item => `${item.id}:${Boolean(item.image)}`).join('|') || 'empty';
    if (!gallery) {
      gallery = DOC.createElement('section');
      gallery.className = 'completion-gallery';
      page.appendChild(gallery);
    } else if (gallery.dataset.renderKey === renderKey) {
      return;
    }
    gallery.dataset.renderKey = renderKey;
    gallery.innerHTML = `
      <h2 class="section">作品状態アルバム</h2>
      <p class="small">剪定・針金・鉢替え・病害虫・受賞の節目を、当時の状態画像と部位署名で保存します。</p>
      <div class="completion-tools"><button type="button" data-completion-capture>現在を作品として記録</button><button type="button" data-completion-diagnosis>現在の作品を診断</button></div>
      <div class="completion-gallery-grid">${state.memorials.length ? state.memorials.map(memorialCard).join('') : '<div class="empty" style="grid-column:1/-1">まだ状態画像はありません。<br>剪定や受賞の節目に自動保存されます。</div>'}</div>`;
  }

  function enhanceHome() {
    if (!DOC) return;
    const figure = DOC.querySelector('.photo-bonsai');
    figure?.closest('.stage')?.classList.add('photo-stage');
    const actions = DOC.querySelector('.actions');
    if (actions && !DOC.querySelector('.completion-tools-home')) {
      const tools = DOC.createElement('div');
      tools.className = 'completion-tools completion-tools-home';
      tools.innerHTML = '<button type="button" data-completion-diagnosis>作品診断</button><button type="button" data-completion-capture>現在を記録</button>';
      actions.insertAdjacentElement('afterend', tools);
    }
  }

  function enhanceShow() {
    if (!DOC) return;
    const heading = [...DOC.querySelectorAll('h1')].find(node => node.textContent?.includes('展覧会'));
    if (!heading) return;
    const page = heading.closest('.page') || heading.parentElement;
    if (!page || page.querySelector('.completion-show-diagnosis')) return;
    const evaluation = exhibitionEvaluation(readState());
    const card = DOC.createElement('div');
    card.className = 'completion-diagnosis completion-show-diagnosis';
    card.innerHTML = diagnosisHtml(evaluation) + `<p class="adv-note">${esc(evaluation.cautions[0])}</p><button class="btn" data-completion-diagnosis>審査内訳を見る</button>`;
    const firstCard = page.querySelector('.card');
    if (firstCard) firstCard.insertAdjacentElement('beforebegin', card);
    else heading.insertAdjacentElement('afterend', card);
  }

  function openMemory(id) {
    if (!DOC) return;
    const memory = readState().memorials.find(item => item.id === id);
    if (!memory?.image) return;
    const viewer = DOC.createElement('div');
    viewer.className = 'completion-viewer';
    viewer.innerHTML = `<img src="${memory.image}" alt="${esc(memory.label)}"><button type="button" data-completion-viewer-close>閉じる</button>`;
    DOC.body.appendChild(viewer);
  }

  function deleteMemory(id) {
    const state = readState();
    state.memorials = state.memorials.filter(item => item.id !== id);
    safeWrite(state);
    enhanceMemorial();
  }

  function handleClick(event) {
    if (event.target.closest?.('[data-completion-close]')) DOC?.getElementById('bonsai-completion-modal')?.remove();
    if (event.target.closest?.('[data-completion-result-close]')) {
      DOC?.getElementById('bonsai-completion-result')?.remove();
      if (typeof location !== 'undefined') location.hash = 'memorial';
      setTimeout(() => location.reload(), 40);
    }
    if (event.target.closest?.('[data-completion-diagnosis]')) openDiagnosis();
    if (event.target.closest?.('[data-completion-capture]')) {
      const button = event.target.closest('[data-completion-capture]');
      button.disabled = true;
      captureMemorial({ reason: 'manual', label: '手動記録・現在の姿' })
        .then(() => { enhanceMemorial(); })
        .finally(() => { button.disabled = false; });
    }
    const view = event.target.closest?.('[data-memory-view]');
    if (view) openMemory(view.dataset.memoryView);
    const remove = event.target.closest?.('[data-memory-delete]');
    if (remove && typeof confirm !== 'function' || remove && confirm('この状態画像を銘木録から削除しますか？')) deleteMemory(remove.dataset.memoryDelete);
    if (event.target.closest?.('[data-completion-viewer-close]')) event.target.closest('.completion-viewer')?.remove();
  }

  function enhance() {
    if (!DOC) return;
    injectStyles();
    enhanceHome();
    enhanceShow();
    enhanceMemorial();
  }

  function initBrowser() {
    installStorageObserver();
    injectStyles();
    DOC.addEventListener('click', interceptExhibition, true);
    DOC.addEventListener('click', handleClick);
    const observer = new MutationObserver(() => enhance());
    observer.observe(DOC.documentElement, { childList: true, subtree: true });
    enhance();
  }

  ROOT.BonsaiCompletion = {
    VERSION,
    exhibitionEvaluation,
    exhibitionEntry,
    entrants,
    detectCapture,
    captureMemorial,
    renderSnapshot,
    readState,
    migrateState
  };

  if (DOC) {
    if (DOC.readyState === 'loading') DOC.addEventListener('DOMContentLoaded', initBrowser, { once: true });
    else initBrowser();
  }
})();
