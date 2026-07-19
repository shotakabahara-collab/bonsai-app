import { useEffect, useMemo, useState } from 'react';
import { BonsaiStage } from './BonsaiStage';
import { activeBonsai, persistGame as _unused, type GameState, type PartId, type WireDirection } from './model';
import { loadGame, persistGame, GAME_UPDATED_EVENT } from './storage';
import {
  CRAFT_ZONES,
  advanceDeadwoodStage,
  applyFinePrune,
  beginWireTraining,
  craftSummary,
  deadwoodStageName,
  loadCraftState,
  removeTrainingWire,
  showEligibility,
  startDeadwoodProcess,
  type CraftOperation,
  type CraftZoneId,
  type DeadwoodProcess,
  type WireTrainingState
} from './craft-v3';

// This layer deliberately intercepts the legacy coarse care buttons in capture phase.
// It keeps the stable production App intact while replacing care/show interactions with
// the authentic branch hierarchy and training lifecycle.

type Mode = 'prune' | 'wire' | 'deadwood' | 'status' | null;

const GROUPS: Array<{ id: PartId; name: string }> = [
  { id:'apex',name:'頂部' }, { id:'firstLeft',name:'第一枝' }, { id:'secondRight',name:'第二枝' },
  { id:'thirdLeft',name:'第三枝' }, { id:'back',name:'背枝' }, { id:'front',name:'前枝' }
];

const OPERATIONS: Array<{ id: CraftOperation; label: string; note: string }> = [
  { id:'bud-pinching',label:'芽切り',note:'伸びた芽を止め、次の芽吹きを整える' },
  { id:'bud-selection',label:'芽かき',note:'残す芽を選び、将来の枝方向を決める' },
  { id:'needle-thinning',label:'古葉取り・葉透かし',note:'枝を切らず、光と通風を入れる' },
  { id:'tip-cutback',label:'枝先の切り戻し',note:'先端を詰め、樹冠を小さくする' },
  { id:'inner-thinning',label:'懐枝の整理',note:'内側の混みを抜き、奥行きを作る' },
  { id:'branch-removal',label:'枝抜き',note:'枝系統を元から落とす。完全に不可逆' }
];

export function AuthenticCraftLayer() {
  const [game, setGame] = useState<GameState>(() => loadGame());
  const [mode, setMode] = useState<Mode>(null);
  const [group, setGroup] = useState<PartId>('apex');
  const [zoneId, setZoneId] = useState<CraftZoneId>('apex-leader');
  const [notice, setNotice] = useState('');
  const bonsai = activeBonsai(game);
  const craft = useMemo(() => bonsai ? loadCraftState(bonsai) : null, [bonsai?.id, game]);
  const eligibility = useMemo(() => showEligibility(game), [game]);

  useEffect(() => {
    const onGame = (event: Event) => {
      const detail = (event as CustomEvent<GameState>).detail;
      setGame(detail ?? loadGame());
    };
    window.addEventListener(GAME_UPDATED_EVENT, onGame);
    return () => window.removeEventListener(GAME_UPDATED_EVENT, onGame);
  }, []);

  useEffect(() => {
    const intercept = (event: MouseEvent) => {
      const button = event.target instanceof Element ? event.target.closest('button') : null;
      if (!button) return;
      const label = (button.textContent ?? '').replace(/\s+/g, ' ').trim();
      if (label.includes('部位剪定')) {
        event.preventDefault(); event.stopImmediatePropagation(); setMode('prune'); return;
      }
      if (label.includes('部位針金')) {
        event.preventDefault(); event.stopImmediatePropagation(); setMode('wire'); return;
      }
      if (label.includes('神・舎利')) {
        event.preventDefault(); event.stopImmediatePropagation(); setMode('deadwood'); return;
      }
      if (label.includes('今週の展覧会へ出展') && !eligibility.eligible) {
        event.preventDefault(); event.stopImmediatePropagation(); setMode('status'); return;
      }
    };
    document.addEventListener('click', intercept, { capture:true });
    return () => document.removeEventListener('click', intercept, { capture:true });
  }, [eligibility.eligible]);

  if (!bonsai || !craft) return null;
  const zones = CRAFT_ZONES.filter(zone => zone.group === group);
  const selected = CRAFT_ZONES.find(zone => zone.id === zoneId) ?? zones[0];
  const selectedState = craft.zones[selected.id];
  const summary = craftSummary(bonsai);

  const saveAndRefresh = (next: GameState, message: string) => {
    persistGame(next);
    setGame(next);
    setNotice(message);
    window.setTimeout(() => window.location.reload(), 450);
  };

  const chooseGroup = (id: PartId) => {
    setGroup(id);
    const first = CRAFT_ZONES.find(zone => zone.group === id);
    if (first) setZoneId(first.id);
  };

  const applyPrune = (operation: CraftOperation) => {
    const label = OPERATIONS.find(item => item.id === operation)?.label ?? operation;
    const warning = operation === 'branch-removal'
      ? `${selected.name}を枝元から除去します。子となる小枝・葉群・芽も失われ、元に戻せません。`
      : `${selected.name}へ「${label}」を行います。切除した組織は元に戻せません。`;
    if (!window.confirm(warning)) return;
    const result = applyFinePrune(game, selected.id, operation);
    saveAndRefresh(result.game, `${selected.name}：${label}を確定しました`);
  };

  const applyWire = (intensity: 'light'|'strong', direction: WireDirection) => {
    const result = beginWireTraining(game, group, intensity, direction);
    saveAndRefresh(result.game, `${GROUPS.find(item=>item.id===group)?.name}の針金養成を開始しました`);
  };

  const removeWire = (partId: PartId) => {
    const result = removeTrainingWire(game, partId);
    saveAndRefresh(result.game, result.result);
  };

  const startDeadwood = (kind:'jin'|'shari', side?:'left'|'right') => {
    try {
      if (!window.confirm(kind === 'jin'
        ? `${GROUPS.find(item=>item.id===group)?.name}の神制作を開始します。完成まで複数工程と時間が必要です。`
        : `主幹${side === 'left' ? '左' : '右'}側の舎利制作を開始します。生き筋を残し、段階的に仕上げます。`)) return;
      const result = startDeadwoodProcess(game, kind, kind === 'jin' ? group : undefined, side);
      saveAndRefresh(result.game, `${kind === 'jin' ? '神' : '舎利'}の第一工程を開始しました`);
    } catch (error) { setNotice(error instanceof Error ? error.message : String(error)); }
  };

  const progressDeadwood = (process:DeadwoodProcess) => {
    try {
      const result = advanceDeadwoodStage(game, process.id);
      saveAndRefresh(result.game, result.message);
    } catch (error) { setNotice(error instanceof Error ? error.message : String(error)); }
  };

  return (
    <>
      <div className="craft-v3-badge" aria-label="精密制作状態">
        <span>精密制作</span><b>{summary.zones}箇所</b>
        {(summary.wires.length > 0 || summary.deadwood.some(item=>item.stage!=='finished')) &&
          <button type="button" onClick={()=>setMode('status')}>養成状況</button>}
      </div>

      {mode && (
        <div className="craft-v3-backdrop" role="dialog" aria-modal="true" aria-label="本物志向の盆栽制作">
          <section className="craft-v3-sheet">
            <header>
              <div><span>BONSAI CRAFT v3</span><h2>{modeTitle(mode)}</h2></div>
              <button type="button" aria-label="閉じる" onClick={()=>setMode(null)}>×</button>
            </header>

            {mode !== 'status' && (
              <>
                <div className="craft-v3-stage-wrap">
                  <BonsaiStage bonsai={bonsai} className="craft-v3-stage" />
                  {zones.map(zone => (
                    <button key={zone.id} type="button" aria-label={`${zone.name}を選択`}
                      className={`craft-zone-hotspot ${zoneId===zone.id?'selected':''} ${craft.zones[zone.id].removed?'removed':''}`}
                      style={{left:`${zone.x}%`,top:`${zone.y}%`}} onClick={()=>setZoneId(zone.id)}>{zone.short}</button>
                  ))}
                </div>
                <div className="craft-group-tabs">
                  {GROUPS.map(item=><button key={item.id} type="button" className={group===item.id?'active':''} onClick={()=>chooseGroup(item.id)}>{item.name}</button>)}
                </div>
              </>
            )}

            {mode === 'prune' && (
              <div className="craft-v3-content">
                <div className="craft-zone-summary"><b>{selected.name}</b><span>葉量 {Math.round(selectedState.foliage)}／芽 {selectedState.budCount}／健康 {Math.round(selectedState.health)}</span>{selectedState.removed&&<em>除去済み</em>}</div>
                <p className="craft-guidance">枝系統を選び、枝元・中間・先端・葉群・芽のどこへ手を入れるか決めます。操作名ではなく、残す芽と将来の輪郭を基準に判断してください。</p>
                <div className="craft-operation-list">
                  {OPERATIONS.map(item=><button key={item.id} type="button" disabled={selectedState.removed || !operationAllowed(selected.depth,item.id)} onClick={()=>applyPrune(item.id)}><b>{item.label}</b><span>{item.note}</span></button>)}
                </div>
              </div>
            )}

            {mode === 'wire' && (
              <WirePanel wires={summary.wires} group={group} onApply={applyWire} onRemove={removeWire} />
            )}

            {mode === 'deadwood' && (
              <div className="craft-v3-content">
                <p className="craft-guidance">神・舎利は一度の操作で白く完成しません。樹皮剥ぎ、乾燥、繊維整形、保護、風化の順に進みます。未完成工程がある作品は品評会へ出せません。</p>
                <div className="deadwood-start-grid">
                  <button type="button" disabled={['trunk','roots'].includes(group)} onClick={()=>startDeadwood('jin')}><b>{GROUPS.find(item=>item.id===group)?.name}を神へ</b><span>枝葉整理→樹皮剥ぎ→乾燥</span></button>
                  <button type="button" onClick={()=>startDeadwood('shari','left')}><b>左側へ舎利</b><span>生き筋を残して細く開始</span></button>
                  <button type="button" onClick={()=>startDeadwood('shari','right')}><b>右側へ舎利</b><span>一度に広げず年次で進行</span></button>
                </div>
                <DeadwoodTimeline processes={summary.deadwood} onProgress={progressDeadwood} />
              </div>
            )}

            {mode === 'status' && (
              <div className="craft-v3-content">
                <div className={`eligibility-card ${eligibility.eligible?'eligible':'blocked'}`}><b>{eligibility.eligible?'出展可能':'品評会へ出展できません'}</b>{eligibility.reasons.map(reason=><span key={reason}>{reason}</span>)}</div>
                <WireStatus wires={summary.wires} onRemove={removeWire} />
                <DeadwoodTimeline processes={summary.deadwood} onProgress={progressDeadwood} />
              </div>
            )}
            {notice && <div className="craft-notice" role="status">{notice}</div>}
          </section>
        </div>
      )}
    </>
  );
}

function WirePanel({wires,group,onApply,onRemove}:{wires:WireTrainingState[];group:PartId;onApply:(i:'light'|'strong',d:WireDirection)=>void;onRemove:(p:PartId)=>void}) {
  const [intensity,setIntensity]=useState<'light'|'strong'>('light');
  const [direction,setDirection]=useState<WireDirection>('down');
  const existing=wires.find(item=>item.partId===group);
  return <div className="craft-v3-content"><p className="craft-guidance">針金は枝姿を即時完成させません。黒松は適期まで養成し、師匠の「外し頃」で外すと高い割合で定着します。早外しは戻り、遅れは食い込み傷になります。</p>{existing?<div className={`wire-training-card ${existing.status}`}><b>{partLabel(existing.partId)}・{wireStatusName(existing.status)}</b><span>定着見込み {Math.round(existing.fixedRatio*100)}%</span><time>適期 {new Date(existing.idealRemoveAt).toLocaleDateString('ja-JP')}</time><button type="button" onClick={()=>onRemove(existing.partId)}>針金を外す</button></div>:<><div className="segmented"><button className={intensity==='light'?'active':''} type="button" onClick={()=>setIntensity('light')}>軽針金</button><button className={intensity==='strong'?'active':''} type="button" onClick={()=>setIntensity('strong')}>強針金</button></div><div className="direction-grid">{([['down','下げる'],['up','上げる'],['left','左へ'],['right','右へ'],['front','手前へ'],['back','奥へ']] as Array<[WireDirection,string]>).map(([id,label])=><button key={id} className={direction===id?'active':''} type="button" onClick={()=>setDirection(id)}>{label}</button>)}</div><button className="craft-primary" type="button" onClick={()=>onApply(intensity,direction)}>{partLabel(group)}の養成を開始</button></>}</div>;
}
function WireStatus({wires,onRemove}:{wires:WireTrainingState[];onRemove:(p:PartId)=>void}) { return <div className="craft-status-section"><h3>針金養成</h3>{wires.length===0?<p>針金養成中の枝はありません。</p>:wires.map(wire=><div key={wire.partId} className={`wire-training-card ${wire.status}`}><b>{partLabel(wire.partId)}・{wireStatusName(wire.status)}</b><span>定着見込み {Math.round(wire.fixedRatio*100)}%</span><time>適期 {new Date(wire.idealRemoveAt).toLocaleDateString('ja-JP')}</time><button type="button" onClick={()=>onRemove(wire.partId)}>外す</button></div>)}</div>; }
function DeadwoodTimeline({processes,onProgress}:{processes:DeadwoodProcess[];onProgress:(p:DeadwoodProcess)=>void}) { return <div className="craft-status-section"><h3>神・舎利工程</h3>{processes.length===0?<p>進行中の古木技法はありません。</p>:processes.map(process=><article key={process.id} className={`deadwood-process ${process.stage}`}><b>{process.kind==='jin'?'神':'舎利'}・{deadwoodStageName(process.stage)}</b><span>{process.kind==='jin'?partLabel(process.partId!):`主幹${process.side==='left'?'左':'右'}側`}</span><time>{process.stage==='finished'?'風化完成':`次工程 ${new Date(process.readyAt).toLocaleDateString('ja-JP')}`}</time>{process.stage!=='finished'&&<button type="button" disabled={Date.now()<process.readyAt} onClick={()=>onProgress(process)}>{Date.now()<process.readyAt?'乾燥・安定待ち':'次工程へ進む'}</button>}</article>)}</div>; }
function modeTitle(mode:Exclude<Mode,null>):string { return ({prune:'26箇所・精密剪定',wire:'枝姿の針金養成',deadwood:'神・舎利の制作工程',status:'展示前の仕上げ確認'} as Record<Exclude<Mode,null>,string>)[mode]; }
function operationAllowed(depth:string,operation:CraftOperation):boolean { if(operation==='bud-pinching'||operation==='bud-selection') return depth==='bud'||depth==='tip'; if(operation==='branch-removal') return depth==='base'||depth==='middle'; if(operation==='needle-thinning') return depth==='pad'||depth==='tip'||depth==='middle'; return true; }
function partLabel(id:PartId):string { return GROUPS.find(item=>item.id===id)?.name ?? id; }
function wireStatusName(status:WireTrainingState['status']):string { return status==='ready'?'外し頃':status==='overdue'?'食い込み注意':'養成中'; }
