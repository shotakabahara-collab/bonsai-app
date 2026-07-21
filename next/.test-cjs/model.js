"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PARTS = exports.PEOPLE = exports.POTS = exports.SPECIES = void 0;
exports.createParts = createParts;
exports.createBonsai = createBonsai;
exports.createGame = createGame;
exports.migrateLegacy = migrateLegacy;
exports.normalizeGame = normalizeGame;
exports.activeBonsai = activeBonsai;
exports.titleForReputation = titleForReputation;
exports.unlockedSlots = unlockedSlots;
exports.inGameAgeYears = inGameAgeYears;
exports.seasonIndex = seasonIndex;
exports.metrics = metrics;
exports.visualSignature = visualSignature;
exports.weekKey = weekKey;
exports.exhibitionScore = exhibitionScore;
exports.advanceTime = advanceTime;
exports.addAftercareRisk = addAftercareRisk;
exports.markBonsaiDead = markBonsaiDead;
exports.evaluateBonsaiDeath = evaluateBonsaiDeath;
exports.updateActiveBonsai = updateActiveBonsai;
exports.waterBonsai = waterBonsai;
exports.prunePart = prunePart;
exports.wirePart = wirePart;
exports.removeWire = removeWire;
exports.treatPart = treatPart;
exports.createJin = createJin;
exports.createShari = createShari;
exports.buyOrSelectPot = buyOrSelectPot;
exports.enterWeeklyShow = enterWeeklyShow;
exports.addMemorial = addMemorial;
exports.addBonsai = addBonsai;
exports.diseaseName = diseaseName;
exports.pestName = pestName;
const craft_v3_1 = require("./craft-v3");
exports.SPECIES = {
    pine: {
        id: 'pine', name: '黒松', subtitle: '力強い幹と葉棚を作る王道の松柏', emoji: '🌲',
        waterDecayPerHour: 1.7, seasonAffinity: [88, 82, 90, 94]
    },
    maple: {
        id: 'maple', name: '山もみじ', subtitle: '芽吹き・青葉・紅葉・寒樹を味わう', emoji: '🍁',
        waterDecayPerHour: 2.25, seasonAffinity: [96, 80, 100, 86]
    },
    azalea: {
        id: 'azalea', name: '皐月', subtitle: '蕾から満開まで花姿を仕立てる', emoji: '🌸',
        waterDecayPerHour: 2.05, seasonAffinity: [100, 88, 76, 70]
    }
};
exports.POTS = {
    starter: { id: 'starter', name: '素焼き入門鉢', price: 0, prestige: 70, tone: '#8d6043', description: '通気性が高く、若木の育成に向く。' },
    blue: { id: 'blue', name: '青嵐釉楕円鉢', price: 1800, prestige: 86, tone: '#477b7b', description: '柔らかな釉調。花物や雑木に映える。' },
    black: { id: 'black', name: '黒土長方鉢', price: 3400, prestige: 93, tone: '#302b28', description: '松柏の力強さを受け止める王道鉢。' },
    moon: { id: 'moon', name: '月光白釉鉢', price: 7200, prestige: 96, tone: '#b5b0a3', description: '余白を明るく見せる上級者向けの浅鉢。' },
    old: { id: 'old', name: '古渡・琥珀鉢', price: 15000, prestige: 99, tone: '#895433', description: '経年の景色を持つ最高級の古鉢。' }
};
exports.PEOPLE = [
    { id: 'gensai', name: '榊 玄斎', role: '古典盆栽・宗匠', emoji: '👴', quote: '枝を切るな。迷いを切れ。' },
    { id: 'shino', name: '水城 志乃', role: '季節盆栽作家', emoji: '👩', quote: 'どこで咲かせるかが作品になる。' },
    { id: 'ren', name: '橘 蓮', role: '現代盆栽アーティスト', emoji: '🧑', quote: '作品は、育てた判断の積み重ねだ。' },
    { id: 'gakuto', name: '岩城 岳斗', role: '松柏専門・若手筆頭', emoji: '👨', quote: '派手さはいらん。幹を見ろ。' },
    { id: 'soichiro', name: '三嶋 宗一郎', role: '全国樹藝会 審査長', emoji: '🧓', quote: '十年後にも立つ姿か。' },
    { id: 'reiji', name: '牧村 玲二', role: '樹藝評論家', emoji: '🧔', quote: '技術はある。だが景色がない。' },
    { id: 'takashi', name: '東雲 崇', role: '名木コレクター', emoji: '🤵', quote: '手放せない理由を買いたい。' }
];
exports.PARTS = [
    { id: 'apex', name: '頂部', short: '頂', x: 50, y: 22 },
    { id: 'firstLeft', name: '第一枝', short: '一', x: 29, y: 46 },
    { id: 'secondRight', name: '第二枝', short: '二', x: 72, y: 40 },
    { id: 'thirdLeft', name: '第三枝', short: '三', x: 32, y: 64 },
    { id: 'back', name: '背枝', short: '背', x: 61, y: 55 },
    { id: 'front', name: '前枝', short: '前', x: 52, y: 67 },
    { id: 'trunk', name: '主幹', short: '幹', x: 51, y: 58 },
    { id: 'roots', name: '根張り・根域', short: '根', x: 50, y: 82 }
];
const PART_DEFAULTS = {
    apex: 64, firstLeft: 78, secondRight: 72, thirdLeft: 66,
    back: 54, front: 46, trunk: 0, roots: 0
};
const uuid = () => typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
const clamp = (value, min = 0, max = 100) => Math.max(min, Math.min(max, value));
const finite = (value, fallback) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const asObject = (value) => value && typeof value === 'object' && !Array.isArray(value) ? value : {};
function createParts() {
    return Object.fromEntries(exports.PARTS.map(part => [part.id, {
            id: part.id,
            foliage: PART_DEFAULTS[part.id],
            health: 92,
            pruneLevel: 0,
            scar: 0
        }]));
}
function createBonsai(species, name) {
    const now = Date.now();
    return {
        id: uuid(),
        name: name?.trim() || `${exports.SPECIES[species].name}・若樹`,
        species,
        bornAt: now,
        lastUpdatedAt: now,
        water: 82,
        vitality: 88,
        stress: 2,
        potId: 'starter',
        parts: createParts(),
        craft: (0, craft_v3_1.createCraftState)(),
        awards: [],
        memorials: [],
        logs: [{ id: uuid(), at: now, text: `${exports.SPECIES[species].name}を迎えた。` }],
        lastEventSlot: Math.floor(now / 43_200_000),
        lifeStatus: 'living',
        aftercareRisks: []
    };
}
function createGame() {
    return {
        version: 2,
        started: false,
        playerName: 'あなた',
        mentorId: 'gensai',
        money: 5000,
        reputation: 0,
        ownedPots: ['starter'],
        bonsai: [],
        activeBonsaiId: '',
        lastShowWeek: '',
        createdAt: Date.now()
    };
}
function migrateParts(raw) {
    const source = asObject(raw);
    const defaults = createParts();
    for (const part of exports.PARTS) {
        const legacy = asObject(source[part.id] ?? source[legacyPartKey(part.id)]);
        const wireSource = asObject(legacy.wire);
        defaults[part.id] = {
            ...defaults[part.id],
            foliage: clamp(finite(legacy.foliage, defaults[part.id].foliage)),
            health: clamp(finite(legacy.health, defaults[part.id].health)),
            pruneLevel: clamp(Math.round(finite(legacy.pruneLevel ?? legacy.prune, 0)), 0, 3),
            scar: clamp(finite(legacy.scar, 0)),
            trainedDirection: isWireDirection(legacy.trainedDirection) ? legacy.trainedDirection : undefined,
            shapeRetention: legacy.shapeRetention === undefined ? undefined : clamp(finite(legacy.shapeRetention, 0)),
            wireRemovedAt: finite(legacy.wireRemovedAt, 0) || undefined,
            wireHistory: Array.isArray(legacy.wireHistory) ? legacy.wireHistory.map((value, index) => normalizeWireOutcome(value, index)).filter((value) => Boolean(value)).slice(0, 20) : [],
            wire: typeof legacy.wire === 'string'
                ? { intensity: legacy.wire === 'strong' ? 'strong' : 'light', direction: 'down', appliedAt: Date.now() }
                : wireSource.intensity
                    ? {
                        intensity: wireSource.intensity === 'strong' ? 'strong' : 'light',
                        direction: isWireDirection(wireSource.direction) ? wireSource.direction : 'down',
                        appliedAt: finite(wireSource.appliedAt, Date.now()),
                        readyAt: finite(wireSource.readyAt, 0) || undefined,
                        progress: wireSource.progress === undefined ? undefined : clamp(finite(wireSource.progress, 0)),
                        status: ['training', 'ready', 'overdue'].includes(String(wireSource.status)) ? wireSource.status : undefined,
                        lastRiskAt: finite(wireSource.lastRiskAt, 0) || undefined
                    }
                    : undefined,
            disease: isDisease(legacy.disease) ? legacy.disease : mapLegacyDisease(legacy.disease),
            pest: isPest(legacy.pest) ? legacy.pest : mapLegacyPest(legacy.pest),
            deadwood: legacy.deadwood === true || legacy.deadwood === 'jin'
        };
    }
    return defaults;
}
function legacyPartKey(id) {
    return { firstLeft: 'first_left', secondRight: 'second_right', thirdLeft: 'third_left', back: 'back_branch', front: 'front_branch' }[id] ?? id;
}
function isWireDirection(value) {
    return ['down', 'up', 'left', 'right', 'front', 'back'].includes(String(value));
}
function isDisease(value) {
    return ['needleBlight', 'sootyMold', 'rootRot'].includes(String(value));
}
function isPest(value) {
    return ['aphid', 'spiderMite', 'scale'].includes(String(value));
}
function mapLegacyDisease(value) {
    return { needle_blight: 'needleBlight', sooty_mold: 'sootyMold', root_rot: 'rootRot' }[String(value)];
}
function mapLegacyPest(value) {
    return { aphid: 'aphid', spider_mite: 'spiderMite', scale: 'scale' }[String(value)];
}
function normalizeWireOutcome(value, index = 0) {
    const source = asObject(value);
    if (!['interrupted', 'settled', 'bitten'].includes(String(source.result)))
        return null;
    return {
        id: String(source.id || `wire-outcome-${index}`),
        at: finite(source.at, Date.now()),
        intensity: source.intensity === 'strong' ? 'strong' : 'light',
        direction: isWireDirection(source.direction) ? source.direction : 'down',
        result: source.result,
        retention: clamp(finite(source.retention, 0)),
        scarAdded: clamp(finite(source.scarAdded, 0))
    };
}
function normalizeAftercareRisks(value) {
    if (!Array.isArray(value))
        return [];
    return value.map((item, index) => {
        const source = asObject(item);
        const createdAt = finite(source.createdAt, Date.now());
        return {
            id: String(source.id || `aftercare-${index}`),
            source: String(source.source || '作業後リスク'),
            createdAt,
            expiresAt: finite(source.expiresAt, createdAt),
            diseaseBonus: clamp(finite(source.diseaseBonus, 0)),
            pestBonus: clamp(finite(source.pestBonus, 0)),
            growthPenalty: clamp(finite(source.growthPenalty, 0)),
            diebackBonus: clamp(finite(source.diebackBonus, 0)),
            deathBonus: clamp(finite(source.deathBonus, 0))
        };
    }).filter(item => item.expiresAt > 0).slice(-24);
}
function migrateLegacy(raw) {
    const source = asObject(raw);
    if (source.version === 2 && Array.isArray(source.bonsai)) {
        return normalizeGame(source);
    }
    const game = createGame();
    const aliases = {
        pine: 'pine', kuromatsu: 'pine', '黒松': 'pine',
        maple: 'maple', yamamomiji: 'maple', '山もみじ': 'maple',
        azalea: 'azalea', satsuki: 'azalea', '皐月': 'azalea'
    };
    const potAliases = {
        starter: 'starter', pot01: 'starter', blue: 'blue', pot03: 'blue',
        black: 'black', pot02: 'black', moon: 'moon', pot04: 'moon', old: 'old', pot05: 'old'
    };
    const species = aliases[String(source.sp ?? source.species)] ?? 'pine';
    const potId = potAliases[String(source.pot ?? source.potId)] ?? 'starter';
    const now = Date.now();
    const advanced = asObject(source.advanced);
    const bonsai = {
        ...createBonsai(species, String(source.tree ?? source.name ?? '')),
        bornAt: finite(source.born ?? source.bornAt, now),
        lastUpdatedAt: finite(source.last ?? source.lastUpdatedAt, now),
        water: clamp(finite(source.water, 80)),
        vitality: clamp(finite(source.vit ?? source.vitality, 84)),
        stress: clamp(finite(source.stress, 2), 0, 1000),
        potId,
        parts: migrateParts(advanced.parts),
        craft: (0, craft_v3_1.normalizeCraftState)(advanced.craft, migrateParts(advanced.parts), advanced.shari),
        shari: asObject(advanced.shari).level
            ? {
                side: asObject(advanced.shari).side === 'right' ? 'right' : 'left',
                level: clamp(Math.round(finite(asObject(advanced.shari).level, 1)), 1, 3),
                createdAt: finite(asObject(advanced.shari).createdAt, now)
            }
            : undefined,
        awards: Array.isArray(source.awards) ? source.awards.map((item, index) => migrateAward(item, index, potId)) : [],
        lifeStatus: advanced.lifeStatus === 'dead' ? 'dead' : 'living',
        diedAt: finite(advanced.diedAt, 0) || undefined,
        deathCause: advanced.deathCause ? String(advanced.deathCause) : undefined,
        aftercareRisks: normalizeAftercareRisks(advanced.aftercareRisks),
        logs: Array.isArray(source.log) ? source.log.slice(0, 120).map((item, index) => ({
            id: `legacy-log-${index}`,
            at: finite(asObject(item).at, now - index),
            text: typeof item === 'string' ? item : String(asObject(item).x ?? asObject(item).text ?? '')
        })).filter(item => item.text) : []
    };
    game.started = source.started === true;
    game.playerName = String(source.name ?? source.playerName ?? 'あなた').slice(0, 40);
    game.mentorId = exports.PEOPLE[Math.max(0, Math.min(exports.PEOPLE.length - 1, Math.trunc(finite(source.mentor, 0))))]?.id ?? 'gensai';
    game.money = Math.max(0, Math.round(finite(source.money, 5000)));
    game.reputation = Math.max(0, Math.round(finite(source.rep ?? source.reputation, 0)));
    game.ownedPots = Array.from(new Set([
        'starter',
        ...(Array.isArray(source.owned) ? source.owned : []).map(id => potAliases[String(id)]).filter(Boolean),
        potId
    ]));
    game.bonsai = [bonsai];
    game.activeBonsaiId = bonsai.id;
    game.lastShowWeek = String(source.lastWeek ?? '');
    return normalizeGame(game);
}
function migrateAward(item, index, fallbackPot) {
    const value = asObject(item);
    return {
        id: String(value.id ?? `legacy-award-${index}`),
        at: finite(value.at, Date.now() - index),
        title: String(value.award ?? value.title ?? '受賞'),
        score: clamp(finite(value.score, 70), 0, 100),
        rank: Math.max(1, Math.round(finite(value.rank, 1))),
        fieldSize: Math.max(1, Math.round(finite(value.fieldSize, 7))),
        potId: Object.keys(exports.POTS).includes(value.potId) ? value.potId : fallbackPot,
        visualSignature: String(value.visualSignature ?? 'legacy')
    };
}
function normalizeGame(input) {
    const base = createGame();
    const source = input && typeof input === 'object' ? input : base;
    const bonsai = Array.isArray(source.bonsai) ? source.bonsai.slice(0, 3).map(item => normalizeBonsai(item)) : [];
    const active = bonsai.some(item => item.id === source.activeBonsaiId) ? source.activeBonsaiId : bonsai[0]?.id ?? '';
    const owned = Array.from(new Set((Array.isArray(source.ownedPots) ? source.ownedPots : ['starter']).filter((id) => id in exports.POTS)));
    if (!owned.includes('starter'))
        owned.unshift('starter');
    return {
        ...base,
        ...source,
        version: 2,
        started: source.started === true,
        playerName: String(source.playerName || 'あなた').slice(0, 40),
        mentorId: exports.PEOPLE.some(person => person.id === source.mentorId) ? source.mentorId : 'gensai',
        money: Math.max(0, Math.round(finite(source.money, 5000))),
        reputation: Math.max(0, Math.round(finite(source.reputation, 0))),
        ownedPots: owned,
        bonsai,
        activeBonsaiId: active,
        lastShowWeek: String(source.lastShowWeek ?? ''),
        createdAt: finite(source.createdAt, Date.now())
    };
}
function normalizeBonsai(input) {
    const species = input?.species in exports.SPECIES ? input.species : 'pine';
    const fallback = createBonsai(species, input?.name);
    return {
        ...fallback,
        ...input,
        name: String(input?.name || fallback.name).slice(0, 80),
        species,
        bornAt: finite(input?.bornAt, fallback.bornAt),
        lastUpdatedAt: finite(input?.lastUpdatedAt, Date.now()),
        water: clamp(finite(input?.water, 80)),
        vitality: clamp(finite(input?.vitality, 84)),
        stress: clamp(finite(input?.stress, 2), 0, 1000),
        potId: input?.potId in exports.POTS ? input.potId : 'starter',
        parts: migrateParts(input?.parts),
        craft: (0, craft_v3_1.normalizeCraftState)(input?.craft, migrateParts(input?.parts), input?.shari),
        awards: Array.isArray(input?.awards) ? input.awards : [],
        memorials: Array.isArray(input?.memorials) ? input.memorials : [],
        logs: Array.isArray(input?.logs) ? input.logs : [],
        lifeStatus: input?.lifeStatus === 'dead' ? 'dead' : 'living',
        diedAt: finite(input?.diedAt, 0) || undefined,
        deathCause: input?.deathCause ? String(input.deathCause) : undefined,
        aftercareRisks: normalizeAftercareRisks(input?.aftercareRisks),
        lastEventSlot: Math.floor(finite(input?.lastEventSlot, Date.now() / 43_200_000))
    };
}
function activeBonsai(game) {
    return game.bonsai.find(item => item.id === game.activeBonsaiId) ?? game.bonsai[0];
}
function titleForReputation(reputation) {
    if (reputation >= 720)
        return '名匠';
    if (reputation >= 450)
        return '盆栽宗匠';
    if (reputation >= 250)
        return '盆栽作家';
    if (reputation >= 120)
        return '一級盆栽師';
    if (reputation >= 60)
        return '若手盆栽師';
    return '若木の友';
}
function unlockedSlots(reputation) {
    return reputation >= 300 ? 3 : reputation >= 120 ? 2 : 1;
}
function inGameAgeYears(bonsai, now = Date.now()) {
    return Math.max(0, ((now - bonsai.bornAt) / 86_400_000) * 10 / 365);
}
function seasonIndex(bonsai, now = Date.now()) {
    const inGameDays = Math.max(0, (now - bonsai.bornAt) / 86_400_000 * 10);
    return Math.floor((inGameDays % 360) / 90);
}
function metrics(bonsai) {
    const livingParts = exports.PARTS.filter(part => !['trunk', 'roots'].includes(part.id));
    const health = livingParts.reduce((sum, part) => sum + bonsai.parts[part.id].health, 0) / livingParts.length;
    const foliage = livingParts.reduce((sum, part) => sum + bonsai.parts[part.id].foliage, 0) / livingParts.length;
    const pruning = livingParts.reduce((sum, part) => sum + bonsai.parts[part.id].pruneLevel, 0) / livingParts.length;
    const retainedShape = livingParts.map(part => bonsai.parts[part.id].shapeRetention ?? 0).reduce((sum, value) => sum + value, 0) / livingParts.length;
    const precision = (0, craft_v3_1.precisionStructureScore)(bonsai);
    const artistry = clamp(precision * .68 + pruning * 6 + retainedShape * .12 + Math.min(12, inGameAgeYears(bonsai) * 2));
    return { water: clamp(bonsai.water), vitality: clamp(bonsai.vitality), artistry, health: clamp(health) };
}
function visualSignature(bonsai) {
    const parts = exports.PARTS.map(({ id }) => {
        const part = bonsai.parts[id];
        return `${id}:${part.foliage.toFixed(0)}:${part.health.toFixed(0)}:${part.pruneLevel}:${part.wire?.intensity ?? '-'}:${part.wire?.direction ?? '-'}:${part.disease ?? '-'}:${part.pest ?? '-'}:${part.deadwood ? 'jin' : '-'}`;
    }).join('|');
    return `${bonsai.species}:${bonsai.potId}:${bonsai.lifeStatus}:${bonsai.water.toFixed(0)}:${bonsai.vitality.toFixed(0)}:${bonsai.shari?.side ?? '-'}:${bonsai.shari?.level ?? 0}|${parts}|risk:${bonsai.aftercareRisks.length}|craft:${(0, craft_v3_1.craftSignature)(bonsai)}`;
}
function weekKey(date = new Date()) {
    const first = new Date(date.getFullYear(), 0, 1);
    const day = Math.floor((date.getTime() - first.getTime()) / 86_400_000);
    return `${date.getFullYear()}-${Math.ceil((day + first.getDay() + 1) / 7)}`;
}
const NATIONAL_POT_COMPATIBILITY = {
    pine: { starter: 72, blue: 58, black: 98, moon: 54, old: 95 },
    maple: { starter: 74, blue: 94, black: 68, moon: 92, old: 84 },
    azalea: { starter: 72, blue: 96, black: 62, moon: 94, old: 80 }
};
const average = (values) => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
function exhibitionScore(bonsai) {
    const livingIds = exports.PARTS.filter(part => !['trunk', 'roots'].includes(part.id)).map(part => part.id);
    const living = livingIds.map(id => bonsai.parts[id]);
    const allParts = exports.PARTS.map(part => bonsai.parts[part.id]);
    const health = average(living.map(part => part.health));
    const foliage = average(living.map(part => part.foliage));
    const foliageValues = living.map(part => part.foliage);
    const spread = Math.max(...foliageValues) - Math.min(...foliageValues);
    const pruning = average(living.map(part => part.pruneLevel));
    const age = inGameAgeYears(bonsai);
    const diseaseCount = allParts.filter(part => part.disease).length;
    const pestCount = allParts.filter(part => part.pest).length;
    const rootRot = bonsai.parts.roots.disease === 'rootRot' ? 1 : 0;
    const visibleWire = living.filter(part => part.wire).length;
    const averageScar = average(allParts.map(part => part.scar));
    const heavyCuts = living.filter(part => part.pruneLevel === 3).length;
    const bareLivingBranches = living.filter(part => !part.deadwood && part.foliage < 18).length;
    const deadwood = living.filter(part => part.deadwood).length + (bonsai.shari ? 1 : 0);
    const activeBranches = living.filter(part => part.foliage >= 24 || part.deadwood).length;
    const waterReadiness = clamp(100 - Math.abs(78 - bonsai.water) * 2.15);
    const cleanliness = clamp(100 - diseaseCount * 24 - pestCount * 17 - rootRot * 20);
    const precisionStructure = (0, craft_v3_1.precisionStructureScore)(bonsai);
    const structure = clamp(64 + precisionStructure * .31
        - spread * 1.08
        - Math.abs(58 - foliage) * .68
        + Math.min(10, activeBranches * 1.45)
        + Math.min(8, pruning * 4)
        - heavyCuts * 7
        - bareLivingBranches * 10);
    const cultivation = clamp(bonsai.vitality * .36
        + health * .34
        + waterReadiness * .18
        + cleanliness * .12);
    const maturity = clamp(40
        + Math.min(29, age * 4.6)
        + bonsai.parts.roots.health * .08
        + bonsai.parts.trunk.health * .08
        + Math.min(9, deadwood * 3.5)
        - averageScar * .16);
    const finish = clamp(98
        - visibleWire * 13
        - averageScar * .45
        - diseaseCount * 12
        - pestCount * 8
        - heavyCuts * 6
        - Math.max(0, bonsai.stress - 35) * .22);
    const potHarmony = clamp(NATIONAL_POT_COMPATIBILITY[bonsai.species][bonsai.potId] * .72
        + exports.POTS[bonsai.potId].prestige * .28);
    const seasonalImpression = clamp(exports.SPECIES[bonsai.species].seasonAffinity[seasonIndex(bonsai)] * .48
        + structure * .24
        + cultivation * .18
        + maturity * .10);
    const breakdown = [
        { id: 'maturity', label: '樹格・成熟度', weight: 20, score: Math.round(maturity) },
        { id: 'structure', label: '樹形・枝配り', weight: 25, score: Math.round(structure) },
        { id: 'cultivation', label: '培養・健康', weight: 20, score: Math.round(cultivation) },
        { id: 'finish', label: '手入れ・仕上げ', weight: 15, score: Math.round(finish) },
        { id: 'pot', label: '鉢合わせ・展示調和', weight: 15, score: Math.round(potHarmony) },
        { id: 'season', label: '季節感・感銘', weight: 5, score: Math.round(seasonalImpression) }
    ];
    const penalties = [];
    let explicitPenalty = 0;
    if (rootRot) {
        explicitPenalty += 10;
        penalties.push('根腐れ兆候 −10');
    }
    if (diseaseCount - rootRot > 0) {
        const value = (diseaseCount - rootRot) * 5;
        explicitPenalty += value;
        penalties.push(`病徴 ${diseaseCount - rootRot}部位 −${value}`);
    }
    if (pestCount > 0) {
        const value = pestCount * 3;
        explicitPenalty += value;
        penalties.push(`害虫 ${pestCount}部位 −${value}`);
    }
    if (visibleWire > 0) {
        const value = visibleWire * 2;
        explicitPenalty += value;
        penalties.push(`展示中の露出針金 ${visibleWire}部位 −${value}`);
    }
    if (bareLivingBranches > 0) {
        const value = bareLivingBranches * 3;
        explicitPenalty += value;
        penalties.push(`過度な枝抜き ${bareLivingBranches}部位 −${value}`);
    }
    if (bonsai.stress > 70) {
        explicitPenalty += 4;
        penalties.push('作業直後の強いストレス −4');
    }
    const subtotal = breakdown.reduce((sum, item) => sum + item.score * item.weight / 100, 0);
    const score = Math.round(clamp(subtotal - explicitPenalty, 20, 99));
    const panels = [
        { name: '造形審査', score: Math.round(structure * .58 + maturity * .42) },
        { name: '培養審査', score: Math.round(cultivation * .70 + finish * .30) },
        { name: '展示審査', score: Math.round(potHarmony * .65 + seasonalImpression * .35) }
    ];
    const strongest = [...breakdown].sort((a, b) => b.score - a.score)[0];
    const weakest = [...breakdown].sort((a, b) => a.score - b.score)[0];
    const notes = [
        `主査所見：最も評価できるのは「${strongest.label}」${strongest.score}点。`,
        `改善優先：最も低い「${weakest.label}」${weakest.score}点を整えると総合点が伸びる。`,
        visibleWire ? '展示作品としては針金を外し、整姿の痕跡を見せないことが望ましい。' : '針金を見せず、展示前の仕上げは整っている。',
        diseaseCount || pestCount ? '病害虫が確認されるため、出展より培養の回復を優先すべき状態。' : '病害虫による減点はなく、清潔感を保っている。',
        potHarmony >= 90 ? '樹種の性格と鉢の格・色調が高い水準で調和している。' : '鉢の形・色・格に再考の余地がある。'
    ];
    return {
        score,
        notes,
        standard: '国風賞の公表項目を参考にした六軸合議制',
        breakdown,
        panels,
        penalties
    };
}
function advanceTime(game, now = Date.now()) {
    const copy = structuredClone(game);
    for (const bonsai of copy.bonsai) {
        const elapsedHours = Math.max(0, (now - bonsai.lastUpdatedAt) / 3_600_000);
        if (elapsedHours <= 0)
            continue;
        bonsai.aftercareRisks = normalizeAftercareRisks(bonsai.aftercareRisks).filter(risk => risk.expiresAt > now);
        if (bonsai.lifeStatus === 'dead') {
            bonsai.lastUpdatedAt = now;
            continue;
        }
        bonsai.water = clamp(bonsai.water - elapsedHours * exports.SPECIES[bonsai.species].waterDecayPerHour);
        const dryPenalty = bonsai.water < 35 ? (35 - bonsai.water) * .035 * elapsedHours : 0;
        const stressPenalty = Math.max(0, bonsai.stress - 20) * .005 * elapsedHours;
        const growthPenalty = bonsai.aftercareRisks.reduce((sum, risk) => sum + risk.growthPenalty, 0) * elapsedHours / 960;
        bonsai.vitality = clamp(bonsai.vitality - dryPenalty - stressPenalty - growthPenalty);
        bonsai.stress = Math.max(0, bonsai.stress - elapsedHours * .14);
        (0, craft_v3_1.advanceCraftLifecycle)(bonsai, now);
        bonsai.lastUpdatedAt = now;
        maybeTriggerEvent(bonsai, now);
        evaluateBonsaiDeath(bonsai, now, '長期の衰弱と培養不良');
    }
    return copy;
}
function maybeTriggerEvent(bonsai, now) {
    if (bonsai.lifeStatus === 'dead')
        return;
    const slot = Math.floor(now / 43_200_000);
    if (slot <= bonsai.lastEventSlot)
        return;
    bonsai.lastEventSlot = slot;
    const crowded = exports.PARTS.filter(part => !['trunk', 'roots'].includes(part.id)).filter(part => bonsai.parts[part.id].foliage > 82);
    const seed = hash(`${bonsai.id}:${slot}`);
    const candidates = exports.PARTS.filter(part => part.id !== 'trunk');
    const target = candidates[seed % candidates.length].id;
    const part = bonsai.parts[target];
    const diseaseBonus = bonsai.aftercareRisks.reduce((sum, item) => sum + item.diseaseBonus, 0);
    const pestBonus = bonsai.aftercareRisks.reduce((sum, item) => sum + item.pestBonus, 0);
    const baseRisk = (bonsai.water > 94 ? 22 : 0) + (bonsai.water < 24 ? 18 : 0) + crowded.length * 5 + (bonsai.vitality < 55 ? 25 : 0);
    const risk = Math.min(88, baseRisk + diseaseBonus + pestBonus);
    if (seed % 100 < risk) {
        const diseaseWeight = diseaseBonus + (target === 'roots' || bonsai.water > 94 ? 28 : 14);
        const pestWeight = pestBonus + 16;
        if (target === 'roots' || bonsai.water > 94)
            part.disease = 'rootRot';
        else if ((seed >>> 8) % Math.max(1, Math.round(diseaseWeight + pestWeight)) < diseaseWeight)
            part.disease = seed % 2 ? 'needleBlight' : 'sootyMold';
        else
            part.pest = seed % 3 === 0 ? 'scale' : seed % 2 ? 'spiderMite' : 'aphid';
        part.health = clamp(part.health - 8 - Math.min(7, risk * .07));
        bonsai.vitality = clamp(bonsai.vitality - Math.min(4, risk * .025));
        bonsai.logs.unshift({ id: uuid(), at: now, text: `${exports.PARTS.find(item => item.id === target)?.name}に、作業後の衰弱と関係する異変が見つかった。` });
    }
}
function addAftercareRisk(bonsai, risk) {
    const normalized = {
        id: risk.id || uuid(),
        source: String(risk.source || '作業後リスク'),
        createdAt: finite(risk.createdAt, Date.now()),
        expiresAt: finite(risk.expiresAt, Date.now()),
        diseaseBonus: clamp(finite(risk.diseaseBonus, 0), 0, 100),
        pestBonus: clamp(finite(risk.pestBonus, 0), 0, 100),
        growthPenalty: clamp(finite(risk.growthPenalty, 0), 0, 100),
        diebackBonus: clamp(finite(risk.diebackBonus, 0), 0, 100),
        deathBonus: clamp(finite(risk.deathBonus, 0), 0, 100)
    };
    bonsai.aftercareRisks = [...normalizeAftercareRisks(bonsai.aftercareRisks), normalized].slice(-24);
}
function markBonsaiDead(bonsai, cause, now = Date.now()) {
    if (bonsai.lifeStatus === 'dead')
        return;
    bonsai.lifeStatus = 'dead';
    bonsai.diedAt = now;
    bonsai.deathCause = cause;
    bonsai.vitality = 0;
    bonsai.stress = 0;
    for (const part of Object.values(bonsai.parts)) {
        part.health = Math.min(part.health, 3);
        part.foliage = Math.min(part.foliage, 6);
        delete part.wire;
    }
    bonsai.logs.unshift({ id: uuid(), at: now, text: `この木は「${cause}」により枯死した。判断の履歴と最後の姿は銘木録に残る。` });
}
function evaluateBonsaiDeath(bonsai, now = Date.now(), cause = '全身の衰弱') {
    if (bonsai.lifeStatus === 'dead')
        return true;
    const living = exports.PARTS.filter(part => !['trunk', 'roots'].includes(part.id)).map(part => bonsai.parts[part.id]);
    const averageHealth = living.length ? living.reduce((sum, part) => sum + part.health, 0) / living.length : 0;
    if (bonsai.vitality <= 1 || averageHealth <= 2) {
        markBonsaiDead(bonsai, cause, now);
        return true;
    }
    return false;
}
function hash(value) {
    let result = 2166136261;
    for (let index = 0; index < value.length; index += 1) {
        result ^= value.charCodeAt(index);
        result = Math.imul(result, 16777619);
    }
    return result >>> 0;
}
function updateActiveBonsai(game, updater) {
    const copy = structuredClone(game);
    const bonsai = activeBonsai(copy);
    if (!bonsai)
        return copy;
    updater(bonsai);
    bonsai.lastUpdatedAt = Date.now();
    return copy;
}
function waterBonsai(game) {
    return updateActiveBonsai(game, bonsai => {
        if (bonsai.lifeStatus === 'dead')
            return;
        bonsai.water = 100;
        bonsai.vitality = clamp(bonsai.vitality + 1.5);
        bonsai.logs.unshift({ id: uuid(), at: Date.now(), text: '土の乾きを見て、鉢底から流れるまで水を与えた。' });
    });
}
function prunePart(game, partId, level) {
    return updateActiveBonsai(game, bonsai => {
        if (bonsai.lifeStatus === 'dead')
            return;
        const part = bonsai.parts[partId];
        if (!part || ['trunk', 'roots'].includes(partId))
            return;
        const reduction = [0, 14, 28, 45][level];
        part.foliage = clamp(part.foliage - reduction);
        part.pruneLevel = Math.max(part.pruneLevel, level);
        part.health = clamp(part.health - (level === 3 ? 7 : level === 2 ? 3 : 1));
        part.scar = clamp(part.scar + level * 4);
        bonsai.stress = clamp(bonsai.stress + level * 6, 0, 1000);
        bonsai.vitality = clamp(bonsai.vitality - level * 1.4);
        bonsai.logs.unshift({ id: uuid(), at: Date.now(), text: `${exports.PARTS.find(item => item.id === partId)?.name}を${['', '軽く', '中程度に', '強く'][level]}剪定した。切った枝は戻らない。` });
    });
}
function wirePart(game, partId, intensity, direction) {
    return updateActiveBonsai(game, bonsai => (0, craft_v3_1.applyWireTraining)(bonsai, partId, intensity, direction));
}
function removeWire(game, partId) {
    return updateActiveBonsai(game, bonsai => (0, craft_v3_1.removeWireTraining)(bonsai, partId));
}
function wireDirectionName(direction) {
    return { down: '下', up: '上', left: '左', right: '右', front: '手前', back: '奥' }[direction];
}
function treatPart(game, partId) {
    const copy = structuredClone(game);
    const bonsai = activeBonsai(copy);
    if (!bonsai || bonsai.lifeStatus === 'dead')
        return copy;
    const part = bonsai.parts[partId];
    if (!part?.disease && !part?.pest)
        return copy;
    const cost = part.disease === 'rootRot' ? 900 : part.disease ? 520 : 320;
    if (copy.money < cost)
        return copy;
    copy.money -= cost;
    const label = part.disease ? diseaseName(part.disease) : pestName(part.pest);
    delete part.disease;
    delete part.pest;
    part.health = clamp(part.health + 10);
    bonsai.vitality = clamp(bonsai.vitality + 3);
    bonsai.logs.unshift({ id: uuid(), at: Date.now(), text: `${exports.PARTS.find(item => item.id === partId)?.name}の${label}へ対処した。` });
    return copy;
}
function createJin(game, partId) {
    return (0, craft_v3_1.startJinProjectInGame)(game, partId);
}
function createShari(game, side) {
    return (0, craft_v3_1.startShariProjectInGame)(game, side);
}
function buyOrSelectPot(game, potId) {
    const copy = structuredClone(game);
    const pot = exports.POTS[potId];
    if (!copy.ownedPots.includes(potId)) {
        if (copy.money < pot.price)
            return copy;
        copy.money -= pot.price;
        copy.ownedPots.push(potId);
    }
    const bonsai = activeBonsai(copy);
    if (!bonsai)
        return copy;
    bonsai.potId = potId;
    bonsai.stress = clamp(bonsai.stress + 5, 0, 1000);
    bonsai.logs.unshift({ id: uuid(), at: Date.now(), text: `${pot.name}へ鉢替えした。` });
    return copy;
}
function enterWeeklyShow(game) {
    if (game.lastShowWeek === weekKey())
        return { game, notes: ['今週はすでに出展済みです。'] };
    const copy = structuredClone(game);
    const bonsai = activeBonsai(copy);
    if (!bonsai)
        return { game: copy, notes: ['出展できる盆栽がありません。'] };
    const eligibility = (0, craft_v3_1.exhibitionEligibility)(bonsai);
    if (!eligibility.eligible)
        return { game: copy, notes: eligibility.reasons };
    const evaluation = exhibitionScore(bonsai);
    const seed = hash(`${weekKey()}:${copy.playerName}`);
    const rivals = [
        63 + seed % 22,
        68 + (seed * 3) % 21,
        61 + (seed * 7) % 27,
        66 + (seed * 11) % 22,
        58 + (seed * 13) % 30,
        65 + (seed * 17) % 22
    ];
    const rank = rivals.filter(score => score > evaluation.score).length + 1;
    const title = rank === 1 ? '金賞' : rank <= 3 ? '優秀賞' : evaluation.score >= 74 ? '入選' : '選外';
    const award = {
        id: uuid(), at: Date.now(), title, score: evaluation.score, rank, fieldSize: rivals.length + 1,
        potId: bonsai.potId, visualSignature: visualSignature(bonsai)
    };
    bonsai.awards.unshift(award);
    bonsai.logs.unshift({ id: uuid(), at: Date.now(), text: `${title}。${award.fieldSize}作品中${rank}位、${evaluation.score}点。` });
    copy.lastShowWeek = weekKey();
    copy.money += rank === 1 ? 5000 : rank <= 3 ? 2500 : evaluation.score >= 74 ? 900 : 250;
    copy.reputation += rank === 1 ? 45 : rank <= 3 ? 25 : evaluation.score >= 74 ? 10 : 3;
    return { game: copy, award, notes: evaluation.notes };
}
function addMemorial(game, reason) {
    return updateActiveBonsai(game, bonsai => {
        bonsai.memorials.unshift({
            id: uuid(), at: Date.now(), reason, title: `${bonsai.name} — ${reason}`, visualSignature: visualSignature(bonsai)
        });
        bonsai.memorials = bonsai.memorials.slice(0, 80);
    });
}
function addBonsai(game, species) {
    const copy = structuredClone(game);
    if (copy.bonsai.length >= unlockedSlots(copy.reputation) || copy.money < 1800)
        return copy;
    copy.money -= 1800;
    const bonsai = createBonsai(species);
    copy.bonsai.push(bonsai);
    copy.activeBonsaiId = bonsai.id;
    return copy;
}
function diseaseName(id) {
    return { needleBlight: '葉枯れ症状', sootyMold: 'すす病', rootRot: '根腐れ兆候' }[id];
}
function pestName(id) {
    return { aphid: 'アブラムシ', spiderMite: 'ハダニ', scale: 'カイガラムシ' }[id];
}
