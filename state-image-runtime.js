(() => {
  'use strict';

  const SAVE_KEY = 'bonsai_live_1';
  const META_KEY = 'bonsai_state_runtime_meta_v1';
  const DB_NAME = 'bonsai_state_images_v1';
  const DB_VERSION = 1;
  const STORE = 'snapshots';
  const MAX_SNAPSHOTS = 80;
  const POLL_MS = 900;

  const PARTS = {
    apex: {
      label: '頂部', x: 0.53, y: 0.16, rx: 0.18, ry: 0.085,
      branch: [[0.50, 0.50], [0.50, 0.35], [0.53, 0.17]]
    },
    first_left: {
      label: '第一枝', x: 0.25, y: 0.59, rx: 0.25, ry: 0.085,
      branch: [[0.50, 0.61], [0.38, 0.60], [0.19, 0.59]]
    },
    second_right: {
      label: '第二枝', x: 0.73, y: 0.53, rx: 0.24, ry: 0.085,
      branch: [[0.52, 0.54], [0.63, 0.53], [0.82, 0.52]]
    },
    third_left: {
      label: '第三枝', x: 0.28, y: 0.42, rx: 0.23, ry: 0.075,
      branch: [[0.51, 0.45], [0.40, 0.43], [0.21, 0.41]]
    },
    back_branch: {
      label: '背枝', x: 0.65, y: 0.37, rx: 0.18, ry: 0.065,
      branch: [[0.51, 0.42], [0.58, 0.39], [0.72, 0.36]]
    },
    front_branch: {
      label: '前枝', x: 0.46, y: 0.32, rx: 0.17, ry: 0.06,
      branch: [[0.51, 0.39], [0.48, 0.35], [0.43, 0.31]]
    },
    trunk: {
      label: '主幹', x: 0.51, y: 0.64, rx: 0.075, ry: 0.27,
      branch: [[0.50, 0.82], [0.49, 0.69], [0.53, 0.55], [0.50, 0.41], [0.53, 0.22]]
    },
    nebari: {
      label: '根張り', x: 0.50, y: 0.82, rx: 0.22, ry: 0.075,
      branch: [[0.34, 0.84], [0.50, 0.80], [0.67, 0.84]]
    }
  };

  const runtime = {
    lastSignature: '',
    lastProjection: '',
    rendering: false,
    captureQueued: false,
    observer: null,
    timer: null,
    dbPromise: null,
    lastState: null
  };

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, Number(value) || 0));
  }

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, char => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[char]);
  }

  function readState() {
    try {
      const parsed = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null');
      if (!parsed || typeof parsed !== 'object') return null;
      if (window.BonsaiAdvancedCare?.migrateState) {
        return window.BonsaiAdvancedCare.migrateState(parsed);
      }
      return parsed;
    } catch {
      return null;
    }
  }

  function statePart(state, id) {
    const part = state?.advanced?.parts?.[id] || {};
    const wire = part.wire || {};
    return {
      prune: clamp(part.prune ?? part.pruneLevel ?? 0, 0, 3),
      foliage: clamp(part.foliage ?? 100, 0, 100),
      health: clamp(part.health ?? 100, 0, 100),
      angle: clamp(part.angle ?? 0, -45, 45),
      wire: typeof wire === 'string' ? wire : (wire.strength || wire.level || ''),
      wireDirection: typeof wire === 'object' ? (wire.direction || '') : (part.wireDirection || ''),
      disease: typeof part.disease === 'object' ? (part.disease.type || part.disease.id || '') : (part.disease || ''),
      pest: typeof part.pest === 'object' ? (part.pest.type || part.pest.id || '') : (part.pest || ''),
      deadwood: part.deadwood || (part.jin ? 'jin' : ''),
      scar: clamp(part.wireScar ?? part.scar ?? part.scars ?? 0, 0, 3)
    };
  }

  function currentSeason(state) {
    const born = Number(state?.born || Date.now());
    const gameDays = Math.max(0, (Date.now() - born) / 8640000 * 10);
    return Math.floor((gameDays % 360) / 90);
  }

  function waterBand(state) {
    const elapsed = Math.max(0, (Date.now() - Number(state?.last || Date.now())) / 36e5);
    const speed = state?.sp === 'maple' ? 2.3 : state?.sp === 'azalea' ? 2.1 : 1.7;
    const water = clamp(Number(state?.water ?? 80) - elapsed * speed, 0, 100);
    return water < 20 ? 0 : water < 42 ? 1 : water < 78 ? 2 : 3;
  }

  function vigorBand(state) {
    const value = clamp(state?.vit ?? 80, 0, 100);
    return value < 40 ? 0 : value < 62 ? 1 : value < 86 ? 2 : 3;
  }

  function projection(state) {
    if (!state) return '';
    const parts = {};
    Object.keys(PARTS).forEach(id => { parts[id] = statePart(state, id); });
    return JSON.stringify({
      sp: state.sp,
      pot: state.pot,
      season: currentSeason(state),
      water: waterBand(state),
      vigor: vigorBand(state),
      awards: Array.isArray(state.awards) ? state.awards.length : 0,
      shari: state?.advanced?.shari || null,
      parts
    });
  }

  function signature(state) {
    try {
      const advanced = window.BonsaiAdvancedCare?.visualSignature?.(state);
      if (advanced) return `${state?.sp || ''}|${state?.pot || ''}|${waterBand(state)}|${vigorBand(state)}|${currentSeason(state)}|${advanced}`;
    } catch {}
    return projection(state);
  }

  function loadMeta() {
    try {
      return JSON.parse(localStorage.getItem(META_KEY) || '{}') || {};
    } catch {
      return {};
    }
  }

  function saveMeta(meta) {
    try { localStorage.setItem(META_KEY, JSON.stringify(meta)); } catch {}
  }

  function openDatabase() {
    if (!('indexedDB' in window)) return Promise.reject(new Error('IndexedDB unavailable'));
    if (runtime.dbPromise) return runtime.dbPromise;
    runtime.dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE)) {
          const store = db.createObjectStore(STORE, { keyPath: 'id', autoIncrement: true });
          store.createIndex('createdAt', 'createdAt');
          store.createIndex('signature', 'signature');
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error('IndexedDB open failed'));
    });
    return runtime.dbPromise;
  }

  async function listSnapshots() {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const request = db.transaction(STORE, 'readonly').objectStore(STORE).getAll();
      request.onsuccess = () => resolve((request.result || []).sort((a, b) => b.createdAt - a.createdAt));
      request.onerror = () => reject(request.error);
    });
  }

  async function storeSnapshot(record) {
    const db = await openDatabase();
    await new Promise((resolve, reject) => {
      const request = db.transaction(STORE, 'readwrite').objectStore(STORE).add(record);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
    const all = await listSnapshots();
    if (all.length <= MAX_SNAPSHOTS) return;
    const stale = all.slice(MAX_SNAPSHOTS);
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      const store = tx.objectStore(STORE);
      stale.forEach(item => store.delete(item.id));
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
  }

  async function deleteSnapshot(id) {
    const db = await openDatabase();
    await new Promise((resolve, reject) => {
      const request = db.transaction(STORE, 'readwrite').objectStore(STORE).delete(id);
      request.onsuccess = resolve;
      request.onerror = () => reject(request.error);
    });
  }

  function imageElement() {
    return document.querySelector('.photo-bonsai img');
  }

  function loadImage(source) {
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.decoding = 'async';
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error('state image source failed'));
      image.src = source;
    });
  }

  function coverTransform(image, width, height, positionY = 0.48) {
    const scale = Math.max(width / image.naturalWidth, height / image.naturalHeight);
    const dw = image.naturalWidth * scale;
    const dh = image.naturalHeight * scale;
    return {
      scale,
      dx: (width - dw) / 2,
      dy: (height - dh) * positionY,
      dw,
      dh
    };
  }

  function mapPoint(transform, width, height, x, y) {
    return [transform.dx + transform.dw * x, transform.dy + transform.dh * y];
  }

  function seeded(seedText) {
    let seed = 2166136261;
    for (let index = 0; index < seedText.length; index += 1) {
      seed ^= seedText.charCodeAt(index);
      seed = Math.imul(seed, 16777619);
    }
    return () => {
      seed += 0x6D2B79F5;
      let value = seed;
      value = Math.imul(value ^ value >>> 15, value | 1);
      value ^= value + Math.imul(value ^ value >>> 7, value | 61);
      return ((value ^ value >>> 14) >>> 0) / 4294967296;
    };
  }

  function drawPath(ctx, transform, points) {
    ctx.beginPath();
    points.forEach((point, index) => {
      const [x, y] = mapPoint(transform, ctx.canvas.width, ctx.canvas.height, point[0], point[1]);
      if (index === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
  }

  function foliageReduction(ctx, transform, id, model) {
    const part = PARTS[id];
    const level = Math.max(model.prune, model.foliage < 72 ? 1 : 0, model.foliage < 44 ? 2 : 0);
    if (!level) return;
    const [cx, cy] = mapPoint(transform, ctx.canvas.width, ctx.canvas.height, part.x, part.y);
    const rx = transform.dw * part.rx;
    const ry = transform.dh * part.ry;
    const random = seeded(`${id}:${level}:${Math.round(model.foliage / 8)}`);
    const holes = 8 + level * 11;

    ctx.save();
    ctx.globalCompositeOperation = 'source-over';
    for (let index = 0; index < holes; index += 1) {
      const angle = random() * Math.PI * 2;
      const radius = Math.sqrt(random());
      const x = cx + Math.cos(angle) * rx * radius;
      const y = cy + Math.sin(angle) * ry * radius;
      const size = (0.025 + random() * 0.055) * transform.dw * (0.75 + level * 0.2);
      const gradient = ctx.createRadialGradient(x, y, 0, x, y, size);
      const opacity = 0.18 + level * 0.10 + random() * 0.12;
      gradient.addColorStop(0, `rgba(5,12,8,${opacity})`);
      gradient.addColorStop(0.62, `rgba(9,17,12,${opacity * 0.72})`);
      gradient.addColorStop(1, 'rgba(9,17,12,0)');
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.ellipse(x, y, size * (1.2 + random()), size * (0.42 + random() * 0.38), random() * Math.PI, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 0.62 + level * 0.08;
    ctx.strokeStyle = '#6d4a32';
    ctx.lineWidth = Math.max(2, transform.dw * (0.005 + level * 0.0008));
    ctx.lineCap = 'round';
    drawPath(ctx, transform, part.branch);
    ctx.stroke();
    ctx.restore();
  }

  function drawWire(ctx, transform, id, model) {
    if (!model.wire || model.wire === 'none' || model.wire === 'off') return;
    const part = PARTS[id];
    const points = part.branch;
    ctx.save();
    ctx.strokeStyle = model.wire === 'heavy' || model.wire === 'strong' || model.wire === '2' ? '#b87432' : '#c68a4c';
    ctx.lineWidth = Math.max(1.8, transform.dw * (model.wire === 'heavy' || model.wire === 'strong' ? 0.006 : 0.004));
    ctx.lineCap = 'round';
    ctx.globalAlpha = 0.92;
    drawPath(ctx, transform, points);
    ctx.stroke();

    const samples = 13;
    for (let i = 1; i < samples; i += 1) {
      const t = i / samples;
      const segment = Math.min(points.length - 2, Math.floor(t * (points.length - 1)));
      const local = t * (points.length - 1) - segment;
      const a = points[segment];
      const b = points[segment + 1];
      const nx = a[0] + (b[0] - a[0]) * local;
      const ny = a[1] + (b[1] - a[1]) * local;
      const [x, y] = mapPoint(transform, ctx.canvas.width, ctx.canvas.height, nx, ny);
      ctx.beginPath();
      ctx.ellipse(x, y, transform.dw * 0.009, transform.dw * 0.004, t * Math.PI * 7, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawDisease(ctx, transform, id, model) {
    if (!model.disease) return;
    const part = PARTS[id];
    const [cx, cy] = mapPoint(transform, ctx.canvas.width, ctx.canvas.height, part.x, part.y);
    const rx = transform.dw * part.rx;
    const ry = transform.dh * part.ry;
    const random = seeded(`${id}:${model.disease}`);
    ctx.save();
    ctx.globalCompositeOperation = 'multiply';
    const soot = /soot|すす/i.test(model.disease);
    const rot = /root|rot|根腐/i.test(model.disease);
    const count = rot ? 12 : 26;
    for (let index = 0; index < count; index += 1) {
      const angle = random() * Math.PI * 2;
      const radius = Math.sqrt(random());
      const x = cx + Math.cos(angle) * rx * radius;
      const y = cy + Math.sin(angle) * ry * radius;
      const size = transform.dw * (0.006 + random() * 0.015);
      ctx.fillStyle = soot ? `rgba(24,22,16,${0.20 + random() * 0.26})` : `rgba(116,66,34,${0.16 + random() * 0.22})`;
      ctx.beginPath();
      ctx.ellipse(x, y, size * 1.5, size, random() * Math.PI, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawPest(ctx, transform, id, model) {
    if (!model.pest) return;
    const part = PARTS[id];
    const [cx, cy] = mapPoint(transform, ctx.canvas.width, ctx.canvas.height, part.x, part.y);
    const rx = transform.dw * part.rx;
    const ry = transform.dh * part.ry;
    const random = seeded(`${id}:${model.pest}`);
    ctx.save();
    const count = /mite|ハダニ/i.test(model.pest) ? 34 : 18;
    for (let index = 0; index < count; index += 1) {
      const angle = random() * Math.PI * 2;
      const radius = Math.sqrt(random());
      const x = cx + Math.cos(angle) * rx * radius;
      const y = cy + Math.sin(angle) * ry * radius;
      const size = Math.max(1.1, transform.dw * (0.0017 + random() * 0.002));
      ctx.fillStyle = /scale|カイガラ/i.test(model.pest) ? 'rgba(220,205,171,.78)' : 'rgba(35,24,16,.82)';
      ctx.beginPath();
      ctx.arc(x, y, size, 0, Math.PI * 2);
      ctx.fill();
      if (index % 4 === 0) {
        ctx.strokeStyle = 'rgba(24,16,10,.6)';
        ctx.lineWidth = 0.8;
        ctx.beginPath();
        ctx.moveTo(x - size * 1.8, y - size);
        ctx.lineTo(x + size * 1.8, y + size);
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  function drawDeadwood(ctx, transform, id, model) {
    if (!model.deadwood || !/jin|神/i.test(model.deadwood)) return;
    const part = PARTS[id];
    ctx.save();
    ctx.strokeStyle = '#c9c3aa';
    ctx.shadowColor = 'rgba(255,250,225,.24)';
    ctx.shadowBlur = transform.dw * 0.006;
    ctx.lineWidth = Math.max(3.5, transform.dw * 0.010);
    ctx.lineCap = 'round';
    drawPath(ctx, transform, part.branch);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(85,77,61,.65)';
    ctx.lineWidth *= 0.22;
    drawPath(ctx, transform, part.branch);
    ctx.stroke();
    ctx.restore();
  }

  function drawShari(ctx, transform, state) {
    const shari = state?.advanced?.shari;
    const level = clamp(typeof shari === 'number' ? shari : shari?.level, 0, 3);
    if (!level) return;
    const side = typeof shari === 'object' ? (shari.side || 'left') : 'left';
    const points = side === 'right'
      ? [[0.52, 0.81], [0.535, 0.68], [0.55, 0.55], [0.53, 0.43], [0.55, 0.31]]
      : [[0.485, 0.81], [0.475, 0.68], [0.50, 0.55], [0.485, 0.43], [0.51, 0.31]];
    ctx.save();
    ctx.strokeStyle = level >= 3 ? '#d6d0b9' : '#bdb79f';
    ctx.lineWidth = transform.dw * (0.009 + level * 0.0045);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.shadowColor = 'rgba(255,250,226,.18)';
    ctx.shadowBlur = transform.dw * 0.004;
    drawPath(ctx, transform, points);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(69,60,49,.55)';
    ctx.lineWidth *= 0.18;
    drawPath(ctx, transform, points);
    ctx.stroke();
    ctx.restore();
  }

  function drawRootCondition(ctx, transform, state) {
    const root = statePart(state, 'nebari');
    if (!root.disease) return;
    const [cx, cy] = mapPoint(transform, ctx.canvas.width, ctx.canvas.height, 0.5, 0.83);
    const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, transform.dw * 0.27);
    gradient.addColorStop(0, 'rgba(32,22,17,.42)');
    gradient.addColorStop(0.48, 'rgba(57,40,25,.24)');
    gradient.addColorStop(1, 'rgba(57,40,25,0)');
    ctx.save();
    ctx.globalCompositeOperation = 'multiply';
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.ellipse(cx, cy, transform.dw * 0.28, transform.dh * 0.055, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  async function compose(state, width, height, source) {
    const image = await loadImage(source);
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(width));
    canvas.height = Math.max(1, Math.round(height));
    const ctx = canvas.getContext('2d', { alpha: false });
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.fillStyle = '#071009';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const water = waterBand(state);
    const vigor = vigorBand(state);
    const saturation = 0.74 + vigor * 0.085;
    const brightness = 0.78 + vigor * 0.055 - (water === 0 ? 0.07 : 0);
    const contrast = 1.04 + vigor * 0.018;
    ctx.filter = `saturate(${saturation}) brightness(${brightness}) contrast(${contrast})`;
    const transform = coverTransform(image, canvas.width, canvas.height);
    ctx.drawImage(image, transform.dx, transform.dy, transform.dw, transform.dh);
    ctx.filter = 'none';

    if (water <= 1) {
      ctx.fillStyle = water === 0 ? 'rgba(151,105,58,.10)' : 'rgba(136,101,67,.055)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    Object.keys(PARTS).forEach(id => {
      const model = statePart(state, id);
      foliageReduction(ctx, transform, id, model);
      drawDisease(ctx, transform, id, model);
      drawPest(ctx, transform, id, model);
      drawWire(ctx, transform, id, model);
      drawDeadwood(ctx, transform, id, model);
    });
    drawShari(ctx, transform, state);
    drawRootCondition(ctx, transform, state);

    const vignette = ctx.createRadialGradient(canvas.width * 0.5, canvas.height * 0.44, canvas.width * 0.18, canvas.width * 0.5, canvas.height * 0.48, canvas.width * 0.74);
    vignette.addColorStop(0, 'rgba(0,0,0,0)');
    vignette.addColorStop(0.72, 'rgba(0,0,0,.06)');
    vignette.addColorStop(1, 'rgba(0,0,0,.30)');
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    return canvas;
  }

  async function renderCurrentPhoto() {
    if (runtime.rendering) return;
    const image = imageElement();
    const state = readState();
    if (!image || !state || state.sp !== 'pine') return;
    if (!image.complete) {
      image.addEventListener('load', renderCurrentPhoto, { once: true });
      return;
    }
    const frame = image.closest('.photo-bonsai');
    if (!frame) return;
    runtime.rendering = true;
    try {
      const width = Math.max(320, Math.round(frame.clientWidth * Math.min(2, devicePixelRatio || 1)));
      const height = Math.max(320, Math.round(frame.clientHeight * Math.min(2, devicePixelRatio || 1)));
      const canvas = await compose(state, width, height, image.currentSrc || image.src);
      canvas.className = 'bonsai-state-canvas';
      canvas.setAttribute('aria-label', '現在の手入れ状態を反映した黒松');
      const previous = frame.querySelector(':scope > .bonsai-state-canvas');
      if (previous) previous.replaceWith(canvas);
      else frame.appendChild(canvas);
    } catch (error) {
      console.warn('[BONSAI state image]', error);
    } finally {
      runtime.rendering = false;
    }
  }

  function reasonForChange(previous, current, state) {
    const log = state?.log?.[0]?.x;
    if (log) return String(log);
    if (!previous) return '育成開始時の姿';
    try {
      const before = JSON.parse(previous);
      const after = JSON.parse(current);
      if (before.pot !== after.pot) return '鉢替え後の姿';
      if (before.awards !== after.awards) return '展覧会出展時の姿';
      if (before.season !== after.season) return '季節が移った姿';
      for (const id of Object.keys(PARTS)) {
        const a = before.parts?.[id] || {};
        const b = after.parts?.[id] || {};
        if (a.prune !== b.prune || a.foliage !== b.foliage) return `${PARTS[id].label}を剪定した姿`;
        if (a.wire !== b.wire || a.angle !== b.angle) return `${PARTS[id].label}を整姿した姿`;
        if (a.deadwood !== b.deadwood) return `${PARTS[id].label}へ神を施した姿`;
        if (a.disease !== b.disease) return `${PARTS[id].label}の病変記録`;
        if (a.pest !== b.pest) return `${PARTS[id].label}の虫害記録`;
      }
      if (JSON.stringify(before.shari) !== JSON.stringify(after.shari)) return '舎利を施した姿';
      if (before.water !== after.water) return '水分状態が変化した姿';
      if (before.vigor !== after.vigor) return '樹勢が変化した姿';
    } catch {}
    return '作品状態の記録';
  }

  async function capture(reason = '作品状態の記録', force = false) {
    const state = readState();
    const image = imageElement();
    if (!state?.started || state.sp !== 'pine' || !image) return null;
    const sig = signature(state);
    const meta = loadMeta();
    if (!force && meta.lastCapturedSignature === sig) return null;
    const source = image.currentSrc || image.src;
    const naturalRatio = image.naturalWidth && image.naturalHeight ? image.naturalHeight / image.naturalWidth : 1.5;
    const width = 1200;
    const height = Math.round(width * clamp(naturalRatio, 1.15, 1.75));
    const canvas = await compose(state, width, height, source);
    const blob = await new Promise((resolve, reject) => canvas.toBlob(value => value ? resolve(value) : reject(new Error('snapshot encoding failed')), 'image/jpeg', 0.91));
    const record = {
      createdAt: Date.now(),
      signature: sig,
      reason,
      tree: String(state.tree || '無銘'),
      species: '黒松',
      pot: String(state.pot || ''),
      projection: projection(state),
      image: blob,
      width: canvas.width,
      height: canvas.height
    };
    await storeSnapshot(record);
    saveMeta({ ...meta, lastCapturedSignature: sig, lastCapturedAt: record.createdAt });
    return record;
  }

  async function snapshotUrl(item) {
    if (!item?.image) return '';
    return URL.createObjectURL(item.image);
  }

  async function openGallery() {
    let items = [];
    try { items = await listSnapshots(); } catch {}
    document.querySelector('.bonsai-state-gallery')?.remove();
    const overlay = document.createElement('div');
    overlay.className = 'bonsai-state-gallery';
    overlay.innerHTML = `
      <div class="bonsai-state-gallery__panel" role="dialog" aria-modal="true" aria-label="作品状態画像の記録">
        <header><div><small>MEMORIAL IMAGES</small><h2>作品状態記録</h2></div><button type="button" data-state-gallery-close aria-label="閉じる">×</button></header>
        <p class="bonsai-state-gallery__intro">剪定・整姿・病害虫・神・舎利など、作品の姿が変わった時点を端末内に保存します。</p>
        <div class="bonsai-state-gallery__list">${items.length ? '' : '<div class="bonsai-state-gallery__empty">まだ状態画像はありません。現在の姿を記録してください。</div>'}</div>
        <button type="button" class="bonsai-state-gallery__capture" data-state-capture-now>現在の姿を記録</button>
      </div>`;
    document.body.appendChild(overlay);
    const list = overlay.querySelector('.bonsai-state-gallery__list');
    for (const item of items) {
      const url = await snapshotUrl(item);
      const card = document.createElement('article');
      card.className = 'bonsai-state-gallery__card';
      card.innerHTML = `<img src="${url}" alt="${escapeHtml(item.reason)}"><div><time>${new Date(item.createdAt).toLocaleString('ja-JP')}</time><strong>${escapeHtml(item.reason)}</strong><small>${escapeHtml(item.tree)}・${escapeHtml(item.species)}</small></div><button type="button" data-state-delete="${item.id}" aria-label="記録を削除">削除</button>`;
      list.appendChild(card);
    }
  }

  function installStyles() {
    if (document.getElementById('bonsai-state-runtime-style')) return;
    const style = document.createElement('style');
    style.id = 'bonsai-state-runtime-style';
    style.textContent = `
      .photo-bonsai>.bonsai-state-canvas{position:absolute;inset:0;width:100%;height:100%;display:block;object-fit:cover;pointer-events:none;z-index:1}
      .photo-bonsai>img{visibility:hidden}
      .bonsai-state-memory-button{position:fixed;right:14px;bottom:calc(76px + env(safe-area-inset-bottom));z-index:18;border:1px solid rgba(217,183,123,.45);background:rgba(10,20,14,.94);color:#eed8aa;border-radius:999px;padding:10px 14px;box-shadow:0 12px 32px rgba(0,0,0,.35);font:600 11px -apple-system,sans-serif;backdrop-filter:blur(14px)}
      .bonsai-state-gallery{position:fixed;inset:0;z-index:120;background:rgba(0,0,0,.76);display:flex;align-items:flex-end;justify-content:center;backdrop-filter:blur(8px)}
      .bonsai-state-gallery__panel{width:min(720px,100%);max-height:92vh;overflow:auto;background:linear-gradient(180deg,#18261c,#0b140e);border-radius:26px 26px 0 0;border:1px solid rgba(218,193,146,.2);padding:20px 16px calc(24px + env(safe-area-inset-bottom));color:#eee8da}
      .bonsai-state-gallery__panel header{display:flex;align-items:flex-start;justify-content:space-between;gap:12px}.bonsai-state-gallery__panel h2{font:30px Georgia,serif;margin:3px 0}.bonsai-state-gallery__panel header small{color:#d9b77b;letter-spacing:.18em}.bonsai-state-gallery__panel header button{width:40px;height:40px;border-radius:50%;border:1px solid rgba(255,255,255,.14);background:rgba(255,255,255,.05);color:white;font-size:25px}.bonsai-state-gallery__intro{color:#9daa9f;line-height:1.7;font-size:12px}
      .bonsai-state-gallery__list{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.bonsai-state-gallery__card{position:relative;overflow:hidden;border-radius:17px;border:1px solid rgba(255,255,255,.12);background:#101c14}.bonsai-state-gallery__card img{width:100%;aspect-ratio:3/4;object-fit:cover;display:block}.bonsai-state-gallery__card div{padding:10px}.bonsai-state-gallery__card time,.bonsai-state-gallery__card small{display:block;color:#93a097;font-size:9px}.bonsai-state-gallery__card strong{display:block;font-size:12px;margin:4px 0}.bonsai-state-gallery__card>button{position:absolute;right:7px;top:7px;border:0;border-radius:999px;background:rgba(0,0,0,.62);color:#ddd;padding:5px 8px;font-size:9px}.bonsai-state-gallery__empty{grid-column:1/-1;padding:45px 20px;text-align:center;color:#93a097;border:1px dashed rgba(255,255,255,.15);border-radius:18px}.bonsai-state-gallery__capture{width:100%;margin-top:14px;border:0;border-radius:14px;padding:14px;background:#eee8da;color:#101611;font-weight:700}
      @media(max-width:430px){.bonsai-state-gallery__list{grid-template-columns:1fr 1fr}}
    `;
    document.head.appendChild(style);
  }

  function ensureMemoryButton() {
    if (document.querySelector('.bonsai-state-memory-button')) return;
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'bonsai-state-memory-button';
    button.textContent = '作品画像';
    button.addEventListener('click', openGallery);
    document.body.appendChild(button);
  }

  function observeDom() {
    runtime.observer?.disconnect();
    runtime.observer = new MutationObserver(() => {
      ensureMemoryButton();
      renderCurrentPhoto();
    });
    runtime.observer.observe(document.documentElement, { childList: true, subtree: true });
  }

  async function pollState() {
    const state = readState();
    if (!state?.started) return;
    const sig = signature(state);
    const nextProjection = projection(state);
    if (!runtime.lastSignature) {
      const meta = loadMeta();
      runtime.lastSignature = sig;
      runtime.lastProjection = nextProjection;
      runtime.lastState = state;
      if (!meta.lastCapturedSignature) {
        setTimeout(() => capture('育成開始時の姿', true).catch(() => {}), 1000);
      }
      renderCurrentPhoto();
      return;
    }
    if (sig !== runtime.lastSignature || nextProjection !== runtime.lastProjection) {
      const reason = reasonForChange(runtime.lastProjection, nextProjection, state);
      runtime.lastSignature = sig;
      runtime.lastProjection = nextProjection;
      runtime.lastState = state;
      renderCurrentPhoto();
      clearTimeout(runtime.captureQueued);
      runtime.captureQueued = setTimeout(() => capture(reason).catch(error => console.warn('[BONSAI snapshot]', error)), 700);
    }
  }

  document.addEventListener('click', async event => {
    const close = event.target.closest('[data-state-gallery-close]');
    if (close || event.target.classList.contains('bonsai-state-gallery')) {
      document.querySelector('.bonsai-state-gallery')?.remove();
      return;
    }
    const captureButton = event.target.closest('[data-state-capture-now]');
    if (captureButton) {
      captureButton.disabled = true;
      captureButton.textContent = '記録中…';
      try {
        await capture('プレイヤーが保存した現在の姿', true);
        await openGallery();
      } catch {
        captureButton.disabled = false;
        captureButton.textContent = '現在の姿を記録';
      }
      return;
    }
    const deleteButton = event.target.closest('[data-state-delete]');
    if (deleteButton) {
      await deleteSnapshot(Number(deleteButton.dataset.stateDelete));
      await openGallery();
    }
  });

  function start() {
    installStyles();
    ensureMemoryButton();
    observeDom();
    clearInterval(runtime.timer);
    runtime.timer = setInterval(() => pollState().catch(() => {}), POLL_MS);
    pollState().catch(() => {});
  }

  window.BonsaiStateRuntime = {
    version: '1.0.0',
    parts: PARTS,
    compose,
    capture,
    openGallery,
    listSnapshots,
    render: renderCurrentPhoto,
    signature,
    projection
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();
