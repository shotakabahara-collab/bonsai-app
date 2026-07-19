#!/usr/bin/env python3
from __future__ import annotations

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def read(path: str) -> str:
    return (ROOT / path).read_text(encoding="utf-8")


def write(path: str, text: str) -> None:
    target = ROOT / path
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(text, encoding="utf-8")


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f"{label}: expected exactly one match, found {count}")
    return text.replace(old, new, 1)


def regex_once(text: str, pattern: str, replacement: str, label: str) -> str:
    result, count = re.subn(pattern, replacement, text, count=1, flags=re.S)
    if count != 1:
        raise RuntimeError(f"{label}: expected exactly one regex match, found {count}")
    return result


def patch_app() -> None:
    path = "next/src/App.tsx"
    text = read(path)
    text = replace_once(text, "  fertilizeBonsai,\n", "", "remove fertilizer import")
    text = replace_once(
        text,
        "            onFertilize={() => commit(current => fertilizeBonsai(current), '施肥を記録しました')}\n",
        "",
        "remove fertilizer callback",
    )
    text = replace_once(
        text,
        "function GrowPage({ game, bonsai, alerts, mentorName, mentorTip, onSelectBonsai, onWater, onFertilize, onOpenCare, onWall, onAddTree }: {",
        "function GrowPage({ game, bonsai, alerts, mentorName, mentorTip, onSelectBonsai, onWater, onOpenCare, onWall, onAddTree }: {",
        "remove fertilizer prop name",
    )
    text = replace_once(text, "  onFertilize: () => void;\n", "", "remove fertilizer prop type")
    text = replace_once(
        text,
        '          <ActionButton icon="🌿" label="施肥" onClick={onFertilize} />\n',
        "",
        "remove fertilizer action",
    )

    show_page = r'''function ShowPage({ game, bonsai, onEnter }: { game: GameState; bonsai: NonNullable<ReturnType<typeof activeBonsai>>; onEnter: () => void }) {
  const evaluation = exhibitionScore(bonsai);
  const latest = bonsai.awards[0];
  return (
    <section className="page">
      <div className="page-heading">
        <div className="eyebrow">公開審査基準・週に一度の非同期大会</div>
        <h1>全国樹藝品評会</h1>
        <p>国風賞で公表されている「総合美・風格・鉢等との調和・培養状態」を参考に、ゲーム内で再現できる六つの審査軸へ定量化しています。審査は作品の状態だけを見て行い、名声や所持金は採点に加えません。</p>
      </div>
      <article className="show-card">
        <BonsaiStage bonsai={bonsai} />
        <div className="show-score"><small>三部門合議による予想評価</small><b>{evaluation.score}<span>点</span></b></div>
        <section className="judging-standard" aria-label="品評会の公開審査基準">
          <header><div><span>審査基準</span><b>{evaluation.standard}</b></div><em>100点満点</em></header>
          <div className="judge-panel-grid">
            {evaluation.panels.map(panel => <div key={panel.name}><span>{panel.name}</span><b>{panel.score}</b></div>)}
          </div>
          <div className="criterion-grid">
            {evaluation.breakdown.map(item => (
              <article className="criterion-card" key={item.id}>
                <div><b>{item.label}</b><span>配点 {item.weight}</span></div>
                <strong>{item.score}</strong>
                <i><span style={{ width: `${item.score}%` }} /></i>
              </article>
            ))}
          </div>
          {evaluation.penalties.length > 0 && <div className="judging-penalties"><b>明示減点</b>{evaluation.penalties.map(item => <span key={item}>{item}</span>)}</div>}
        </section>
        <ul className="judge-notes">{evaluation.notes.map(note => <li key={note}>{note}</li>)}</ul>
        <button className="primary-button" type="button" onClick={onEnter}>今週の展覧会へ出展</button>
      </article>
      {latest && <article className="latest-award"><span>{latest.rank === 1 ? '🥇' : latest.rank <= 3 ? '🏅' : '🎖️'}</span><div><small>直近の成績</small><b>{latest.title}・{latest.score}点</b><p>{new Date(latest.at).toLocaleString('ja-JP')}／{latest.fieldSize}作品中{latest.rank}位</p></div></article>}
    </section>
  );
}
'''
    text = regex_once(
        text,
        r"function ShowPage\([\s\S]*?\n}\n\nfunction PeoplePage",
        show_page + "\nfunction PeoplePage",
        "replace show page with published judging rubric",
    )
    write(path, text)


def patch_model() -> None:
    path = "next/src/model.ts"
    text = read(path)
    text = text.replace(
        "fertilizer: clamp(finite(source.fert ?? source.fertilizer, 0), 0, 100),",
        "fertilizer: 0,",
    )
    text = text.replace(
        "fertilizer: clamp(finite(input?.fertilizer, 0), 0, 100),",
        "fertilizer: 0,",
    )
    text = replace_once(
        text,
        "    bonsai.vitality = clamp(bonsai.vitality - dryPenalty - stressPenalty + Math.min(2, bonsai.fertilizer * .006 * elapsedHours));",
        "    bonsai.vitality = clamp(bonsai.vitality - dryPenalty - stressPenalty);",
        "remove fertilizer growth effect",
    )
    text = regex_once(
        text,
        r"export function fertilizeBonsai\(game: GameState\): GameState \{[\s\S]*?\n}\n\nexport function prunePart",
        """/** @deprecated 施肥要素は作品状態から廃止済みです。旧呼び出しとの互換性だけを保ちます。 */
export function fertilizeBonsai(game: GameState): GameState {
  const copy = structuredClone(game);
  const bonsai = activeBonsai(copy);
  if (bonsai) bonsai.fertilizer = 0;
  return copy;
}

export function prunePart""",
        "neutralize legacy fertilizer function",
    )

    judging = r'''const NATIONAL_POT_COMPATIBILITY: Record<SpeciesId, Record<PotId, number>> = {
  pine: { starter: 72, blue: 58, black: 98, moon: 54, old: 95 },
  maple: { starter: 74, blue: 94, black: 68, moon: 92, old: 84 },
  azalea: { starter: 72, blue: 96, black: 62, moon: 94, old: 80 }
};

const average = (values: number[]): number => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;

export function exhibitionScore(bonsai: BonsaiState): {
  score: number;
  notes: string[];
  standard: string;
  breakdown: Array<{ id: string; label: string; weight: number; score: number }>;
  panels: Array<{ name: string; score: number }>;
  penalties: string[];
} {
  const livingIds = PARTS.filter(part => !['trunk', 'roots'].includes(part.id)).map(part => part.id);
  const living = livingIds.map(id => bonsai.parts[id]);
  const allParts = PARTS.map(part => bonsai.parts[part.id]);
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

  const structure = clamp(
    92
      - spread * 1.08
      - Math.abs(58 - foliage) * .68
      + Math.min(10, activeBranches * 1.45)
      + Math.min(8, pruning * 4)
      - heavyCuts * 7
      - bareLivingBranches * 10
  );
  const cultivation = clamp(
    bonsai.vitality * .36
      + health * .34
      + waterReadiness * .18
      + cleanliness * .12
  );
  const maturity = clamp(
    40
      + Math.min(29, age * 4.6)
      + bonsai.parts.roots.health * .08
      + bonsai.parts.trunk.health * .08
      + Math.min(9, deadwood * 3.5)
      - averageScar * .16
  );
  const finish = clamp(
    98
      - visibleWire * 13
      - averageScar * .45
      - diseaseCount * 12
      - pestCount * 8
      - heavyCuts * 6
      - Math.max(0, bonsai.stress - 35) * .22
  );
  const potHarmony = clamp(
    NATIONAL_POT_COMPATIBILITY[bonsai.species][bonsai.potId] * .72
      + POTS[bonsai.potId].prestige * .28
  );
  const seasonalImpression = clamp(
    SPECIES[bonsai.species].seasonAffinity[seasonIndex(bonsai)] * .48
      + structure * .24
      + cultivation * .18
      + maturity * .10
  );

  const breakdown = [
    { id: 'maturity', label: '樹格・成熟度', weight: 20, score: Math.round(maturity) },
    { id: 'structure', label: '樹形・枝配り', weight: 25, score: Math.round(structure) },
    { id: 'cultivation', label: '培養・健康', weight: 20, score: Math.round(cultivation) },
    { id: 'finish', label: '手入れ・仕上げ', weight: 15, score: Math.round(finish) },
    { id: 'pot', label: '鉢合わせ・展示調和', weight: 15, score: Math.round(potHarmony) },
    { id: 'season', label: '季節感・感銘', weight: 5, score: Math.round(seasonalImpression) }
  ];

  const penalties: string[] = [];
  let explicitPenalty = 0;
  if (rootRot) { explicitPenalty += 10; penalties.push('根腐れ兆候 −10'); }
  if (diseaseCount - rootRot > 0) { const value = (diseaseCount - rootRot) * 5; explicitPenalty += value; penalties.push(`病徴 ${diseaseCount - rootRot}部位 −${value}`); }
  if (pestCount > 0) { const value = pestCount * 3; explicitPenalty += value; penalties.push(`害虫 ${pestCount}部位 −${value}`); }
  if (visibleWire > 0) { const value = visibleWire * 2; explicitPenalty += value; penalties.push(`展示中の露出針金 ${visibleWire}部位 −${value}`); }
  if (bareLivingBranches > 0) { const value = bareLivingBranches * 3; explicitPenalty += value; penalties.push(`過度な枝抜き ${bareLivingBranches}部位 −${value}`); }
  if (bonsai.stress > 70) { explicitPenalty += 4; penalties.push('作業直後の強いストレス −4'); }

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

export function advanceTime'''
    text = regex_once(
        text,
        r"export function exhibitionScore\([\s\S]*?\n}\n\nexport function advanceTime",
        judging,
        "replace exhibition score with national-show rubric",
    )
    write(path, text)


def patch_storage() -> None:
    path = "next/src/storage.ts"
    text = read(path)
    text = replace_once(text, "    fert: bonsai.fertilizer,", "    fert: 0,", "remove legacy fertilizer mirror")
    write(path, text)


def write_bonsai_stage() -> None:
    stage = r'''import { useMemo, useState } from 'react';
import {
  PARTS,
  diseaseName,
  pestName,
  type BonsaiState,
  type PartId,
  type SpeciesId,
  type WireDirection
} from './model';

type Coil = readonly [x: number, y: number, angle: number, length: number];

// Coordinates are calibrated to the bundled 900×1500 black-pine photograph.
// Each short diagonal segment represents one visible turn around a real branch;
// no continuous guide line is rendered over the artwork.
const WIRE_COILS: Partial<Record<PartId, readonly Coil[]>> = {
  apex: [
    [468, 610, 48, 34], [448, 575, 50, 32], [427, 540, 52, 31],
    [405, 505, 54, 30], [383, 470, 56, 28], [360, 435, 58, 27]
  ],
  firstLeft: [
    [420, 535, -18, 33], [382, 525, -16, 31], [344, 514, -15, 29],
    [307, 502, -14, 28], [270, 490, -12, 26], [233, 479, -10, 24]
  ],
  secondRight: [
    [492, 596, 55, 34], [530, 571, 58, 33], [569, 548, 61, 31],
    [610, 528, 65, 30], [651, 515, 70, 28], [692, 510, 76, 26]
  ],
  thirdLeft: [
    [408, 786, -24, 35], [372, 772, -22, 33], [336, 758, -20, 31],
    [300, 744, -18, 29], [264, 730, -16, 27]
  ],
  back: [
    [482, 676, 68, 31], [520, 681, 72, 30], [558, 687, 76, 28], [596, 694, 80, 26]
  ],
  front: [
    [448, 748, 54, 35], [485, 765, 58, 34], [523, 782, 62, 32],
    [561, 798, 66, 30], [600, 812, 70, 28]
  ]
};

const FALLBACK: Record<SpeciesId, string> = {
  pine: makeFallback('#294c35', '#6d4935', 'pine'),
  maple: makeFallback('#6d8d5b', '#6e4730', 'maple'),
  azalea: makeFallback('#4e7651', '#76513a', 'azalea')
};

function makeFallback(foliage: string, trunk: string, kind: SpeciesId): string {
  const flower = kind === 'azalea' ? '<g fill="#e5a4ae"><circle cx="100" cy="80" r="6"/><circle cx="220" cy="95" r="7"/><circle cx="295" cy="115" r="6"/><circle cx="150" cy="135" r="6"/></g>' : '';
  const maple = kind === 'maple' ? '<g fill="#a34e37" opacity=".75"><path d="M98 78l8 15 15-6-8 15 14 8-17 2 2 17-12-12-12 12 2-17-17-2 14-8-8-15 15 6z"/><path d="M276 100l7 13 13-5-7 13 12 7-15 2 2 15-11-10-10 10 2-15-15-2 12-7-7-13 13 5z"/></g>' : '';
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 500"><defs><radialGradient id="bg"><stop stop-color="#33493a"/><stop offset="1" stop-color="#101b14"/></radialGradient><filter id="shadow"><feDropShadow dx="0" dy="12" stdDeviation="10" flood-opacity=".45"/></filter></defs><rect width="400" height="500" fill="url(#bg)"/><g filter="url(#shadow)"><path d="M206 390c-22-68 9-122-7-184-6-24 0-69 24-109" stroke="${trunk}" stroke-width="27" stroke-linecap="round" fill="none"/><path d="M207 243c-50-8-88-30-121-61M211 204c54-12 91-30 119-57M205 296c-43 4-78 21-103 47" stroke="${trunk}" stroke-width="16" stroke-linecap="round" fill="none"/><g fill="${foliage}"><ellipse cx="94" cy="161" rx="70" ry="44"/><ellipse cx="158" cy="139" rx="75" ry="49"/><ellipse cx="297" cy="137" rx="80" ry="48"/><ellipse cx="111" cy="326" rx="72" ry="44"/><ellipse cx="270" cy="274" rx="92" ry="53"/><ellipse cx="209" cy="104" rx="67" ry="47"/></g>${flower}${maple}<ellipse cx="200" cy="393" rx="108" ry="20" fill="#29402d"/><path d="M77 390h246l-27 76H104z" fill="#5a4035"/><rect x="64" y="376" width="272" height="31" rx="9" fill="#735144"/></g></svg>`)}`;
}

interface Props {
  bonsai: BonsaiState;
  interactive?: boolean;
  selectedPart?: PartId;
  onSelectPart?: (part: PartId) => void;
  className?: string;
}

export function BonsaiStage({ bonsai, interactive = false, selectedPart, onSelectPart, className = '' }: Props) {
  const [failed, setFailed] = useState(false);
  const source = useMemo(() => resolvePhoto(bonsai), [bonsai.potId, bonsai.species]);
  const vitalityFilter = Math.max(.55, bonsai.vitality / 100);
  const waterFilter = Math.max(.68, bonsai.water / 100);
  const saturation = .68 + vitalityFilter * .42;
  const brightness = .65 + waterFilter * .3;
  const livingParts = PARTS.filter(part => !['trunk', 'roots'].includes(part.id));
  const wiredCount = livingParts.filter(part => bonsai.parts[part.id]?.wire).length;

  return (
    <figure className={`bonsai-stage ${className}`} aria-label={`${bonsai.name}の現在の姿`}>
      <img
        className="bonsai-photo"
        src={failed ? FALLBACK[bonsai.species] : source}
        alt={`${bonsai.name}・現在の作品状態`}
        draggable={false}
        onError={() => setFailed(true)}
        style={{ filter: `saturate(${saturation}) brightness(${brightness}) contrast(1.06)` }}
      />
      <div className="stage-vignette" />

      {livingParts.map(({ id, x, y }) => {
        const part = bonsai.parts[id];
        if (!part) return null;
        const pruneOpacity = part.deadwood ? 0 : part.pruneLevel * .15 + Math.max(0, 62 - part.foliage) / 150;
        return (
          <div key={id} className="part-visual" style={{ left: `${x}%`, top: `${y}%` }}>
            {pruneOpacity > .05 && <span className="prune-mask" style={{ opacity: Math.min(.58, pruneOpacity) }} />}
            {part.disease && <span className={`condition condition-${part.disease}`} title={diseaseName(part.disease)} />}
            {part.pest && <span className={`condition pest condition-${part.pest}`} title={pestName(part.pest)} />}
            {part.deadwood && <span className="deadwood-mark" />}
          </div>
        );
      })}

      <svg
        className={`wire-layer wire-layer-coils ${interactive ? 'wire-layer-editing' : 'wire-layer-viewing'}`}
        viewBox="0 0 900 1500"
        preserveAspectRatio="xMidYMid meet"
        aria-hidden="true"
      >
        {livingParts.map(({ id }) => {
          const wire = bonsai.parts[id]?.wire;
          const coils = WIRE_COILS[id];
          if (!wire || !coils) return null;
          const [dx, dy] = wireOffset(wire.direction);
          return (
            <g key={id} className={`wire-coil-group wire-group-${wire.intensity}`} transform={`translate(${dx} ${dy})`}>
              {coils.map(([x, y, angle, length], index) => (
                <g key={`${id}-${index}`} transform={`translate(${x} ${y}) rotate(${angle})`}>
                  <line className="wire-coil-shadow" x1={-length / 2} y1="0" x2={length / 2} y2="0" />
                  <line className="wire-coil-metal" x1={-length / 2} y1="0" x2={length / 2} y2="0" />
                  <circle className="wire-coil-highlight" cx={-length * .14} cy="-1.1" r="1.35" />
                </g>
              ))}
            </g>
          );
        })}
        {bonsai.shari && (
          <path
            d={bonsai.shari.side === 'left'
              ? 'M365 1260 C338 1110 359 974 405 830 C441 714 470 607 478 474'
              : 'M398 1260 C429 1110 413 978 435 840 C459 716 490 610 492 475'}
            className={`shari-path shari-${bonsai.shari.level}`}
          />
        )}
      </svg>

      {!interactive && wiredCount > 0 && <span className="wire-status-tag">整姿中 {wiredCount}枝</span>}

      {interactive && PARTS.map(part => (
        <button
          type="button"
          key={part.id}
          className={`part-hotspot ${selectedPart === part.id ? 'selected' : ''}`}
          style={{ left: `${part.x}%`, top: `${part.y}%` }}
          aria-label={`${part.name}を選択`}
          onClick={() => onSelectPart?.(part.id)}
        >
          {part.short}
        </button>
      ))}
    </figure>
  );
}

function wireOffset(direction: WireDirection): readonly [number, number] {
  return ({
    down: [0, 8], up: [0, -8], left: [-10, 0], right: [10, 0], front: [5, 5], back: [-4, -4]
  } as Record<WireDirection, readonly [number, number]>)[direction];
}

function resolvePhoto(bonsai: BonsaiState): string {
  if (bonsai.species === 'pine') {
    try {
      const byPot = window.BonsaiPhotos?.pineForPot?.(bonsai.potId);
      if (byPot) return byPot;
      if (window.BonsaiPhotos?.pine) return window.BonsaiPhotos.pine;
    } catch {
      // Fall through to bundled fallback.
    }
  }
  return FALLBACK[bonsai.species];
}
'''
    write("next/src/BonsaiStage.tsx", stage)


def write_quality_css() -> None:
    css = r'''.action-grid {
  grid-template-columns: repeat(3, minmax(0, 1fr)) !important;
}

.wire-layer-coils {
  position: absolute;
  inset: 0;
  z-index: 4;
  width: 100%;
  height: 100%;
  pointer-events: none;
  overflow: hidden;
}

.wire-layer-viewing { opacity: .68; }
.wire-layer-editing { opacity: .96; }
.wire-coil-shadow {
  stroke: rgba(24, 12, 6, .62);
  stroke-width: 10;
  stroke-linecap: round;
  filter: blur(.45px);
}
.wire-coil-metal {
  stroke: #9b6642;
  stroke-width: 5.2;
  stroke-linecap: round;
  filter: drop-shadow(0 1px .8px rgba(0, 0, 0, .75));
}
.wire-coil-highlight { fill: rgba(244, 193, 133, .72); }
.wire-group-strong .wire-coil-shadow { stroke-width: 12.5; }
.wire-group-strong .wire-coil-metal { stroke-width: 7; stroke: #865332; }
.wire-group-strong .wire-coil-highlight { r: 1.7; }
.wire-status-tag {
  position: absolute;
  z-index: 7;
  top: 11px;
  right: 11px;
  border: 1px solid rgba(202, 145, 91, .38);
  border-radius: 999px;
  padding: 5px 8px;
  background: rgba(9, 13, 10, .76);
  color: #d6ad7d;
  font-size: 9px;
  letter-spacing: .04em;
  backdrop-filter: blur(8px);
}

.judging-standard {
  margin: 7px 12px 13px;
  border: 1px solid rgba(214, 183, 119, .2);
  border-radius: 18px;
  background: linear-gradient(180deg, rgba(214, 183, 119, .065), rgba(4, 10, 6, .24));
  padding: 13px;
}
.judging-standard > header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 11px;
}
.judging-standard > header span,
.criterion-card span,
.judge-panel-grid span {
  display: block;
  color: var(--muted);
  font-size: 8px;
}
.judging-standard > header b { display: block; margin-top: 3px; font-size: 11px; }
.judging-standard > header em {
  flex: 0 0 auto;
  border: 1px solid rgba(214, 183, 119, .3);
  border-radius: 999px;
  padding: 4px 7px;
  color: var(--gold);
  font: normal 8px sans-serif;
}
.judge-panel-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 6px;
  margin-bottom: 9px;
}
.judge-panel-grid > div {
  border: 1px solid var(--line);
  border-radius: 12px;
  background: rgba(255, 255, 255, .025);
  padding: 8px;
  text-align: center;
}
.judge-panel-grid b { display: block; margin-top: 3px; font: 20px Georgia, serif; color: var(--gold); }
.criterion-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 7px; }
.criterion-card {
  position: relative;
  overflow: hidden;
  border: 1px solid var(--line);
  border-radius: 13px;
  background: rgba(4, 10, 6, .46);
  padding: 9px;
}
.criterion-card > div { display: flex; align-items: baseline; justify-content: space-between; gap: 5px; }
.criterion-card > div b { font-size: 9px; }
.criterion-card strong { display: block; margin: 5px 0 7px; font: 22px Georgia, serif; }
.criterion-card i { display: block; height: 2px; border-radius: 99px; background: rgba(255, 255, 255, .08); overflow: hidden; }
.criterion-card i span { display: block; height: 100%; background: var(--gold); }
.judging-penalties {
  display: grid;
  gap: 4px;
  margin-top: 9px;
  border-left: 2px solid var(--danger);
  border-radius: 3px 11px 11px 3px;
  background: rgba(166, 81, 70, .09);
  padding: 8px 10px;
}
.judging-penalties b { font-size: 9px; color: #e1b4ad; }
.judging-penalties span { color: #c59d96; font-size: 8px; }
.judge-notes { margin-top: 10px !important; }

@media (max-width: 360px) {
  .criterion-grid { grid-template-columns: 1fr; }
}
'''
    write("next/src/quality-v2.css", css)


def patch_main_and_worker() -> None:
    main_path = "next/src/main.tsx"
    main = read(main_path)
    if "./quality-v2.css" not in main:
        main = replace_once(main, "import './completion-layer.css';", "import './completion-layer.css';\nimport './quality-v2.css';", "import quality css")
    main = main.replace("bonsai-react-production-v1-20260718", "bonsai-react-production-v2-20260719")
    write(main_path, main)

    sw_path = "next/public/sw.js"
    sw = read(sw_path)
    sw = sw.replace("const VERSION = 'bonsai-react-v1';", "const VERSION = 'bonsai-react-v2-wire-judge';")
    write(sw_path, sw)


def patch_tests() -> None:
    path = "next/tests/smoke.mjs"
    text = read(path)
    text = replace_once(
        text,
        "  afterPrune: null,\n  growVisual: null,",
        "  afterPrune: null,\n  wireVisual: null,\n  judgingCriteria: 0,\n  growVisual: null,",
        "extend smoke report",
    )
    text = replace_once(
        text,
        "  if (migrated.mentorId !== 'gensai') throw new Error(`Mentor migration failed: ${migrated.mentorId}`);",
        """  if (migrated.mentorId !== 'gensai') throw new Error(`Mentor migration failed: ${migrated.mentorId}`);
  if (migrated.bonsai[0].fertilizer !== 0) throw new Error(`Fertilizer state was not removed: ${migrated.bonsai[0].fertilizer}`);
  if (await page.getByRole('button', { name: /施肥|堆肥/ }).count()) throw new Error('Fertilizer action is still visible');""",
        "assert fertilizer removal",
    )
    text = replace_once(
        text,
        """  if (active.parts.firstLeft.pruneLevel < 2 || active.parts.firstLeft.foliage >= 72) {
    throw new Error(`Pruning was not persisted: ${JSON.stringify(active.parts.firstLeft)}`);
  }

  report.phase = 'show page';""",
        """  if (active.parts.firstLeft.pruneLevel < 2 || active.parts.firstLeft.foliage >= 72) {
    throw new Error(`Pruning was not persisted: ${JSON.stringify(active.parts.firstLeft)}`);
  }

  report.phase = 'realistic branch wiring';
  await page.getByRole('button', { name: '部位針金' }).click();
  await page.getByRole('button', { name: '第二枝を選択' }).click();
  await page.getByRole('button', { name: '右へ' }).click();
  await page.getByRole('button', { name: 'この部位へかける' }).click();
  await page.waitForSelector('.wire-coil-metal');
  report.wireVisual = await page.evaluate(() => ({
    coils: document.querySelectorAll('.wire-coil-metal').length,
    continuousLines: document.querySelectorAll('.wire-path').length,
    status: document.querySelector('.wire-status-tag')?.textContent ?? '',
    wire: JSON.parse(localStorage.getItem('bonsai:v2')).bonsai.find(item => item.id === JSON.parse(localStorage.getItem('bonsai:v2')).activeBonsaiId).parts.secondRight.wire
  }));
  if (report.wireVisual.coils < 5 || report.wireVisual.continuousLines !== 0 || !report.wireVisual.status.includes('整姿中') || report.wireVisual.wire?.direction !== 'right') {
    throw new Error(`Wire rendering is not branch-coil based: ${JSON.stringify(report.wireVisual)}`);
  }
  await page.screenshot({ path: 'test-artifacts/02b-wire-coils.png', fullPage: false });

  report.phase = 'show page';""",
        "add wire visual smoke",
    )
    text = replace_once(
        text,
        "  if (!report.showVisual.text.includes('現在の予想評価')) throw new Error(`show card content is missing: ${report.showVisual.text}`);",
        """  if (!report.showVisual.text.includes('三部門合議による予想評価')) throw new Error(`show card content is missing: ${report.showVisual.text}`);
  await page.waitForSelector('.judging-standard');
  report.judgingCriteria = await page.locator('.criterion-card').count();
  const judgingText = await page.locator('.judging-standard').innerText();
  if (report.judgingCriteria !== 6 || !judgingText.includes('国風賞') || !judgingText.includes('樹格・成熟度') || !judgingText.includes('培養・健康')) {
    throw new Error(`Published judging rubric is incomplete: ${report.judgingCriteria} / ${judgingText}`);
  }""",
        "assert judging rubric",
    )
    text = replace_once(
        text,
        "  await page.getByRole('button', { name: /売却して山もみじへ買替/ }).click();",
        "  await page.locator('.offer-purchase:visible').last().getByRole('button', { name: /売却して山もみじへ買替/ }).click();",
        "scope purchase offer click",
    )
    write(path, text)


def main() -> None:
    patch_app()
    patch_model()
    patch_storage()
    write_bonsai_stage()
    write_quality_css()
    patch_main_and_worker()
    patch_tests()
    print("BONSAI visual/judging v2 patch applied")


if __name__ == "__main__":
    main()
