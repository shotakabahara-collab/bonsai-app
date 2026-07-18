(() => {
  'use strict';

  const SAVE_KEY = 'bonsai_live_1';
  const PART_IDS = ['apex','first_left','second_right','third_left','back_branch','front_branch','trunk','nebari'];
  const TARGET_FOLIAGE = {
    apex: 64,
    first_left: 78,
    second_right: 72,
    third_left: 66,
    back_branch: 54,
    front_branch: 46
  };

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, Number(value) || 0));
  }

  function statePart(state, id) {
    const part = state?.advanced?.parts?.[id] || {};
    const wire = part.wire || {};
    return {
      foliage: clamp(part.foliage ?? 100, 0, 100),
      health: clamp(part.health ?? 100, 0, 100),
      prune: clamp(part.prune ?? part.pruneLevel ?? 0, 0, 3),
      wire: typeof wire === 'string' ? wire : (wire.strength || wire.level || ''),
      scar: clamp(part.wireScar ?? part.scar ?? part.scars ?? 0, 0, 3),
      disease: typeof part.disease === 'object' ? (part.disease.type || part.disease.id || '') : (part.disease || ''),
      pest: typeof part.pest === 'object' ? (part.pest.type || part.pest.id || '') : (part.pest || ''),
      deadwood: part.deadwood || (part.jin ? 'jin' : '')
    };
  }

  function readState() {
    try {
      const state = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null');
      return window.BonsaiAdvancedCare?.migrateState ? window.BonsaiAdvancedCare.migrateState(state) : state;
    } catch {
      return null;
    }
  }

  function shariLevel(state) {
    const shari = state?.advanced?.shari;
    return clamp(typeof shari === 'number' ? shari : shari?.level, 0, 3);
  }

  function evaluate(state) {
    if (!state?.advanced?.parts) {
      return {
        delta: 0,
        components: {},
        comments: ['部位別の作り込みを始めると、より詳しい審査見立てが表示されます。'],
        flags: []
      };
    }

    const parts = Object.fromEntries(PART_IDS.map(id => [id, statePart(state, id)]));
    const branchIds = Object.keys(TARGET_FOLIAGE);
    const comments = [];
    const flags = [];

    const averageHealth = PART_IDS.reduce((sum, id) => sum + parts[id].health, 0) / PART_IDS.length;
    const health = clamp((averageHealth - 68) * 0.105, -8, 3.4);
    if (averageHealth >= 88) comments.push('樹勢と部位健康が揃い、作品に張りがあります。');
    else if (averageHealth < 60) {
      comments.push('部位ごとの健康差が大きく、展示前の回復が必要です。');
      flags.push('health');
    }

    const deviations = branchIds.map(id => Math.abs(parts[id].foliage - TARGET_FOLIAGE[id]));
    const averageDeviation = deviations.reduce((sum, value) => sum + value, 0) / deviations.length;
    const silhouette = clamp(4.2 - averageDeviation * 0.17, -7, 4.2);
    if (averageDeviation <= 12) comments.push('葉棚の重さと余白が整い、枝の流れが読みやすい構成です。');
    else if (averageDeviation > 28) {
      comments.push('葉棚の密度差が大きく、正面の重心が散っています。');
      flags.push('silhouette');
    }

    let overPrune = 0;
    let congestion = 0;
    for (const id of branchIds) {
      const part = parts[id];
      if (part.deadwood) continue;
      if (part.foliage < 22) overPrune += 1;
      if (part.foliage > 92) congestion += 1;
    }
    const pruning = clamp(2.2 - overPrune * 2.4 - congestion * 1.1, -8, 2.2);
    if (overPrune) {
      comments.push('葉量を失った生枝があり、強剪定の緊張が作品へ残っています。');
      flags.push('over-prune');
    } else if (congestion) {
      comments.push('混み合う葉棚があり、内側の光と通風が不足しています。');
      flags.push('congestion');
    }

    const diseaseCount = PART_IDS.filter(id => parts[id].disease).length;
    const pestCount = PART_IDS.filter(id => parts[id].pest).length;
    const pathology = clamp(-(diseaseCount * 6.5 + pestCount * 4.2), -24, 0);
    if (diseaseCount) {
      comments.push(`病変が${diseaseCount}部位に見られ、健康美の評価を大きく落とします。`);
      flags.push('disease');
    }
    if (pestCount) {
      comments.push(`虫害が${pestCount}部位に残っています。出展前の駆除が必要です。`);
      flags.push('pest');
    }

    let activeWire = 0;
    let heavyWire = 0;
    let scars = 0;
    for (const id of branchIds) {
      const value = String(parts[id].wire || '').toLowerCase();
      if (value && value !== 'none' && value !== 'off' && value !== '0') {
        activeWire += 1;
        if (/heavy|strong|2|強/.test(value)) heavyWire += 1;
      }
      scars += parts[id].scar;
    }
    const wiring = clamp(-(activeWire * 0.65 + heavyWire * 0.8 + scars * 1.15), -10, 0);
    if (activeWire >= 3) comments.push('整姿中の針金が目立ち、完成展示としては作業感が残ります。');
    if (scars) {
      comments.push('針金跡が枝肌に残り、技術評価を下げています。');
      flags.push('wire-scar');
    }

    const jinCount = branchIds.filter(id => /jin|神/i.test(parts[id].deadwood)).length;
    const shari = shariLevel(state);
    const vitality = clamp(state.vit ?? averageHealth, 0, 100);
    let deadwood = 0;
    if (jinCount || shari) {
      const controlled = diseaseCount === 0 && vitality >= 68;
      deadwood = controlled ? Math.min(6.2, jinCount * 1.8 + shari * 1.35) : -Math.min(5, jinCount * 1.3 + shari * 1.1);
      if (controlled) comments.push('神・舎利が幹筋に沿い、古木表現として作品へ意味を与えています。');
      else {
        comments.push('樹勢が整わないまま枯れ表現が重なり、作為が先行しています。');
        flags.push('deadwood-risk');
      }
      if (jinCount > 2) {
        deadwood -= (jinCount - 2) * 1.5;
        comments.push('神の数が多く、生きた部分との対比が弱くなっています。');
      }
    }

    const stressValue = clamp(state.stress ?? 0, 0, 100);
    const stress = stressValue > 34 ? -Math.min(6, (stressValue - 34) * 0.11) : 0;
    if (stressValue > 50) {
      comments.push('作業ストレスが高く、今は触らず回復を待つ段階です。');
      flags.push('stress');
    }

    const components = {
      部位健康: health,
      葉棚構成: silhouette,
      剪定完成度: pruning,
      病害虫: pathology,
      針金と傷跡: wiring,
      神舎利: deadwood,
      作業ストレス: stress
    };
    const delta = clamp(Object.values(components).reduce((sum, value) => sum + value, 0), -28, 11);
    if (!comments.length) comments.push('大きな欠点はありません。鉢と季節を読み、展示の焦点を定めてください。');

    return {
      delta: Math.round(delta * 10) / 10,
      components,
      comments: comments.slice(0, 5),
      flags,
      metrics: {
        averageHealth: Math.round(averageHealth),
        averageDeviation: Math.round(averageDeviation),
        diseaseCount,
        pestCount,
        activeWire,
        scars,
        jinCount,
        shari
      }
    };
  }

  function score(baseScore, state) {
    const result = evaluate(state);
    return clamp(Math.round(Number(baseScore || 0) + result.delta), 20, 99);
  }

  function injectAssessment() {
    const state = readState();
    if (!state?.started) return;
    const page = document.querySelector('.page');
    const heading = page?.querySelector('h1')?.textContent || '';
    if (!page || !/大会|展覧/.test(heading)) return;
    let card = page.querySelector('.bonsai-judging-assessment');
    if (!card) {
      card = document.createElement('section');
      card.className = 'item bonsai-judging-assessment';
      const firstItem = page.querySelector('.item');
      if (firstItem) firstItem.before(card);
      else page.appendChild(card);
    }
    const result = evaluate(state);
    const deltaText = result.delta > 0 ? `+${result.delta.toFixed(1)}` : result.delta.toFixed(1);
    card.innerHTML = `<div class="small">部位状態による審査補正</div><div class="bonsai-judging-assessment__score">${deltaText}<small>点</small></div><div class="bonsai-judging-assessment__components">${Object.entries(result.components).map(([name,value])=>`<span>${name}<b>${value>0?'+':''}${value.toFixed(1)}</b></span>`).join('')}</div><p>${result.comments[0]}</p>`;
  }

  function installStyles() {
    if (document.getElementById('bonsai-judging-style')) return;
    const style = document.createElement('style');
    style.id = 'bonsai-judging-style';
    style.textContent = `.bonsai-judging-assessment{border-color:rgba(217,183,123,.34)!important;background:linear-gradient(135deg,rgba(217,183,123,.09),rgba(21,33,25,.98))!important}.bonsai-judging-assessment__score{font:32px Georgia,serif;color:#e6c88d;margin:5px 0}.bonsai-judging-assessment__score small{font-size:11px;margin-left:3px}.bonsai-judging-assessment__components{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:5px}.bonsai-judging-assessment__components span{display:flex;justify-content:space-between;gap:8px;border:1px solid rgba(255,255,255,.09);border-radius:9px;padding:6px 8px;font-size:9px;color:#aab4ac}.bonsai-judging-assessment__components b{color:#e8dfcf}.bonsai-judging-assessment p{font-size:11px;line-height:1.65;color:#c9cfc9;margin:10px 0 0}`;
    document.head.appendChild(style);
  }

  function start() {
    installStyles();
    const observer = new MutationObserver(injectAssessment);
    observer.observe(document.documentElement, { childList: true, subtree: true });
    injectAssessment();
  }

  window.BonsaiJudging = { version: '1.0.0', evaluate, score, readState };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();
