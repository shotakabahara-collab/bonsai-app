import { useMemo, useState } from 'react';
import {
  PARTS,
  diseaseName,
  pestName,
  type BonsaiState,
  type PartId,
  type SpeciesId,
  type WireDirection
} from './model';
import { CRAFT_ZONES, deadwoodStageName, loadCraftState, type DeadwoodProcess } from './craft-v3';

type Coil = readonly [x:number,y:number,angle:number,length:number];
const WIRE_COILS:Partial<Record<PartId,readonly Coil[]>>={
  apex:[[468,610,48,34],[448,575,50,32],[427,540,52,31],[405,505,54,30],[383,470,56,28],[360,435,58,27]],
  firstLeft:[[420,535,-18,33],[382,525,-16,31],[344,514,-15,29],[307,502,-14,28],[270,490,-12,26],[233,479,-10,24]],
  secondRight:[[492,596,55,34],[530,571,58,33],[569,548,61,31],[610,528,65,30],[651,515,70,28],[692,510,76,26]],
  thirdLeft:[[408,786,-24,35],[372,772,-22,33],[336,758,-20,31],[300,744,-18,29],[264,730,-16,27]],
  back:[[482,676,68,31],[520,681,72,30],[558,687,76,28],[596,694,80,26]],
  front:[[448,748,54,35],[485,765,58,34],[523,782,62,32],[561,798,66,30],[600,812,70,28]]
};
const BRANCH_PATHS:Partial<Record<PartId,string>>={
  apex:'M468 610 C445 570 416 520 360 435',firstLeft:'M420 535 C360 522 296 496 233 479',
  secondRight:'M492 596 C555 550 628 510 692 510',thirdLeft:'M408 786 C350 765 305 742 264 730',
  back:'M482 676 C520 682 560 688 596 694',front:'M448 748 C500 771 553 798 600 812'
};
const FALLBACK:Record<SpeciesId,string>={pine:makeFallback('#294c35','#6d4935','pine'),maple:makeFallback('#6d8d5b','#6e4730','maple'),azalea:makeFallback('#4e7651','#76513a','azalea')};
function makeFallback(foliage:string,trunk:string,kind:SpeciesId):string{
  const flower=kind==='azalea'?'<g fill="#e5a4ae"><circle cx="100" cy="80" r="6"/><circle cx="220" cy="95" r="7"/></g>':'';
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 500"><rect width="400" height="500" fill="#16241a"/><path d="M206 390c-22-68 9-122-7-184-6-24 0-69 24-109" stroke="${trunk}" stroke-width="27" fill="none"/><g fill="${foliage}"><ellipse cx="94" cy="161" rx="70" ry="44"/><ellipse cx="297" cy="137" rx="80" ry="48"/><ellipse cx="270" cy="274" rx="92" ry="53"/></g>${flower}<path d="M77 390h246l-27 76H104z" fill="#5a4035"/></svg>`)}`;
}
interface Props{bonsai:BonsaiState;interactive?:boolean;selectedPart?:PartId;onSelectPart?:(part:PartId)=>void;className?:string}
export function BonsaiStage({bonsai,interactive=false,selectedPart,onSelectPart,className=''}:Props){
  const[failed,setFailed]=useState(false);
  const source=useMemo(()=>resolvePhoto(bonsai),[bonsai.potId,bonsai.species]);
  const craft=useMemo(()=>loadCraftState(bonsai),[bonsai.id,bonsai.lastUpdatedAt,bonsai.parts]);
  const vitality=Math.max(.55,bonsai.vitality/100),water=Math.max(.68,bonsai.water/100);
  const livingParts=PARTS.filter(part=>!['trunk','roots'].includes(part.id));
  const wiredCount=livingParts.filter(part=>bonsai.parts[part.id]?.wire).length;
  const unfinished=craft.deadwood.filter(item=>item.stage!=='finished').length;
  return <figure className={`bonsai-stage ${className}`} aria-label={`${bonsai.name}の現在の姿`}>
    <img className="bonsai-photo" src={failed?FALLBACK[bonsai.species]:source} alt={`${bonsai.name}・現在の作品状態`} draggable={false} onError={()=>setFailed(true)} style={{filter:`saturate(${.68+vitality*.42}) brightness(${.65+water*.3}) contrast(1.06)`}}/>
    <div className="stage-vignette"/>
    {livingParts.map(({id,x,y})=>{const part=bonsai.parts[id];if(!part)return null;const opacity=part.deadwood?0:part.pruneLevel*.08+Math.max(0,58-part.foliage)/190;return <div key={id} className="part-visual" style={{left:`${x}%`,top:`${y}%`}}>{opacity>.04&&<span className="prune-mask" style={{opacity:Math.min(.34,opacity)}}/>}{part.disease&&<span className={`condition condition-${part.disease}`} title={diseaseName(part.disease)}/>} {part.pest&&<span className={`condition pest condition-${part.pest}`} title={pestName(part.pest)}/>}</div>})}
    <div className="craft-zone-visual-layer" aria-hidden="true">{CRAFT_ZONES.map(zone=>{const state=craft.zones[zone.id];if(!state?.lastOperation&&!state?.removed)return null;const strength=state.removed?.82:Math.min(.62,.18+(100-state.foliage)/120);return <span key={zone.id} className={`craft-zone-visual craft-op-${state.lastOperation??'removed'} ${state.removed?'removed':''}`} style={{left:`${zone.x}%`,top:`${zone.y}%`,opacity:strength}}><i/>{state.removed&&<b/>}</span>})}</div>
    <svg className={`wire-layer wire-layer-coils ${interactive?'wire-layer-editing':'wire-layer-viewing'}`} viewBox="0 0 900 1500" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
      {livingParts.map(({id})=>{const wire=bonsai.parts[id]?.wire,coils=WIRE_COILS[id];if(!wire||!coils)return null;const[dx,dy]=wireOffset(wire.direction);return <g key={id} className={`wire-coil-group wire-group-${wire.intensity}`} transform={`translate(${dx} ${dy})`}>{coils.map(([x,y,angle,length],index)=><g key={`${id}-${index}`} transform={`translate(${x} ${y}) rotate(${angle})`}><line className="wire-coil-shadow" x1={-length/2} y1="0" x2={length/2} y2="0"/><line className="wire-coil-metal" x1={-length/2} y1="0" x2={length/2} y2="0"/><circle className="wire-coil-highlight" cx={-length*.14} cy="-1.1" r="1.35"/></g>)}</g>})}
      {craft.deadwood.map(item=><DeadwoodVisual key={item.id} process={item}/>)}
    </svg>
    {!interactive&&(wiredCount>0||unfinished>0)&&<span className="wire-status-tag">{wiredCount>0?`養成中 ${wiredCount}枝`:''}{wiredCount>0&&unfinished>0?'・':''}{unfinished>0?`古木工程 ${unfinished}`:''}</span>}
    {interactive&&PARTS.map(part=><button type="button" key={part.id} className={`part-hotspot ${selectedPart===part.id?'selected':''}`} style={{left:`${part.x}%`,top:`${part.y}%`}} aria-label={`${part.name}を選択`} onClick={()=>onSelectPart?.(part.id)}>{part.short}</button>)}
  </figure>;
}
function DeadwoodVisual({process}:{process:DeadwoodProcess}){
  const color=({fresh:'#9b704e',drying:'#b59a76',carving:'#d2c5a6',protected:'#eee2c5',weathering:'#d9cfb7',finished:'#c8bea9'} as const)[process.stage];
  const opacity=({fresh:.56,drying:.62,carving:.72,protected:.88,weathering:.82,finished:.72} as const)[process.stage];
  if(process.kind==='jin'&&process.partId){const path=BRANCH_PATHS[process.partId];if(!path)return null;return <g className={`deadwood-visual deadwood-${process.stage}`}><path d={path} stroke="#261b13" strokeWidth="16" opacity=".35" fill="none"/><path d={path} stroke={color} strokeWidth={process.stage==='fresh'?7:5} opacity={opacity} fill="none" strokeLinecap="round" strokeDasharray={process.stage==='carving'||process.stage==='weathering'?'18 5 9 4':undefined}/><title>{`神・${deadwoodStageName(process.stage)}`}</title></g>}
  const path=process.side==='left'?'M365 1260 C338 1110 359 974 405 830 C441 714 470 607 478 474':'M398 1260 C429 1110 413 978 435 840 C459 716 490 610 492 475';
  return <g className={`deadwood-visual deadwood-${process.stage}`}><path d={path} stroke="#1f160f" strokeWidth="12" opacity=".32" fill="none"/><path d={path} stroke={color} strokeWidth={process.stage==='fresh'?5:process.stage==='finished'?4:6} opacity={opacity} fill="none" strokeLinecap="round" strokeDasharray={process.stage==='carving'||process.stage==='weathering'?'20 4 7 3':undefined}/><title>{`舎利・${deadwoodStageName(process.stage)}`}</title></g>;
}
function wireOffset(direction:WireDirection):readonly[number,number]{return({down:[0,8],up:[0,-8],left:[-10,0],right:[10,0],front:[5,5],back:[-4,-4]} as Record<WireDirection,readonly[number,number]>)[direction]}
function resolvePhoto(bonsai:BonsaiState):string{if(bonsai.species==='pine'){try{const byPot=window.BonsaiPhotos?.pineForPot?.(bonsai.potId);if(byPot)return byPot;if(window.BonsaiPhotos?.pine)return window.BonsaiPhotos.pine}catch{}}return FALLBACK[bonsai.species]}
