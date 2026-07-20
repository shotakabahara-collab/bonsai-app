from pathlib import Path
import re

root = Path('.')
stage_path = root / 'next/src/BonsaiStage.tsx'
css_path = root / 'next/src/photoreal-v6.css'
sw_path = root / 'next/public/sw.js'
test_path = root / 'next/tests/authentic-v5.mjs'
audit_path = root / 'next/scripts/visual-audit-v6.py'

stage = stage_path.read_text(encoding='utf-8')
anchor = """const JIN_PATHS: Partial<Record<PartId, string>> = {
  apex: 'M480 606 C477 589 473 573 469 557',
  firstLeft: 'M466 590 C453 585 440 580 427 575',
  secondRight: 'M492 486 C505 483 518 481 532 480',
  thirdLeft: 'M399 829 C388 833 377 837 366 841',
  back: 'M472 612 C482 614 491 617 500 620',
  front: 'M405 815 C416 819 427 823 438 827'
};
"""
insert = anchor + """
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
"""
if stage.count(anchor) != 1:
    raise SystemExit('JIN_PATHS anchor changed')
stage = stage.replace(anchor, insert)

render_pattern = re.compile(
    r"          \{deadwoodProjects\.map\(project => \{\n"
    r"            const clipId = `\$\{id\}-deadwood-\$\{svgToken\(project\.id\)\}`;\n"
    r"            const opacity = deadwoodPhotoOpacity\(project\.stage\);\n"
    r".*?\n          \}\)\}\n\n          \{wiredParts\.map",
    re.S,
)
render_replacement = """          {deadwoodProjects.map(project => {
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

          {wiredParts.map"""
stage, count = render_pattern.subn(render_replacement, stage, count=1)
if count != 1:
    raise SystemExit(f'deadwood render block replacement count={count}')

legacy_pattern = re.compile(
    r"          \{bonsai\.shari && !deadwoodProjects\.some\(project => project\.kind === 'shari'\) && \(\n"
    r"            <g className=\"legacy-shari-photoreal.*?\n"
    r"          \)\}\n        </svg>",
    re.S,
)
legacy_replacement = """          {bonsai.shari && !deadwoodProjects.some(project => project.kind === 'shari') && (
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
        </svg>"""
stage, count = legacy_pattern.subn(legacy_replacement, stage, count=1)
if count != 1:
    raise SystemExit(f'legacy shari replacement count={count}')

stage_path.write_text(stage, encoding='utf-8')

css = css_path.read_text(encoding='utf-8')
css_anchor = """.photoreal-craft-v6 .deadwood-effect {
  pointer-events: none;
  isolation: isolate;
}
"""
css_insert = css_anchor + """

/* Jin and shari are photographed transparent layers, not vector ribbons. */
.photoreal-craft-v6 .deadwood-raster {
  width: 900px;
  height: 1500px;
  opacity: .98;
  pointer-events: none;
  image-rendering: auto;
  transform: translateZ(0);
}

.photoreal-craft-v6 .deadwood-effect.stage-fresh .deadwood-raster {
  filter: saturate(.92) brightness(1.01) contrast(1.05);
}

.photoreal-craft-v6 .deadwood-effect.stage-drying .deadwood-raster {
  filter: saturate(.76) brightness(1.02) contrast(1.07);
}

.photoreal-craft-v6 .deadwood-effect.stage-carving .deadwood-raster {
  filter: saturate(.61) brightness(1.04) contrast(1.09);
}

.photoreal-craft-v6 .deadwood-effect.stage-preserving .deadwood-raster {
  filter: saturate(.34) brightness(1.10) contrast(1.06);
}

.photoreal-craft-v6 .deadwood-effect.stage-weathering .deadwood-raster {
  filter: saturate(.18) brightness(1.07) contrast(1.09);
}

.photoreal-craft-v6 .deadwood-effect.stage-mature .deadwood-raster {
  filter: saturate(.08) brightness(1.08) contrast(1.12);
}
"""
if css.count(css_anchor) != 1:
    raise SystemExit('deadwood CSS anchor changed')
css = css.replace(css_anchor, css_insert)
css_path.write_text(css, encoding='utf-8')

sw = sw_path.read_text(encoding='utf-8')
sw_anchor = """  '/bonsai-app/assets/kuromatsu/base/moon.webp',
  '/bonsai-app/assets/kuromatsu/base/old.webp'
];"""
assets = [
    *[f"  '/bonsai-app/assets/kuromatsu/deadwood-photo-v6/shari-{side}-l{level}.webp'" for side in ('left', 'right') for level in (1, 2, 3)],
    *[f"  '/bonsai-app/assets/kuromatsu/deadwood-photo-v6/jin-{part}.webp'" for part in ('apex', 'firstLeft', 'secondRight', 'thirdLeft', 'back', 'front')],
]
sw_insert = """  '/bonsai-app/assets/kuromatsu/base/moon.webp',
  '/bonsai-app/assets/kuromatsu/base/old.webp',
""" + ',\n'.join(assets) + "\n];"
if sw.count(sw_anchor) != 1:
    raise SystemExit('service worker asset anchor changed')
sw = sw.replace(sw_anchor, sw_insert)
sw_path.write_text(sw, encoding='utf-8')

test = test_path.read_text(encoding='utf-8')
old_visual = """  const deadwoodVisual = await page.evaluate(() => ({
    groups: [...document.querySelectorAll('[data-testid="photoreal-deadwood"]')].map(node => ({
      kind: node.classList.contains('deadwood-jin') ? 'jin' : node.classList.contains('deadwood-shari') ? 'shari' : 'unknown',
      stage: node.getAttribute('data-stage'),
      paused: node.getAttribute('data-paused'),
      barkEdges: node.querySelectorAll('.deadwood-bark-edge').length,
      liveEdges: node.querySelectorAll('.deadwood-live-edge').length,
      cores: node.querySelectorAll('.deadwood-wood-core').length,
      grains: node.querySelectorAll('.deadwood-grain').length,
      barkIslands: node.querySelectorAll('.deadwood-bark-island').length,
      fillOpacity: node.querySelector('.deadwood-shari-fill') ? Number(getComputedStyle(node.querySelector('.deadwood-shari-fill')).opacity) : null
    })),
    lineElements: document.querySelectorAll('.authentic-work-layer line').length,
    circleElements: document.querySelectorAll('.precision-prune-svg circle').length,
    legacyPhotoOcclusions: document.querySelectorAll('[data-testid="wire-branch-occlusion"]').length,
    status: document.querySelector('.deadwood-status-tag')?.textContent ?? ''
  }));
  const shariVisual = deadwoodVisual.groups.find(group => group.kind === 'shari');
  if (deadwoodVisual.groups.length !== 2 || !deadwoodVisual.groups.some(group => group.kind === 'jin') || !shariVisual || deadwoodVisual.groups.some(group => group.stage !== 'fresh' || group.barkEdges < 1 || group.liveEdges < 1 || group.cores < 1 || group.grains < 2) || shariVisual.barkIslands < 4 || !(shariVisual.fillOpacity > 0 && shariVisual.fillOpacity <= .55) || deadwoodVisual.lineElements !== 0 || deadwoodVisual.circleElements !== 0 || deadwoodVisual.legacyPhotoOcclusions !== 0) {
    throw new Error(`Photoreal v6 deadwood structure is incomplete: ${JSON.stringify(deadwoodVisual)}`);
  }
"""
new_visual = """  const deadwoodVisual = await page.evaluate(() => ({
    groups: [...document.querySelectorAll('[data-testid="photoreal-deadwood"]')].map(node => {
      const raster = node.querySelector('image.deadwood-raster');
      return {
        kind: node.getAttribute('data-deadwood-kind'),
        stage: node.getAttribute('data-stage'),
        paused: node.getAttribute('data-paused'),
        asset: node.getAttribute('data-deadwood-asset'),
        rasterCount: node.querySelectorAll('image.deadwood-raster').length,
        width: raster?.getAttribute('width'),
        height: raster?.getAttribute('height'),
        preserveAspectRatio: raster?.getAttribute('preserveAspectRatio'),
        vectorPieces: node.querySelectorAll('.deadwood-bark-edge, .deadwood-live-edge, .deadwood-wood-core, .deadwood-grain, .deadwood-bark-island, .jin-torn-end').length,
        filter: raster ? getComputedStyle(raster).filter : ''
      };
    }),
    lineElements: document.querySelectorAll('.authentic-work-layer line').length,
    circleElements: document.querySelectorAll('.precision-prune-svg circle').length,
    legacyPhotoOcclusions: document.querySelectorAll('[data-testid="wire-branch-occlusion"]').length,
    status: document.querySelector('.deadwood-status-tag')?.textContent ?? ''
  }));
  const jinVisual = deadwoodVisual.groups.find(group => group.kind === 'jin');
  const shariVisual = deadwoodVisual.groups.find(group => group.kind === 'shari');
  const invalidRaster = deadwoodVisual.groups.some(group =>
    group.stage !== 'fresh' || group.rasterCount !== 1 || group.width !== '900' || group.height !== '1500' ||
    group.preserveAspectRatio !== 'none' || group.vectorPieces !== 0 || !group.asset?.includes('/deadwood-photo-v6/') ||
    !group.filter || group.filter === 'none'
  );
  if (deadwoodVisual.groups.length !== 2 || !jinVisual || !shariVisual || invalidRaster || !jinVisual.asset?.includes('/jin-') || !shariVisual.asset?.match(/\/shari-right-l[1-3]\.webp$/) || deadwoodVisual.lineElements !== 0 || deadwoodVisual.circleElements !== 0 || deadwoodVisual.legacyPhotoOcclusions !== 0) {
    throw new Error(`Photographed deadwood raster structure is incomplete: ${JSON.stringify(deadwoodVisual)}`);
  }
"""
if test.count(old_visual) != 1:
    raise SystemExit('deadwood browser assertion anchor changed')
test = test.replace(old_visual, new_visual)

old_combined = """      deadwoodGroups: stage.querySelectorAll('[data-testid="photoreal-deadwood"]').length,
      legacyPhotoOcclusions:"""
new_combined = """      deadwoodGroups: stage.querySelectorAll('[data-testid="photoreal-deadwood"]').length,
      deadwoodRasters: stage.querySelectorAll('image.deadwood-raster').length,
      legacyPhotoOcclusions:"""
if test.count(old_combined) != 1:
    raise SystemExit('combined visual anchor changed')
test = test.replace(old_combined, new_combined)
old_combined_assert = "combinedVisual.deadwoodGroups !== 2 || combinedVisual.legacyPhotoOcclusions"
new_combined_assert = "combinedVisual.deadwoodGroups !== 2 || combinedVisual.deadwoodRasters !== 2 || combinedVisual.legacyPhotoOcclusions"
if test.count(old_combined_assert) != 1:
    raise SystemExit('combined assertion anchor changed')
test = test.replace(old_combined_assert, new_combined_assert)

test_path.write_text(test, encoding='utf-8')

audit = audit_path.read_text(encoding='utf-8')
audit_anchor = """    report['deadwoodDelta'] = compare_state(base, images['authentic-v5-deadwood-fresh-artwork.png'], 'deadwoodDelta')
    report['combinedDelta'] = compare_state(base, images['photoreal-v6-combined-artwork.png'], 'combinedDelta')
"""
audit_insert = """    report['deadwoodDelta'] = compare_state(base, images['authentic-v5-deadwood-fresh-artwork.png'], 'deadwoodDelta')
    # A deadwood state must occupy an irregular photographed surface, not collapse
    # back into the thin vector line that failed the iPhone review.
    deadwood = report['deadwoodDelta']
    if deadwood['changedRatio'] < .0024 or deadwood['componentCount'] < 3 or int(deadwood['largestComponent']['width']) < 7 or int(deadwood['largestComponent']['height']) < 28:
        raise SystemExit(f"deadwoodDelta: stripped wood is too thin or too small {deadwood}")
    report['combinedDelta'] = compare_state(base, images['photoreal-v6-combined-artwork.png'], 'combinedDelta')
"""
if audit.count(audit_anchor) != 1:
    raise SystemExit('visual audit anchor changed')
audit = audit.replace(audit_anchor, audit_insert)
audit_path.write_text(audit, encoding='utf-8')

print('patched photographed jin/shari raster renderer')
