import {
  PRUNING_SITES,
  applyPrecisionPruningToGame,
  type PruningSiteId,
  type PruningTechnique,
  type SiteRole
} from './craft-v3';
import type { BonsaiState, GameState, PartId, SpeciesId } from './model';

export type SuitabilityStatus = 'ideal' | 'caution' | 'blocked';
export type ResponseKind = 'secondaryBudBreak' | 'budBalance' | 'interiorRecovery' | 'backBud' | 'woundCallus';

export interface TechniqueSuitability {
  status: SuitabilityStatus;
  label: string;
  reasons: string[];
  quality: number;
}

export interface SeasonalResponse {
  id: string;
  siteId: PruningSiteId;
  technique: PruningTechnique;
  kind: ResponseKind;
  startedAt: number;
  dueAt: number;
  quality: number;
  budDelta: number;
  foliageDelta: number;
  vigorDelta: number;
  healthDelta: number;
  opennessDelta: number;
  scarDelta: number;
  completedAt?: number;
}

export interface SeasonalStateV4 {
  version: 4;
  responses: SeasonalResponse[];
  lastAdvancedAt: number;
}

export interface SeasonalOverview {
  gameDay: number;
  month: string;
  phase: string;
  climate: string;
  activeResponses: SeasonalResponse[];
}

interface Range { start: number; end: number }
interface TechniqueRule {
  ideal: Range[];
  caution: Range[];
  rationale: string;
  responseDays: number;
}

const DAY = 86_400_000;
const KEY_PREFIX = 'bonsai:seasonal:v4:';
const CLIMATE = '標準温帯設定';

const RULES: Record<SpeciesId, Record<PruningTechnique, TechniqueRule>> = {
  pine: {
    budPinch: {
      ideal: [{ start: 120, end: 175 }], caution: [{ start: 100, end: 195 }], responseDays: 36,
      rationale: '黒松の芽摘み・芽切りは、樹勢と二番芽が伸びる期間を残せる時期に行う。'
    },
    budSelect: {
      ideal: [{ start: 65, end: 115 }, { start: 245, end: 315 }], caution: [{ start: 45, end: 135 }, { start: 225, end: 335 }], responseDays: 24,
      rationale: '芽数を整理し、同一点から多数の芽が伸びてコブになるのを防ぐ。'
    },
    needleThin: {
      ideal: [{ start: 270, end: 350 }], caution: [{ start: 235, end: 364 }, { start: 0, end: 35 }], responseDays: 28,
      rationale: '古葉取りは二番芽が固まった後に行い、枝ごとの力を整える。'
    },
    tipCutback: {
      ideal: [{ start: 320, end: 364 }, { start: 0, end: 55 }], caution: [{ start: 285, end: 364 }, { start: 0, end: 85 }], responseDays: 52,
      rationale: '構造的な切り戻しは休眠期を中心に行い、夏の強い消耗を避ける。'
    },
    innerTwigThin: {
      ideal: [{ start: 285, end: 364 }, { start: 0, end: 75 }], caution: [{ start: 250, end: 364 }, { start: 0, end: 105 }], responseDays: 34,
      rationale: '懐の整理は芽と枝の位置を確認しやすい秋から休眠期が基準。'
    },
    removeBranch: {
      ideal: [{ start: 330, end: 364 }, { start: 0, end: 50 }], caution: [{ start: 295, end: 364 }, { start: 0, end: 85 }], responseDays: 90,
      rationale: '太い枝抜きは休眠期に限定し、樹液活動が強い時期の大傷を避ける。'
    }
  },
  maple: {
    budPinch: {
      ideal: [{ start: 70, end: 125 }], caution: [{ start: 55, end: 145 }], responseDays: 18,
      rationale: '山もみじの芽摘みは新梢が伸び始める春に節間を詰める。'
    },
    budSelect: {
      ideal: [{ start: 65, end: 125 }], caution: [{ start: 50, end: 150 }], responseDays: 18,
      rationale: '芽吹き時に芽数と方向を選び、将来の枝分かれを整える。'
    },
    needleThin: {
      ideal: [{ start: 135, end: 195 }], caution: [{ start: 115, end: 220 }], responseDays: 24,
      rationale: '葉が固まった後に葉量を調整し、内側へ光を入れる。'
    },
    tipCutback: {
      ideal: [{ start: 125, end: 205 }], caution: [{ start: 105, end: 230 }], responseDays: 30,
      rationale: '新梢が固まり始めた後に切り戻し、二次伸長を利用する。'
    },
    innerTwigThin: {
      ideal: [{ start: 305, end: 364 }, { start: 0, end: 55 }], caution: [{ start: 270, end: 364 }, { start: 0, end: 85 }], responseDays: 35,
      rationale: '落葉後は枝筋を見ながら懐枝と交差枝を判断できる。'
    },
    removeBranch: {
      ideal: [{ start: 325, end: 364 }, { start: 0, end: 45 }], caution: [{ start: 290, end: 364 }, { start: 0, end: 75 }], responseDays: 70,
      rationale: '大きな構造剪定は休眠期に行い、樹液の流出と日焼けを避ける。'
    }
  },
  azalea: {
    budPinch: {
      ideal: [{ start: 150, end: 215 }], caution: [{ start: 135, end: 235 }], responseDays: 20,
      rationale: '皐月は花後の新梢整理を基準にし、翌年の花芽形成を妨げない。'
    },
    budSelect: {
      ideal: [{ start: 150, end: 220 }], caution: [{ start: 130, end: 240 }], responseDays: 20,
      rationale: '花後に新芽の数と方向を選び、枝の混み合いを防ぐ。'
    },
    needleThin: {
      ideal: [{ start: 160, end: 230 }], caution: [{ start: 140, end: 250 }], responseDays: 24,
      rationale: '花後の葉量調整で光と通風を確保する。'
    },
    tipCutback: {
      ideal: [{ start: 150, end: 215 }], caution: [{ start: 130, end: 235 }], responseDays: 28,
      rationale: '花後に輪郭を戻し、次の花芽が固まる前に仕立てる。'
    },
    innerTwigThin: {
      ideal: [{ start: 155, end: 235 }], caution: [{ start: 135, end: 255 }], responseDays: 30,
      rationale: '花後の枝抜きで内側の蒸れを防ぎ、細枝を残す。'
    },
    removeBranch: {
      ideal: [{ start: 325, end: 364 }, { start: 0, end: 45 }], caution: [{ start: 285, end: 364 }, { start: 0, end: 75 }], responseDays: 65,
      rationale: '太枝の除去は休眠期に限定し、花後の細かな剪定と分ける。'
    }
  }
};

const MIN_VITALITY: Record<PruningTechnique, number> = {
  budPinch: 55,
  budSelect: 52,
  needleThin: 58,
  tipCutback: 64,
  innerTwigThin: 62,
  removeBranch: 74
};

export function seasonalOverview(bonsai: BonsaiState, now = Date.now()): SeasonalOverview {
  const gameDay = inGameDayOfYear(bonsai, now);
  const date = new Date(Date.UTC(2024, 0, gameDay + 1));
  const month = `${date.getUTCMonth() + 1}月`;
  return {
    gameDay,
    month,
    phase: phenologyPhase(bonsai.species, gameDay),
    climate: CLIMATE,
    activeResponses: loadSeasonalState(bonsai).responses.filter(item => !item.completedAt).sort((a, b) => a.dueAt - b.dueAt)
  };
}

export function pruningSuitability(
  bonsai: BonsaiState,
  siteId: PruningSiteId,
  technique: PruningTechnique,
  now = Date.now()
): TechniqueSuitability {
  const rule = RULES[bonsai.species][technique];
  const gameDay = inGameDayOfYear(bonsai, now);
  const state = bonsai.craft.sites[siteId];
  const definition = PRUNING_SITES.find(item => item.id === siteId);
  const reasons: string[] = [];

  if (!state || !definition || state.removed) return { status: 'blocked', label: '対象なし', reasons: ['この箇所はすでに失われています。'], quality: 0 };
  if (!techniqueAllowedForRole(definition.role, technique)) reasons.push('この枝位置には適さない技法です。');
  if ((technique === 'budPinch' || technique === 'budSelect') && state.budCount < 1) reasons.push('選べる芽がありません。');
  if (bonsai.vitality < MIN_VITALITY[technique]) reasons.push(`樹勢${MIN_VITALITY[technique]}以上が必要です。`);
  if (state.health < 45 || state.vigor < 42) reasons.push('対象部位の健康・局所樹勢が不足しています。');
  if (bonsai.stress > 78) reasons.push('作業ストレスが高く、先に養生が必要です。');
  if (state.lastWorkedAt && now - state.lastWorkedAt < inGameDaysToMs(14)) reasons.push('同じ箇所へ前回の作業から14日相当が経っていません。');
  if (!inRanges(gameDay, rule.caution)) reasons.push(`現在の${seasonalOverview(bonsai, now).month}は標準的な作業時期から外れています。`);

  if (reasons.length) return { status: 'blocked', label: '実行不可', reasons: [...reasons, rule.rationale], quality: 0 };

  const ideal = inRanges(gameDay, rule.ideal);
  const cautionReasons: string[] = [];
  if (!ideal) cautionReasons.push('標準適期の周辺期間です。地域・樹勢によって結果がぶれます。');
  if (bonsai.vitality < MIN_VITALITY[technique] + 12) cautionReasons.push('実行可能ですが、十分な樹勢の木より回復が遅くなります。');
  if (state.health < 68 || state.vigor < 65) cautionReasons.push('局所状態が万全ではないため、芽吹き量が少なくなる可能性があります。');

  const quality = clamp(
    (ideal ? .82 : .62)
      + (bonsai.vitality - MIN_VITALITY[technique]) / 140
      + (state.health - 60) / 260
      + (state.vigor - 60) / 300,
    .28,
    .98
  );

  return {
    status: cautionReasons.length ? 'caution' : 'ideal',
    label: cautionReasons.length ? '条件付き' : '適期',
    reasons: [...cautionReasons, rule.rationale],
    quality
  };
}

export function applySeasonalPruningToGame(
  game: GameState,
  siteId: PruningSiteId,
  technique: PruningTechnique,
  now = Date.now()
): { game: GameState; applied: boolean; message: string } {
  const source = game.bonsai.find(item => item.id === game.activeBonsaiId) ?? game.bonsai[0];
  if (!source) return { game, applied: false, message: '対象の盆栽がありません。' };
  const suitability = pruningSuitability(source, siteId, technique, now);
  if (suitability.status === 'blocked') return { game, applied: false, message: suitability.reasons[0] ?? '現在は実行できません。' };

  const next = applyPrecisionPruningToGame(game, siteId, technique, now);
  const bonsai = next.bonsai.find(item => item.id === next.activeBonsaiId) ?? next.bonsai[0];
  if (!bonsai) return { game: next, applied: false, message: '対象の盆栽がありません。' };

  const seasonal = loadSeasonalState(bonsai);
  const response = createResponse(bonsai, siteId, technique, suitability.quality, now);
  seasonal.responses.unshift(response);
  seasonal.responses = seasonal.responses.slice(0, 80);
  seasonal.lastAdvancedAt = now;
  saveSeasonalState(bonsai.id, seasonal);

  if (suitability.status === 'caution') {
    bonsai.stress = clamp(bonsai.stress + 2.5, 0, 1000);
  }
  bonsai.logs.unshift({
    id: uid(), at: now,
    text: `${suitability.label}の判断で作業した。結果はゲーム内約${Math.ceil((response.dueAt - now) / DAY * 10)}日後の芽吹き・回復で確認する。`
  });
  return { game: next, applied: true, message: suitability.status === 'ideal' ? '適期の作業として記録しました。' : '条件付き作業として記録しました。' };
}

export function advanceSeasonalGame(game: GameState, now = Date.now()): { game: GameState; changed: boolean } {
  const copy = structuredClone(game);
  let changed = false;
  for (const bonsai of copy.bonsai) {
    const seasonal = loadSeasonalState(bonsai);
    let seasonalChanged = false;
    for (const response of seasonal.responses) {
      if (response.completedAt || now < response.dueAt) continue;
      const state = bonsai.craft.sites[response.siteId];
      if (!state) continue;
      state.budCount = clamp(Math.round(state.budCount + response.budDelta), 0, 12);
      state.foliage = clamp(state.foliage + response.foliageDelta);
      state.vigor = clamp(state.vigor + response.vigorDelta);
      state.health = clamp(state.health + response.healthDelta);
      state.openness = clamp(state.openness + response.opennessDelta);
      state.scar = clamp(state.scar + response.scarDelta);
      response.completedAt = now;
      seasonalChanged = true;
      changed = true;
      syncParentPart(bonsai, response.siteId);
      bonsai.logs.unshift({ id: uid(), at: now, text: responseCompletionText(response) });
    }
    seasonal.lastAdvancedAt = now;
    if (seasonalChanged) saveSeasonalState(bonsai.id, seasonal);
  }
  return { game: copy, changed };
}

export function loadSeasonalState(bonsai: BonsaiState): SeasonalStateV4 {
  const fallback: SeasonalStateV4 = { version: 4, responses: [], lastAdvancedAt: Date.now() };
  try {
    if (typeof localStorage === 'undefined') return fallback;
    const raw = JSON.parse(localStorage.getItem(`${KEY_PREFIX}${bonsai.id}`) || 'null') as Partial<SeasonalStateV4> | null;
    if (!raw || !Array.isArray(raw.responses)) return fallback;
    const responses = raw.responses.map(normalizeResponse).filter((item): item is SeasonalResponse => Boolean(item)).slice(0, 80);
    return { version: 4, responses, lastAdvancedAt: finite(raw.lastAdvancedAt, Date.now()) };
  } catch {
    return fallback;
  }
}

export function saveSeasonalState(bonsaiId: string, state: SeasonalStateV4): void {
  try {
    if (typeof localStorage !== 'undefined') localStorage.setItem(`${KEY_PREFIX}${bonsaiId}`, JSON.stringify(state));
  } catch {
    // The game remains playable when storage quota or private mode blocks this optional history.
  }
}

export function responseLabel(response: SeasonalResponse): string {
  return ({
    secondaryBudBreak: '二番芽の芽吹き待ち',
    budBalance: '残した芽の伸長待ち',
    interiorRecovery: '懐の回復待ち',
    backBud: '戻り芽の確認待ち',
    woundCallus: '切り口の安定待ち'
  } as Record<ResponseKind, string>)[response.kind];
}

function createResponse(
  bonsai: BonsaiState,
  siteId: PruningSiteId,
  technique: PruningTechnique,
  quality: number,
  now: number
): SeasonalResponse {
  const rule = RULES[bonsai.species][technique];
  const values = responseValues(technique, quality);
  return {
    id: uid(), siteId, technique, kind: values.kind,
    startedAt: now, dueAt: now + inGameDaysToMs(rule.responseDays), quality,
    budDelta: values.budDelta, foliageDelta: values.foliageDelta,
    vigorDelta: values.vigorDelta, healthDelta: values.healthDelta,
    opennessDelta: values.opennessDelta, scarDelta: values.scarDelta
  };
}

function responseValues(technique: PruningTechnique, quality: number) {
  const strong = quality >= .78;
  const adequate = quality >= .55;
  return ({
    budPinch: { kind: 'secondaryBudBreak' as ResponseKind, budDelta: strong ? 3 : adequate ? 2 : 1, foliageDelta: strong ? 6 : 3, vigorDelta: 1, healthDelta: 1, opennessDelta: 0, scarDelta: 0 },
    budSelect: { kind: 'budBalance' as ResponseKind, budDelta: 0, foliageDelta: strong ? 4 : 2, vigorDelta: 2, healthDelta: 1, opennessDelta: 1, scarDelta: 0 },
    needleThin: { kind: 'interiorRecovery' as ResponseKind, budDelta: strong ? 1 : 0, foliageDelta: 2, vigorDelta: 4, healthDelta: 3, opennessDelta: 2, scarDelta: 0 },
    tipCutback: { kind: 'backBud' as ResponseKind, budDelta: strong ? 2 : adequate ? 1 : 0, foliageDelta: strong ? 4 : 1, vigorDelta: 1, healthDelta: 1, opennessDelta: 0, scarDelta: 0 },
    innerTwigThin: { kind: 'interiorRecovery' as ResponseKind, budDelta: strong ? 1 : 0, foliageDelta: 1, vigorDelta: 3, healthDelta: 4, opennessDelta: 2, scarDelta: 0 },
    removeBranch: { kind: 'woundCallus' as ResponseKind, budDelta: 0, foliageDelta: 0, vigorDelta: 0, healthDelta: 1, opennessDelta: 0, scarDelta: strong ? -2 : -1 }
  } as const)[technique];
}

function normalizeResponse(value: unknown): SeasonalResponse | null {
  if (!value || typeof value !== 'object') return null;
  const item = value as Partial<SeasonalResponse>;
  if (!PRUNING_SITES.some(site => site.id === item.siteId)) return null;
  if (!['budPinch', 'budSelect', 'needleThin', 'tipCutback', 'innerTwigThin', 'removeBranch'].includes(String(item.technique))) return null;
  if (!['secondaryBudBreak', 'budBalance', 'interiorRecovery', 'backBud', 'woundCallus'].includes(String(item.kind))) return null;
  return {
    id: String(item.id || uid()), siteId: item.siteId as PruningSiteId,
    technique: item.technique as PruningTechnique, kind: item.kind as ResponseKind,
    startedAt: finite(item.startedAt, Date.now()), dueAt: finite(item.dueAt, Date.now()),
    quality: clamp(finite(item.quality, .6), 0, 1),
    budDelta: finite(item.budDelta, 0), foliageDelta: finite(item.foliageDelta, 0),
    vigorDelta: finite(item.vigorDelta, 0), healthDelta: finite(item.healthDelta, 0),
    opennessDelta: finite(item.opennessDelta, 0), scarDelta: finite(item.scarDelta, 0),
    completedAt: item.completedAt ? finite(item.completedAt, 0) : undefined
  };
}

function syncParentPart(bonsai: BonsaiState, siteId: PruningSiteId): void {
  const definition = PRUNING_SITES.find(item => item.id === siteId);
  if (!definition) return;
  const definitions = PRUNING_SITES.filter(item => item.parentPartId === definition.parentPartId);
  const states = definitions.map(item => bonsai.craft.sites[item.id]);
  const living = states.filter(item => !item.removed);
  const part = bonsai.parts[definition.parentPartId];
  if (!part) return;
  part.foliage = living.length ? clamp(living.reduce((sum, item) => sum + item.foliage, 0) / living.length) : 0;
  part.health = living.length ? clamp(living.reduce((sum, item) => sum + item.health, 0) / living.length) : 0;
  part.scar = clamp(Math.max(part.scar, ...states.map(item => item.scar)));
}

function responseCompletionText(response: SeasonalResponse): string {
  const site = PRUNING_SITES.find(item => item.id === response.siteId)?.label ?? response.siteId;
  return `${site}：${responseLabel(response)}の結果が現れた。芽${signed(response.budDelta)}、葉量${signed(response.foliageDelta)}。`;
}

function techniqueAllowedForRole(role: SiteRole, technique: PruningTechnique): boolean {
  if (technique === 'budPinch' || technique === 'budSelect') return ['leader', 'tip', 'foliagePad', 'interior'].includes(role);
  if (technique === 'needleThin') return ['leader', 'tip', 'foliagePad', 'interior', 'segment'].includes(role);
  if (technique === 'innerTwigThin') return ['interior', 'segment', 'foliagePad', 'defectBranch'].includes(role);
  if (technique === 'removeBranch') return ['branchBase', 'segment', 'defectBranch'].includes(role);
  return true;
}

function phenologyPhase(species: SpeciesId, day: number): string {
  if (species === 'pine') {
    if (day <= 50 || day >= 316) return '休眠・構造確認期';
    if (day <= 105) return '芽動き・ロウソク芽伸長前';
    if (day <= 180) return 'ロウソク芽伸長・芽切り期';
    if (day <= 245) return '二番芽伸長・硬化期';
    return '秋の芽整理・古葉取り期';
  }
  if (species === 'maple') {
    if (day <= 55 || day >= 321) return '落葉休眠・枝筋確認期';
    if (day <= 110) return '芽吹き・新梢伸長期';
    if (day <= 190) return '葉固まり・切り戻し期';
    if (day <= 260) return '夏の充実期';
    return '紅葉・落葉準備期';
  }
  if (day <= 60 || day >= 321) return '休眠・樹形確認期';
  if (day <= 130) return '蕾・開花準備期';
  if (day <= 180) return '開花・花後剪定期';
  if (day <= 250) return '新梢伸長・枝作り期';
  return '枝の充実・花芽形成期';
}

function inGameDayOfYear(bonsai: BonsaiState, now: number): number {
  const base = realDayOfYear(bonsai.bornAt);
  const elapsed = Math.max(0, (now - bonsai.bornAt) / DAY * 10);
  return Math.floor((base + elapsed) % 365);
}

function realDayOfYear(timestamp: number): number {
  const date = new Date(timestamp);
  const start = new Date(date.getFullYear(), 0, 1);
  return Math.max(0, Math.floor((date.getTime() - start.getTime()) / DAY));
}

function inRanges(day: number, ranges: Range[]): boolean {
  return ranges.some(range => range.start <= range.end
    ? day >= range.start && day <= range.end
    : day >= range.start || day <= range.end);
}

function inGameDaysToMs(days: number): number {
  return days * DAY / 10;
}

function signed(value: number): string {
  const rounded = Math.round(value);
  return `${rounded >= 0 ? '+' : ''}${rounded}`;
}

function finite(value: unknown, fallback: number): number {
  return Number.isFinite(Number(value)) ? Number(value) : fallback;
}

function clamp(value: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, value));
}

function uid(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}
