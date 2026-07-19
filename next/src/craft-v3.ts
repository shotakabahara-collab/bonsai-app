import type {
  BonsaiState,
  GameState,
  PartId,
  PartState,
  SpeciesId,
  WireDirection,
  WireState
} from './model';

export type PruningGroupId = 'apex' | 'firstLeft' | 'secondRight' | 'thirdLeft' | 'back' | 'front' | 'defects';
export type PruningSiteId =
  | 'apexLeader' | 'apexLeftPad' | 'apexRightPad' | 'apexInterior'
  | 'firstBase' | 'firstMid' | 'firstTip' | 'firstUpperPad' | 'firstLowerPad'
  | 'secondBase' | 'secondMid' | 'secondTip' | 'secondUpperPad' | 'secondLowerPad'
  | 'thirdBase' | 'thirdMid' | 'thirdTip' | 'thirdPad'
  | 'backBase' | 'backMid' | 'backTip'
  | 'frontBase' | 'frontMid' | 'frontTip'
  | 'crossLeft' | 'crossRight';
export type PruningTechnique = 'budPinch' | 'budSelect' | 'needleThin' | 'tipCutback' | 'innerTwigThin' | 'removeBranch';
export type SiteRole = 'leader' | 'branchBase' | 'segment' | 'tip' | 'foliagePad' | 'interior' | 'defectBranch';
export type WireTrainingStatus = 'training' | 'ready' | 'overdue';
export type DeadwoodKind = 'jin' | 'shari';
export type DeadwoodStage = 'fresh' | 'drying' | 'carving' | 'preserving' | 'weathering' | 'mature';

export interface PruningSiteDefinition {
  id: PruningSiteId;
  group: PruningGroupId;
  parentPartId: PartId;
  parentId?: PruningSiteId;
  label: string;
  short: string;
  role: SiteRole;
  x: number;
  y: number;
  initialFoliage: number;
  initialBuds: number;
}

export interface PruningSiteState {
  id: PruningSiteId;
  foliage: number;
  budCount: number;
  vigor: number;
  health: number;
  openness: number;
  scar: number;
  removed: boolean;
  lastTechnique?: PruningTechnique;
  lastWorkedAt?: number;
}

export interface DeadwoodProject {
  id: string;
  kind: DeadwoodKind;
  targetPartId: PartId;
  side?: 'left' | 'right';
  stage: DeadwoodStage;
  level: 1 | 2 | 3;
  startedAt: number;
  stageStartedAt: number;
  readyAt: number;
}

export interface CraftState {
  version: 3;
  sites: Record<PruningSiteId, PruningSiteState>;
  deadwoodProjects: DeadwoodProject[];
}

export interface EligibilityResult {
  eligible: boolean;
  reasons: string[];
}

export interface WireLifecycleView {
  status: WireTrainingStatus;
  progress: number;
  readyAt: number;
  remainingInGameDays: number;
  predictedRetention: number;
  biteRisk: number;
}

export const PRUNING_GROUPS: ReadonlyArray<{ id: PruningGroupId; label: string; description: string }> = [
  { id: 'apex', label: '頂部', description: '芯、左右の頂部葉棚、懐の混みを分けて扱う。' },
  { id: 'firstLeft', label: '第一枝', description: '枝元から先端、上下の葉棚まで作品の重心を担う。' },
  { id: 'secondRight', label: '第二枝', description: '第一枝との呼応と左右の間を整える。' },
  { id: 'thirdLeft', label: '第三枝', description: '奥行きと幹の流れを補う。' },
  { id: 'back', label: '背枝', description: '正面から見えすぎず、奥行きを作る。' },
  { id: 'front', label: '前枝', description: '幹を隠しすぎず、正面の立体感を作る。' },
  { id: 'defects', label: '交差・内向き枝', description: '交差、逆向き、幹へ戻る枝を一本単位で判断する。' }
];

export const PRUNING_SITES: ReadonlyArray<PruningSiteDefinition> = [
  { id: 'apexLeader', group: 'apex', parentPartId: 'apex', label: '頂部・芯', short: '芯', role: 'leader', x: 50, y: 20, initialFoliage: 62, initialBuds: 3 },
  { id: 'apexLeftPad', group: 'apex', parentPartId: 'apex', parentId: 'apexLeader', label: '頂部・左葉棚', short: '左棚', role: 'foliagePad', x: 41, y: 24, initialFoliage: 68, initialBuds: 5 },
  { id: 'apexRightPad', group: 'apex', parentPartId: 'apex', parentId: 'apexLeader', label: '頂部・右葉棚', short: '右棚', role: 'foliagePad', x: 57, y: 26, initialFoliage: 64, initialBuds: 5 },
  { id: 'apexInterior', group: 'apex', parentPartId: 'apex', parentId: 'apexLeader', label: '頂部・懐', short: '懐', role: 'interior', x: 49, y: 30, initialFoliage: 58, initialBuds: 4 },

  { id: 'firstBase', group: 'firstLeft', parentPartId: 'firstLeft', label: '第一枝・枝元', short: '枝元', role: 'branchBase', x: 43, y: 43, initialFoliage: 45, initialBuds: 2 },
  { id: 'firstMid', group: 'firstLeft', parentPartId: 'firstLeft', parentId: 'firstBase', label: '第一枝・中間', short: '中間', role: 'segment', x: 35, y: 42, initialFoliage: 58, initialBuds: 3 },
  { id: 'firstTip', group: 'firstLeft', parentPartId: 'firstLeft', parentId: 'firstMid', label: '第一枝・先端', short: '先端', role: 'tip', x: 25, y: 40, initialFoliage: 72, initialBuds: 5 },
  { id: 'firstUpperPad', group: 'firstLeft', parentPartId: 'firstLeft', parentId: 'firstMid', label: '第一枝・上側葉棚', short: '上棚', role: 'foliagePad', x: 31, y: 35, initialFoliage: 78, initialBuds: 6 },
  { id: 'firstLowerPad', group: 'firstLeft', parentPartId: 'firstLeft', parentId: 'firstMid', label: '第一枝・下側葉棚', short: '下棚', role: 'foliagePad', x: 29, y: 48, initialFoliage: 70, initialBuds: 5 },

  { id: 'secondBase', group: 'secondRight', parentPartId: 'secondRight', label: '第二枝・枝元', short: '枝元', role: 'branchBase', x: 53, y: 41, initialFoliage: 44, initialBuds: 2 },
  { id: 'secondMid', group: 'secondRight', parentPartId: 'secondRight', parentId: 'secondBase', label: '第二枝・中間', short: '中間', role: 'segment', x: 62, y: 39, initialFoliage: 58, initialBuds: 3 },
  { id: 'secondTip', group: 'secondRight', parentPartId: 'secondRight', parentId: 'secondMid', label: '第二枝・先端', short: '先端', role: 'tip', x: 75, y: 37, initialFoliage: 74, initialBuds: 5 },
  { id: 'secondUpperPad', group: 'secondRight', parentPartId: 'secondRight', parentId: 'secondMid', label: '第二枝・上側葉棚', short: '上棚', role: 'foliagePad', x: 68, y: 32, initialFoliage: 76, initialBuds: 6 },
  { id: 'secondLowerPad', group: 'secondRight', parentPartId: 'secondRight', parentId: 'secondMid', label: '第二枝・下側葉棚', short: '下棚', role: 'foliagePad', x: 70, y: 45, initialFoliage: 72, initialBuds: 5 },

  { id: 'thirdBase', group: 'thirdLeft', parentPartId: 'thirdLeft', label: '第三枝・枝元', short: '枝元', role: 'branchBase', x: 45, y: 59, initialFoliage: 42, initialBuds: 2 },
  { id: 'thirdMid', group: 'thirdLeft', parentPartId: 'thirdLeft', parentId: 'thirdBase', label: '第三枝・中間', short: '中間', role: 'segment', x: 37, y: 61, initialFoliage: 56, initialBuds: 3 },
  { id: 'thirdTip', group: 'thirdLeft', parentPartId: 'thirdLeft', parentId: 'thirdMid', label: '第三枝・先端', short: '先端', role: 'tip', x: 27, y: 62, initialFoliage: 68, initialBuds: 5 },
  { id: 'thirdPad', group: 'thirdLeft', parentPartId: 'thirdLeft', parentId: 'thirdMid', label: '第三枝・葉棚', short: '葉棚', role: 'foliagePad', x: 32, y: 56, initialFoliage: 72, initialBuds: 5 },

  { id: 'backBase', group: 'back', parentPartId: 'back', label: '背枝・枝元', short: '枝元', role: 'branchBase', x: 53, y: 51, initialFoliage: 40, initialBuds: 2 },
  { id: 'backMid', group: 'back', parentPartId: 'back', parentId: 'backBase', label: '背枝・中間', short: '中間', role: 'segment', x: 59, y: 50, initialFoliage: 52, initialBuds: 3 },
  { id: 'backTip', group: 'back', parentPartId: 'back', parentId: 'backMid', label: '背枝・先端', short: '先端', role: 'tip', x: 65, y: 49, initialFoliage: 62, initialBuds: 4 },

  { id: 'frontBase', group: 'front', parentPartId: 'front', label: '前枝・枝元', short: '枝元', role: 'branchBase', x: 49, y: 59, initialFoliage: 38, initialBuds: 2 },
  { id: 'frontMid', group: 'front', parentPartId: 'front', parentId: 'frontBase', label: '前枝・中間', short: '中間', role: 'segment', x: 55, y: 65, initialFoliage: 50, initialBuds: 3 },
  { id: 'frontTip', group: 'front', parentPartId: 'front', parentId: 'frontMid', label: '前枝・先端', short: '先端', role: 'tip', x: 61, y: 70, initialFoliage: 58, initialBuds: 4 },

  { id: 'crossLeft', group: 'defects', parentPartId: 'firstLeft', label: '内向き交差枝・左', short: '交左', role: 'defectBranch', x: 44, y: 48, initialFoliage: 34, initialBuds: 2 },
  { id: 'crossRight', group: 'defects', parentPartId: 'secondRight', label: '内向き交差枝・右', short: '交右', role: 'defectBranch', x: 55, y: 48, initialFoliage: 32, initialBuds: 2 }
];

export const PRUNING_TECHNIQUES: ReadonlyArray<{ id: PruningTechnique; label: string; description: string; irreversible: boolean }> = [
  { id: 'budPinch', label: '芽摘み', description: '伸びる力を抑え、次の芽の位置を詰める。枝そのものは切らない。', irreversible: true },
  { id: 'budSelect', label: '芽かき', description: '残す芽を選び、将来の枝方向と密度を決める。', irreversible: true },
  { id: 'needleThin', label: '古葉取り・葉透かし', description: '葉量を減らして光と風を通し、枝の奥を守る。', irreversible: true },
  { id: 'tipCutback', label: '枝先の切り戻し', description: '先端を詰めて輪郭を小さくする。戻り芽がない場所は回復しにくい。', irreversible: true },
  { id: 'innerTwigThin', label: '懐枝の整理', description: '内側の混み枝を抜き、幹と枝の流れを見せる。', irreversible: true },
  { id: 'removeBranch', label: '枝抜き', description: '選んだ枝系統を枝元から除去する。子となる枝葉も全て失う。', irreversible: true }
];

const PART_LABELS: Record<PartId, string> = {
  apex: '頂部', firstLeft: '第一枝', secondRight: '第二枝', thirdLeft: '第三枝',
  back: '背枝', front: '前枝', trunk: '主幹', roots: '根張り・根域'
};

const SITE_BY_ID = Object.fromEntries(PRUNING_SITES.map(site => [site.id, site])) as Record<PruningSiteId, PruningSiteDefinition>;
const clamp = (value: number, min = 0, max = 100) => Math.max(min, Math.min(max, value));
const finite = (value: unknown, fallback: number) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const asObject = (value: unknown): Record<string, unknown> => value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
const uid = () => typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
const inGameDaysToMs = (days: number) => days * 86_400_000 / 10;

export function createCraftState(): CraftState {
  const sites = Object.fromEntries(PRUNING_SITES.map(definition => [definition.id, {
    id: definition.id,
    foliage: definition.initialFoliage,
    budCount: definition.initialBuds,
    vigor: 86,
    health: 92,
    openness: 30,
    scar: 0,
    removed: false
  }])) as Record<PruningSiteId, PruningSiteState>;
  return { version: 3, sites, deadwoodProjects: [] };
}

export function normalizeCraftState(raw: unknown, parts: Record<PartId, PartState>, legacyShari?: unknown): CraftState {
  const base = createCraftState();
  const source = asObject(raw);
  const rawSites = asObject(source.sites);
  for (const definition of PRUNING_SITES) {
    const item = asObject(rawSites[definition.id]);
    const state = base.sites[definition.id];
    const parent = parts[definition.parentPartId];
    state.foliage = clamp(finite(item.foliage, parent ? Math.min(definition.initialFoliage, parent.foliage) : definition.initialFoliage));
    state.budCount = clamp(Math.round(finite(item.budCount, definition.initialBuds)), 0, 12);
    state.vigor = clamp(finite(item.vigor, parent?.health ?? 86));
    state.health = clamp(finite(item.health, parent?.health ?? 92));
    state.openness = clamp(finite(item.openness, 30));
    state.scar = clamp(finite(item.scar, parent?.scar ?? 0));
    state.removed = item.removed === true;
    state.lastTechnique = isTechnique(item.lastTechnique) ? item.lastTechnique : undefined;
    state.lastWorkedAt = finite(item.lastWorkedAt, 0) || undefined;
  }

  const projects = Array.isArray(source.deadwoodProjects)
    ? source.deadwoodProjects.map(normalizeProject).filter((item): item is DeadwoodProject => Boolean(item))
    : [];

  for (const partId of ['apex', 'firstLeft', 'secondRight', 'thirdLeft', 'back', 'front'] as PartId[]) {
    if (parts[partId]?.deadwood && !projects.some(project => project.kind === 'jin' && project.targetPartId === partId)) {
      const now = Date.now();
      projects.push({ id: `legacy-jin-${partId}`, kind: 'jin', targetPartId: partId, stage: 'mature', level: 1, startedAt: now, stageStartedAt: now, readyAt: now });
    }
  }

  const oldShari = asObject(legacyShari);
  if (oldShari.level && !projects.some(project => project.kind === 'shari')) {
    const now = finite(oldShari.createdAt, Date.now());
    projects.push({
      id: 'legacy-shari', kind: 'shari', targetPartId: 'trunk', side: oldShari.side === 'right' ? 'right' : 'left',
      stage: 'mature', level: clamp(Math.round(finite(oldShari.level, 1)), 1, 3) as 1 | 2 | 3,
      startedAt: now, stageStartedAt: now, readyAt: now
    });
  }

  return { version: 3, sites: base.sites, deadwoodProjects: projects.slice(0, 20) };
}

function normalizeProject(value: unknown): DeadwoodProject | null {
  const source = asObject(value);
  const kind = source.kind === 'shari' ? 'shari' : source.kind === 'jin' ? 'jin' : null;
  if (!kind) return null;
  const stage = isDeadwoodStage(source.stage) ? source.stage : 'fresh';
  const targetPartId = isPartId(source.targetPartId) ? source.targetPartId : kind === 'shari' ? 'trunk' : 'apex';
  const startedAt = finite(source.startedAt, Date.now());
  return {
    id: String(source.id || uid()), kind, targetPartId,
    side: kind === 'shari' ? (source.side === 'right' ? 'right' : 'left') : undefined,
    stage, level: clamp(Math.round(finite(source.level, 1)), 1, 3) as 1 | 2 | 3,
    startedAt, stageStartedAt: finite(source.stageStartedAt, startedAt),
    readyAt: finite(source.readyAt, startedAt + stageWaitMs(stage))
  };
}

function isTechnique(value: unknown): value is PruningTechnique {
  return PRUNING_TECHNIQUES.some(item => item.id === value);
}
function isDeadwoodStage(value: unknown): value is DeadwoodStage {
  return ['fresh', 'drying', 'carving', 'preserving', 'weathering', 'mature'].includes(String(value));
}
function isPartId(value: unknown): value is PartId {
  return ['apex', 'firstLeft', 'secondRight', 'thirdLeft', 'back', 'front', 'trunk', 'roots'].includes(String(value));
}

export function pruningSitesForGroup(craft: CraftState, group: PruningGroupId): Array<PruningSiteDefinition & { state: PruningSiteState; blocked: boolean }> {
  return PRUNING_SITES.filter(site => site.group === group).map(site => ({
    ...site,
    state: craft.sites[site.id],
    blocked: ancestorRemoved(craft, site)
  }));
}

function ancestorRemoved(craft: CraftState, definition: PruningSiteDefinition): boolean {
  let parent = definition.parentId;
  while (parent) {
    if (craft.sites[parent]?.removed) return true;
    parent = SITE_BY_ID[parent]?.parentId;
  }
  return false;
}

export function pruningPrediction(craft: CraftState, siteId: PruningSiteId, technique: PruningTechnique): string[] {
  const state = craft.sites[siteId];
  const definition = SITE_BY_ID[siteId];
  if (!state || !definition) return ['対象を確認できません。'];
  const impact = techniqueImpact(technique, state, definition);
  return [
    `葉量 ${impact.foliageDelta > 0 ? '+' : ''}${impact.foliageDelta}`,
    `芽数 ${impact.budDelta > 0 ? '+' : ''}${impact.budDelta}`,
    `樹勢負担 ${impact.stress <= 3 ? '小' : impact.stress <= 7 ? '中' : '大'}`,
    impact.removeDescendants ? 'この位置より先の枝葉も失う' : `空間の抜け +${impact.openness}`
  ];
}

function techniqueImpact(technique: PruningTechnique, state: PruningSiteState, definition: PruningSiteDefinition) {
  const impacts = {
    budPinch: { foliageDelta: -3, budDelta: state.budCount > 0 ? -1 : 0, openness: 2, stress: 2, health: -1, scar: 0, removeDescendants: false },
    budSelect: { foliageDelta: -2, budDelta: Math.min(0, 2 - state.budCount), openness: 3, stress: 2, health: 0, scar: 0, removeDescendants: false },
    needleThin: { foliageDelta: -12, budDelta: 0, openness: 14, stress: 3, health: -1, scar: 0, removeDescendants: false },
    tipCutback: { foliageDelta: -18, budDelta: state.budCount ? -1 : 0, openness: 8, stress: 7, health: -2, scar: 3, removeDescendants: false },
    innerTwigThin: { foliageDelta: -14, budDelta: 0, openness: 16, stress: 5, health: -1, scar: 1, removeDescendants: false },
    removeBranch: { foliageDelta: -state.foliage, budDelta: -state.budCount, openness: 28, stress: definition.role === 'branchBase' ? 15 : 10, health: -state.health, scar: 8, removeDescendants: true }
  } as const;
  return impacts[technique];
}

export function applyPrecisionPruningToGame(game: GameState, siteId: PruningSiteId, technique: PruningTechnique, now = Date.now()): GameState {
  const copy = structuredClone(game);
  const bonsai = copy.bonsai.find(item => item.id === copy.activeBonsaiId) ?? copy.bonsai[0];
  if (!bonsai) return copy;
  applyPrecisionPruningToBonsai(bonsai, siteId, technique, now);
  return copy;
}

export function applyPrecisionPruningToBonsai(bonsai: BonsaiState, siteId: PruningSiteId, technique: PruningTechnique, now = Date.now()): void {
  const definition = SITE_BY_ID[siteId];
  const state = bonsai.craft.sites[siteId];
  if (!definition || !state || state.removed || ancestorRemoved(bonsai.craft, definition)) return;
  const impact = techniqueImpact(technique, state, definition);
  state.foliage = clamp(state.foliage + impact.foliageDelta);
  state.budCount = clamp(state.budCount + impact.budDelta, 0, 12);
  state.openness = clamp(state.openness + impact.openness);
  state.health = clamp(state.health + impact.health);
  state.vigor = clamp(state.vigor - impact.stress * .45);
  state.scar = clamp(state.scar + impact.scar);
  state.lastTechnique = technique;
  state.lastWorkedAt = now;
  if (technique === 'removeBranch') {
    state.removed = true;
    removeDescendants(bonsai.craft, siteId, now);
  }
  syncPartFromSites(bonsai, definition.parentPartId);
  bonsai.stress = clamp(bonsai.stress + impact.stress, 0, 1000);
  bonsai.vitality = clamp(bonsai.vitality - impact.stress * .22);
  bonsai.lastUpdatedAt = now;
  const techniqueName = PRUNING_TECHNIQUES.find(item => item.id === technique)?.label ?? technique;
  bonsai.logs.unshift({ id: uid(), at: now, text: `${definition.label}へ「${techniqueName}」を行った。元には戻らない。` });
}

function removeDescendants(craft: CraftState, parentId: PruningSiteId, now: number): void {
  for (const child of PRUNING_SITES.filter(item => item.parentId === parentId)) {
    const state = craft.sites[child.id];
    state.removed = true;
    state.foliage = 0;
    state.budCount = 0;
    state.health = 0;
    state.lastTechnique = 'removeBranch';
    state.lastWorkedAt = now;
    removeDescendants(craft, child.id, now);
  }
}

function syncPartFromSites(bonsai: BonsaiState, partId: PartId): void {
  const definitions = PRUNING_SITES.filter(item => item.parentPartId === partId);
  if (!definitions.length) return;
  const states = definitions.map(item => bonsai.craft.sites[item.id]);
  const living = states.filter(item => !item.removed);
  const part = bonsai.parts[partId];
  part.foliage = living.length ? clamp(living.reduce((sum, item) => sum + item.foliage, 0) / living.length) : 0;
  part.health = living.length ? clamp(living.reduce((sum, item) => sum + item.health, 0) / living.length) : 0;
  part.scar = clamp(Math.max(part.scar, ...states.map(item => item.scar)));
  const worked = states.filter(item => item.lastTechnique);
  part.pruneLevel = worked.some(item => item.lastTechnique === 'removeBranch') ? 3
    : worked.some(item => item.lastTechnique === 'tipCutback' || item.lastTechnique === 'innerTwigThin') ? 2
      : worked.length ? 1 : part.pruneLevel;
}

export function precisionVisualSites(bonsai: BonsaiState): Array<PruningSiteDefinition & { opacity: number; removed: boolean }> {
  return PRUNING_SITES.map(definition => {
    const state = bonsai.craft.sites[definition.id];
    const loss = definition.initialFoliage ? clamp((definition.initialFoliage - state.foliage) / definition.initialFoliage) : 0;
    return { ...definition, opacity: clamp(loss * .58 + (state.removed ? .34 : 0), 0, .68), removed: state.removed };
  }).filter(item => item.opacity > .04);
}

export function precisionStructureScore(bonsai: BonsaiState): number {
  const states = PRUNING_SITES.map(definition => ({ definition, state: bonsai.craft.sites[definition.id] }));
  const live = states.filter(item => !item.state.removed);
  const foliage = live.map(item => item.state.foliage);
  const spread = foliage.length ? Math.max(...foliage) - Math.min(...foliage) : 100;
  const averageOpenness = live.length ? live.reduce((sum, item) => sum + item.state.openness, 0) / live.length : 0;
  const defects = states.filter(item => item.definition.role === 'defectBranch' && !item.state.removed).length;
  const missingBases = states.filter(item => item.definition.role === 'branchBase' && item.state.removed).length;
  const tipsWithoutBuds = states.filter(item => item.definition.role === 'tip' && !item.state.removed && item.state.budCount === 0).length;
  return clamp(86 - spread * .32 + Math.min(12, averageOpenness * .16) - defects * 7 - missingBases * 9 - tipsWithoutBuds * 5);
}

const WIRE_DAYS: Record<SpeciesId, Record<'light' | 'strong', number>> = {
  pine: { light: 120, strong: 180 },
  maple: { light: 60, strong: 90 },
  azalea: { light: 75, strong: 105 }
};
const WIRE_GRACE_DAYS: Record<SpeciesId, number> = { pine: 45, maple: 24, azalea: 30 };

export function applyWireTraining(bonsai: BonsaiState, partId: PartId, intensity: 'light' | 'strong', direction: WireDirection, now = Date.now()): void {
  const part = bonsai.parts[partId];
  if (!part || ['trunk', 'roots'].includes(partId) || part.wire) return;
  const readyAt = now + inGameDaysToMs(WIRE_DAYS[bonsai.species][intensity]);
  part.wire = { intensity, direction, appliedAt: now, readyAt, progress: 0, status: 'training', lastRiskAt: now };
  bonsai.stress = clamp(bonsai.stress + (intensity === 'strong' ? 9 : 5), 0, 1000);
  part.health = clamp(part.health - (intensity === 'strong' ? 3 : 1));
  bonsai.logs.unshift({ id: uid(), at: now, text: `${PART_LABELS[partId]}へ${intensity === 'strong' ? '強い' : '軽い'}針金をかけ、${wireDirectionName(direction)}へ養成を始めた。` });
}

export function wireLifecycle(wire: WireState, species: SpeciesId, now = Date.now()): WireLifecycleView {
  const readyAt = finite(wire.readyAt, wire.appliedAt + inGameDaysToMs(WIRE_DAYS[species][wire.intensity]));
  const duration = Math.max(1, readyAt - wire.appliedAt);
  const progress = clamp((now - wire.appliedAt) / duration * 100);
  const graceEnd = readyAt + inGameDaysToMs(WIRE_GRACE_DAYS[species]);
  const status: WireTrainingStatus = now < readyAt ? 'training' : now <= graceEnd ? 'ready' : 'overdue';
  const predictedRetention = status === 'training' ? clamp(25 + progress * .62, 25, 86) : status === 'ready' ? 93 : 97;
  const biteRisk = status === 'overdue' ? clamp((now - graceEnd) / inGameDaysToMs(60) * 100) : 0;
  return {
    status, progress, readyAt,
    remainingInGameDays: Math.max(0, (readyAt - now) / 86_400_000 * 10),
    predictedRetention,
    biteRisk
  };
}

export function removeWireTraining(bonsai: BonsaiState, partId: PartId, now = Date.now()): void {
  const part = bonsai.parts[partId];
  if (!part?.wire) return;
  const view = wireLifecycle(part.wire, bonsai.species, now);
  const direction = part.wire.direction;
  if (view.status === 'overdue') {
    part.scar = clamp(part.scar + Math.max(4, view.biteRisk * .18));
    part.health = clamp(part.health - Math.max(2, view.biteRisk * .08));
  }
  part.trainedDirection = direction;
  part.shapeRetention = Math.round(view.predictedRetention);
  part.wireRemovedAt = now;
  delete part.wire;
  bonsai.logs.unshift({
    id: uid(), at: now,
    text: `${PART_LABELS[partId]}の針金を${view.status === 'training' ? '定着前に' : view.status === 'ready' ? '適期に' : '食い込み後に'}外した。枝姿の定着 ${Math.round(view.predictedRetention)}%。`
  });
}

export function advanceCraftLifecycle(bonsai: BonsaiState, now = Date.now()): void {
  for (const part of Object.values(bonsai.parts)) {
    if (!part.wire) continue;
    const view = wireLifecycle(part.wire, bonsai.species, now);
    part.wire.readyAt = view.readyAt;
    part.wire.progress = view.progress;
    part.wire.status = view.status;
    if (view.status === 'overdue') {
      const riskSlot = Math.floor(now / 43_200_000);
      const previous = Math.floor(finite(part.wire.lastRiskAt, part.wire.appliedAt) / 43_200_000);
      if (riskSlot > previous) {
        part.wire.lastRiskAt = now;
        part.scar = clamp(part.scar + 1.2 + view.biteRisk * .025);
        part.health = clamp(part.health - .8 - view.biteRisk * .012);
      }
    }
  }
}

function wireDirectionName(direction: WireDirection): string {
  return ({ down: '下', up: '上', left: '左', right: '右', front: '手前', back: '奥' } as Record<WireDirection, string>)[direction];
}

const STAGE_WAIT_DAYS: Record<DeadwoodStage, number> = {
  fresh: 7,
  drying: 45,
  carving: 14,
  preserving: 21,
  weathering: 180,
  mature: 0
};

function stageWaitMs(stage: DeadwoodStage): number {
  return inGameDaysToMs(STAGE_WAIT_DAYS[stage]);
}

export function deadwoodStageLabel(stage: DeadwoodStage): string {
  return ({
    fresh: '樹皮剥離直後', drying: '乾燥中', carving: '繊維整形済み',
    preserving: '保護処理直後', weathering: '風化中', mature: '風化完成'
  } as Record<DeadwoodStage, string>)[stage];
}

export function deadwoodNextAction(stage: DeadwoodStage): string {
  return ({
    fresh: '乾燥工程へ移す', drying: '木繊維を整える', carving: '木部を保護処理する',
    preserving: '風化工程へ移す', weathering: '風化完成を確認する', mature: '完成済み'
  } as Record<DeadwoodStage, string>)[stage];
}

export function deadwoodStatus(project: DeadwoodProject, now = Date.now()) {
  return {
    ready: project.stage !== 'mature' && now >= project.readyAt,
    remainingInGameDays: Math.max(0, (project.readyAt - now) / 86_400_000 * 10),
    label: deadwoodStageLabel(project.stage),
    nextAction: deadwoodNextAction(project.stage)
  };
}

export function startJinProjectInGame(game: GameState, partId: PartId, now = Date.now()): GameState {
  const copy = structuredClone(game);
  const bonsai = copy.bonsai.find(item => item.id === copy.activeBonsaiId) ?? copy.bonsai[0];
  if (!bonsai || ['trunk', 'roots'].includes(partId) || bonsai.vitality < 60) return copy;
  if (bonsai.craft.deadwoodProjects.some(project => project.kind === 'jin' && project.targetPartId === partId && project.stage !== 'mature')) return copy;
  const part = bonsai.parts[partId];
  part.deadwood = true;
  part.foliage = 0;
  part.health = clamp(part.health - 12);
  delete part.wire;
  bonsai.craft.deadwoodProjects.unshift({
    id: uid(), kind: 'jin', targetPartId: partId, stage: 'fresh', level: 1,
    startedAt: now, stageStartedAt: now, readyAt: now + stageWaitMs('fresh')
  });
  bonsai.stress = clamp(bonsai.stress + 18, 0, 1000);
  bonsai.logs.unshift({ id: uid(), at: now, text: `${PART_LABELS[partId]}の枝葉を整理し、神の樹皮剥離を始めた。完成には乾燥・整形・保護・風化が必要。` });
  return copy;
}

export function startShariProjectInGame(game: GameState, side: 'left' | 'right', now = Date.now()): GameState {
  const copy = structuredClone(game);
  const bonsai = copy.bonsai.find(item => item.id === copy.activeBonsaiId) ?? copy.bonsai[0];
  if (!bonsai || bonsai.vitality < 70) return copy;
  if (bonsai.craft.deadwoodProjects.some(project => project.kind === 'shari' && project.stage !== 'mature')) return copy;
  const mature = bonsai.craft.deadwoodProjects.filter(project => project.kind === 'shari' && project.stage === 'mature');
  const level = clamp((mature.at(0)?.level ?? 0) + 1, 1, 3) as 1 | 2 | 3;
  bonsai.craft.deadwoodProjects.unshift({
    id: uid(), kind: 'shari', targetPartId: 'trunk', side, stage: 'fresh', level,
    startedAt: now, stageStartedAt: now, readyAt: now + stageWaitMs('fresh')
  });
  bonsai.stress = clamp(bonsai.stress + 14, 0, 1000);
  bonsai.logs.unshift({ id: uid(), at: now, text: `主幹の${side === 'left' ? '左' : '右'}側に、生き筋を残して細い舎利の樹皮剥離を始めた。` });
  return copy;
}

export function advanceDeadwoodProjectInGame(game: GameState, projectId: string, now = Date.now()): GameState {
  const copy = structuredClone(game);
  const bonsai = copy.bonsai.find(item => item.id === copy.activeBonsaiId) ?? copy.bonsai[0];
  const project = bonsai?.craft.deadwoodProjects.find(item => item.id === projectId);
  if (!bonsai || !project || project.stage === 'mature' || now < project.readyAt) return copy;
  const next = ({ fresh: 'drying', drying: 'carving', carving: 'preserving', preserving: 'weathering', weathering: 'mature' } as Partial<Record<DeadwoodStage, DeadwoodStage>>)[project.stage];
  if (!next) return copy;
  project.stage = next;
  project.stageStartedAt = now;
  project.readyAt = now + stageWaitMs(next);
  if (next === 'mature' && project.kind === 'shari') {
    bonsai.shari = { side: project.side === 'right' ? 'right' : 'left', level: project.level, createdAt: project.startedAt };
  }
  bonsai.logs.unshift({
    id: uid(), at: now,
    text: `${project.kind === 'jin' ? `${PART_LABELS[project.targetPartId]}の神` : '舎利'}を「${deadwoodStageLabel(next)}」へ進めた。`
  });
  return copy;
}

export function activeDeadwoodProjects(bonsai: BonsaiState): DeadwoodProject[] {
  return bonsai.craft.deadwoodProjects.filter(project => project.stage !== 'mature');
}

export function exhibitionEligibility(bonsai: BonsaiState, now = Date.now()): EligibilityResult {
  const reasons: string[] = [];
  const wired = Object.entries(bonsai.parts).filter(([, part]) => part.wire);
  if (wired.length) reasons.push(`針金を装着中の枝が${wired.length}か所ある。展示前に外し、枝姿を定着させる必要がある。`);
  const unfinished = activeDeadwoodProjects(bonsai);
  for (const project of unfinished) {
    reasons.push(`${project.kind === 'jin' ? PART_LABELS[project.targetPartId] + 'の神' : '舎利'}が「${deadwoodStageLabel(project.stage)}」で、風化完成していない。`);
  }
  const rootRot = bonsai.parts.roots.disease === 'rootRot';
  if (rootRot) reasons.push('根腐れ兆候があり、展示より回復を優先すべき状態。');
  const affected = Object.values(bonsai.parts).filter(part => part.disease || part.pest).length;
  if (affected && !rootRot) reasons.push(`病害虫が${affected}部位に残っている。`);
  if (bonsai.stress > 70) reasons.push('作業ストレスが高く、展示に耐える培養状態ではない。');
  const recentHeavy = Object.values(bonsai.craft.sites).filter(site =>
    site.lastWorkedAt && now - site.lastWorkedAt < inGameDaysToMs(30)
      && (site.lastTechnique === 'tipCutback' || site.lastTechnique === 'removeBranch')
  ).length;
  if (recentHeavy) reasons.push(`強い剪定から30日相当を経ていない箇所が${recentHeavy}か所ある。`);
  return { eligible: reasons.length === 0, reasons };
}

export function craftSignature(bonsai: BonsaiState): string {
  const sites = PRUNING_SITES.map(definition => {
    const state = bonsai.craft.sites[definition.id];
    return `${definition.id}:${Math.round(state.foliage)}:${state.budCount}:${Math.round(state.openness)}:${state.removed ? 1 : 0}:${state.lastTechnique ?? '-'}`;
  }).join('|');
  const deadwood = bonsai.craft.deadwoodProjects.map(project => `${project.kind}:${project.targetPartId}:${project.side ?? '-'}:${project.stage}:${project.level}`).join('|');
  return `${sites}#${deadwood}`;
}
