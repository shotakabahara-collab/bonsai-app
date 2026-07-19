import { useEffect, useMemo, useState } from 'react';
import { BonsaiStage } from './BonsaiStage';
import { activeBonsai, type GameState, type PartId, type WireDirection } from './model';
import { GAME_UPDATED_EVENT, loadGame, persistGame } from './storage';
import {
  CRAFT_ZONES,
  advanceDeadwoodStage,
  applyFinePrune,
  beginWireTraining,
  craftSummary,
  deadwoodStageName,
  removeTrainingWire,
  showEligibility,
  startDeadwoodProcess,
  type CraftOperation,
  type CraftZoneId,
  type DeadwoodProcess,
  type WireTrainingState
} from './craft-v3';

type Mode = 'prune' | 'wire' | 'deadwood' | 'status' | null;
const GROUPS: Array<{ id: PartId; name: string }> = [
  { id:'apex',name:'頂部' },{ id:'firstLeft',name:'第一枝' },{ id:'secondRight',name:'第二枝' },
  { id:'thirdLeft',name:'第三枝' },{ id:'back',name:'背枝' },{ id:'front',name:'前枝' }
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
  const [game,setGame]=useState<GameState>(()=>loadGame());
  const [mode,setMode]=useState<Mode>(null);
  const [group,setGroup]=useState<PartId>('apex');
  const [zoneId,setZoneId]=useState<CraftZoneId>('apex-leader');
  const [notice,setNotice]=useState('');
  const [wireIntensity,setWireIntensity]=useState<'light'|'strong'>('light');
  const [wireDirection,setWireDirection]=useState<WireDirection>('down');
  const bonsai=activeBonsai(game);
  const eligibility=useMemo(()=>showEligibility(game),[game]);

  useEffect(()=>{
    const onGame=(event:Event)=>setGame((event as CustomEvent<GameState>).detail ?? loadGame());
    window.addEventListener(GAME_UPDATED_EVENT,onGame);
    return()=>window.removeEventListener(GAME_UPDATED_EVENT,onGame);
  },[]);

  useEffect(()=>{
    const intercept=(event:MouseEvent)=>{
      const button=event.target instanceof Element?event.target.closest('button'):null;
      const label=(button?.textContent??'').replace(/\s+/g,' ').trim();
      const open=(next:Mode)=>{ event.preventDefault(); event.stopImmediatePropagation(); setMode(next); };
      if(label.includes('部位剪定')) open('prune');
      else if(label.includes('部位針金')) open('wire');
      else if(label.includes('神・舎利')) open('deadwood');
      else if(label.includes('今週の展覧会へ出展')&&!eligibility.eligible) open('status');
    };
    document.addEventListener('click',intercept,{capture:true});
    return()=>document.removeEventListener('click',intercept,{capture:true});
  },[eligibility.eligible]);

  if(!bonsai) return null;
  const summary=craftSummary(bonsai);
  const zones=CRAFT_ZONES.filter(zone=>zone.group===group);
  const selected=CRAFT_ZONES.find(zone=>zone.id===zoneId)??zones[0];
  const selectedState=(bonsai&&selected)?JSON.parse(localStorage.getItem(`bonsai:craft:v3:${bonsai.id}`)||'null')?.zones?.[selected.id]:null;

  const commit=(next:GameState,message:string)=>{ persistGame(next); setGame(next); setNotice(message); window.setTimeout(()=>location.reload(),400); };
  const chooseGroup=(id:PartId)=>{ setGroup(id); const first=CRAFT_ZONES.find(zone=>zone.group===id); if(first)setZoneId(first.id); };
  const prune=(operation:CraftOperation)=>{
    const op=OPERATIONS.find(item=>item.id===operation)!;
    const warning=operation==='branch-removal'?`${selected.name}を枝元から除去します。子となる枝・葉群・芽も失われ、元に戻せません。`:`${selected.name}へ「${op.label}」を行います。切除した組織は元に戻せません。`;
    if(!confirm(warning))return;
    const result=applyFinePrune(game,selected.id,operation); commit(result.game,`${selected.name}：${op.label}を確定しました`);
  };
  const beginWire=()=>{ const result=beginWireTraining(game,group,wireIntensity,wireDirection); commit(result.game,'針金養成を開始しました'); };
  const removeWire=(partId:PartId)=>{ const result=removeTrainingWire(game,partId); commit(result.game,result.result); };
  const startDeadwood=(kind:'jin'|'shari',side?:'left'|'right')=>{ try{ const result=startDeadwoodProcess(game,kind,kind==='jin'?group:undefined,side); commit(result.game,`${kind==='jin'?'神':'舎利'}の第一工程を開始しました`);}catch(error){setNotice(error instanceof Error?error.message:String(error));} };
  const progressDeadwood=(process:DeadwoodProcess)=>{ try{ const result=advanceDeadwoodStage(game,process.id); commit(result.game,result.message);}catch(error){setNotice(error instanceof Error?error.message:String(error));} };

  return <>
    <div className="craft-v3-badge"><span>精密制作</span><b>26箇所</b>{(summary.wires.length||summary.deadwood.some(item=>item.stage!=='finished'))?<button type="button" onClick={()=>setMode('status')}>養成状況</button>:null}</div>
    {mode&&<div className="craft-v3-backdrop" role="dialog" aria-modal="true"><section className="craft-v3-sheet">
      <header><div><span>BONSAI CRAFT v3</span><h2>{title(mode)}</h2></div><button type="button" onClick={()=>setMode(null)}>×</button></header>
      {mode!=='status'&&<><div className="craft-v3-stage-wrap"><BonsaiStage bonsai={bonsai} className="craft-v3-stage" />{zones.map(zone=><button key={zone.id} type="button" className={`craft-zone-hotspot ${zoneId===zone.id?'selected':''}`} style={{left:`${zone.x}%`,top:`${zone.y}%`}} onClick={()=>setZoneId(zone.id)}>{zone.short}</button>)}</div><div className="craft-group-tabs">{GROUPS.map(item=><button key={item.id} className={group===item.id?'active':''} type="button" onClick={()=>chooseGroup(item.id)}>{item.name}</button>)}</div></>}
      {mode==='prune'&&<div className="craft-v3-content"><div className="craft-zone-summary"><b>{selected.name}</b><span>枝元・中間・先端・葉群・芽を個別管理</span>{selectedState?.removed&&<em>除去済み</em>}</div><p className="craft-guidance">残す芽と将来の輪郭を基準に判断します。剪定は不可逆です。</p><div className="craft-operation-list">{OPERATIONS.map(item=><button key={item.id} type="button" disabled={!allowed(selected.depth,item.id)||selectedState?.removed} onClick={()=>prune(item.id)}><b>{item.label}</b><span>{item.note}</span></button>)}</div></div>}
      {mode==='wire'&&<div className="craft-v3-content"><p className="craft-guidance">針金は即時完成ではありません。養成期間、外し頃、早外しによる戻り、遅れによる食い込み傷を管理します。</p>{summary.wires.find(item=>item.partId===group)?<WireCard wire={summary.wires.find(item=>item.partId===group)!} onRemove={removeWire}/>:<><div className="segmented"><button className={wireIntensity==='light'?'active':''} type="button" onClick={()=>setWireIntensity('light')}>軽針金</button><button className={wireIntensity==='strong'?'active':''} type="button" onClick={()=>setWireIntensity('strong')}>強針金</button></div><div className="direction-grid">{([['down','下げる'],['up','上げる'],['left','左へ'],['right','右へ'],['front','手前へ'],['back','奥へ']] as Array<[WireDirection,string]>).map(([id,label])=><button key={id} className={wireDirection===id?'active':''} type="button" onClick={()=>setWireDirection(id)}>{label}</button>)}</div><button className="craft-primary" type="button" onClick={beginWire}>{groupName(group)}の養成を開始</button></>}</div>}
      {mode==='deadwood'&&<div className="craft-v3-content"><p className="craft-guidance">神・舎利は樹皮剥ぎ、乾燥、繊維整形、保護、風化の順に進めます。未完成中は品評会へ出展できません。</p><div className="deadwood-start-grid"><button type="button" onClick={()=>startDeadwood('jin')}><b>{groupName(group)}を神へ</b><span>枝葉整理から開始</span></button><button type="button" onClick={()=>startDeadwood('shari','left')}><b>左側へ舎利</b><span>生き筋を残す</span></button><button type="button" onClick={()=>startDeadwood('shari','right')}><b>右側へ舎利</b><span>段階的に広げる</span></button></div><DeadwoodList items={summary.deadwood} onProgress={progressDeadwood}/></div>}
      {mode==='status'&&<div className="craft-v3-content"><div className={`eligibility-card ${eligibility.eligible?'eligible':'blocked'}`}><b>{eligibility.eligible?'出展可能':'品評会へ出展できません'}</b>{eligibility.reasons.map(reason=><span key={reason}>{reason}</span>)}</div><div className="craft-status-section"><h3>針金養成</h3>{summary.wires.length?summary.wires.map(item=><WireCard key={item.partId} wire={item} onRemove={removeWire}/>):<p>養成中の枝はありません。</p>}</div><DeadwoodList items={summary.deadwood} onProgress={progressDeadwood}/></div>}
      {notice&&<div className="craft-notice">{notice}</div>}
    </section></div>}
  </>;
}

function WireCard({wire,onRemove}:{wire:WireTrainingState;onRemove:(id:PartId)=>void}){return <div className={`wire-training-card ${wire.status}`}><b>{groupName(wire.partId)}・{wire.status==='ready'?'外し頃':wire.status==='overdue'?'食い込み注意':'養成中'}</b><span>定着見込み {Math.round(wire.fixedRatio*100)}%</span><time>適期 {new Date(wire.idealRemoveAt).toLocaleDateString('ja-JP')}</time><button type="button" onClick={()=>onRemove(wire.partId)}>針金を外す</button></div>}
function DeadwoodList({items,onProgress}:{items:DeadwoodProcess[];onProgress:(item:DeadwoodProcess)=>void}){return <div className="craft-status-section"><h3>神・舎利工程</h3>{items.length?items.map(item=><article key={item.id} className={`deadwood-process ${item.stage}`}><b>{item.kind==='jin'?'神':'舎利'}・{deadwoodStageName(item.stage)}</b><span>{item.kind==='jin'?groupName(item.partId!):`主幹${item.side==='left'?'左':'右'}側`}</span><time>{item.stage==='finished'?'風化完成':`次工程 ${new Date(item.readyAt).toLocaleDateString('ja-JP')}`}</time>{item.stage!=='finished'&&<button type="button" disabled={Date.now()<item.readyAt} onClick={()=>onProgress(item)}>{Date.now()<item.readyAt?'乾燥・安定待ち':'次工程へ進む'}</button>}</article>):<p>進行中の工程はありません。</p>}</div>}
function title(mode:Exclude<Mode,null>){return({prune:'26箇所・精密剪定',wire:'枝姿の針金養成',deadwood:'神・舎利の制作工程',status:'展示前の仕上げ確認'} as Record<Exclude<Mode,null>,string>)[mode]}
function groupName(id:PartId){return GROUPS.find(item=>item.id===id)?.name??id}
function allowed(depth:string,operation:CraftOperation){if(operation==='bud-pinching'||operation==='bud-selection')return depth==='bud'||depth==='tip';if(operation==='branch-removal')return depth==='base'||depth==='middle';if(operation==='needle-thinning')return depth==='pad'||depth==='tip'||depth==='middle';return true}
