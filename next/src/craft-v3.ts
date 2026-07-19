import {
  PARTS,
  activeBonsai,
  diseaseName,
  pestName,
  type BonsaiState,
  type GameState,
  type PartId,
  type SpeciesId,
  type WireDirection
} from './model';

export type CraftOperation =
  | 'bud-pinching'
  | 'bud-selection'
  | 'needle-thinning'
  | 'tip-cutback'
  | 'inner-thinning'
  | 'branch-removal';

export type CraftZoneId =
  | 'apex-leader' | 'apex-left-pad' | 'apex-right-pad' | 'apex-inner'
  | 'first-base' | 'first-middle' | 'first-tip' | 'first-upper-pad' | 'first-lower-pad'
  | 'second-base' | 'second-middle' | 'second-tip' | 'second-upper-pad' | 'second-lower-pad'
  | 'third-base' | 'third-middle' | 'third-tip' | 'third-pad'
  | 'back-base' | 'back-middle' | 'back-tip'
  | 'front-base' | 'front-middle' | 'front-tip'
  | 'inward-branch' | 'crossing-branch';

export interface CraftZoneDefinition {
  id: CraftZoneId;
  group: PartId;
  name: string;
  short: string;
  x: number;
  y: number;
  depth: 'base' | 'middle' | 'tip' | 'pad' | 'bud';
  parentId?: CraftZoneId;
}

export interface CraftZoneState {
  id: CraftZoneId;
  foliage: number;
  budCount: number;
  health: number;
  removed: boolean;
  lastOperation?: CraftOperation;
  lastWorkedAt?: number;
  setAngle?: number;
}

export interface WireTrainingState {
  partId: PartId;
  direction: WireDirection;
  intensity: 'light' | 'strong';
  appliedAt: number;
  idealRemoveAt: number;
  latestRemoveAt: number;
  fixedRatio: number;
  status: 'training' | 'ready' | 'overdue';
}

export type DeadwoodStage = 'fresh' | 'drying' | 'carving' | 'protected' | 'weathering' | 'finished';

export interface DeadwoodProcess {
  id: string;
  kind: 'jin' | 'shari';
  partId?: PartId;
  side?: 'left' | 'right';
  stage: DeadwoodStage;
  startedAt: number;
  stageStartedAt: number;
  readyAt: number;
}

export interface CraftStateV3 {
  version: 3;
  zones: Record<CraftZoneId, CraftZoneState>;
  wires: Partial<Record<PartId, WireTrainingState>>;
  deadwood: DeadwoodProcess[];
  lastAdvancedAt: number;
}

export interface ShowEligibility {
  eligible: boolean;
  reasons: string[];
}

export const CRAFT_ZONES: CraftZoneDefinition[] = [
  { id:'apex-leader',group:'apex',name:'頂部・芯',short:'芯',x:50,y:19,depth:'bud' },
  { id:'apex-left-pad',group:'apex',name:'頂部・左葉棚',short:'左棚',x:40,y:24,depth:'pad' },
  { id:'apex-right-pad',group:'apex',name:'頂部・右葉棚',short:'右棚',x:59,y:25,depth:'pad' },
  { id:'apex-inner',group:'apex',name:'頂部・内側',short:'内',x:50,y:29,depth:'middle' },
  { id:'first-base',group:'firstLeft',name:'第一枝・枝元',short:'枝元',x:42,y:43,depth:'base' },
  { id:'first-middle',group:'firstLeft',name:'第一枝・中間',short:'中',x:34,y:45,depth:'middle',parentId:'first-base' },
  { id:'first-tip',group:'firstLeft',name:'第一枝・先端',short:'先',x:24,y:46,depth:'tip',parentId:'first-middle' },
  { id:'first-upper-pad',group:'firstLeft',name:'第一枝・上側葉群',short:'上葉',x:31,y:39,depth:'pad',parentId:'first-middle' },
  { id:'first-lower-pad',group:'firstLeft',name:'第一枝・下側葉群',short:'下葉',x:31,y:50,depth:'pad',parentId:'first-middle' },
  { id:'second-base',group:'secondRight',name:'第二枝・枝元',short:'枝元',x:53,y:43,depth:'base' },
  { id:'second-middle',group:'secondRight',name:'第二枝・中間',short:'中',x:62,y:40,depth:'middle',parentId:'second-base' },
  { id:'second-tip',group:'secondRight',name:'第二枝・先端',short:'先',x:74,y:39,depth:'tip',parentId:'second-middle' },
  { id:'second-upper-pad',group:'secondRight',name:'第二枝・上側葉群',short:'上葉',x:64,y:34,depth:'pad',parentId:'second-middle' },
  { id:'second-lower-pad',group:'secondRight',name:'第二枝・下側葉群',short:'下葉',x:66,y:46,depth:'pad',parentId:'second-middle' },
  { id:'third-base',group:'thirdLeft',name:'第三枝・枝元',short:'枝元',x:43,y:62,depth:'base' },
  { id:'third-middle',group:'thirdLeft',name:'第三枝・中間',short:'中',x:34,y:64,depth:'middle',parentId:'third-base' },
  { id:'third-tip',group:'thirdLeft',name:'第三枝・先端',short:'先',x:25,y:66,depth:'tip',parentId:'third-middle' },
  { id:'third-pad',group:'thirdLeft',name:'第三枝・葉棚',short:'葉棚',x:31,y:58,depth:'pad',parentId:'third-middle' },
  { id:'back-base',group:'back',name:'背枝・枝元',short:'枝元',x:51,y:52,depth:'base' },
  { id:'back-middle',group:'back',name:'背枝・中間',short:'中',x:58,y:53,depth:'middle',parentId:'back-base' },
  { id:'back-tip',group:'back',name:'背枝・先端',short:'先',x:65,y:52,depth:'tip',parentId:'back-middle' },
  { id:'front-base',group:'front',name:'前枝・枝元',short:'枝元',x:48,y:61,depth:'base' },
  { id:'front-middle',group:'front',name:'前枝・中間',short:'中',x:54,y:66,depth:'middle',parentId:'front-base' },
  { id:'front-tip',group:'front',name:'前枝・先端',short:'先',x:61,y:70,depth:'tip',parentId:'front-middle' },
  { id:'inward-branch',group:'front',name:'内向き枝',short:'内枝',x:49,y:48,depth:'middle' },
  { id:'crossing-branch',group:'back',name:'交差枝',short:'交差',x:55,y:57,depth:'middle' }
];

const KEY_PREFIX = 'bonsai:craft:v3:';
const DAY = 86_400_000;

export function createCraftState(bonsai: BonsaiState): CraftStateV3 {
  const zones = Object.fromEntries(CRAFT_ZONES.map(zone => [zone.id, {
    id: zone.id,
    foliage: initialZoneFoliage(bonsai, zone),
    budCount: zone.depth === 'bud' || zone.depth === 'tip' ? 3 : 1,
    health: bonsai.parts[zone.group]?.health ?? 90,
    removed: false
  }])) as Record<CraftZoneId, CraftZoneState>;
  return { version: 3, zones, wires: {}, deadwood: [], lastAdvancedAt: Date.now() };
}

export function loadCraftState(bonsai: BonsaiState): CraftStateV3 {
  try {
    const raw = localStorage.getItem(`${KEY_PREFIX}${bonsai.id}`);
    if (!raw) return createCraftState(bonsai);
    return normalizeCraftState(bonsai, JSON.parse(raw));
  } catch {
    return createCraftState(bonsai);
  }
}

export function saveCraftState(bonsaiId: string, state: CraftStateV3): void {
  localStorage.setItem(`${KEY_PREFIX}${bonsaiId}`, JSON.stringify(state));
}

export function normalizeCraftState(bonsai: BonsaiState, raw: Partial<CraftStateV3>): CraftStateV3 {
  const base = createCraftState(bonsai);
  const sourceZones = raw?.zones ?? {} as Partial<Record<CraftZoneId, CraftZoneState>>;
  for (const zone of CRAFT_ZONES) {
    const current = sourceZones[zone.id];
    if (!current) continue;
    base.zones[zone.id] = {
      ...base.zones[zone.id],
      ...current,
      foliage: clampNumber(current.foliage, 0, 100, base.zones[zone.id].foliage),
      budCount: clampNumber(current.budCount, 0, 12, base.zones[zone.id].budCount),
      health: clampNumber(current.health, 0, 100, base.zones[zone.id].health),
      removed: current.removed === true,
      setAngle: Number.isFinite(current.setAngle) ? Number(current.setAngle) : undefined
    };
  }
  base.wires = raw?.wires ?? {};
  base.deadwood = Array.isArray(raw?.deadwood) ? raw!.deadwood! : [];
  base.lastAdvancedAt = Number.isFinite(raw?.lastAdvancedAt) ? Number(raw!.lastAdvancedAt) : Date.now();
  return advanceCraftState(bonsai, base);
}

export function applyFinePrune(game: GameState, zoneId: CraftZoneId, operation: CraftOperation): { game: GameState; craft: CraftStateV3 } {
  const copy = structuredClone(game);
  const bonsai = activeBonsai(copy);
  if (!bonsai) return { game: copy, craft: createCraftState({} as BonsaiState) };
  const craft = loadCraftState(bonsai);
  const zoneDef = CRAFT_ZONES.find(zone => zone.id === zoneId)!;
  const zone = craft.zones[zoneId];
  if (zone.removed) return { game: copy, craft };

  const impact = operationImpact(operation);
  zone.foliage = Math.max(0, zone.foliage - impact.foliage);
  zone.budCount = Math.max(0, zone.budCount - impact.buds);
  zone.health = Math.max(0, zone.health - impact.health);
  zone.lastOperation = operation;
  zone.lastWorkedAt = Date.now();
  if (operation === 'branch-removal') removeZoneAndChildren(craft, zoneId);

  const part = bonsai.parts[zoneDef.group];
  if (part) {
    part.foliage = Math.max(0, part.foliage - impact.parentFoliage);
    part.health = Math.max(0, part.health - impact.health * .45);
    part.scar = Math.min(100, part.scar + impact.scar);
    part.pruneLevel = Math.max(part.pruneLevel, impact.pruneLevel) as 0|1|2|3;
  }
  bonsai.stress = Math.min(1000, bonsai.stress + impact.stress);
  bonsai.vitality = Math.max(0, bonsai.vitality - impact.vitality);
  bonsai.logs.unshift({ id: uid(), at: Date.now(), text: `${zoneDef.name}へ${operationName(operation)}を行った。切った組織は元に戻らない。` });
  saveCraftState(bonsai.id, craft);
  return { game: copy, craft };
}

export function beginWireTraining(game: GameState, partId: PartId, intensity: 'light'|'strong', direction: WireDirection): { game: GameState; craft: CraftStateV3 } {
  const copy = structuredClone(game);
  const bonsai = activeBonsai(copy);
  if (!bonsai) throw new Error('盆栽が見つかりません');
  if (['trunk','roots'].includes(partId)) throw new Error('この部位には針金をかけられません');
  const craft = loadCraftState(bonsai);
  const days = wireTrainingDays(bonsai.species, intensity);
  const now = Date.now();
  craft.wires[partId] = {
    partId, direction, intensity, appliedAt: now,
    idealRemoveAt: now + days * DAY,
    latestRemoveAt: now + Math.round(days * 1.35) * DAY,
    fixedRatio: 0,
    status: 'training'
  };
  bonsai.parts[partId].wire = { intensity, direction, appliedAt: now };
  bonsai.stress = Math.min(1000, bonsai.stress + (intensity === 'strong' ? 9 : 5));
  bonsai.logs.unshift({ id: uid(), at: now, text: `${partName(partId)}へ針金をかけた。枝姿が定着するまで養成する。` });
  saveCraftState(bonsai.id, craft);
  return { game: copy, craft };
}

export function removeTrainingWire(game: GameState, partId: PartId): { game: GameState; craft: CraftStateV3; result: string } {
  const copy = structuredClone(game);
  const bonsai = activeBonsai(copy);
  if (!bonsai) throw new Error('盆栽が見つかりません');
  const craft = advanceCraftState(bonsai, loadCraftState(bonsai));
  const wire = craft.wires[partId];
  if (!wire) return { game: copy, craft, result: '針金はかかっていません' };
  const now = Date.now();
  const progress = Math.max(0, Math.min(1, (now - wire.appliedAt) / (wire.idealRemoveAt - wire.appliedAt)));
  const overdue = now > wire.latestRemoveAt;
  const fixedRatio = overdue ? .94 : now >= wire.idealRemoveAt ? .88 : Math.max(.18, progress * .72);
  const scar = overdue ? Math.min(30, 5 + (now - wire.latestRemoveAt) / DAY) : 0;
  bonsai.parts[partId].scar = Math.min(100, bonsai.parts[partId].scar + scar);
  delete bonsai.parts[partId].wire;
  delete craft.wires[partId];
  CRAFT_ZONES.filter(zone => zone.group === partId).forEach(zone => {
    craft.zones[zone.id].setAngle = directionAngle(wire.direction) * fixedRatio;
  });
  const result = overdue
    ? `外し遅れ。枝姿は定着したが、食い込み跡が${Math.round(scar)}残った。`
    : now >= wire.idealRemoveAt
      ? `適期に外した。枝姿が${Math.round(fixedRatio * 100)}%定着した。`
      : `早外し。枝姿の定着は${Math.round(fixedRatio * 100)}%に留まった。`;
  bonsai.logs.unshift({ id: uid(), at: now, text: `${partName(partId)}の針金を外した。${result}` });
  saveCraftState(bonsai.id, craft);
  return { game: copy, craft, result };
}

export function startDeadwoodProcess(game: GameState, kind: 'jin'|'shari', partId?: PartId, side?: 'left'|'right'): { game: GameState; craft: CraftStateV3 } {
  const copy = structuredClone(game);
  const bonsai = activeBonsai(copy);
  if (!bonsai) throw new Error('盆栽が見つかりません');
  if (kind === 'jin' && (!partId || ['trunk','roots'].includes(partId))) throw new Error('神にする枝を選んでください');
  if (kind === 'shari' && !side) throw new Error('舎利を入れる側を選んでください');
  if (bonsai.vitality < (kind === 'jin' ? 65 : 75)) throw new Error('樹勢が不足しています');
  const craft = loadCraftState(bonsai);
  if (craft.deadwood.some(item => item.stage !== 'finished')) throw new Error('進行中の神・舎利工程があります');
  const now = Date.now();
  craft.deadwood.push({
    id: uid(), kind, partId, side, stage:'fresh', startedAt:now, stageStartedAt:now,
    readyAt: now + deadwoodStageDays(kind, 'fresh') * DAY
  });
  bonsai.stress = Math.min(1000, bonsai.stress + (kind === 'jin' ? 16 : 20));
  if (kind === 'jin' && partId) {
    bonsai.parts[partId].foliage = 0;
    bonsai.parts[partId].health = Math.max(0, bonsai.parts[partId].health - 55);
  }
  bonsai.logs.unshift({ id:uid(), at:now, text: kind === 'jin' ? `${partName(partId!)}の神制作を開始した。まず樹皮を剥ぎ乾燥を待つ。` : `主幹${side === 'left' ? '左' : '右'}側の舎利制作を開始した。生き筋を残して乾燥を待つ。` });
  saveCraftState(bonsai.id, craft);
  return { game: copy, craft };
}

export function advanceDeadwoodStage(game: GameState, processId: string): { game: GameState; craft: CraftStateV3; message: string } {
  const copy = structuredClone(game);
  const bonsai = activeBonsai(copy);
  if (!bonsai) throw new Error('盆栽が見つかりません');
  const craft = advanceCraftState(bonsai, loadCraftState(bonsai));
  const process = craft.deadwood.find(item => item.id === processId);
  if (!process) throw new Error('工程が見つかりません');
  if (Date.now() < process.readyAt) throw new Error('木部の乾燥・安定を待つ必要があります');
  const next = nextDeadwoodStage(process.stage);
  process.stage = next;
  process.stageStartedAt = Date.now();
  process.readyAt = Date.now() + deadwoodStageDays(process.kind, next) * DAY;
  if (next === 'finished') {
    if (process.kind === 'jin' && process.partId) bonsai.parts[process.partId].deadwood = true;
    if (process.kind === 'shari' && process.side) bonsai.shari = { side: process.side, level: 1, createdAt: process.startedAt };
  }
  const message = `${process.kind === 'jin' ? '神' : '舎利'}工程を「${deadwoodStageName(next)}」へ進めた。`;
  bonsai.logs.unshift({ id:uid(), at:Date.now(), text:message });
  saveCraftState(bonsai.id, craft);
  return { game:copy, craft, message };
}

export function advanceCraftState(bonsai: BonsaiState, state: CraftStateV3, now = Date.now()): CraftStateV3 {
  for (const wire of Object.values(state.wires)) {
    if (!wire) continue;
    const progress = Math.max(0, Math.min(1, (now - wire.appliedAt) / (wire.idealRemoveAt - wire.appliedAt)));
    wire.fixedRatio = progress * .82;
    wire.status = now > wire.latestRemoveAt ? 'overdue' : now >= wire.idealRemoveAt ? 'ready' : 'training';
  }
  state.lastAdvancedAt = now;
  return state;
}

export function showEligibility(game: GameState): ShowEligibility {
  const bonsai = activeBonsai(game);
  if (!bonsai) return { eligible:false, reasons:['出展作品がありません'] };
  const craft = advanceCraftState(bonsai, loadCraftState(bonsai));
  const reasons:string[] = [];
  const wires = Object.values(craft.wires).filter(Boolean) as WireTrainingState[];
  if (wires.length) reasons.push(`針金養成中の枝が${wires.length}本あります。全て外して仕上げてください。`);
  const unfinished = craft.deadwood.filter(item => item.stage !== 'finished');
  if (unfinished.length) reasons.push(`神・舎利の未完工程が${unfinished.length}件あります。風化完成まで出展できません。`);
  const affected = PARTS.filter(part => bonsai.parts[part.id]?.disease || bonsai.parts[part.id]?.pest);
  if (affected.length) reasons.push(`病害虫が${affected.length}部位に確認されています。`);
  if (bonsai.parts.roots.disease === 'rootRot') reasons.push('根腐れ兆候があるため出展できません。');
  if (bonsai.stress > 55) reasons.push('作業ストレスが高く、展示前の養生が必要です。');
  return { eligible: reasons.length === 0, reasons };
}

export function craftSummary(bonsai:BonsaiState): { zones:number; removed:number; wires:WireTrainingState[]; deadwood:DeadwoodProcess[] } {
  const craft = advanceCraftState(bonsai, loadCraftState(bonsai));
  return {
    zones: CRAFT_ZONES.length,
    removed: Object.values(craft.zones).filter(zone => zone.removed).length,
    wires: Object.values(craft.wires).filter(Boolean) as WireTrainingState[],
    deadwood: craft.deadwood
  };
}

function initialZoneFoliage(bonsai:BonsaiState, zone:CraftZoneDefinition):number {
  const parent = bonsai.parts[zone.group]?.foliage ?? 50;
  return Math.round(parent * (zone.depth === 'pad' ? .72 : zone.depth === 'tip' ? .46 : zone.depth === 'bud' ? .35 : .55));
}
function operationImpact(operation:CraftOperation) {
  return ({
    'bud-pinching': { foliage:4,buds:1,health:0,parentFoliage:1,scar:0,stress:1,vitality:.1,pruneLevel:1 },
    'bud-selection': { foliage:2,buds:1,health:0,parentFoliage:1,scar:0,stress:1,vitality:.1,pruneLevel:1 },
    'needle-thinning': { foliage:12,buds:0,health:1,parentFoliage:4,scar:0,stress:2,vitality:.4,pruneLevel:1 },
    'tip-cutback': { foliage:18,buds:2,health:2,parentFoliage:7,scar:3,stress:5,vitality:1,pruneLevel:2 },
    'inner-thinning': { foliage:14,buds:0,health:1,parentFoliage:5,scar:2,stress:3,vitality:.7,pruneLevel:2 },
    'branch-removal': { foliage:100,buds:12,health:100,parentFoliage:28,scar:12,stress:12,vitality:3,pruneLevel:3 }
  } as const)[operation];
}
function removeZoneAndChildren(craft:CraftStateV3,id:CraftZoneId) {
  const queue:CraftZoneId[]=[id];
  while(queue.length){ const current=queue.shift()!; craft.zones[current].removed=true; craft.zones[current].foliage=0; craft.zones[current].budCount=0; CRAFT_ZONES.filter(z=>z.parentId===current).forEach(z=>queue.push(z.id)); }
}
function operationName(operation:CraftOperation):string { return ({'bud-pinching':'芽切り','bud-selection':'芽かき','needle-thinning':'古葉取り・葉透かし','tip-cutback':'枝先の切り戻し','inner-thinning':'懐枝の整理','branch-removal':'枝抜き'} as Record<CraftOperation,string>)[operation]; }
function wireTrainingDays(species:SpeciesId,intensity:'light'|'strong'):number { const base=species==='pine'?42:species==='maple'?24:28; return Math.round(base*(intensity==='strong'?1.25:1)); }
function directionAngle(direction:WireDirection):number { return ({down:18,up:-12,left:-16,right:16,front:8,back:-8} as Record<WireDirection,number>)[direction]; }
function deadwoodStageDays(kind:'jin'|'shari',stage:DeadwoodStage):number { const base=kind==='jin'?{fresh:4,drying:7,carving:3,protected:10,weathering:30,finished:0}:{fresh:7,drying:14,carving:5,protected:14,weathering:45,finished:0}; return base[stage]; }
function nextDeadwoodStage(stage:DeadwoodStage):DeadwoodStage { return ({fresh:'drying',drying:'carving',carving:'protected',protected:'weathering',weathering:'finished',finished:'finished'} as Record<DeadwoodStage,DeadwoodStage>)[stage]; }
export function deadwoodStageName(stage:DeadwoodStage):string { return ({fresh:'樹皮剥ぎ直後',drying:'乾燥中',carving:'繊維整形',protected:'保護処理後',weathering:'風化待ち',finished:'風化完成'} as Record<DeadwoodStage,string>)[stage]; }
function partName(id:PartId):string { return PARTS.find(part=>part.id===id)?.name ?? id; }
function clampNumber(value:unknown,min:number,max:number,fallback:number):number { const n=Number(value); return Number.isFinite(n)?Math.max(min,Math.min(max,n)):fallback; }
function uid():string { return typeof crypto!=='undefined'&&'randomUUID'in crypto?crypto.randomUUID():`${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`; }
