"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.seasonalOverview = seasonalOverview;
exports.pruningSuitability = pruningSuitability;
exports.applySeasonalPruningToGame = applySeasonalPruningToGame;
exports.advanceSeasonalGame = advanceSeasonalGame;
exports.loadSeasonalState = loadSeasonalState;
exports.saveSeasonalState = saveSeasonalState;
exports.responseLabel = responseLabel;
const craft_v3_1 = require("./craft-v3");
const model_1 = require("./model");
const DAY = 86_400_000;
// Keep the v4 key so every already-published pending response migrates in place.
const KEY_PREFIX = 'bonsai:seasonal:v4:';
const CLIMATE = '標準温帯設定';
const RULES = {
    pine: {
        budPinch: { ideal: [{ start: 120, end: 175 }], caution: [{ start: 100, end: 195 }], responseDays: 36, rationale: '黒松の芽摘み・芽切りは、樹勢と二番芽が伸びる期間を残せる時期に行う。' },
        budSelect: { ideal: [{ start: 65, end: 115 }, { start: 245, end: 315 }], caution: [{ start: 45, end: 135 }, { start: 225, end: 335 }], responseDays: 24, rationale: '芽数を整理し、同一点から多数の芽が伸びてコブになるのを防ぐ。' },
        needleThin: { ideal: [{ start: 270, end: 350 }], caution: [{ start: 235, end: 364 }, { start: 0, end: 35 }], responseDays: 28, rationale: '古葉取りは二番芽が固まった後に行い、枝ごとの力を整える。' },
        tipCutback: { ideal: [{ start: 320, end: 364 }, { start: 0, end: 55 }], caution: [{ start: 285, end: 364 }, { start: 0, end: 85 }], responseDays: 52, rationale: '構造的な切り戻しは休眠期を中心に行い、夏の強い消耗を避ける。' },
        innerTwigThin: { ideal: [{ start: 285, end: 364 }, { start: 0, end: 75 }], caution: [{ start: 250, end: 364 }, { start: 0, end: 105 }], responseDays: 34, rationale: '懐の整理は芽と枝の位置を確認しやすい秋から休眠期が基準。' },
        removeBranch: { ideal: [{ start: 330, end: 364 }, { start: 0, end: 50 }], caution: [{ start: 295, end: 364 }, { start: 0, end: 85 }], responseDays: 90, rationale: '太い枝抜きは休眠期を中心に行い、樹液活動が強い時期の大傷を避ける。' }
    },
    maple: {
        budPinch: { ideal: [{ start: 70, end: 125 }], caution: [{ start: 55, end: 145 }], responseDays: 18, rationale: '山もみじの芽摘みは新梢が伸び始める春に節間を詰める。' },
        budSelect: { ideal: [{ start: 65, end: 125 }], caution: [{ start: 50, end: 150 }], responseDays: 18, rationale: '芽吹き時に芽数と方向を選び、将来の枝分かれを整える。' },
        needleThin: { ideal: [{ start: 135, end: 195 }], caution: [{ start: 115, end: 220 }], responseDays: 24, rationale: '葉が固まった後に葉量を調整し、内側へ光を入れる。' },
        tipCutback: { ideal: [{ start: 125, end: 205 }], caution: [{ start: 105, end: 230 }], responseDays: 30, rationale: '新梢が固まり始めた後に切り戻し、二次伸長を利用する。' },
        innerTwigThin: { ideal: [{ start: 305, end: 364 }, { start: 0, end: 55 }], caution: [{ start: 270, end: 364 }, { start: 0, end: 85 }], responseDays: 35, rationale: '落葉後は枝筋を見ながら懐枝と交差枝を判断できる。' },
        removeBranch: { ideal: [{ start: 325, end: 364 }, { start: 0, end: 45 }], caution: [{ start: 290, end: 364 }, { start: 0, end: 75 }], responseDays: 70, rationale: '大きな構造剪定は休眠期を中心に行い、樹液の流出と日焼けを避ける。' }
    },
    azalea: {
        budPinch: { ideal: [{ start: 150, end: 215 }], caution: [{ start: 135, end: 235 }], responseDays: 20, rationale: '皐月は花後の新梢整理を基準にし、翌年の花芽形成を妨げない。' },
        budSelect: { ideal: [{ start: 150, end: 220 }], caution: [{ start: 130, end: 240 }], responseDays: 20, rationale: '花後に新芽の数と方向を選び、枝の混み合いを防ぐ。' },
        needleThin: { ideal: [{ start: 160, end: 230 }], caution: [{ start: 140, end: 250 }], responseDays: 24, rationale: '花後の葉量調整で光と通風を確保する。' },
        tipCutback: { ideal: [{ start: 150, end: 215 }], caution: [{ start: 130, end: 235 }], responseDays: 28, rationale: '花後に輪郭を戻し、次の花芽が固まる前に仕立てる。' },
        innerTwigThin: { ideal: [{ start: 155, end: 235 }], caution: [{ start: 135, end: 255 }], responseDays: 30, rationale: '花後の枝抜きで内側の蒸れを防ぎ、細枝を残す。' },
        removeBranch: { ideal: [{ start: 325, end: 364 }, { start: 0, end: 45 }], caution: [{ start: 285, end: 364 }, { start: 0, end: 75 }], responseDays: 65, rationale: '太枝の除去は休眠期を中心に行い、花後の細かな剪定と分ける。' }
    }
};
const MIN_VITALITY = {
    budPinch: 55,
    budSelect: 52,
    needleThin: 58,
    tipCutback: 64,
    innerTwigThin: 62,
    removeBranch: 74
};
const BASE_RISK = {
    budPinch: 4,
    budSelect: 4,
    needleThin: 7,
    tipCutback: 18,
    innerTwigThin: 13,
    removeBranch: 27
};
function seasonalOverview(bonsai, now = Date.now()) {
    const gameDay = inGameDayOfYear(bonsai, now);
    const date = new Date(Date.UTC(2024, 0, gameDay + 1));
    return {
        gameDay,
        month: `${date.getUTCMonth() + 1}月`,
        phase: phenologyPhase(bonsai.species, gameDay),
        climate: CLIMATE,
        activeResponses: loadSeasonalState(bonsai).responses.filter(item => !item.completedAt).sort((a, b) => a.dueAt - b.dueAt)
    };
}
function pruningSuitability(bonsai, siteId, technique, now = Date.now()) {
    const state = bonsai.craft.sites[siteId];
    const definition = craft_v3_1.PRUNING_SITES.find(item => item.id === siteId);
    const zeroRisk = riskForecast(0, technique);
    if (bonsai.lifeStatus === 'dead')
        return blocked('枯死', ['枯死した木へ新しい作業はできません。'], zeroRisk);
    if (!state || !definition || state.removed)
        return blocked('対象なし', ['この箇所はすでに失われています。'], zeroRisk);
    if (ancestorRemoved(bonsai, siteId))
        return blocked('対象なし', ['親枝が失われているため、この箇所は存在しません。'], zeroRisk);
    if (!techniqueAllowedForRole(definition.role, technique))
        return blocked('部位不適', ['この枝位置には成立しない技法です。'], zeroRisk);
    if ((technique === 'budPinch' || technique === 'budSelect') && state.budCount < 1)
        return blocked('芽なし', ['選べる芽がありません。'], zeroRisk);
    const rule = RULES[bonsai.species][technique];
    const gameDay = inGameDayOfYear(bonsai, now);
    const idealSeason = inRanges(gameDay, rule.ideal);
    const shoulderSeason = inRanges(gameDay, rule.caution);
    const part = bonsai.parts[definition.parentPartId];
    let riskScore = BASE_RISK[technique];
    const reasons = [];
    if (!idealSeason && shoulderSeason) {
        riskScore += 13;
        reasons.push('標準適期の周辺期間です。芽吹きと傷の安定にばらつきが出ます。');
    }
    else if (!shoulderSeason) {
        riskScore += 32;
        reasons.push(`現在の${seasonalOverview(bonsai, now).month}は標準的な作業時期から外れています。`);
    }
    const vitalityDeficit = Math.max(0, MIN_VITALITY[technique] - bonsai.vitality);
    if (vitalityDeficit > 0) {
        riskScore += vitalityDeficit * .95 + 5;
        reasons.push(`樹勢が目安${MIN_VITALITY[technique]}を下回っています。実行はできますが、全身衰弱の危険が増します。`);
    }
    else if (bonsai.vitality < MIN_VITALITY[technique] + 12) {
        riskScore += 6;
        reasons.push('樹勢に余裕が少なく、回復が遅れる可能性があります。');
    }
    if (state.health < 72) {
        riskScore += (72 - state.health) * .48;
        reasons.push('対象部位の健康が低く、枯れ込みや病徴が出やすい状態です。');
    }
    if (state.vigor < 70) {
        riskScore += (70 - state.vigor) * .38;
        reasons.push('局所樹勢が弱く、芽吹き不発の危険があります。');
    }
    if (bonsai.stress > 42) {
        riskScore += (bonsai.stress - 42) * .28;
        reasons.push('作業ストレスが残っています。続けて切るほど回復余力を失います。');
    }
    if (state.lastWorkedAt) {
        const elapsedGameDays = Math.max(0, (now - state.lastWorkedAt) / DAY * 10);
        if (elapsedGameDays < 14) {
            riskScore += 9 + (14 - elapsedGameDays) * .9;
            reasons.push(`同じ箇所の前回作業からゲーム内${Math.floor(elapsedGameDays)}日。傷が安定する前の再作業です。`);
        }
    }
    if (bonsai.water < 30 || bonsai.water > 96) {
        riskScore += 11;
        reasons.push(bonsai.water < 30 ? '水切れ気味で、作業後に枝先が枯れ込みやすい状態です。' : '過湿で、切り口から病気へ進む危険があります。');
    }
    if (part?.disease || part?.pest) {
        riskScore += 18;
        reasons.push('対象系統に病害虫があり、作業創から悪化する危険があります。');
    }
    riskScore = clamp(riskScore, 0, 100);
    const risk = riskForecast(riskScore, technique);
    const quality = clamp(1 - riskScore / 108, .05, .98);
    const status = riskScore < 20 && idealSeason ? 'ideal' : riskScore < 50 ? 'caution' : 'danger';
    const label = status === 'ideal' ? '適期' : status === 'caution' ? '注意して実行可能' : '高危険・実行可能';
    const mentorAdvice = adviceFor(status, riskScore, technique, bonsai.vitality);
    return {
        status,
        label,
        reasons: [...reasons, rule.rationale],
        quality,
        mentorAdvice,
        risk
    };
}
function applySeasonalPruningToGame(game, siteId, technique, now = Date.now()) {
    const source = game.bonsai.find(item => item.id === game.activeBonsaiId) ?? game.bonsai[0];
    if (!source)
        return { game, applied: false, message: '対象の盆栽がありません。' };
    const suitability = pruningSuitability(source, siteId, technique, now);
    if (suitability.status === 'blocked')
        return { game, applied: false, message: suitability.reasons[0] ?? 'この作業は成立しません。' };
    const next = (0, craft_v3_1.applyPrecisionPruningToGame)(game, siteId, technique, now);
    const bonsai = next.bonsai.find(item => item.id === next.activeBonsaiId) ?? next.bonsai[0];
    const definition = craft_v3_1.PRUNING_SITES.find(item => item.id === siteId);
    const site = bonsai?.craft.sites[siteId];
    if (!bonsai || !definition || !site)
        return { game: next, applied: false, message: '対象の盆栽がありません。' };
    site.health = clamp(site.health - suitability.risk.immediateHealthLoss);
    site.vigor = clamp(site.vigor - suitability.risk.immediateVigorLoss);
    bonsai.vitality = clamp(bonsai.vitality - suitability.risk.immediateVitalityLoss);
    bonsai.stress = clamp(bonsai.stress + suitability.risk.score * .13, 0, 1000);
    const parentPart = bonsai.parts[definition.parentPartId];
    parentPart.health = Math.min(parentPart.health, site.health);
    const response = createResponse(bonsai, siteId, technique, suitability, now);
    const seasonal = loadSeasonalState(bonsai);
    seasonal.responses.unshift(response);
    seasonal.responses = seasonal.responses.slice(0, 80);
    seasonal.lastAdvancedAt = now;
    saveSeasonalState(bonsai.id, seasonal);
    (0, model_1.addAftercareRisk)(bonsai, {
        source: `${definition.label}・${technique}`,
        createdAt: now,
        expiresAt: response.dueAt + inGameDaysToMs(35),
        diseaseBonus: suitability.risk.diseaseChance * .45,
        pestBonus: suitability.risk.pestChance * .45,
        growthPenalty: suitability.risk.growthPenalty,
        diebackBonus: suitability.risk.diebackChance,
        deathBonus: suitability.risk.deathChance
    });
    bonsai.logs.unshift({
        id: uid(),
        at: now,
        text: `${suitability.label}（危険度${suitability.risk.score}）で作業した。${suitability.mentorAdvice} 結果はゲーム内約${Math.ceil((response.dueAt - now) / DAY * 10)}日後に確定する。`
    });
    return {
        game: next,
        applied: true,
        message: suitability.status === 'danger' ? '師匠の強い反対を承知して、危険な作業を記録しました。' : `${suitability.label}として作業を記録しました。`
    };
}
function advanceSeasonalGame(game, now = Date.now()) {
    const copy = structuredClone(game);
    let changed = false;
    for (const bonsai of copy.bonsai) {
        const seasonal = loadSeasonalState(bonsai);
        let seasonalChanged = false;
        for (const response of seasonal.responses) {
            if (response.completedAt || now < response.dueAt)
                continue;
            response.completedAt = now;
            seasonalChanged = true;
            changed = true;
            if (bonsai.lifeStatus === 'dead')
                continue;
            const state = bonsai.craft.sites[response.siteId];
            const definition = craft_v3_1.PRUNING_SITES.find(item => item.id === response.siteId);
            if (!state || !definition)
                continue;
            if (response.outcome === 'death') {
                (0, model_1.markBonsaiDead)(bonsai, `${definition.label}への危険な剪定後の全身衰弱`, now);
                bonsai.logs.unshift({ id: uid(), at: now, text: `${definition.label}の結果待ち期間に全身の樹勢が尽きた。` });
                continue;
            }
            state.budCount = clamp(Math.round(state.budCount + response.budDelta), 0, 12);
            state.foliage = clamp(state.foliage + response.foliageDelta);
            state.vigor = clamp(state.vigor + response.vigorDelta);
            state.health = clamp(state.health + response.healthDelta);
            state.openness = clamp(state.openness + response.opennessDelta);
            state.scar = clamp(state.scar + response.scarDelta);
            const part = bonsai.parts[definition.parentPartId];
            if (response.outcome === 'disease') {
                part.disease = diseaseFor(response);
                part.health = clamp(part.health - 8);
                bonsai.vitality = clamp(bonsai.vitality - 3);
            }
            else if (response.outcome === 'pest') {
                part.pest = pestFor(response);
                part.health = clamp(part.health - 5);
                bonsai.vitality = clamp(bonsai.vitality - 1.5);
            }
            else if (response.outcome === 'dieback') {
                part.health = clamp(part.health - 12);
                part.foliage = clamp(part.foliage - 14);
                bonsai.vitality = clamp(bonsai.vitality - 6);
            }
            syncParentPart(bonsai, response.siteId);
            bonsai.logs.unshift({ id: uid(), at: now, text: responseCompletionText(response) });
        }
        seasonal.lastAdvancedAt = now;
        if (seasonalChanged)
            saveSeasonalState(bonsai.id, seasonal);
    }
    return { game: copy, changed };
}
function loadSeasonalState(bonsai) {
    const fallback = { version: 5, responses: [], lastAdvancedAt: Date.now() };
    try {
        if (typeof localStorage === 'undefined')
            return fallback;
        const raw = JSON.parse(localStorage.getItem(`${KEY_PREFIX}${bonsai.id}`) || 'null');
        if (!raw || !Array.isArray(raw.responses))
            return fallback;
        const responses = raw.responses.map(normalizeResponse).filter((item) => Boolean(item)).slice(0, 80);
        return { version: 5, responses, lastAdvancedAt: finite(raw.lastAdvancedAt, Date.now()) };
    }
    catch {
        return fallback;
    }
}
function saveSeasonalState(bonsaiId, state) {
    try {
        if (typeof localStorage !== 'undefined')
            localStorage.setItem(`${KEY_PREFIX}${bonsaiId}`, JSON.stringify({ ...state, version: 5 }));
    }
    catch {
        // The main save remains playable when private mode blocks optional response history.
    }
}
function responseLabel(response) {
    return {
        secondaryBudBreak: '二番芽の芽吹き待ち',
        budBalance: '残した芽の伸長待ち',
        interiorRecovery: '懐の回復待ち',
        backBud: '戻り芽の確認待ち',
        woundCallus: '切り口の安定待ち'
    }[response.kind];
}
function blocked(label, reasons, risk) {
    return { status: 'blocked', label, reasons, quality: 0, mentorAdvice: '存在しない部位や成立しない技法は実行できない。', risk };
}
function riskForecast(score, technique) {
    const heavy = technique === 'removeBranch' ? 8 : technique === 'tipCutback' ? 5 : technique === 'innerTwigThin' ? 3 : 0;
    return {
        score: Math.round(clamp(score)),
        immediateVitalityLoss: round1(Math.max(0, (score - 20) / 14) + heavy * .18),
        immediateHealthLoss: round1(Math.max(0, (score - 16) / 12) + heavy * .25),
        immediateVigorLoss: round1(Math.max(0, (score - 12) / 10) + heavy * .22),
        diseaseChance: Math.round(clamp((score - 22) * .62 + heavy * .4, 0, 62)),
        pestChance: Math.round(clamp((score - 28) * .48 + heavy * .25, 0, 48)),
        diebackChance: Math.round(clamp((score - 36) * .70 + heavy * .5, 0, 68)),
        deathChance: Math.round(clamp((score - 66) * .42 + (technique === 'removeBranch' ? 3 : 0), 0, 26)),
        growthPenalty: Math.round(clamp((score - 15) * .72, 0, 68))
    };
}
function adviceFor(status, score, technique, vitality) {
    if (status === 'ideal')
        return '師匠：今なら切った後の芽と傷まで読める。残す芽を決めてから刃を入れろ。';
    if (status === 'caution')
        return '師匠：切ることはできる。ただし完成を急がず、作業後の水と日照を慎重に見ろ。';
    if (vitality < 35)
        return '師匠：今は見送れ。切ることはできるが、この木そのものを失う危険がある。';
    if (technique === 'removeBranch')
        return `師匠：危険度${Math.round(score)}。その枝だけでなく、生きる力まで切る覚悟があるか。`;
    return `師匠：危険度${Math.round(score)}。私は反対だ。実行するなら芽吹き不発と病害虫まで引き受けろ。`;
}
function createResponse(bonsai, siteId, technique, suitability, now) {
    const rule = RULES[bonsai.species][technique];
    const outcome = chooseOutcome(bonsai, siteId, technique, suitability.risk, now);
    const values = responseValues(technique, suitability.quality, outcome);
    return {
        id: uid(), siteId, technique, kind: values.kind,
        startedAt: now, dueAt: now + inGameDaysToMs(rule.responseDays), quality: suitability.quality,
        riskScore: suitability.risk.score, outcome, mentorAdvice: suitability.mentorAdvice,
        diseaseChance: suitability.risk.diseaseChance, pestChance: suitability.risk.pestChance,
        diebackChance: suitability.risk.diebackChance, deathChance: suitability.risk.deathChance,
        growthPenalty: suitability.risk.growthPenalty,
        budDelta: values.budDelta, foliageDelta: values.foliageDelta,
        vigorDelta: values.vigorDelta, healthDelta: values.healthDelta,
        opennessDelta: values.opennessDelta, scarDelta: values.scarDelta
    };
}
function chooseOutcome(bonsai, siteId, technique, risk, now) {
    const seed = `${bonsai.id}:${siteId}:${technique}:${now}`;
    if (roll(seed, 'death') < risk.deathChance)
        return 'death';
    if (roll(seed, 'dieback') < risk.diebackChance)
        return 'dieback';
    if (roll(seed, 'disease') < risk.diseaseChance)
        return 'disease';
    if (roll(seed, 'pest') < risk.pestChance)
        return 'pest';
    if (risk.score >= 38 && roll(seed, 'weak') < Math.min(82, risk.score))
        return 'weak';
    return 'healthy';
}
function responseValues(technique, quality, outcome) {
    const strong = quality >= .78;
    const adequate = quality >= .55;
    const base = {
        budPinch: { kind: 'secondaryBudBreak', budDelta: strong ? 3 : adequate ? 2 : 1, foliageDelta: strong ? 6 : 3, vigorDelta: 1, healthDelta: 1, opennessDelta: 0, scarDelta: 0 },
        budSelect: { kind: 'budBalance', budDelta: 0, foliageDelta: strong ? 4 : 2, vigorDelta: 2, healthDelta: 1, opennessDelta: 1, scarDelta: 0 },
        needleThin: { kind: 'interiorRecovery', budDelta: strong ? 1 : 0, foliageDelta: 2, vigorDelta: 4, healthDelta: 3, opennessDelta: 2, scarDelta: 0 },
        tipCutback: { kind: 'backBud', budDelta: strong ? 2 : adequate ? 1 : 0, foliageDelta: strong ? 4 : 1, vigorDelta: 1, healthDelta: 1, opennessDelta: 0, scarDelta: 0 },
        innerTwigThin: { kind: 'interiorRecovery', budDelta: strong ? 1 : 0, foliageDelta: 1, vigorDelta: 3, healthDelta: 4, opennessDelta: 2, scarDelta: 0 },
        removeBranch: { kind: 'woundCallus', budDelta: 0, foliageDelta: 0, vigorDelta: 0, healthDelta: 1, opennessDelta: 0, scarDelta: strong ? -2 : -1 }
    }[technique];
    if (outcome === 'healthy')
        return base;
    if (outcome === 'weak')
        return { ...base, budDelta: Math.min(0, base.budDelta - 1), foliageDelta: Math.min(0, base.foliageDelta - 2), vigorDelta: -3, healthDelta: -2, scarDelta: Math.max(0, base.scarDelta) };
    if (outcome === 'disease')
        return { ...base, budDelta: 0, foliageDelta: -4, vigorDelta: -5, healthDelta: -6, scarDelta: Math.max(1, base.scarDelta) };
    if (outcome === 'pest')
        return { ...base, budDelta: 0, foliageDelta: -3, vigorDelta: -3, healthDelta: -3, scarDelta: Math.max(0, base.scarDelta) };
    if (outcome === 'dieback')
        return { ...base, budDelta: -2, foliageDelta: -16, vigorDelta: -18, healthDelta: -18, scarDelta: 5 };
    return { ...base, budDelta: 0, foliageDelta: 0, vigorDelta: 0, healthDelta: 0, opennessDelta: 0, scarDelta: 0 };
}
function normalizeResponse(value) {
    if (!value || typeof value !== 'object')
        return null;
    const item = value;
    if (!craft_v3_1.PRUNING_SITES.some(site => site.id === item.siteId))
        return null;
    if (!['budPinch', 'budSelect', 'needleThin', 'tipCutback', 'innerTwigThin', 'removeBranch'].includes(String(item.technique)))
        return null;
    if (!['secondaryBudBreak', 'budBalance', 'interiorRecovery', 'backBud', 'woundCallus'].includes(String(item.kind)))
        return null;
    const outcome = ['healthy', 'weak', 'disease', 'pest', 'dieback', 'death'].includes(String(item.outcome)) ? item.outcome : 'healthy';
    return {
        id: String(item.id || uid()), siteId: item.siteId,
        technique: item.technique, kind: item.kind,
        startedAt: finite(item.startedAt, Date.now()), dueAt: finite(item.dueAt, Date.now()),
        quality: clamp(finite(item.quality, .6), 0, 1),
        riskScore: clamp(finite(item.riskScore, 0)), outcome,
        mentorAdvice: String(item.mentorAdvice || ''),
        diseaseChance: clamp(finite(item.diseaseChance, 0)), pestChance: clamp(finite(item.pestChance, 0)),
        diebackChance: clamp(finite(item.diebackChance, 0)), deathChance: clamp(finite(item.deathChance, 0)),
        growthPenalty: clamp(finite(item.growthPenalty, 0)),
        budDelta: finite(item.budDelta, 0), foliageDelta: finite(item.foliageDelta, 0),
        vigorDelta: finite(item.vigorDelta, 0), healthDelta: finite(item.healthDelta, 0),
        opennessDelta: finite(item.opennessDelta, 0), scarDelta: finite(item.scarDelta, 0),
        completedAt: item.completedAt ? finite(item.completedAt, 0) : undefined
    };
}
function syncParentPart(bonsai, siteId) {
    const definition = craft_v3_1.PRUNING_SITES.find(item => item.id === siteId);
    if (!definition)
        return;
    const definitions = craft_v3_1.PRUNING_SITES.filter(item => item.parentPartId === definition.parentPartId);
    const states = definitions.map(item => bonsai.craft.sites[item.id]);
    const living = states.filter(item => !item.removed);
    const part = bonsai.parts[definition.parentPartId];
    if (!part)
        return;
    part.foliage = living.length ? clamp(living.reduce((sum, item) => sum + item.foliage, 0) / living.length) : 0;
    part.health = living.length ? clamp(living.reduce((sum, item) => sum + item.health, 0) / living.length) : 0;
    part.scar = clamp(Math.max(part.scar, ...states.map(item => item.scar)));
}
function responseCompletionText(response) {
    const site = craft_v3_1.PRUNING_SITES.find(item => item.id === response.siteId)?.label ?? response.siteId;
    const outcomeText = {
        healthy: '芽吹きと回復が予定どおり現れた',
        weak: '芽吹きが弱く、生育が鈍った',
        disease: '作業後の衰弱から病徴が現れた',
        pest: '弱った枝へ害虫が発生した',
        dieback: '枝先の枯れ込みが進んだ',
        death: '全身の樹勢が尽きた'
    };
    return `${site}：${outcomeText[response.outcome]}。芽${signed(response.budDelta)}、葉量${signed(response.foliageDelta)}。`;
}
function diseaseFor(response) {
    return deterministicHash(`${response.id}:disease`) % 2 ? 'needleBlight' : 'sootyMold';
}
function pestFor(response) {
    return ['aphid', 'spiderMite', 'scale'][deterministicHash(`${response.id}:pest`) % 3];
}
function ancestorRemoved(bonsai, siteId) {
    let parent = craft_v3_1.PRUNING_SITES.find(item => item.id === siteId)?.parentId;
    while (parent) {
        if (bonsai.craft.sites[parent]?.removed)
            return true;
        parent = craft_v3_1.PRUNING_SITES.find(item => item.id === parent)?.parentId;
    }
    return false;
}
function techniqueAllowedForRole(role, technique) {
    if (technique === 'budPinch' || technique === 'budSelect')
        return ['leader', 'tip', 'foliagePad', 'interior'].includes(role);
    if (technique === 'needleThin')
        return ['leader', 'tip', 'foliagePad', 'interior', 'segment'].includes(role);
    if (technique === 'innerTwigThin')
        return ['interior', 'segment', 'foliagePad', 'defectBranch'].includes(role);
    if (technique === 'removeBranch')
        return ['branchBase', 'segment', 'defectBranch'].includes(role);
    return true;
}
function phenologyPhase(species, day) {
    if (species === 'pine') {
        if (day <= 50 || day >= 316)
            return '休眠・構造確認期';
        if (day <= 105)
            return '芽動き・ロウソク芽伸長前';
        if (day <= 180)
            return 'ロウソク芽伸長・芽切り期';
        if (day <= 245)
            return '二番芽伸長・硬化期';
        return '秋の芽整理・古葉取り期';
    }
    if (species === 'maple') {
        if (day <= 55 || day >= 321)
            return '落葉休眠・枝筋確認期';
        if (day <= 110)
            return '芽吹き・新梢伸長期';
        if (day <= 190)
            return '葉固まり・切り戻し期';
        if (day <= 260)
            return '夏の充実期';
        return '紅葉・落葉準備期';
    }
    if (day <= 60 || day >= 321)
        return '休眠・樹形確認期';
    if (day <= 130)
        return '蕾・開花準備期';
    if (day <= 180)
        return '開花・花後剪定期';
    if (day <= 250)
        return '新梢伸長・枝作り期';
    return '枝の充実・花芽形成期';
}
function inGameDayOfYear(bonsai, now) {
    const base = realDayOfYear(bonsai.bornAt);
    const elapsed = Math.max(0, (now - bonsai.bornAt) / DAY * 10);
    return Math.floor((base + elapsed) % 365);
}
function realDayOfYear(timestamp) {
    const date = new Date(timestamp);
    const start = new Date(date.getFullYear(), 0, 1);
    return Math.max(0, Math.floor((date.getTime() - start.getTime()) / DAY));
}
function inRanges(day, ranges) {
    return ranges.some(range => range.start <= range.end
        ? day >= range.start && day <= range.end
        : day >= range.start || day <= range.end);
}
function inGameDaysToMs(days) {
    return days * DAY / 10;
}
function signed(value) {
    const rounded = Math.round(value);
    return `${rounded >= 0 ? '+' : ''}${rounded}`;
}
function finite(value, fallback) {
    return Number.isFinite(Number(value)) ? Number(value) : fallback;
}
function clamp(value, min = 0, max = 100) {
    return Math.max(min, Math.min(max, value));
}
function round1(value) {
    return Math.round(value * 10) / 10;
}
function roll(seed, channel) {
    return deterministicHash(`${seed}:${channel}`) % 100;
}
function deterministicHash(value) {
    let result = 2166136261;
    for (let index = 0; index < value.length; index += 1) {
        result ^= value.charCodeAt(index);
        result = Math.imul(result, 16777619);
    }
    return result >>> 0;
}
function uid() {
    return typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}
