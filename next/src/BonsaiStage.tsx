import { useId, useMemo, useState } from 'react';
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
  precisionVisualSites,
  type DeadwoodStage,
  type SiteRole
} from './craft-v3';

type WireGuidePoint = readonly [x: number, y: number, tangentDegrees: number, radius: number];

type WireGuide = {
  points: readonly WireGuidePoint[];
  branchPath: string;
  branchWidth: number;
};

// Coordinates are tied to the bundled 900×1500 black-pine master photograph.
// The v6 renderer places the photograph and every state layer inside one exact
// 3:5 canvas, so these guides cannot drift when the iPhone wall view changes size.
const WIRE_GUIDES: Partial<Record<PartId, WireGuide>> = {
  apex: {
    points: [
      [481, 607, -82, 8.2], [474, 568, -80, 8], [464, 529, -76, 7.6],
      [451, 491, -70, 7.1], [433, 454, -62, 6.6], [411, 419, -54, 6.1],
      [386, 388, -47, 5.6], [360, 360, -42, 5.1]
    ],
    branchPath: 'M481 607 C471 552 460 510 437 466 C414 421 385 384 351 350',
    branchWidth: 18
  },
  firstLeft: {
    points: [
      [466, 590, 194, 7.3], [426, 574, 193, 7], [386, 558, 190, 6.6],
      [347, 545, 187, 6.2], [309, 535, 184, 5.8], [271, 528, 181, 5.4],
      [234, 522, 179, 5], [198, 517, 177, 4.6]
    ],
    branchPath: 'M468 591 C414 570 357 551 301 537 C261 527 222 520 186 516',
    branchWidth: 15
  },
  secondRight: {
    points: [
      [493, 486, -6, 7.8], [537, 480, -4, 7.4], [581, 479, 0, 7],
      [625, 482, 4, 6.5], [669, 489, 8, 6], [713, 500, 13, 5.5],
      [756, 514, 18, 5]
    ],
    branchPath: 'M490 486 C553 476 617 479 680 491 C716 498 747 507 775 520',
    branchWidth: 17
  },
  thirdLeft: {
    // Only the visible woody shoulder is wired. The old v5 guide continued into
    // empty wall space and created the large diagonal tube seen on the iPhone.
    points: [
      [397, 829, 166, 6.2], [373, 837, 164, 5.8], [349, 846, 161, 5.3],
      [326, 857, 158, 4.8]
    ],
    branchPath: 'M403 827 C377 836 350 846 323 858',
    branchWidth: 14
  },
  back: {
    points: [
      [473, 612, 10, 6.3], [507, 619, 12, 5.9], [541, 628, 14, 5.5],
      [575, 639, 16, 5], [608, 651, 18, 4.6]
    ],
    branchPath: 'M471 612 C515 620 561 632 608 651',
    branchWidth: 13
  },
  front: {
    points: [
      [405, 814, 15, 6.4], [444, 827, 18, 5.9], [483, 841, 20, 5.4],
      [522, 856, 23, 4.9], [560, 873, 26, 4.5]
    ],
    branchPath: 'M403 814 C455 831 507 850 560 873',
    branchWidth: 14
  }
};

// A jin begins as a short stripped stub at the branch collar.  v5 painted the
// whole branch as pale wood, which looked like a ruler laid over the photograph.
const JIN_PATHS: Partial<Record<PartId, string>> = {
  apex: 'M480 606 C477 589 473 573 469 557',
  firstLeft: 'M466 590 C453 585 440 580 427 575',
  secondRight: 'M492 486 C505 483 518 481 532 480',
  thirdLeft: 'M399 829 C388 833 377 837 366 841',
  back: 'M472 612 C482 614 491 617 500 620',
  front: 'M405 815 C416 819 427 823 438 827'
};

const DEADWOOD_PHOTO_BASE = '/bonsai-app/assets/kuromatsu/deadwood-photo-v6';
const DEADWOOD_JIN_PARTS = new Set<PartId>(['apex', 'firstLeft', 'secondRight', 'thirdLeft', 'back', 'front']);

type ActiveDeadwoodProject = ReturnType<typeof activeDeadwoodProjects>[number];

function deadwoodPhotoHref(project: ActiveDeadwoodProject): string | null {
  if (project.kind === 'shari') {
    const side = project.side === 'right' ? 'right' : 'left';
    const level = Math.max(1, Math.min(3, Math.round(project.level)));
    return `${DEADWOOD_PHOTO_BASE}/shari-${side}-l${level}.webp`;
  }
  return DEADWOOD_JIN_PARTS.has(project.targetPartId)
    ? `${DEADWOOD_PHOTO_BASE}/jin-${project.targetPartId}.webp`
    : null;
}

function legacyShariPhotoHref(side: 'left' | 'right'): string {
  return `${DEADWOOD_PHOTO_BASE}/shari-${side}-l3.webp`;
}

// Shari is rendered as separated, tapered bark-loss patches.  The tiny gaps and
// changing width stop it reading as one glowing ribbon while preserving a live
// vein along the neighbouring bark.
const SHARI_RIBBONS = {
  left: [
    'M280 1236 C266 1192 247 1153 221 1106 L226 1103 C252 1150 271 1190 286 1233 Z',
    'M220 1094 C209 1055 208 1028 216 1011 C228 998 251 990 271 980 L276 985 C255 997 234 1005 225 1017 C218 1032 219 1057 226 1092 Z',
    'M278 975 C314 955 336 932 347 902 C358 873 364 850 367 832 L373 834 C370 854 364 879 353 907 C341 938 318 963 282 983 Z',
    'M369 824 C382 790 394 756 405 720 C425 655 447 602 464 557 L470 560 C452 607 431 661 411 724 C400 760 388 795 375 828 Z'
  ].join(' '),
  right: [
    'M296 1236 C282 1192 263 1153 237 1106 L242 1103 C268 1150 287 1190 302 1233 Z',
    'M236 1094 C225 1055 224 1028 232 1011 C244 998 267 990 287 980 L292 985 C271 997 250 1005 241 1017 C234 1032 235 1057 242 1092 Z',
    'M294 975 C330 955 352 932 363 902 C374 873 380 850 383 832 L389 834 C386 854 380 879 369 907 C357 938 334 963 298 983 Z',
    'M385 824 C398 790 410 756 421 720 C441 655 463 602 480 557 L486 560 C468 607 447 661 427 724 C416 760 404 795 391 828 Z'
  ].join(' ')
} as const;

const SHARI_LIVE_EDGES = {
  left: 'M286 1233 C271 1190 252 1150 226 1103 M226 1092 C219 1057 218 1032 225 1017 C234 1005 255 997 276 985 M282 983 C318 963 341 938 353 907 C364 879 370 854 373 834 M375 828 C388 795 400 760 411 724 C431 661 452 607 470 560',
  right: 'M302 1233 C287 1190 268 1150 242 1103 M242 1092 C235 1057 234 1032 241 1017 C250 1005 271 997 292 985 M298 983 C334 963 357 938 369 907 C380 879 386 854 389 834 M391 828 C404 795 416 760 427 724 C447 661 468 607 486 560'
} as const;

const SHARI_GRAINS = {
  left: [
    'M283 1222 C269 1184 252 1148 226 1110 M222 1081 C216 1052 217 1032 224 1019 C236 1007 254 999 270 989 M284 971 C315 951 335 929 346 901 C356 875 362 851 365 837 M374 816 C386 783 397 751 408 715 C427 653 447 604 461 568',
    'M278 1208 C265 1173 249 1140 229 1114 M227 1078 C222 1053 223 1036 230 1023 C241 1013 257 1005 272 997 M290 970 C320 950 340 926 350 898 C360 872 365 850 368 839 M379 814 C390 783 402 748 412 713 C430 655 449 606 463 570'
  ],
  right: [
    'M299 1222 C285 1184 268 1148 242 1110 M238 1081 C232 1052 233 1032 240 1019 C252 1007 270 999 286 989 M300 971 C331 951 351 929 362 901 C372 875 378 851 381 837 M390 816 C402 783 413 751 424 715 C443 653 463 604 477 568',
    'M294 1208 C281 1173 265 1140 245 1114 M243 1078 C238 1053 239 1036 246 1023 C257 1013 273 1005 288 997 M306 970 C336 950 356 926 366 898 C376 872 381 850 384 839 M395 814 C406 783 418 748 428 713 C446 655 465 606 479 570'
  ]
} as const;

const SHARI_BARK_ISLANDS = {
  left: [
    'M224 1070 C221 1055 223 1043 230 1031 C229 1045 231 1057 235 1067 Z',
    'M319 952 C328 944 335 935 341 924 C339 941 332 953 321 960 Z',
    'M400 738 C405 721 410 704 415 687 C413 707 409 725 404 742 Z',
    'M447 620 C451 607 455 594 459 581 C458 596 455 610 451 624 Z'
  ],
  right: [
    'M240 1070 C237 1055 239 1043 246 1031 C245 1045 247 1057 251 1067 Z',
    'M335 952 C344 944 351 935 357 924 C355 941 348 953 337 960 Z',
    'M416 738 C421 721 426 704 431 687 C429 707 425 725 420 742 Z',
    'M463 620 C467 607 471 594 475 581 C474 596 471 610 467 624 Z'
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
  const wiredParts = livingParts.filter(part => bonsai.parts[part.id]?.wire && WIRE_GUIDES[part.id]);
  const wiredCount = wiredParts.length;
  const precisionSites = precisionVisualSites(bonsai);
  const deadwoodProjects = bonsai.craft.deadwoodProjects;
  const unfinishedDeadwood = activeDeadwoodProjects(bonsai);
  const photo = failed ? FALLBACK[bonsai.species] : source;

  return (
    <figure
      className={`bonsai-stage photoreal-craft-v6 ${dead ? 'bonsai-dead' : ''} ${className}`}
      aria-label={`${bonsai.name}の現在の姿`}
      data-renderer="photoreal-craft-v6"
    >
      <div className="bonsai-photo-canvas" data-testid="bonsai-photo-canvas">
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

        <svg
          className={`wire-layer authentic-work-layer ${interactive ? 'wire-layer-editing' : 'wire-layer-viewing'}`}
          viewBox="0 0 900 1500"
          preserveAspectRatio="xMidYMid meet"
          aria-hidden="true"
        >
          <defs>
            <linearGradient id={`${id}-copper`} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#7f543e" />
              <stop offset=".38" stopColor="#57392b" />
              <stop offset=".72" stopColor="#32241d" />
              <stop offset="1" stopColor="#684432" />
            </linearGradient>
            <linearGradient id={`${id}-fresh`} x1="0" y1="0" x2="1" y2="0"><stop stopColor="#44372f"/><stop offset=".32" stopColor="#6f6250"/><stop offset=".68" stopColor="#96866b"/><stop offset="1" stopColor="#51463a"/></linearGradient>
            <linearGradient id={`${id}-drying`} x1="0" y1="0" x2="1" y2="0"><stop stopColor="#675543"/><stop offset=".34" stopColor="#9b8464"/><stop offset=".7" stopColor="#c0aa84"/><stop offset="1" stopColor="#6f604a"/></linearGradient>
            <linearGradient id={`${id}-carving`} x1="0" y1="0" x2="1" y2="0"><stop stopColor="#6c6252"/><stop offset=".31" stopColor="#a99878"/><stop offset=".68" stopColor="#cdbd98"/><stop offset="1" stopColor="#786d58"/></linearGradient>
            <linearGradient id={`${id}-preserving`} x1="0" y1="0" x2="1" y2="0"><stop stopColor="#85847a"/><stop offset=".32" stopColor="#b7b8ae"/><stop offset=".7" stopColor="#d5d6cd"/><stop offset="1" stopColor="#8f8f85"/></linearGradient>
            <linearGradient id={`${id}-weathering`} x1="0" y1="0" x2="1" y2="0"><stop stopColor="#737873"/><stop offset=".33" stopColor="#a7aca6"/><stop offset=".7" stopColor="#c6cbc5"/><stop offset="1" stopColor="#7e847f"/></linearGradient>
            <linearGradient id={`${id}-mature`} x1="0" y1="0" x2="1" y2="0"><stop stopColor="#686e6a"/><stop offset=".34" stopColor="#a6aca7"/><stop offset=".7" stopColor="#ced2cd"/><stop offset="1" stopColor="#747b77"/></linearGradient>
            <filter id={`${id}-wire-shadow`} x="-30%" y="-30%" width="160%" height="160%"><feDropShadow dx=".55" dy=".8" stdDeviation=".45" floodColor="#130a06" floodOpacity=".52" /></filter>
            <filter id={`${id}-wood-texture`} x="-24%" y="-18%" width="148%" height="136%">
              <feTurbulence type="fractalNoise" baseFrequency=".014 .1" numOctaves="3" seed="29" result="grain" />
              <feDisplacementMap in="SourceGraphic" in2="grain" scale="2.1" xChannelSelector="R" yChannelSelector="G" />
            </filter>
            <filter id={`${id}-photo-wood`} x="-18%" y="-14%" width="136%" height="128%">
              <feColorMatrix type="matrix" values=".38 .42 .2 0 .04  .36 .44 .2 0 .03  .31 .39 .3 0 .02  0 0 0 1 0" result="woodTone" />
              <feComponentTransfer in="woodTone" result="contrast">
                <feFuncR type="gamma" amplitude="1.03" exponent=".86" offset="0" />
                <feFuncG type="gamma" amplitude="1.03" exponent=".86" offset="0" />
                <feFuncB type="gamma" amplitude="1.03" exponent=".86" offset="0" />
              </feComponentTransfer>
              <feTurbulence type="fractalNoise" baseFrequency=".022 .13" numOctaves="2" seed="47" result="edgeNoise" />
              <feDisplacementMap in="contrast" in2="edgeNoise" scale="2.4" xChannelSelector="R" yChannelSelector="G" />
            </filter>

            {wiredParts.map(({ id: partId }) => {
              const guide = WIRE_GUIDES[partId];
              return guide ? (
                <mask key={partId} id={`${id}-wire-back-mask-${partId}`} maskUnits="userSpaceOnUse" x="0" y="0" width="900" height="1500">
                  <rect x="0" y="0" width="900" height="1500" fill="white" />
                  <path d={guide.branchPath} fill="none" stroke="black" strokeWidth={guide.branchWidth} strokeLinecap="round" strokeLinejoin="round" />
                </mask>
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
            const href = deadwoodPhotoHref(project);
            if (!href) return null;
            return (
              <g
                key={project.id}
                className={`deadwood-effect deadwood-${project.kind} stage-${project.stage} ${project.pausedAt ? 'paused' : ''}`}
                data-testid="photoreal-deadwood"
                data-stage={project.stage}
                data-paused={project.pausedAt ? 'true' : 'false'}
                data-deadwood-kind={project.kind}
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
                />
              </g>
            );
          })}

          {wiredParts.map(({ id: partId }) => {
            const wire = bonsai.parts[partId]?.wire;
            const guide = WIRE_GUIDES[partId];
            if (!wire || !guide) return null;
            const coil = wireHelixPaths(guide.points);
            return (
              <g
                key={`${partId}-back`}
                className={`wire-turn-group wire-group-${wire.intensity}`}
                data-testid="wire-back-pass"
                data-wire-part={partId}
                mask={`url(#${id}-wire-back-mask-${partId})`}
              >
                {coil.back.map((segment, index) => (
                  <path
                    key={index}
                    className="wire-turn-back"
                    d={segment.d}
                    data-wire-span={segment.span}
                    style={{ stroke: `url(#${id}-copper)` }}
                  />
                ))}
              </g>
            );
          })}

          {wiredParts.map(({ id: partId }) => {
            const wire = bonsai.parts[partId]?.wire;
            const guide = WIRE_GUIDES[partId];
            if (!wire || !guide) return null;
            const coil = wireHelixPaths(guide.points);
            return (
              <g
                key={`${partId}-front`}
                className={`wire-turn-group wire-group-${wire.intensity}`}
                data-testid="photoreal-wire"
                data-wire-part={partId}
                filter={`url(#${id}-wire-shadow)`}
              >
                {coil.front.map((segment, index) => (
                  <path
                    key={index}
                    className="wire-turn-front wire-coil-metal"
                    d={segment.d}
                    data-wire-span={segment.span}
                    style={{ stroke: `url(#${id}-copper)` }}
                  />
                ))}
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
              data-deadwood-asset={legacyShariPhotoHref(bonsai.shari.side)}
            >
              <image
                className="deadwood-raster"
                href={legacyShariPhotoHref(bonsai.shari.side)}
                x="0"
                y="0"
                width="900"
                height="1500"
                preserveAspectRatio="none"
              />
            </g>
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
      </div>

      {!interactive && wiredCount > 0 && <span className="wire-status-tag">整姿中 {wiredCount}枝</span>}
      {!interactive && unfinishedDeadwood.length > 0 && <span className="deadwood-status-tag">古木技法：{deadwoodStageLabel(unfinishedDeadwood[0].stage)}{unfinishedDeadwood[0].pausedAt ? '・中断中' : ''}</span>}
      {!interactive && dead && <span className="dead-tree-status-tag">枯死・{bonsai.deathCause ?? '全身衰弱'}</span>}
    </figure>
  );
}

function svgToken(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]/g, '');
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

function jinWidth(level: number): number {
  return 5.4 + Math.max(1, Math.min(3, level)) * 1.15;
}

function deadwoodPhotoOpacity(stage: DeadwoodStage): number {
  return ({ fresh: .5, drying: .55, carving: .61, preserving: .48, weathering: .56, mature: .6 } as Record<DeadwoodStage, number>)[stage];
}

function jinLiveEdgeOffset(partId: PartId): readonly [number, number] {
  return ({
    apex: [2, 0], firstLeft: [0, 2], secondRight: [0, 2], thirdLeft: [0, -1.8], back: [0, 1.8], front: [0, -1.8],
    trunk: [0, 0], roots: [0, 0]
  } as Record<PartId, readonly [number, number]>)[partId];
}

function jinEndPoint(partId: PartId): readonly [number, number] {
  return ({
    apex: [469, 557], firstLeft: [427, 575], secondRight: [532, 480], thirdLeft: [366, 841], back: [500, 620], front: [438, 827],
    trunk: [0, 0], roots: [0, 0]
  } as Record<PartId, readonly [number, number]>)[partId];
}

function jinTornEndPath(partId: PartId, width: number): string {
  const [x, y] = jinEndPoint(partId);
  const r = width * .42;
  return `M ${roundSvg(x - r)} ${roundSvg(y - r * .12)} L ${roundSvg(x - r * .32)} ${roundSvg(y - r * .78)} L ${roundSvg(x + r * .06)} ${roundSvg(y - r * .44)} L ${roundSvg(x + r * .68)} ${roundSvg(y - r * .08)} L ${roundSvg(x + r * .34)} ${roundSvg(y + r * .58)} L ${roundSvg(x - r * .18)} ${roundSvg(y + r * .7)} L ${roundSvg(x - r * .7)} ${roundSvg(y + r * .22)} Z`;
}

type WirePath = { d: string; span: number };

type WireHelix = { front: WirePath[]; back: WirePath[] };

function wireHelixPaths(points: readonly WireGuidePoint[]): WireHelix {
  const samplesPerTurn = 18;
  const front: WirePath[] = [];
  const back: WirePath[] = [];
  let active: { front: boolean; points: Array<readonly [number, number]> } | null = null;

  const flush = () => {
    if (!active || active.points.length < 2) {
      active = null;
      return;
    }
    const entry = { d: smoothSvgPath(active.points), span: roundSvg(pathSpan(active.points)) };
    (active.front ? front : back).push(entry);
    active = null;
  };

  for (let index = 0; index < points.length - 1; index += 1) {
    const current = points[index];
    const next = points[index + 1];
    const lastInterval = index === points.length - 2;
    const limit = samplesPerTurn + (lastInterval ? 1 : 0);
    for (let sample = 0; sample < limit; sample += 1) {
      const t = sample / samplesPerTurn;
      const x = lerp(current[0], next[0], t);
      const y = lerp(current[1], next[1], t);
      const tangent = lerp(current[2], next[2], t) * Math.PI / 180;
      const radius = lerp(current[3], next[3], t);
      const phase = (index + t) * Math.PI * 2;
      const wave = Math.sin(phase);
      const px = x - Math.sin(tangent) * radius * wave;
      const py = y + Math.cos(tangent) * radius * wave;
      const isFront = Math.cos(phase) >= 0;
      const point = [px, py] as const;

      if (!active) {
        active = { front: isFront, points: [point] };
      } else if (active.front === isFront) {
        active.points.push(point);
      } else {
        active.points.push(point);
        flush();
        active = { front: isFront, points: [point] };
      }
    }
  }
  flush();
  return { front, back };
}

function smoothSvgPath(points: ReadonlyArray<readonly [number, number]>): string {
  if (points.length === 2) {
    return `M ${roundSvg(points[0][0])} ${roundSvg(points[0][1])} L ${roundSvg(points[1][0])} ${roundSvg(points[1][1])}`;
  }
  let d = `M ${roundSvg(points[0][0])} ${roundSvg(points[0][1])}`;
  for (let index = 0; index < points.length - 1; index += 1) {
    const p0 = points[Math.max(0, index - 1)];
    const p1 = points[index];
    const p2 = points[index + 1];
    const p3 = points[Math.min(points.length - 1, index + 2)];
    const cp1x = p1[0] + (p2[0] - p0[0]) / 6;
    const cp1y = p1[1] + (p2[1] - p0[1]) / 6;
    const cp2x = p2[0] - (p3[0] - p1[0]) / 6;
    const cp2y = p2[1] - (p3[1] - p1[1]) / 6;
    d += ` C ${roundSvg(cp1x)} ${roundSvg(cp1y)} ${roundSvg(cp2x)} ${roundSvg(cp2y)} ${roundSvg(p2[0])} ${roundSvg(p2[1])}`;
  }
  return d;
}

function pathSpan(points: ReadonlyArray<readonly [number, number]>): number {
  const xs = points.map(point => point[0]);
  const ys = points.map(point => point[1]);
  return Math.hypot(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys));
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
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
