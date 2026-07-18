(() => {
  'use strict';

  const ROOT = typeof window !== 'undefined' ? window : globalThis;
  const DOC = typeof document !== 'undefined' ? document : null;
  const STORAGE_KEY = 'bonsai_live_1';
  const VERSION = 1;
  const EVENT_INTERVAL_MS = 12 * 60 * 60 * 1000;
  const HISTORY_LIMIT = 120;

  const PARTS = [
    { id: 'apex', name: '頂部', short: '頂', x: 51, y: 17, kind: 'branch' },
    { id: 'first_left', name: '第一枝（左下）', short: '一', x: 28, y: 58, kind: 'branch' },
    { id: 'second_right', name: '第二枝（右中）', short: '二', x: 73, y: 45, kind: 'branch' },
    { id: 'third_left', name: '第三枝（左中）', short: '三', x: 31, y: 38, kind: 'branch' },
    { id: 'back_branch', name: '背枝', short: '背', x: 61, y: 30, kind: 'branch' },
    { id: 'front_branch', name: '前枝', short: '前', x: 52, y: 49, kind: 'branch' },
    { id: 'trunk', name: '主幹', short: '幹', x: 53, y: 65, kind: 'trunk' },
    { id: 'nebari', name: '根張り・根域', short: '根', x: 51, y: 81, kind: 'root' }
  ];

  const DIRECTIONS = {
    down: { name: '下げる', delta: -12 },
    up: { name: '上げる', delta: 10 },
    left: { name: '左へ流す', delta: -9 },
    right: { name: '右へ流す', delta: 9 },
    front: { name: '手前へ出す', delta: 6 },
    back: { name: '奥へ引く', delta: -6 }
  };

  const DISEASES = {
    needle_blight: { name: '葉枯れ症状', icon: '🍂', cost: 420 },
    sooty_mold: { name: 'すす病', icon: '◼︎', cost: 480 },
    root_rot: { name: '根腐れ兆候', icon: '🟤', cost: 760 }
  };

  const PESTS = {
    aphid: { name: 'アブラムシ', icon: '🪲', cost: 260 },
    spider_mite: { name: 'ハダニ', icon: '🕷️', cost: 320 },
    scale: { name: 'カイガラムシ', icon: '⚪︎', cost: 380 }
  };

  const clamp = (value, min, max) => Math.max(min, Math.min(max, Number(value) || 0));
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
  const partMeta = id => PARTS.find(part => part.id === id) || PARTS[0];

  function defaultPart(meta) {
    return {
      foliage: meta.kind === 'root' ? 0 : 100,
      health: 100,
      pruneLevel: 0,
      angle: 0,
      wire: { level: 0, direction: 'down', since: null },
      disease: null,
      pest: null,
      deadwood: null,
      scars: 0,
      updatedAt: Date.now()
    };
  }

  function freshAdvanced() {
    return {
      version: VERSION,
      parts: Object.fromEntries(PARTS.map(meta => [meta.id, defaultPart(meta)])),
      shari: { level: 0, side: 'left', createdAt: null },
      lastEventBucket: null,
      history: [],
      selectedPart: 'apex'
    };
  }

  function migrateState(input) {
    const state = input && typeof input === 'object' ? input : {};
    state.stats = state.stats && typeof state.stats === 'object'
      ? state.stats
      : { water: 0, prune: 0, wire: 0, shows: 0 };
    state.log = Array.isArray(state.log) ? state.log : [];
    state.money = Number.isFinite(Number(state.money)) ? Number(state.money) : 0;
    state.rep = Number.isFinite(Number(state.rep)) ? Number(state.rep) : 0;
    state.vit = Number.isFinite(Number(state.vit)) ? Number(state.vit) : 84;
    state.stress = Number.isFinite(Number(state.stress)) ? Number(state.stress) : 0;
    state.prune = Number.isFinite(Number(state.prune)) ? Number(state.prune) : 0;
    state.wire = Number.isFinite(Number(state.wire)) ? Number(state.wire) : 0;

    const current = state.advanced && typeof state.advanced === 'object'
      ? state.advanced
      : freshAdvanced();
    const migrated = freshAdvanced();

    migrated.version = VERSION;
    migrated.lastEventBucket = current.lastEventBucket ?? null;
    migrated.selectedPart = PARTS.some(p => p.id === current.selectedPart)
      ? current.selectedPart
      : 'apex';
    migrated.history = Array.isArray(current.history)
      ? current.history.slice(0, HISTORY_LIMIT)
      : [];
    migrated.shari = {
      level: clamp(current.shari?.level ?? 0, 0, 3),
      side: ['left', 'right'].includes(current.shari?.side) ? current.shari.side : 'left',
      createdAt: current.shari?.createdAt ?? null
    };

    for (const meta of PARTS) {
      const source = current.parts?.[meta.id] || {};
      const base = defaultPart(meta);
      migrated.parts[meta.id] = {
        foliage: meta.kind === 'root' ? 0 : clamp(source.foliage ?? base.foliage, 0, 100),
        health: clamp(source.health ?? 100, 0, 100),
        pruneLevel: clamp(source.pruneLevel ?? 0, 0, 3),
        angle: clamp(source.angle ?? 0, -45, 45),
        wire: {
          level: clamp(source.wire?.level ?? 0, 0, 2),
          direction: DIRECTIONS[source.wire?.direction] ? source.wire.direction : 'down',
          since: source.wire?.since ?? null
        },
        disease: DISEASES[source.disease] ? source.disease : null,
        pest: PESTS[source.pest] ? source.pest : null,
        deadwood: source.deadwood === 'jin' ? 'jin' : null,
        scars: clamp(source.scars ?? 0, 0, 9),
        updatedAt: source.updatedAt ?? Date.now()
      };
    }

    state.advanced = migrated;
    return state;
  }

  function readState() {
    if (typeof localStorage === 'undefined') return migrateState({});
    try {
      return migrateState(JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'));
    } catch {
      return migrateState({});
    }
  }

  function writeState(state) {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(migrateState(state)));
    }
    return state;
  }

  function appendLog(state, text) {
    state.log.unshift({ at: Date.now(), x: text });
    state.log = state.log.slice(0, 80);
  }

  function visualSignature(state) {
    const advanced = migrateState(state).advanced;
    const partKey = PARTS.map(meta => {
      const p = advanced.parts[meta.id];
      return [
        meta.id,
        p.pruneLevel,
        p.wire.level,
        p.wire.direction,
        p.disease || '-',
        p.pest || '-',
        p.deadwood || '-',
        Math.round(p.health / 10)
      ].join(':');
    }).join('|');
    return `v${VERSION};${partKey};shari:${advanced.shari.level}:${advanced.shari.side}`;
  }

  function addHistory(state, action, partId, detail) {
    const entry = {
      at: Date.now(),
      action,
      part: partId,
      detail,
      visualSignature: visualSignature(state)
    };
    state.advanced.history.unshift(entry);
    state.advanced.history = state.advanced.history.slice(0, HISTORY_LIMIT);
  }

  function derivedState(state) {
    const rates = { pine: 1.7, maple: 2.3, azalea: 2.1 };
    const elapsedHours = Math.max(0, (Date.now() - Number(state.last || Date.now())) / 3600000);
    const water = Math.max(0, Number(state.water ?? 80) - elapsedHours * (rates[state.sp] || 2));
    const stress = Math.max(0, Number(state.stress || 0));
    const averageHealth = PARTS.reduce((sum, meta) => sum + state.advanced.parts[meta.id].health, 0) / PARTS.length;
    const vitality = clamp(Number(state.vit ?? 84) - Math.max(0, 35 - water) * 0.34 - stress * 0.13, 0, 100);
    return { water, stress, vitality, averageHealth };
  }

  function hash(text) {
    let h = 2166136261;
    for (let i = 0; i < String(text).length; i += 1) {
      h ^= String(text).charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  function activeIssues(state) {
    const issues = [];
    for (const meta of PARTS) {
      const part = state.advanced.parts[meta.id];
      if (part.disease) issues.push({ type: 'disease', id: part.disease, part: meta });
      if (part.pest) issues.push({ type: 'pest', id: part.pest, part: meta });
    }
    return issues;
  }

  function applyAction(stateInput, partId, action, option = '') {
    const state = migrateState(stateInput);
    const meta = partMeta(partId);
    const part = state.advanced.parts[meta.id];
    const derived = derivedState(state);
    const now = Date.now();
    let detail = '';
    let text = '';

    const finish = () => {
      part.updatedAt = now;
      addHistory(state, action, meta.id, detail);
      appendLog(state, text);
      return { ok: true, state, message: text, visualSignature: visualSignature(state) };
    };

    if (action.startsWith('prune_')) {
      if (meta.kind !== 'branch') return { ok: false, state, message: '剪定対象は枝・葉棚を選んでください。' };
      if (part.deadwood) return { ok: false, state, message: '神にした枝は剪定できません。' };
      const levels = {
        prune_light: { level: 1, foliage: 14, stress: 5, vitality: 1, label: '軽剪定' },
        prune_medium: { level: 2, foliage: 28, stress: 9, vitality: 3, label: '中剪定' },
        prune_hard: { level: 3, foliage: 48, stress: 14, vitality: 5, label: '強剪定' }
      };
      const config = levels[action];
      if (!config) return { ok: false, state, message: '剪定内容が不正です。' };
      if (part.pruneLevel >= config.level && part.foliage <= 20) {
        return { ok: false, state, message: 'この部位はすでに十分切り詰められています。' };
      }
      part.pruneLevel = Math.max(part.pruneLevel, config.level);
      part.foliage = clamp(part.foliage - config.foliage, 0, 100);
      part.health = clamp(part.health - Math.ceil(config.vitality / 2), 0, 100);
      state.prune += 1;
      state.stats.prune = Number(state.stats.prune || 0) + 1;
      state.stress += config.stress;
      state.vit = clamp(state.vit - config.vitality, 0, 100);
      detail = `${config.label}; foliage=${part.foliage}`;
      text = `${meta.name}へ${config.label}を確定した。切った枝葉は戻らない。`;
      return finish();
    }

    if (action === 'wire_light' || action === 'wire_strong') {
      if (meta.kind !== 'branch') return { ok: false, state, message: '針金は枝を選んでください。' };
      if (part.deadwood) return { ok: false, state, message: '神にした枝へ針金は掛けられません。' };
      const direction = DIRECTIONS[option] ? option : 'down';
      const level = action === 'wire_strong' ? 2 : 1;
      part.wire = { level, direction, since: now };
      part.angle = clamp(part.angle + DIRECTIONS[direction].delta * level, -45, 45);
      part.health = clamp(part.health - level, 0, 100);
      state.wire += 1;
      state.stats.wire = Number(state.stats.wire || 0) + 1;
      state.stress += level === 2 ? 8 : 4;
      detail = `level=${level}; direction=${direction}; angle=${part.angle}`;
      text = `${meta.name}へ${level === 2 ? '強い' : '軽い'}針金を掛け、${DIRECTIONS[direction].name}方向へ整姿した。`;
      return finish();
    }

    if (action === 'wire_remove') {
      if (!part.wire.level) return { ok: false, state, message: 'この部位には針金が掛かっていません。' };
      const elapsedDays = part.wire.since ? (now - part.wire.since) / 86400000 : 0;
      if (elapsedDays > 7 && part.wire.level === 2) {
        part.scars = clamp(part.scars + 1, 0, 9);
      }
      const scarred = part.scars > 0;
      part.wire = { level: 0, direction: part.wire.direction, since: null };
      detail = `scarred=${scarred}`;
      text = `${meta.name}の針金を外した。${scarred ? 'わずかな食い込み跡が残った。' : '枝は整姿した位置を保っている。'}`;
      return finish();
    }

    if (action === 'treat_disease') {
      if (!part.disease) return { ok: false, state, message: 'この部位に治療対象の病気はありません。' };
      const disease = DISEASES[part.disease];
      if (state.money < disease.cost) return { ok: false, state, message: `治療費として¥${disease.cost.toLocaleString()}必要です。` };
      state.money -= disease.cost;
      const name = disease.name;
      part.disease = null;
      part.health = clamp(part.health + 10, 0, 100);
      state.vit = clamp(state.vit + 3, 0, 100);
      detail = name;
      text = `${meta.name}の${name}を治療した。`;
      return finish();
    }

    if (action === 'treat_pest') {
      if (!part.pest) return { ok: false, state, message: 'この部位に駆除対象の害虫はいません。' };
      const pest = PESTS[part.pest];
      if (state.money < pest.cost) return { ok: false, state, message: `駆除費として¥${pest.cost.toLocaleString()}必要です。` };
      state.money -= pest.cost;
      const name = pest.name;
      part.pest = null;
      part.health = clamp(part.health + 6, 0, 100);
      detail = name;
      text = `${meta.name}の${name}を駆除した。`;
      return finish();
    }

    if (action === 'jin') {
      if (meta.kind !== 'branch') return { ok: false, state, message: '神は枝を選んで施します。' };
      if (part.deadwood === 'jin') return { ok: false, state, message: 'この枝はすでに神になっています。' };
      if (part.pruneLevel < 2 && part.foliage > 55) {
        return { ok: false, state, message: '神にする前に、この枝を中剪定以上まで整理してください。' };
      }
      if (derived.vitality < 60) return { ok: false, state, message: '樹勢が不足しています。回復させてから施してください。' };
      part.deadwood = 'jin';
      part.foliage = 0;
      part.health = 0;
      part.wire = { level: 0, direction: part.wire.direction, since: null };
      state.prune += 1;
      state.stats.prune = Number(state.stats.prune || 0) + 1;
      state.stress += 12;
      state.vit = clamp(state.vit - 3, 0, 100);
      detail = 'jin';
      text = `${meta.name}を神に仕立てた。白骨化した枝は作品の来歴として残る。`;
      return finish();
    }

    if (action === 'shari') {
      if (meta.kind !== 'trunk') return { ok: false, state, message: '舎利は主幹を選んで施します。' };
      if (state.rep < 120) return { ok: false, state, message: '舎利は「一級盆栽師」以上で解放されます。' };
      if (derived.vitality < 70) return { ok: false, state, message: '樹勢70以上が必要です。' };
      if (state.advanced.shari.level >= 3) return { ok: false, state, message: '舎利はすでに最大段階です。' };
      const side = option === 'right' ? 'right' : 'left';
      state.advanced.shari.level += 1;
      state.advanced.shari.side = side;
      state.advanced.shari.createdAt = state.advanced.shari.createdAt || now;
      part.health = clamp(part.health - 8, 0, 100);
      state.stress += 14;
      state.vit = clamp(state.vit - 4, 0, 100);
      detail = `level=${state.advanced.shari.level}; side=${side}`;
      text = `主幹の${side === 'left' ? '左側' : '右側'}へ舎利を施した。不可逆の古木表現として残る。`;
      return finish();
    }

    return { ok: false, state, message: '未対応の操作です。' };
  }

  function tickEvents(stateInput, currentSeason = 0, now = Date.now()) {
    const state = migrateState(stateInput);
    if (!state.started) return { state, changed: false };
    const bucket = Math.floor(now / EVENT_INTERVAL_MS);
    if (state.advanced.lastEventBucket === bucket) return { state, changed: false };
    state.advanced.lastEventBucket = bucket;

    const derived = derivedState(state);
    const branchParts = PARTS.filter(meta => meta.kind === 'branch')
      .map(meta => ({ meta, part: state.advanced.parts[meta.id] }))
      .filter(item => !item.part.deadwood);
    const averageFoliage = branchParts.reduce((sum, item) => sum + item.part.foliage, 0) / Math.max(1, branchParts.length);
    let risk = 3;
    if (averageFoliage > 86) risk += 7;
    if (derived.water < 35) risk += 11;
    if (derived.water > 88 && derived.stress > 16) risk += 8;
    if (derived.stress > 26) risk += 9;
    if (currentSeason === 1) risk += 5;
    risk = clamp(risk, 2, 34);

    const seed = `${state.born || 0}:${bucket}:${state.prune}:${state.wire}`;
    const roll = hash(seed) % 100;
    if (roll >= risk) return { state, changed: true, event: null };

    let type;
    if (derived.water < 27) type = (hash(seed + 'dry') % 2) ? 'needle_blight' : 'spider_mite';
    else if (derived.water > 90 && derived.stress > 18) type = (hash(seed + 'wet') % 2) ? 'root_rot' : 'sooty_mold';
    else if (currentSeason === 1) type = ['aphid', 'spider_mite', 'scale'][hash(seed + 'summer') % 3];
    else type = ['needle_blight', 'sooty_mold', 'aphid', 'scale'][hash(seed + 'base') % 4];

    const isDisease = Boolean(DISEASES[type]);
    let candidates;
    if (type === 'root_rot') {
      candidates = [PARTS.find(meta => meta.id === 'nebari')];
    } else {
      candidates = PARTS.filter(meta => meta.kind === 'branch')
        .filter(meta => {
          const p = state.advanced.parts[meta.id];
          return !p.deadwood && !p.disease && !p.pest;
        });
    }
    if (!candidates.length) return { state, changed: true, event: null };
    const meta = candidates[hash(seed + type) % candidates.length];
    const part = state.advanced.parts[meta.id];

    if (isDisease) part.disease = type;
    else part.pest = type;
    part.health = clamp(part.health - (type === 'root_rot' ? 13 : 7), 0, 100);
    part.foliage = meta.kind === 'branch' ? clamp(part.foliage - 5, 0, 100) : part.foliage;
    state.vit = clamp(state.vit - (type === 'root_rot' ? 5 : 2), 0, 100);
    const eventName = isDisease ? DISEASES[type].name : PESTS[type].name;
    const text = `${meta.name}に${eventName}が発生した。部位別手入れから対処できる。`;
    appendLog(state, text);
    addHistory(state, isDisease ? 'disease_event' : 'pest_event', meta.id, type);
    return { state, changed: true, event: { type, part: meta.id, text } };
  }

  function overlaySvg(stateInput) {
    const state = migrateState(stateInput);
    const elements = [];

    for (const meta of PARTS) {
      const part = state.advanced.parts[meta.id];
      if (part.pruneLevel > 0 && meta.kind === 'branch') {
        const opacity = 0.08 + part.pruneLevel * 0.06;
        const radiusX = 10 + part.pruneLevel * 2;
        const radiusY = 6 + part.pruneLevel;
        elements.push(`<ellipse cx="${meta.x}" cy="${meta.y}" rx="${radiusX}" ry="${radiusY}" fill="rgba(3,8,5,${opacity.toFixed(2)})" filter="url(#advBlur)"/>`);
      }
      if (part.health < 65 && meta.kind !== 'root') {
        const opacity = clamp((65 - part.health) / 90, 0.08, 0.33);
        elements.push(`<ellipse cx="${meta.x}" cy="${meta.y}" rx="9" ry="6" fill="rgba(171,125,47,${opacity.toFixed(2)})" filter="url(#advBlur)"/>`);
      }
      if (part.wire.level > 0 && meta.kind === 'branch') {
        const width = part.wire.level === 2 ? 0.8 : 0.55;
        const direction = part.wire.direction;
        const shiftX = direction === 'left' ? -8 : direction === 'right' ? 8 : direction === 'front' ? 4 : direction === 'back' ? -4 : 0;
        const shiftY = direction === 'up' ? -7 : direction === 'down' ? 7 : 0;
        elements.push(`<path d="M ${meta.x - 8} ${meta.y + 4} C ${meta.x - 3} ${meta.y - 6}, ${meta.x + shiftX} ${meta.y + shiftY - 5}, ${meta.x + 8 + shiftX} ${meta.y + shiftY}" fill="none" stroke="#b87333" stroke-width="${width}" stroke-linecap="round" stroke-dasharray="1.5 1.1" opacity=".88"/>`);
      }
      if (part.disease) {
        const color = part.disease === 'sooty_mold' ? '#181512' : part.disease === 'root_rot' ? '#6d4c2e' : '#9b6e28';
        elements.push(`<ellipse cx="${meta.x}" cy="${meta.y}" rx="8" ry="5" fill="${color}" opacity=".34" filter="url(#advBlur)"/>`);
      }
      if (part.pest) {
        for (let i = 0; i < 5; i += 1) {
          const dx = ((hash(`${meta.id}:${i}`) % 9) - 4) * 0.7;
          const dy = ((hash(`${i}:${meta.id}`) % 7) - 3) * 0.6;
          elements.push(`<circle cx="${(meta.x + dx).toFixed(1)}" cy="${(meta.y + dy).toFixed(1)}" r=".65" fill="${part.pest === 'scale' ? '#d7d1bc' : '#291e18'}" opacity=".9"/>`);
        }
      }
      if (part.deadwood === 'jin') {
        const direction = meta.x < 50 ? -1 : 1;
        elements.push(`<path d="M ${meta.x - direction * 2} ${meta.y + 2} C ${meta.x + direction * 4} ${meta.y - 1}, ${meta.x + direction * 8} ${meta.y - 5}, ${meta.x + direction * 12} ${meta.y - 7}" fill="none" stroke="#d7d1bd" stroke-width="2.2" stroke-linecap="round" opacity=".93"/>`);
        elements.push(`<path d="M ${meta.x} ${meta.y + 1} C ${meta.x + direction * 5} ${meta.y - 2}, ${meta.x + direction * 9} ${meta.y - 5}, ${meta.x + direction * 12} ${meta.y - 7}" fill="none" stroke="#fff8dd" stroke-width=".45" stroke-linecap="round" opacity=".8"/>`);
      }
    }

    const shari = state.advanced.shari;
    if (shari.level > 0) {
      const offset = shari.side === 'right' ? 2.2 : -2.2;
      const width = 0.9 + shari.level * 0.55;
      elements.push(`<path d="M ${52 + offset} 42 C ${49 + offset} 53, ${55 + offset} 61, ${51 + offset} 76" fill="none" stroke="#d8d1bb" stroke-width="${width}" stroke-linecap="round" opacity=".9"/>`);
      elements.push(`<path d="M ${52 + offset} 42 C ${49 + offset} 53, ${55 + offset} 61, ${51 + offset} 76" fill="none" stroke="#fff6d8" stroke-width=".4" stroke-linecap="round" opacity=".8"/>`);
    }

    return `<svg class="adv-visual-overlay" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><defs><filter id="advBlur"><feGaussianBlur stdDeviation="2.3"/></filter></defs>${elements.join('')}</svg>`;
  }

  let selectedPart = 'apex';
  let workingState = null;
  let modalDirty = false;

  function injectStyles() {
    if (!DOC || DOC.getElementById('bonsai-advanced-style')) return;
    const style = DOC.createElement('style');
    style.id = 'bonsai-advanced-style';
    style.textContent = `
      .adv-care-button{grid-column:1/-1;border-color:rgba(217,183,123,.36)!important;background:linear-gradient(135deg,rgba(217,183,123,.16),rgba(255,255,255,.04))!important}
      .adv-care-button span{font-size:20px!important}
      .adv-alert{margin:10px 0;padding:12px 13px;border:1px solid rgba(209,121,78,.42);border-radius:16px;background:linear-gradient(145deg,rgba(116,47,30,.22),rgba(25,34,28,.92));font-size:11px;line-height:1.6}
      .adv-alert b{display:block;color:#efd0a5;margin-bottom:4px}
      .adv-modal{position:fixed;inset:0;z-index:180;background:rgba(0,0,0,.74);backdrop-filter:blur(10px);display:flex;align-items:flex-end;justify-content:center}
      .adv-sheet{width:100%;max-width:700px;max-height:94dvh;overflow:auto;background:#101a14;border:1px solid rgba(255,255,255,.13);border-radius:28px 28px 0 0;padding:14px 14px calc(22px + env(safe-area-inset-bottom));box-shadow:0 -24px 60px rgba(0,0,0,.48)}
      .adv-top{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:10px}
      .adv-top h2{font:24px Georgia,"Yu Mincho",serif;margin:2px 0}
      .adv-close{border:1px solid rgba(255,255,255,.14);background:rgba(255,255,255,.06);color:#eee8da;border-radius:999px;padding:8px 12px}
      .adv-map{position:relative;height:270px;overflow:hidden;border-radius:20px;border:1px solid rgba(255,255,255,.13);background:radial-gradient(circle,#28392d,#08100b 72%);margin-bottom:12px}
      .adv-map img{width:100%;height:100%;object-fit:cover;object-position:center 48%;filter:saturate(.72) brightness(.58);opacity:.82}
      .adv-map:after{content:"";position:absolute;inset:0;background:radial-gradient(circle at 50% 46%,transparent 30%,rgba(4,9,6,.48) 94%);pointer-events:none}
      .adv-hotspot{position:absolute;z-index:2;width:34px;height:34px;margin:-17px 0 0 -17px;border-radius:50%;border:1px solid rgba(255,235,190,.68);background:rgba(8,15,10,.76);color:#f4e9cf;font-weight:700;box-shadow:0 4px 16px rgba(0,0,0,.42)}
      .adv-hotspot.active{background:#d5b273;color:#102016;transform:scale(1.12)}
      .adv-hotspot.issue{box-shadow:0 0 0 4px rgba(190,74,49,.28),0 4px 16px rgba(0,0,0,.42)}
      .adv-panel{padding:13px;border-radius:18px;border:1px solid rgba(255,255,255,.11);background:linear-gradient(145deg,rgba(28,43,33,.96),rgba(14,23,17,.97));margin-bottom:10px}
      .adv-part-title{display:flex;justify-content:space-between;align-items:flex-start;gap:12px}
      .adv-part-title h3{font:20px Georgia,"Yu Mincho",serif;margin:0}
      .adv-state-key{font-size:8px;color:#7f8d83;word-break:break-all;margin-top:7px}
      .adv-meter-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:6px;margin-top:11px}
      .adv-meter{padding:8px;border-radius:12px;background:rgba(255,255,255,.045);font-size:9px;color:#9daa9f}
      .adv-meter b{display:block;color:#eee8da;font-size:15px;margin-bottom:3px}
      .adv-section-title{font:16px Georgia,"Yu Mincho",serif;margin:15px 2px 7px;color:#e4c58e}
      .adv-actions{display:grid;grid-template-columns:repeat(3,1fr);gap:7px}
      .adv-actions button,.adv-direction{min-height:42px;border:1px solid rgba(255,255,255,.13);border-radius:12px;background:rgba(255,255,255,.055);color:#eee8da;padding:9px 6px;font-size:10px}
      .adv-actions button.danger{background:rgba(121,48,38,.58);border-color:rgba(224,121,93,.45)}
      .adv-direction{width:100%;margin-bottom:7px}
      .adv-issue{display:flex;justify-content:space-between;gap:8px;align-items:center;padding:9px;border-radius:12px;background:rgba(154,74,42,.16);margin-top:7px;font-size:10px}
      .adv-note{color:#9daa9f;font-size:9px;line-height:1.65;margin:8px 2px}
      .photo-bonsai{isolation:isolate}
      .adv-visual-overlay{position:absolute;z-index:3;inset:0;width:100%;height:100%;pointer-events:none;mix-blend-mode:normal}
    `;
    DOC.head.appendChild(style);
  }

  function currentPhoto() {
    return DOC?.querySelector('.photo-bonsai img')?.src || ROOT.BonsaiPhotos?.pine || '';
  }

  function partStatusHtml(state, meta) {
    const part = state.advanced.parts[meta.id];
    const issueParts = [];
    if (part.disease) issueParts.push(`${DISEASES[part.disease].icon} ${DISEASES[part.disease].name}`);
    if (part.pest) issueParts.push(`${PESTS[part.pest].icon} ${PESTS[part.pest].name}`);
    if (part.deadwood) issueParts.push('白骨化・神');
    return `
      <div class="adv-part-title">
        <div>
          <h3>${esc(meta.name)}</h3>
          <div class="small">${issueParts.length ? issueParts.join(' / ') : '異常なし'}</div>
        </div>
        <span class="badge">${meta.kind === 'branch' ? '枝・葉棚' : meta.kind === 'trunk' ? '幹' : '根域'}</span>
      </div>
      <div class="adv-meter-grid">
        <div class="adv-meter"><b>${Math.round(part.health)}%</b>部位健康</div>
        <div class="adv-meter"><b>${Math.round(part.foliage)}%</b>葉量</div>
        <div class="adv-meter"><b>P${part.pruneLevel} / G${part.wire.level}</b>剪定・針金</div>
      </div>
      <div class="adv-state-key">${esc(visualSignature(state))}</div>
    `;
  }

  function renderModal() {
    if (!DOC || !workingState) return;
    let modal = DOC.getElementById('bonsai-advanced-modal');
    if (!modal) {
      modal = DOC.createElement('div');
      modal.id = 'bonsai-advanced-modal';
      modal.className = 'adv-modal';
      DOC.body.appendChild(modal);
    }
    const meta = partMeta(selectedPart);
    workingState.advanced.selectedPart = selectedPart;
    const part = workingState.advanced.parts[selectedPart];
    const photo = currentPhoto();
    const issues = [];
    if (part.disease) {
      const disease = DISEASES[part.disease];
      issues.push(`<div class="adv-issue"><span>${disease.icon} ${disease.name}</span><button data-adv-action="treat_disease">治療 ¥${disease.cost.toLocaleString()}</button></div>`);
    }
    if (part.pest) {
      const pest = PESTS[part.pest];
      issues.push(`<div class="adv-issue"><span>${pest.icon} ${pest.name}</span><button data-adv-action="treat_pest">駆除 ¥${pest.cost.toLocaleString()}</button></div>`);
    }

    const hotspots = PARTS.map(item => {
      const p = workingState.advanced.parts[item.id];
      const issue = p.disease || p.pest;
      return `<button class="adv-hotspot ${item.id === selectedPart ? 'active' : ''} ${issue ? 'issue' : ''}" data-adv-part="${item.id}" style="left:${item.x}%;top:${item.y}%">${esc(item.short)}</button>`;
    }).join('');

    const branchActions = meta.kind === 'branch' ? `
      <div class="adv-section-title">剪定 — 確定後は取り消せません</div>
      <div class="adv-actions">
        <button data-adv-action="prune_light">軽剪定</button>
        <button data-adv-action="prune_medium">中剪定</button>
        <button class="danger" data-adv-action="prune_hard">強剪定</button>
      </div>
      <div class="adv-section-title">針金と枝方向</div>
      <select class="adv-direction" id="adv-direction">
        ${Object.entries(DIRECTIONS).map(([id, value]) => `<option value="${id}" ${part.wire.direction === id ? 'selected' : ''}>${esc(value.name)}</option>`).join('')}
      </select>
      <div class="adv-actions">
        <button data-adv-action="wire_light">軽針金</button>
        <button data-adv-action="wire_strong">強針金</button>
        <button data-adv-action="wire_remove">針金を外す</button>
      </div>
      <div class="adv-section-title">古木技法</div>
      <div class="adv-actions">
        <button class="danger" data-adv-action="jin">この枝を神にする</button>
      </div>
      <p class="adv-note">神は枝を意図的に枯らし、白骨化させる不可逆の技法です。中剪定以上と十分な樹勢が必要です。</p>
    ` : '';

    const trunkActions = meta.kind === 'trunk' ? `
      <div class="adv-section-title">舎利 — 上級・不可逆技法</div>
      <select class="adv-direction" id="adv-shari-side">
        <option value="left" ${workingState.advanced.shari.side === 'left' ? 'selected' : ''}>幹の左側</option>
        <option value="right" ${workingState.advanced.shari.side === 'right' ? 'selected' : ''}>幹の右側</option>
      </select>
      <div class="adv-actions">
        <button class="danger" data-adv-action="shari">舎利を一段階広げる</button>
      </div>
      <p class="adv-note">一級盆栽師以上・樹勢70以上で実行できます。幹肌を意図的に枯らすため、元には戻せません。</p>
    ` : '';

    modal.innerHTML = `
      <div class="adv-sheet">
        <div class="adv-top">
          <div><div class="small">作品構造編集</div><h2>部位別手入れ</h2></div>
          <button class="adv-close" data-adv-close>完了</button>
        </div>
        <div class="adv-map">
          ${photo ? `<img src="${esc(photo)}" alt="手入れ箇所選択用の盆栽画像">` : ''}
          ${hotspots}
        </div>
        <div class="adv-panel">${partStatusHtml(workingState, meta)}</div>
        ${issues.length ? `<div class="adv-section-title">病害虫への対処</div>${issues.join('')}` : ''}
        ${branchActions}
        ${trunkActions}
        ${meta.kind === 'root' ? '<p class="adv-note">根域の異常は早期治療が重要です。根腐れ兆候がある場合は治療を行ってください。</p>' : ''}
        <p class="adv-note">各操作は部位単位で記録され、剪定・神・舎利は取り消せません。「完了」でゲーム画面へ反映します。</p>
      </div>
    `;
  }

  function openModal(partId = '') {
    workingState = readState();
    selectedPart = PARTS.some(part => part.id === partId)
      ? partId
      : workingState.advanced.selectedPart || 'apex';
    modalDirty = false;
    renderModal();
  }

  function closeModal() {
    DOC?.getElementById('bonsai-advanced-modal')?.remove();
    workingState = null;
    if (modalDirty && typeof location !== 'undefined') {
      location.reload();
    }
  }

  function actionConfirmation(action, meta) {
    if (action.startsWith('prune_')) return `${meta.name}を剪定します。切った枝葉は戻りません。実行しますか？`;
    if (action === 'jin') return `${meta.name}を意図的に枯らして神にします。この操作は取り消せません。`;
    if (action === 'shari') return '主幹へ舎利を施します。この操作は取り消せません。';
    return '';
  }

  function handleModalClick(event) {
    const partButton = event.target.closest?.('[data-adv-part]');
    if (partButton) {
      selectedPart = partButton.dataset.advPart;
      renderModal();
      return;
    }

    if (event.target.closest?.('[data-adv-close]')) {
      closeModal();
      return;
    }

    const actionButton = event.target.closest?.('[data-adv-action]');
    if (!actionButton || !workingState) return;
    const action = actionButton.dataset.advAction;
    const meta = partMeta(selectedPart);
    const confirmation = actionConfirmation(action, meta);
    if (confirmation && typeof confirm === 'function' && !confirm(confirmation)) return;

    const direction = DOC.getElementById('adv-direction')?.value || '';
    const shariSide = DOC.getElementById('adv-shari-side')?.value || '';
    const option = action === 'shari' ? shariSide : direction;
    const result = applyAction(workingState, selectedPart, action, option);

    if (!result.ok) {
      actionButton.blur();
      if (typeof alert === 'function') alert(result.message);
      return;
    }

    workingState = writeState(result.state);
    modalDirty = true;
    renderModal();
    enhance();
  }

  function renderVisualOverlay() {
    if (!DOC) return;
    const state = readState();
    const figure = DOC.querySelector('.photo-bonsai');
    if (!figure) return;
    figure.querySelector('.adv-visual-overlay')?.remove();
    figure.insertAdjacentHTML('beforeend', overlaySvg(state));
    figure.dataset.advancedState = visualSignature(state);

    const image = figure.querySelector('img');
    if (image) {
      const derived = derivedState(state);
      const health = derived.averageHealth;
      const saturation = clamp(0.76 + health / 420 + derived.water / 700, 0.72, 1.06);
      const brightness = clamp(0.77 + health / 500 + derived.water / 900, 0.78, 1.01);
      image.style.filter = `saturate(${saturation.toFixed(2)}) contrast(1.07) brightness(${brightness.toFixed(2)})`;
    }
  }

  function enhance() {
    if (!DOC) return;
    injectStyles();
    const state = readState();
    const actions = DOC.querySelector('.actions');
    if (actions && !actions.querySelector('[data-advanced-care]')) {
      const button = DOC.createElement('button');
      button.type = 'button';
      button.className = 'adv-care-button';
      button.dataset.advancedCare = 'true';
      button.innerHTML = '<span>🌿</span>部位別手入れ';
      button.addEventListener('click', () => openModal());
      actions.appendChild(button);
    }

    const issues = activeIssues(state);
    const existing = DOC.querySelector('.adv-alert');
    if (issues.length) {
      const text = issues.slice(0, 3).map(issue => {
        const name = issue.type === 'disease' ? DISEASES[issue.id].name : PESTS[issue.id].name;
        return `${issue.part.name}：${name}`;
      }).join('／');
      const alertCard = existing || DOC.createElement('div');
      alertCard.className = 'adv-alert';
      alertCard.innerHTML = `<b>病害虫の兆候 ${issues.length}件</b>${esc(text)}<br><button class="btn" data-advanced-alert-open>部位別手入れで確認</button>`;
      if (!existing) {
        const mentor = DOC.querySelector('.mentor');
        mentor?.insertAdjacentElement('afterend', alertCard);
      }
      alertCard.querySelector('[data-advanced-alert-open]')?.addEventListener('click', () => openModal(issues[0].part.id), { once: true });
    } else {
      existing?.remove();
    }
    renderVisualOverlay();
  }

  function runEventTick() {
    const state = readState();
    const born = Number(state.born || Date.now());
    const gameDays = Math.max(0, (Date.now() - born) / 8640000 * 10);
    const currentSeason = Math.floor((gameDays % 360) / 90);
    const result = tickEvents(state, currentSeason, Date.now());
    if (!result.changed) return;
    writeState(result.state);
    if (result.event && typeof sessionStorage !== 'undefined') {
      const marker = `event-${result.state.advanced.lastEventBucket}`;
      if (sessionStorage.getItem('bonsai-advanced-reload') !== marker) {
        sessionStorage.setItem('bonsai-advanced-reload', marker);
        setTimeout(() => location.reload(), 120);
      }
    }
  }

  function initBrowser() {
    injectStyles();
    DOC.addEventListener('click', handleModalClick);
    const observer = new MutationObserver(() => enhance());
    observer.observe(DOC.documentElement, { childList: true, subtree: true });
    enhance();
    runEventTick();
  }

  ROOT.BonsaiAdvancedCare = {
    PARTS,
    DIRECTIONS,
    DISEASES,
    PESTS,
    migrateState,
    applyAction,
    tickEvents,
    activeIssues,
    visualSignature,
    overlaySvg,
    open: openModal,
    readState,
    writeState
  };

  if (DOC) {
    if (DOC.readyState === 'loading') DOC.addEventListener('DOMContentLoaded', initBrowser, { once: true });
    else initBrowser();
  }
})();
