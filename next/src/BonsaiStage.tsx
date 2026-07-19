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
import { activeDeadwoodProjects, deadwoodStageLabel, precisionVisualSites } from './craft-v3';

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

const JIN_PATHS: Partial<Record<PartId, string>> = {
  apex: 'M485 650 C452 598 423 548 392 490 C372 452 352 422 329 395',
  firstLeft: 'M456 642 C405 618 352 593 298 566 C252 544 216 525 183 505',
  secondRight: 'M476 650 C530 620 581 590 634 559 C681 532 721 516 760 503',
  thirdLeft: 'M447 785 C399 772 351 755 302 739 C266 727 232 717 203 706',
  back: 'M477 690 C526 685 570 688 616 699 C650 707 680 714 710 724',
  front: 'M449 772 C489 795 527 820 566 845 C596 864 625 881 654 897'
};

const SHARI_PATHS = {
  left: 'M365 1260 C340 1120 352 990 397 842 C430 733 461 620 475 482',
  right: 'M401 1260 C425 1120 416 988 438 847 C459 730 488 620 492 485'
} as const;

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
  const precisionSites = precisionVisualSites(bonsai);
  const deadwoodProjects = bonsai.craft.deadwoodProjects;
  const unfinishedDeadwood = activeDeadwoodProjects(bonsai);

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
          </div>
        );
      })}


      <svg className="precision-prune-svg" viewBox="0 0 900 1500" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
        {precisionSites.map(site => (
          <g key={site.id}>
            <ellipse className="precision-prune-veil" cx={site.x * 9} cy={site.y * 15} rx={site.role === 'foliagePad' ? 62 : 45} ry={site.role === 'foliagePad' ? 42 : 30} opacity={site.opacity} />
            {site.removed && <circle className="precision-cut-scar" cx={site.x * 9} cy={site.y * 15} r="7" />}
          </g>
        ))}
      </svg>

      <svg
        className={`wire-layer wire-layer-coils ${interactive ? 'wire-layer-editing' : 'wire-layer-viewing'}`}
        viewBox="0 0 900 1500"
        preserveAspectRatio="xMidYMid meet"
        aria-hidden="true"
      >

        {deadwoodProjects.map(project => {
          const path = project.kind === 'jin' ? JIN_PATHS[project.targetPartId] : SHARI_PATHS[project.side === 'right' ? 'right' : 'left'];
          if (!path) return null;
          return (
            <g key={project.id}>
              <path d={path} className={`deadwood-svg-path stage-${project.stage}`} />
              <path d={path} className="deadwood-fiber" transform={project.kind === 'jin' ? 'translate(2 -2)' : 'translate(3 0)'} />
            </g>
          );
        })}
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
        {bonsai.shari && !deadwoodProjects.some(project => project.kind === 'shari') && (
          <path
            d={bonsai.shari.side === 'left'
              ? 'M365 1260 C338 1110 359 974 405 830 C441 714 470 607 478 474'
              : 'M398 1260 C429 1110 413 978 435 840 C459 716 490 610 492 475'}
            className={`shari-path shari-${bonsai.shari.level}`}
          />
        )}
      </svg>

      {!interactive && wiredCount > 0 && <span className="wire-status-tag">整姿中 {wiredCount}枝</span>}
      {!interactive && unfinishedDeadwood.length > 0 && <span className="deadwood-status-tag">古木技法：{deadwoodStageLabel(unfinishedDeadwood[0].stage)}</span>}

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
