import { useId, useMemo, useState, type PointerEvent as ReactPointerEvent } from 'react';
import {
  PARTS,
  diseaseName,
  pestName,
  type BonsaiState,
  type PartId,
  type SpeciesId
} from './model';
import {
  activeDeadwoodProjects,
  deadwoodStageLabel,
  deadwoodStatus,
  precisionVisualSites,
  wireLifecycle,
  type DeadwoodStage,
  type SiteRole
} from './craft-v3';

const WIRE_PHOTO_BASE = '/bonsai-app/assets/kuromatsu/wire-photo-v7';
const WIRE_PHOTO_PARTS = new Set<PartId>(['apex', 'firstLeft', 'secondRight', 'thirdLeft', 'back', 'front']);
const DEADWOOD_PHOTO_BASE = '/bonsai-app/assets/kuromatsu/deadwood-photo-v6';
const DEADWOOD_JIN_PARTS = new Set<PartId>(['apex', 'firstLeft', 'secondRight', 'thirdLeft', 'back', 'front']);

type DeadwoodProjectView = ReturnType<typeof activeDeadwoodProjects>[number];

function wirePhotoHref(partId: PartId, intensity: 'light' | 'strong'): string | null {
  return WIRE_PHOTO_PARTS.has(partId) ? `${WIRE_PHOTO_BASE}/${partId}-${intensity}.webp` : null;
}

function deadwoodPhotoHref(project: DeadwoodProjectView): string | null {
  const level = Math.max(1, Math.min(3, Math.round(project.level)));
  if (project.kind === 'shari') {
    const side = project.side === 'right' ? 'right' : 'left';
    return `${DEADWOOD_PHOTO_BASE}/shari-${side}-l${level}.webp`;
  }
  return DEADWOOD_JIN_PARTS.has(project.targetPartId)
    ? `${DEADWOOD_PHOTO_BASE}/jin-${project.targetPartId}-l${level}.webp`
    : null;
}

function legacyShariPhotoHref(side: 'left' | 'right', level: number): string {
  return `${DEADWOOD_PHOTO_BASE}/shari-${side}-l${Math.max(1, Math.min(3, Math.round(level)))}.webp`;
}

function deadwoodVisualFilter(stage: DeadwoodStage, progress: number): string {
  const t = Math.max(0, Math.min(1, progress / 100));
  const values = ({
    fresh: [0.93, 1.00, 1.04, 0.86, 1.02, 1.06],
    drying: [0.82, 1.00, 1.05, 0.68, 1.03, 1.08],
    carving: [0.66, 1.02, 1.07, 0.52, 1.05, 1.10],
    preserving: [0.43, 1.06, 1.06, 0.27, 1.10, 1.07],
    weathering: [0.30, 1.05, 1.08, 0.11, 1.08, 1.12],
    mature: [0.08, 1.08, 1.12, 0.08, 1.08, 1.12]
  } as Record<DeadwoodStage, readonly [number, number, number, number, number, number]>)[stage];
  const mix = (a: number, b: number) => a + (b - a) * t;
  return `saturate(${mix(values[0], values[3]).toFixed(3)}) brightness(${mix(values[1], values[4]).toFixed(3)}) contrast(${mix(values[2], values[5]).toFixed(3)})`;
}

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
  const id = useId().replace(/:/g, '');
  const source = useMemo(() => resolvePhoto(bonsai), [bonsai.potId, bonsai.species]);
  const vitalityFilter = Math.max(.38, bonsai.vitality / 100);
  const waterFilter = Math.max(.58, bonsai.water / 100);
  const dead = bonsai.lifeStatus === 'dead';
  const saturation = dead ? .22 : .68 + vitalityFilter * .42;
  const brightness = dead ? .58 : .65 + waterFilter * .3;
  const livingParts = PARTS.filter(part => !['trunk', 'roots'].includes(part.id));
  const wiredParts = livingParts.filter(part => bonsai.parts[part.id]?.wire && WIRE_PHOTO_PARTS.has(part.id));
  const wiredCount = wiredParts.length;
  const precisionSites = precisionVisualSites(bonsai);
  const deadwoodProjects = bonsai.craft.deadwoodProjects;
  const unfinishedDeadwood = activeDeadwoodProjects(bonsai);
  const photo = failed ? FALLBACK[bonsai.species] : source;
  const selectedDefinition = PARTS.find(part => part.id === selectedPart);
  const selectPartFromPhoto = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!interactive || !onSelectPart) return;
    const target = event.target instanceof Element ? event.target : null;
    if (target?.closest('button')) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const photoAspect = 900 / 1500;
    const boxAspect = rect.width / rect.height;
    const renderedWidth = boxAspect > photoAspect ? rect.height * photoAspect : rect.width;
    const renderedHeight = boxAspect > photoAspect ? rect.height : rect.width / photoAspect;
    const offsetX = (rect.width - renderedWidth) / 2;
    const offsetY = (rect.height - renderedHeight) / 2;
    const x = (event.clientX - rect.left - offsetX) / renderedWidth * 100;
    const y = (event.clientY - rect.top - offsetY) / renderedHeight * 100;
    if (x < 0 || x > 100 || y < 0 || y > 100) return;
    const nearest = PARTS.reduce((best, part) => {
      const distance = (part.x - x) ** 2 + (part.y - y) ** 2 * .82;
      return !best || distance < best.distance ? { part, distance } : best;
    }, undefined as { part: (typeof PARTS)[number]; distance: number } | undefined);
    if (nearest) onSelectPart(nearest.part.id);
  };

  return (
    <figure
      className={`bonsai-stage photoreal-craft-v6 photoreal-craft-v7 gameplay-v8-stage ${dead ? 'bonsai-dead' : ''} ${className}`}
      aria-label={`${bonsai.name}の現在の姿`}
      data-renderer="gameplay-v8"
      data-photo-cleaned={bonsai.species === 'pine' && !failed ? 'true' : 'not-applicable'}
    >
      <div className={`bonsai-photo-canvas ${interactive ? 'direct-part-picker' : ''}`} data-testid="bonsai-photo-canvas" onPointerUp={selectPartFromPhoto}>
        <img
          className="bonsai-photo"
          src={photo}
          alt={`${bonsai.name}・現在の作品状態`}
          draggable={false}
          onError={() => setFailed(true)}
          style={{ filter: `saturate(${saturation}) brightness(${brightness}) contrast(${dead ? .96 : 1.06})` }}
        />
        <div className="stage-vignette" />

        {livingParts.map(({ id: partId, x, y }) => {
          const part = bonsai.parts[partId];
          if (!part) return null;
          const pruneOpacity = part.deadwood ? 0 : part.pruneLevel * .12 + Math.max(0, 62 - part.foliage) / 190;
          return (
            <div key={partId} className="part-visual" style={{ left: `${x}%`, top: `${y}%` }}>
              {pruneOpacity > .05 && <span className="prune-mask authentic-leaf-loss" style={{ opacity: Math.min(.34, pruneOpacity) }} />}
              {part.disease && <span className={`condition condition-${part.disease}`} title={diseaseName(part.disease)} />}
              {part.pest && <span className={`condition pest condition-${part.pest}`} title={pestName(part.pest)} />}
            </div>
          );
        })}

        {interactive && (
        <svg className="precision-prune-svg" viewBox="0 0 900 1500" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
          <defs>
            <filter id={`${id}-leaf-fade`} x="-40%" y="-40%" width="180%" height="180%">
              <feTurbulence type="fractalNoise" baseFrequency=".025 .065" numOctaves="2" seed="17" result="noise" />
              <feDisplacementMap in="SourceGraphic" in2="noise" scale="10" />
              <feGaussianBlur stdDeviation="5" />
            </filter>
          </defs>
          {precisionSites.map(site => {
            const x = site.x * 9;
            const y = site.y * 15;
            return (
              <g key={site.id}>
                <ellipse
                  className="precision-prune-veil authentic-prune-veil"
                  filter={`url(#${id}-leaf-fade)`}
                  cx={x}
                  cy={y}
                  rx={site.role === 'foliagePad' ? 48 : 30}
                  ry={site.role === 'foliagePad' ? 31 : 20}
                  opacity={site.opacity * .5}
                />
                {site.removed && (interactive || showNaturalCut(site.role)) && (
                  <path
                    className="precision-cut-scar-natural"
                    data-testid="natural-cut-scar"
                    d={naturalCutScarPath(x, y, site.id)}
                  />
                )}
              </g>
            );
          })}
        </svg>
        )}

        <svg
          className={`wire-layer authentic-work-layer ${interactive ? 'wire-layer-editing' : 'wire-layer-viewing'}`}
          viewBox="0 0 900 1500"
          preserveAspectRatio="xMidYMid meet"
          aria-hidden="true"
        >
          <defs />

          {deadwoodProjects.map(project => {
            const href = deadwoodPhotoHref(project);
            if (!href) return null;
            const status = deadwoodStatus(project);
            return (
              <g
                key={project.id}
                className={`deadwood-effect deadwood-${project.kind} stage-${project.stage} deadwood-progress-${status.progressBand} ${project.pausedAt ? 'paused' : ''}`}
                data-testid="photoreal-deadwood"
                data-stage={project.stage}
                data-paused={project.pausedAt ? 'true' : 'false'}
                data-deadwood-kind={project.kind}
                data-deadwood-level={project.level}
                data-deadwood-progress={status.progress.toFixed(2)}
                data-deadwood-progress-band={status.progressBand}
                data-deadwood-asset={href}
              >
                <image
                  className="deadwood-raster"
                  href={href}
                  x="0"
                  y="0"
                  width="900"
                  height="1500"
                  preserveAspectRatio="none"
                  style={{ filter: deadwoodVisualFilter(project.stage, status.progress) }}
                />
              </g>
            );
          })}

          {wiredParts.map(({ id: partId }) => {
            const wire = bonsai.parts[partId]?.wire;
            if (!wire) return null;
            const href = wirePhotoHref(partId, wire.intensity);
            if (!href) return null;
            const lifecycle = wireLifecycle(wire, bonsai.species);
            const progressBand = Math.min(3, Math.floor(Math.min(99.999, lifecycle.progress) / 25));
            return (
              <g
                key={partId}
                className={`wire-photo-state wire-group-${wire.intensity} wire-status-${lifecycle.status} wire-progress-${progressBand}`}
                data-testid="photoreal-wire"
                data-wire-part={partId}
                data-wire-intensity={wire.intensity}
                data-wire-direction={wire.direction}
                data-wire-progress={lifecycle.progress.toFixed(2)}
                data-wire-progress-band={progressBand}
                data-wire-status={lifecycle.status}
                data-wire-asset={href}
              >
                <image
                  className="wire-raster"
                  href={href}
                  x="0"
                  y="0"
                  width="900"
                  height="1500"
                  preserveAspectRatio="none"
                />
              </g>
            );
          })}

          {bonsai.shari && !deadwoodProjects.some(project => project.kind === 'shari') && (
            <g
              className="legacy-shari-photoreal deadwood-effect deadwood-shari stage-mature"
              data-testid="photoreal-deadwood"
              data-stage="mature"
              data-paused="false"
              data-deadwood-kind="shari"
              data-deadwood-level={bonsai.shari.level}
              data-deadwood-progress="100.00"
              data-deadwood-progress-band="3"
              data-deadwood-asset={legacyShariPhotoHref(bonsai.shari.side, bonsai.shari.level)}
            >
              <image
                className="deadwood-raster"
                href={legacyShariPhotoHref(bonsai.shari.side, bonsai.shari.level)}
                x="0"
                y="0"
                width="900"
                height="1500"
                preserveAspectRatio="none"
                style={{ filter: deadwoodVisualFilter('mature', 100) }}
              />
            </g>
          )}
        </svg>

        {interactive && selectedDefinition && (
          <div className="direct-part-selection" style={{ left: `${selectedDefinition.x}%`, top: `${selectedDefinition.y}%` }} aria-hidden="true"><span>{selectedDefinition.name}</span></div>
        )}
        {interactive && <div className="direct-pick-hint">写真をタップして部位を選択</div>}
        {interactive && PARTS.map(part => (
          <button
            type="button"
            key={part.id}
            className={`part-hotspot part-hit-zone ${selectedPart === part.id ? 'selected' : ''}`}
            style={{ left: `${part.x}%`, top: `${part.y}%` }}
            aria-label={`${part.name}を選択`}
            onClick={() => onSelectPart?.(part.id)}
          >
            {part.short}
          </button>
        ))}
      </div>

      {!interactive && wiredCount > 0 && <span className="wire-status-tag">整姿中 {wiredCount}枝</span>}
      {!interactive && unfinishedDeadwood.length > 0 && <span className="deadwood-status-tag">古木技法：{deadwoodStageLabel(unfinishedDeadwood[0].stage)}{unfinishedDeadwood[0].pausedAt ? '・中断中' : ''}</span>}
      {!interactive && dead && <span className="dead-tree-status-tag">枯死・{bonsai.deathCause ?? '全身衰弱'}</span>}
    </figure>
  );
}

function showNaturalCut(role: SiteRole): boolean {
  return role === 'branchBase' || role === 'tip' || role === 'defectBranch';
}

function naturalCutScarPath(x: number, y: number, seedText: string): string {
  const seed = [...seedText].reduce((sum, char) => sum + char.charCodeAt(0), 0);
  const points = Array.from({ length: 9 }, (_, index) => {
    const angle = (Math.PI * 2 * index) / 9;
    const wobble = 1 + Math.sin(seed * .17 + index * 1.91) * .16;
    const rx = 4.6 * wobble;
    const ry = 3.2 * (1 + Math.cos(seed * .11 + index * 1.37) * .12);
    return [x + Math.cos(angle) * rx, y + Math.sin(angle) * ry] as const;
  });
  return `${points.map((point, index) => `${index ? 'L' : 'M'} ${roundSvg(point[0])} ${roundSvg(point[1])}`).join(' ')} Z`;
}

function roundSvg(value: number): number {
  return Math.round(value * 10) / 10;
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
