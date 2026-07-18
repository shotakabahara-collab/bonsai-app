import { useMemo, useState } from 'react';
import {
  PARTS,
  diseaseName,
  pestName,
  type BonsaiState,
  type PartId,
  type SpeciesId
} from './model';

const WIRES: Partial<Record<PartId, string>> = {
  apex: 'M50,62 C48,50 53,35 50,20',
  firstLeft: 'M50,63 C43,58 36,50 26,45',
  secondRight: 'M50,58 C58,51 64,45 75,39',
  thirdLeft: 'M50,67 C42,66 36,65 28,66',
  back: 'M50,58 C55,55 61,54 65,51',
  front: 'M50,62 C53,64 54,68 54,73'
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

      <svg className="wire-layer" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
        {livingParts.map(({ id }) => {
          const wire = bonsai.parts[id]?.wire;
          const path = WIRES[id];
          if (!wire || !path) return null;
          const transform = wire.direction === 'left' ? 'translate(-2 0)' : wire.direction === 'right' ? 'translate(2 0)' : wire.direction === 'up' ? 'translate(0 -2)' : wire.direction === 'down' ? 'translate(0 2)' : '';
          return <path key={id} d={path} transform={transform} className={`wire-path wire-${wire.intensity}`} />;
        })}
        {bonsai.shari && (
          <path
            d={bonsai.shari.side === 'left' ? 'M48 78 C45 67 47 55 49 43 C51 33 49 27 50 21' : 'M53 78 C56 66 53 55 52 44 C50 34 52 27 51 21'}
            className={`shari-path shari-${bonsai.shari.level}`}
          />
        )}
      </svg>

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
