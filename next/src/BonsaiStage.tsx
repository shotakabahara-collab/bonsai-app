import { useId, useMemo, useState } from 'react';
import {
  PARTS,
  diseaseName,
  pestName,
  type BonsaiState,
  type PartId,
  type SpeciesId,
  type WireDirection
} from './model';
import { activeDeadwoodProjects, deadwoodStageLabel, precisionVisualSites, type DeadwoodStage } from './craft-v3';

type WireTurn = readonly [x: number, y: number, angle: number, radius: number, height: number];

// Calibrated against the bundled 900×1500 master photograph. Each turn is a
// curved front/back arc around the photographed branch, never a straight bar.
const WIRE_TURNS: Partial<Record<PartId, readonly WireTurn[]>> = {
  apex: [
    [475, 610, -80, 13, 8], [468, 574, -79, 13, 8], [459, 538, -76, 12, 8],
    [448, 503, -72, 12, 7], [432, 468, -66, 11, 7], [412, 436, -58, 10, 7],
    [389, 405, -50, 10, 6], [365, 374, -46, 9, 6]
  ],
  firstLeft: [
    [463, 590, 194, 12, 7], [425, 575, 193, 11, 7], [386, 561, 191, 11, 7],
    [346, 548, 188, 10, 6], [305, 538, 185, 10, 6], [263, 529, 182, 9, 6],
    [220, 521, 180, 9, 5], [178, 515, 178, 8, 5]
  ],
  secondRight: [
    [488, 485, -6, 13, 8], [529, 480, -4, 12, 8], [570, 478, 0, 12, 7],
    [613, 480, 4, 11, 7], [657, 486, 8, 10, 6], [701, 495, 13, 9, 6],
    [745, 508, 18, 9, 5]
  ],
  thirdLeft: [
    [427, 823, 170, 12, 7], [391, 831, 167, 11, 7], [355, 841, 164, 10, 6],
    [319, 852, 161, 9, 6], [284, 864, 158, 9, 5]
  ],
  back: [
    [476, 615, 10, 11, 7], [510, 621, 12, 10, 6], [545, 629, 14, 10, 6],
    [580, 638, 16, 9, 5], [616, 649, 18, 8, 5]
  ],
  front: [
    [449, 786, 18, 12, 7], [485, 798, 20, 11, 7], [522, 812, 22, 10, 6],
    [559, 827, 24, 9, 6], [596, 844, 26, 8, 5]
  ]
};

const WIRE_BRANCH_PATHS: Partial<Record<PartId, { d: string; width: number }>> = {
  apex: { d: 'M482 626 C471 566 459 515 434 468 C407 416 371 373 330 338', width: 31 },
  firstLeft: { d: 'M478 595 C407 568 330 542 250 528 C204 520 161 514 122 506', width: 25 },
  secondRight: { d: 'M480 486 C557 474 633 479 702 496 C749 508 786 523 818 544', width: 27 },
  thirdLeft: { d: 'M440 817 C395 828 348 843 303 861 C273 873 247 886 223 900', width: 25 },
  back: { d: 'M469 613 C515 620 568 634 622 654', width: 22 },
  front: { d: 'M445 783 C496 800 548 824 605 852', width: 24 }
};

const JIN_PATHS: Partial<Record<PartId, string>> = {
  apex: 'M480 620 C466 558 451 506 425 459 C399 412 364 370 326 338',
  firstLeft: 'M474 594 C410 569 342 547 273 533 C222 523 174 516 128 506',
  secondRight: 'M485 486 C553 476 620 480 686 494 C733 504 771 520 807 541',
  thirdLeft: 'M435 821 C395 831 354 844 314 860 C282 873 254 886 230 900',
  back: 'M470 615 C514 621 565 635 616 653',
  front: 'M447 784 C494 800 545 823 598 849'
};

const SHARI_PATHS = {
  left: 'M288 1238 C269 1182 247 1120 244 1062 C241 1009 276 981 329 958 C373 938 401 883 418 820 C442 730 462 640 478 548',
  right: 'M304 1239 C287 1182 267 1118 266 1060 C266 1007 300 980 348 954 C390 930 418 876 434 816 C457 728 474 638 484 548'
} as const;

// Irregular filled ribbons follow the actual live trunk. Unlike the previous
// single thick stroke, these shapes keep a narrow living vein beside the work.
const SHARI_RIBBONS = {
  left: 'M278 1239 C260 1184 238 1124 237 1063 C236 1010 267 977 320 951 C364 930 390 879 407 817 C430 728 451 638 469 545 L482 551 C469 642 449 734 425 824 C407 890 380 946 334 968 C285 992 252 1018 252 1065 C253 1120 275 1180 294 1236 Z',
  right: 'M296 1241 C280 1184 260 1121 260 1060 C260 1007 293 974 342 947 C383 924 409 872 426 812 C449 724 466 635 476 545 L490 551 C481 641 464 733 440 820 C422 886 394 942 351 966 C307 991 276 1016 276 1062 C276 1117 296 1178 312 1237 Z'
} as const;

const SHARI_LIVE_EDGES = {
  left: 'M294 1236 C275 1180 253 1120 252 1065 C252 1018 285 992 334 968 C380 946 407 890 425 824 C449 734 469 642 482 551',
  right: 'M312 1237 C296 1178 276 1117 276 1062 C276 1016 307 991 351 966 C394 942 422 886 440 820 C464 733 481 641 490 551'
} as const;

const SHARI_GRAINS = {
  left: [
    'M284 1231 C270 1179 251 1121 250 1067 C250 1025 282 999 328 976 C373 953 400 899 418 832 C441 746 460 656 474 564',
    'M288 1220 C276 1175 260 1118 260 1072 C260 1034 291 1008 335 986 C378 964 404 910 422 845 C444 760 461 673 474 586'
  ],
  right: [
    'M302 1231 C290 1180 274 1120 274 1066 C274 1023 304 999 347 975 C388 952 415 898 432 833 C454 747 471 659 482 566',
    'M306 1218 C296 1174 284 1118 284 1073 C284 1034 313 1009 354 987 C394 965 420 912 436 848 C457 765 473 680 482 590'
  ]
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
  const id = useId().replace(/:/g, '');
  const source = useMemo(() => resolvePhoto(bonsai), [bonsai.potId, bonsai.species]);
  const vitalityFilter = Math.max(.38, bonsai.vitality / 100);
  const waterFilter = Math.max(.58, bonsai.water / 100);
  const dead = bonsai.lifeStatus === 'dead';
  const saturation = dead ? .22 : .68 + vitalityFilter * .42;
  const brightness = dead ? .58 : .65 + waterFilter * .3;
  const livingParts = PARTS.filter(part => !['trunk', 'roots'].includes(part.id));
  const wiredParts = livingParts.filter(part => bonsai.parts[part.id]?.wire && WIRE_TURNS[part.id]);
  const wiredCount = wiredParts.length;
  const precisionSites = precisionVisualSites(bonsai);
  const deadwoodProjects = bonsai.craft.deadwoodProjects;
  const unfinishedDeadwood = activeDeadwoodProjects(bonsai);

  return (
    <figure className={`bonsai-stage authentic-state-v5 ${dead ? 'bonsai-dead' : ''} ${className}`} aria-label={`${bonsai.name}の現在の姿`} data-renderer="authentic-state-v5">
      <img
        className="bonsai-photo"
        src={failed ? FALLBACK[bonsai.species] : source}
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
            {pruneOpacity > .05 && <span className="prune-mask authentic-leaf-loss" style={{ opacity: Math.min(.42, pruneOpacity) }} />}
            {part.disease && <span className={`condition condition-${part.disease}`} title={diseaseName(part.disease)} />}
            {part.pest && <span className={`condition pest condition-${part.pest}`} title={pestName(part.pest)} />}
          </div>
        );
      })}

      <svg className="precision-prune-svg" viewBox="0 0 900 1500" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
        <defs>
          <filter id={`${id}-leaf-fade`} x="-40%" y="-40%" width="180%" height="180%">
            <feTurbulence type="fractalNoise" baseFrequency=".025 .065" numOctaves="2" seed="17" result="noise" />
            <feDisplacementMap in="SourceGraphic" in2="noise" scale="12" />
            <feGaussianBlur stdDeviation="6" />
          </filter>
        </defs>
        {precisionSites.map(site => (
          <g key={site.id}>
            <ellipse className="precision-prune-veil authentic-prune-veil" filter={`url(#${id}-leaf-fade)`} cx={site.x * 9} cy={site.y * 15} rx={site.role === 'foliagePad' ? 52 : 34} ry={site.role === 'foliagePad' ? 34 : 23} opacity={site.opacity * .65} />
            {site.removed && <g className="precision-cut-site"><circle className="precision-cut-scar" cx={site.x * 9} cy={site.y * 15} r="8" /><circle className="precision-cut-ring" cx={site.x * 9} cy={site.y * 15} r="5.4" /></g>}
          </g>
        ))}
      </svg>

      <svg
        className={`wire-layer authentic-work-layer ${interactive ? 'wire-layer-editing' : 'wire-layer-viewing'}`}
        viewBox="0 0 900 1500"
        preserveAspectRatio="xMidYMid slice"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id={`${id}-copper`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#c68a60" />
            <stop offset=".26" stopColor="#824b31" />
            <stop offset=".62" stopColor="#40271d" />
            <stop offset="1" stopColor="#a56543" />
          </linearGradient>
          <linearGradient id={`${id}-fresh`} x1="0" y1="0" x2="1" y2="0"><stop stopColor="#6e3828"/><stop offset=".25" stopColor="#c98e63"/><stop offset=".58" stopColor="#edc491"/><stop offset="1" stopColor="#875038"/></linearGradient>
          <linearGradient id={`${id}-drying`} x1="0" y1="0" x2="1" y2="0"><stop stopColor="#806047"/><stop offset=".3" stopColor="#b8966e"/><stop offset=".66" stopColor="#d9bd91"/><stop offset="1" stopColor="#755840"/></linearGradient>
          <linearGradient id={`${id}-carving`} x1="0" y1="0" x2="1" y2="0"><stop stopColor="#88765c"/><stop offset=".22" stopColor="#cdb58c"/><stop offset=".57" stopColor="#ead7ad"/><stop offset="1" stopColor="#958064"/></linearGradient>
          <linearGradient id={`${id}-preserving`} x1="0" y1="0" x2="1" y2="0"><stop stopColor="#a2a195"/><stop offset=".25" stopColor="#d7d8cf"/><stop offset=".62" stopColor="#f0f0e7"/><stop offset="1" stopColor="#aaa99e"/></linearGradient>
          <linearGradient id={`${id}-weathering`} x1="0" y1="0" x2="1" y2="0"><stop stopColor="#858a85"/><stop offset=".28" stopColor="#c3c7c0"/><stop offset=".62" stopColor="#e1e4dc"/><stop offset="1" stopColor="#969b95"/></linearGradient>
          <linearGradient id={`${id}-mature`} x1="0" y1="0" x2="1" y2="0"><stop stopColor="#747b77"/><stop offset=".24" stopColor="#cbd0cb"/><stop offset=".58" stopColor="#eff1ec"/><stop offset="1" stopColor="#858c87"/></linearGradient>
          <filter id={`${id}-wire-shadow`} x="-50%" y="-50%" width="200%" height="200%"><feDropShadow dx="1.2" dy="1.8" stdDeviation="1.1" floodColor="#120905" floodOpacity=".68" /></filter>
          <filter id={`${id}-wood-texture`} x="-30%" y="-20%" width="160%" height="140%">
            <feTurbulence type="fractalNoise" baseFrequency=".012 .085" numOctaves="4" seed="29" result="grain" />
            <feDisplacementMap in="SourceGraphic" in2="grain" scale="3.2" xChannelSelector="R" yChannelSelector="G" />
            <feDropShadow dx=".7" dy="1.2" stdDeviation=".9" floodColor="#1d1009" floodOpacity=".38" />
          </filter>
          <filter id={`${id}-photo-wood`} x="-22%" y="-18%" width="144%" height="136%">
            <feColorMatrix type="saturate" values="0" result="gray" />
            <feComponentTransfer in="gray" result="contrast">
              <feFuncR type="gamma" amplitude="1.34" exponent=".72" offset=".035" />
              <feFuncG type="gamma" amplitude="1.34" exponent=".72" offset=".035" />
              <feFuncB type="gamma" amplitude="1.34" exponent=".72" offset=".035" />
            </feComponentTransfer>
            <feTurbulence type="fractalNoise" baseFrequency=".018 .105" numOctaves="3" seed="47" result="edgeNoise" />
            <feDisplacementMap in="contrast" in2="edgeNoise" scale="4.2" xChannelSelector="R" yChannelSelector="G" />
          </filter>
          {wiredParts.map(({ id: partId }) => {
            const branch = WIRE_BRANCH_PATHS[partId];
            return branch ? (
              <clipPath key={partId} id={`${id}-branch-${partId}`} clipPathUnits="userSpaceOnUse">
                <path d={branch.d} fill="none" stroke="white" strokeWidth={branch.width} strokeLinecap="round" />
              </clipPath>
            ) : null;
          })}
          {deadwoodProjects.map(project => {
            const clipId = `${id}-deadwood-${svgToken(project.id)}`;
            if (project.kind === 'shari') {
              const side = project.side === 'right' ? 'right' : 'left';
              return <clipPath key={clipId} id={clipId} clipPathUnits="userSpaceOnUse"><path d={SHARI_RIBBONS[side]} /></clipPath>;
            }
            const path = JIN_PATHS[project.targetPartId];
            return path ? <clipPath key={clipId} id={clipId} clipPathUnits="userSpaceOnUse"><path d={path} fill="none" stroke="white" strokeWidth={jinWidth(project.level)} strokeLinecap="round" /></clipPath> : null;
          })}
          {bonsai.shari && !deadwoodProjects.some(project => project.kind === 'shari') && (
            <clipPath id={`${id}-legacy-shari`} clipPathUnits="userSpaceOnUse"><path d={SHARI_RIBBONS[bonsai.shari.side]} /></clipPath>
          )}
        </defs>

        {deadwoodProjects.map(project => {
          const clipId = `${id}-deadwood-${svgToken(project.id)}`;
          const photo = failed ? FALLBACK[bonsai.species] : source;
          const opacity = deadwoodPhotoOpacity(project.stage);
          if (project.kind === 'shari') {
            const side = project.side === 'right' ? 'right' : 'left';
            const ribbon = SHARI_RIBBONS[side];
            return (
              <g key={project.id} className={`deadwood-effect deadwood-shari stage-${project.stage} ${project.pausedAt ? 'paused' : ''}`} data-testid="photoreal-deadwood" data-stage={project.stage} data-paused={project.pausedAt ? 'true' : 'false'}>
                <path d={ribbon} className="deadwood-bark-edge deadwood-shari-outline" />
                <path d={ribbon} className="deadwood-wood-core deadwood-shari-fill" style={{ fill: `url(#${id}-${project.stage})` }} filter={`url(#${id}-wood-texture)`} />
                <image className="deadwood-photo-texture" href={photo} x="0" y="0" width="900" height="1500" preserveAspectRatio="xMidYMid meet" clipPath={`url(#${clipId})`} filter={`url(#${id}-photo-wood)`} opacity={opacity} />
                <path d={SHARI_LIVE_EDGES[side]} className="deadwood-live-edge deadwood-shari-live-edge" />
                {SHARI_GRAINS[side].map((grain, index) => <path key={grain} d={grain} className={`deadwood-grain deadwood-grain-${index ? 'b' : 'a'}`} clipPath={`url(#${clipId})`} />)}
              </g>
            );
          }

          const path = JIN_PATHS[project.targetPartId];
          if (!path) return null;
          const width = jinWidth(project.level);
          const [edgeX, edgeY] = jinLiveEdgeOffset(project.targetPartId);
          return (
            <g key={project.id} className={`deadwood-effect deadwood-jin stage-${project.stage} ${project.pausedAt ? 'paused' : ''}`} data-testid="photoreal-deadwood" data-stage={project.stage} data-paused={project.pausedAt ? 'true' : 'false'}>
              <path d={path} className="deadwood-bark-edge deadwood-jin-outline" strokeWidth={width + 3.2} />
              <path d={path} className="deadwood-wood-core deadwood-jin-core" style={{ stroke: `url(#${id}-${project.stage})` }} strokeWidth={width} filter={`url(#${id}-wood-texture)`} />
              <image className="deadwood-photo-texture" href={photo} x="0" y="0" width="900" height="1500" preserveAspectRatio="xMidYMid meet" clipPath={`url(#${clipId})`} filter={`url(#${id}-photo-wood)`} opacity={opacity} />
              <path d={path} className="deadwood-live-edge deadwood-jin-live-edge" strokeWidth="1.6" transform={`translate(${edgeX} ${edgeY})`} />
              <path d={path} className="deadwood-grain deadwood-grain-a" strokeWidth={Math.max(.9, width * .12)} transform="translate(-1 .6)" />
              <path d={path} className="deadwood-grain deadwood-grain-b" strokeWidth={Math.max(.7, width * .085)} transform="translate(1.4 -1)" />
              <path className="jin-torn-end" d={jinTornEndPath(project.targetPartId, width)} style={{ fill: `url(#${id}-${project.stage})` }} />
            </g>
          );
        })}

        {/* Continuous copper helix under the photographed branch. The photo is
            repainted between the back and front passes, so every other diagonal
            genuinely disappears behind the wood instead of looking pasted on. */}
        {wiredParts.map(({ id: partId }) => {
          const wire = bonsai.parts[partId]?.wire;
          const turns = WIRE_TURNS[partId];
          if (!wire || !turns) return null;
          const [dx, dy] = wireOffset(wire.direction);
          const segments = wireCoilSegments(turns);
          return (
            <g key={`${partId}-back`} className={`wire-turn-group wire-group-${wire.intensity}`} transform={`translate(${dx} ${dy})`} filter={`url(#${id}-wire-shadow)`}>
              {segments.map((segment, index) => (
                <path key={index} className="wire-turn-back" d={segment.d} style={{ stroke: `url(#${id}-copper)` }} />
              ))}
            </g>
          );
        })}

        {/* Repaint the photographed branch over the back half: genuine foreground occlusion. */}
        {wiredParts.map(({ id: partId }) => (
          <image
            key={`${partId}-occlusion`}
            className="wire-branch-occlusion"
            data-testid="wire-branch-occlusion"
            href={failed ? FALLBACK[bonsai.species] : source}
            x="0" y="0" width="900" height="1500"
            preserveAspectRatio="xMidYMid meet"
            clipPath={`url(#${id}-branch-${partId})`}
          />
        ))}

        {/* Alternate diagonal spans are the front half of the same helix. */}
        {wiredParts.map(({ id: partId }) => {
          const wire = bonsai.parts[partId]?.wire;
          const turns = WIRE_TURNS[partId];
          if (!wire || !turns) return null;
          const [dx, dy] = wireOffset(wire.direction);
          const segments = wireCoilSegments(turns).filter(segment => segment.front);
          return (
            <g key={`${partId}-front`} className={`wire-turn-group wire-group-${wire.intensity}`} transform={`translate(${dx} ${dy})`} data-testid="photoreal-wire">
              {segments.map((segment, index) => (
                <g key={index}>
                  <path className="wire-turn-front wire-coil-metal" d={segment.d} style={{ stroke: `url(#${id}-copper)` }} />
                  <path className="wire-turn-glint" d={segment.glint} />
                </g>
              ))}
            </g>
          );
        })}

        {bonsai.shari && !deadwoodProjects.some(project => project.kind === 'shari') && (
          <g className="legacy-shari-photoreal deadwood-effect deadwood-shari stage-mature" data-testid="photoreal-deadwood" data-stage="mature" data-paused="false">
            <path d={SHARI_RIBBONS[bonsai.shari.side]} className="deadwood-bark-edge deadwood-shari-outline" />
            <path d={SHARI_RIBBONS[bonsai.shari.side]} className="deadwood-wood-core deadwood-shari-fill" style={{ fill: `url(#${id}-mature)` }} filter={`url(#${id}-wood-texture)`} />
            <image className="deadwood-photo-texture" href={failed ? FALLBACK[bonsai.species] : source} x="0" y="0" width="900" height="1500" preserveAspectRatio="xMidYMid meet" clipPath={`url(#${id}-legacy-shari)`} filter={`url(#${id}-photo-wood)`} opacity=".34" />
            <path d={SHARI_LIVE_EDGES[bonsai.shari.side]} className="deadwood-live-edge deadwood-shari-live-edge" />
            {SHARI_GRAINS[bonsai.shari.side].map((grain, index) => <path key={grain} d={grain} className={`deadwood-grain deadwood-grain-${index ? 'b' : 'a'}`} clipPath={`url(#${id}-legacy-shari)`} />)}
          </g>
        )}
      </svg>

      {!interactive && wiredCount > 0 && <span className="wire-status-tag">整姿中 {wiredCount}枝</span>}
      {!interactive && unfinishedDeadwood.length > 0 && <span className="deadwood-status-tag">古木技法：{deadwoodStageLabel(unfinishedDeadwood[0].stage)}{unfinishedDeadwood[0].pausedAt ? '・中断中' : ''}</span>}
      {!interactive && dead && <span className="dead-tree-status-tag">枯死・{bonsai.deathCause ?? '全身衰弱'}</span>}

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

function svgToken(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]/g, '');
}

function jinWidth(level: number): number {
  return 9 + Math.max(1, Math.min(3, level)) * 2;
}

function deadwoodPhotoOpacity(stage: DeadwoodStage): number {
  return ({ fresh: .78, drying: .82, carving: .86, preserving: .72, weathering: .78, mature: .82 } as Record<DeadwoodStage, number>)[stage];
}

function jinLiveEdgeOffset(partId: PartId): readonly [number, number] {
  return ({
    apex: [3, 0], firstLeft: [0, 3], secondRight: [0, 3], thirdLeft: [0, -3], back: [0, 2.4], front: [0, -2.4],
    trunk: [0, 0], roots: [0, 0]
  } as Record<PartId, readonly [number, number]>)[partId];
}

function jinEndPoint(partId: PartId): readonly [number, number] {
  return ({
    apex: [326, 338], firstLeft: [128, 506], secondRight: [807, 541], thirdLeft: [230, 900], back: [616, 653], front: [598, 849],
    trunk: [0, 0], roots: [0, 0]
  } as Record<PartId, readonly [number, number]>)[partId];
}

function jinTornEndPath(partId: PartId, width: number): string {
  const [x, y] = jinEndPoint(partId);
  const r = width * .62;
  return `M ${x - r} ${y - r * .2} L ${x - r * .35} ${y - r * .78} L ${x + r * .1} ${y - r * .52} L ${x + r * .72} ${y - r * .14} L ${x + r * .42} ${y + r * .62} L ${x - r * .2} ${y + r * .76} L ${x - r * .76} ${y + r * .28} Z`;
}

type WireCoilSegment = { d: string; glint: string; front: boolean };

function wireCoilSegments(turns: readonly WireTurn[]): WireCoilSegment[] {
  const points = turns.map(([x, y, angle, radius], index) => {
    const radians = (angle + 90) * Math.PI / 180;
    const sign = index % 2 === 0 ? 1 : -1;
    return {
      x: x + Math.cos(radians) * radius * sign,
      y: y + Math.sin(radians) * radius * sign,
      angle
    };
  });

  return points.slice(0, -1).map((point, index) => {
    const next = points[index + 1];
    const cp1x = point.x * .66 + next.x * .34;
    const cp1y = point.y * .66 + next.y * .34;
    const cp2x = point.x * .34 + next.x * .66;
    const cp2y = point.y * .34 + next.y * .66;
    const d = `M ${roundSvg(point.x)} ${roundSvg(point.y)} C ${roundSvg(cp1x)} ${roundSvg(cp1y)} ${roundSvg(cp2x)} ${roundSvg(cp2y)} ${roundSvg(next.x)} ${roundSvg(next.y)}`;
    const glintStartX = point.x * .72 + cp1x * .28;
    const glintStartY = point.y * .72 + cp1y * .28;
    const glintEndX = next.x * .72 + cp2x * .28;
    const glintEndY = next.y * .72 + cp2y * .28;
    const glint = `M ${roundSvg(glintStartX)} ${roundSvg(glintStartY)} C ${roundSvg(cp1x)} ${roundSvg(cp1y)} ${roundSvg(cp2x)} ${roundSvg(cp2y)} ${roundSvg(glintEndX)} ${roundSvg(glintEndY)}`;
    return { d, glint, front: index % 2 === 0 };
  });
}

function roundSvg(value: number): number {
  return Math.round(value * 10) / 10;
}

function wireOffset(direction: WireDirection): readonly [number, number] {
  return ({
    down: [0, 3], up: [0, -3], left: [-3, 0], right: [3, 0], front: [2, 2], back: [-2, -2]
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
