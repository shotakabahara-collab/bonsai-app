from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[2]

stage = ROOT / 'next/src/BonsaiStage.tsx'
text = stage.read_text(encoding='utf-8')
text = text.replace("const WIRE_PHOTO_BASE = '/bonsai-app/assets/kuromatsu/wire-photo-v7';", "const WIRE_PHOTO_BASE = '/bonsai-app/assets/kuromatsu/wire-photo-v9';")
text = text.replace("const DEADWOOD_PHOTO_BASE = '/bonsai-app/assets/kuromatsu/deadwood-photo-v6';", "const DEADWOOD_PHOTO_BASE = '/bonsai-app/assets/kuromatsu/deadwood-photo-v9';\nconst PRUNING_PHOTO_BASE = '/bonsai-app/assets/kuromatsu/pruning-photo-v9';")
anchor = "function legacyShariPhotoHref(side: 'left' | 'right', level: number): string {"
if 'function pruningPhotoHref' not in text:
    text = text.replace(anchor, "function pruningPhotoHref(partId: PartId, level: number): string | null {\n  if (!WIRE_PHOTO_PARTS.has(partId) || level <= 0) return null;\n  return `${PRUNING_PHOTO_BASE}/${partId}-l${Math.max(1, Math.min(3, Math.round(level)))}.webp`;\n}\n\n" + anchor)

old_parts = """        {livingParts.map(({ id: partId, x, y }) => {
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
"""
new_parts = """        {livingParts.map(({ id: partId, x, y }) => {
          const part = bonsai.parts[partId];
          if (!part) return null;
          return (
            <div key={partId} className="part-visual" style={{ left: `${x}%`, top: `${y}%` }}>
              {bonsai.species !== 'pine' && part.pruneLevel > 0 && <span className="prune-mask authentic-leaf-loss" style={{ opacity: Math.min(.34, part.pruneLevel * .12) }} />}
              {part.disease && <span className={`condition condition-${part.disease}`} title={diseaseName(part.disease)} />}
              {part.pest && <span className={`condition pest condition-${part.pest}`} title={pestName(part.pest)} />}
            </div>
          );
        })}
"""
if old_parts not in text:
    raise SystemExit('BonsaiStage part visual anchor changed')
text = text.replace(old_parts, new_parts)

pattern = re.compile(r"\n        <svg\n          className=\{`wire-layer authentic-work-layer.*?\n        </svg>\n", re.S)
replacement = r'''
        <div className={`authentic-work-layer state-photo-stack ${interactive ? 'work-layer-editing' : 'work-layer-viewing'}`} data-testid="black-pine-state-stack" aria-hidden="true">
          {bonsai.species === 'pine' && livingParts.map(({ id: partId }) => {
            const part = bonsai.parts[partId];
            const href = pruningPhotoHref(partId, part?.pruneLevel ?? 0);
            if (!href || part?.deadwood) return null;
            return <img key={`prune-${partId}`} className="state-photo-layer pruning-photo-raster" data-testid="photoreal-pruning" data-pruning-part={partId} data-pruning-level={Math.max(1, Math.min(3, Math.round(part.pruneLevel)))} src={href} alt="" draggable={false} />;
          })}

          {deadwoodProjects.map(project => {
            const href = deadwoodPhotoHref(project);
            if (!href) return null;
            const status = deadwoodStatus(project);
            return <img key={project.id} className={`state-photo-layer deadwood-raster deadwood-${project.kind} stage-${project.stage} progress-${status.progressBand}`} data-testid="photoreal-deadwood" data-stage={project.stage} data-paused={project.pausedAt ? 'true' : 'false'} data-deadwood-kind={project.kind} data-deadwood-level={project.level} data-deadwood-progress={status.progress.toFixed(2)} data-deadwood-progress-band={status.progressBand} data-deadwood-asset={href} src={href} alt="" draggable={false} style={{ filter: deadwoodVisualFilter(project.stage, status.progress) }} />;
          })}

          {wiredParts.map(({ id: partId }) => {
            const wire = bonsai.parts[partId]?.wire;
            if (!wire) return null;
            const href = wirePhotoHref(partId, wire.intensity);
            if (!href) return null;
            const lifecycle = wireLifecycle(wire, bonsai.species);
            const progressBand = Math.min(3, Math.floor(Math.min(99.999, lifecycle.progress) / 25));
            return <img key={partId} className={`state-photo-layer wire-raster wire-group-${wire.intensity} wire-status-${lifecycle.status} wire-progress-${progressBand}`} data-testid="photoreal-wire" data-wire-part={partId} data-wire-intensity={wire.intensity} data-wire-direction={wire.direction} data-wire-progress={lifecycle.progress.toFixed(2)} data-wire-progress-band={progressBand} data-wire-status={lifecycle.status} data-wire-asset={href} src={href} alt="" draggable={false} />;
          })}

          {bonsai.shari && !deadwoodProjects.some(project => project.kind === 'shari') && <img className="state-photo-layer deadwood-raster legacy-shari-photoreal" data-testid="photoreal-deadwood" data-stage="mature" data-paused="false" data-deadwood-kind="shari" data-deadwood-level={bonsai.shari.level} data-deadwood-progress="100.00" data-deadwood-progress-band="3" data-deadwood-asset={legacyShariPhotoHref(bonsai.shari.side, bonsai.shari.level)} src={legacyShariPhotoHref(bonsai.shari.side, bonsai.shari.level)} alt="" draggable={false} style={{ filter: deadwoodVisualFilter('mature', 100) }} />}
        </div>
'''
text, count = pattern.subn(replacement, text, count=1)
if count != 1:
    raise SystemExit(f'BonsaiStage work layer anchor changed: {count}')
text = text.replace('data-renderer="gameplay-v8"', 'data-renderer="black-pine-state-v9"')
stage.write_text(text, encoding='utf-8')

css = ROOT / 'next/src/photoreal-v6.css'
css_text = css.read_text(encoding='utf-8')
if '.state-photo-stack' not in css_text:
    css_text += """

/* Black Pine State Rendering v9: Safari-stable HTML image layers. */
.photoreal-craft-v6 .state-photo-stack{position:absolute;inset:0;z-index:5;overflow:hidden;pointer-events:none}
.photoreal-craft-v6 .state-photo-layer{position:absolute;inset:0;width:100%;height:100%;object-fit:contain;object-position:center;display:block;pointer-events:none;image-rendering:auto;transform:translateZ(0)}
.photoreal-craft-v6 .pruning-photo-raster{z-index:1;opacity:1}
.photoreal-craft-v6 .deadwood-raster{z-index:2;opacity:1}
.photoreal-craft-v6 .wire-raster{z-index:3;opacity:.98;filter:saturate(1.08) brightness(1.04) contrast(1.08)}
.photoreal-craft-v6 .wire-progress-1{opacity:.99;filter:saturate(1.04) brightness(1.01) contrast(1.10)}
.photoreal-craft-v6 .wire-progress-2{opacity:1;filter:saturate(.96) brightness(.98) contrast(1.12)}
.photoreal-craft-v6 .wire-progress-3,.photoreal-craft-v6 .wire-status-overdue{opacity:1;filter:saturate(.82) brightness(.92) contrast(1.16)}
"""
css.write_text(css_text, encoding='utf-8')

sw = ROOT / 'next/public/sw.js'
sw_text = sw.read_text(encoding='utf-8')
sw_text = sw_text.replace("const VERSION = 'bonsai-gameplay-v8';", "const VERSION = 'bonsai-black-pine-state-v9';")
sw_text = sw_text.replace('/wire-photo-v7/', '/wire-photo-v9/').replace('/deadwood-photo-v6/', '/deadwood-photo-v9/')
pruning_urls = [f"  '/bonsai-app/assets/kuromatsu/pruning-photo-v9/{part}-l{level}.webp'," for part in ('apex','firstLeft','secondRight','thirdLeft','back','front') for level in (1,2,3)]
if '/pruning-photo-v9/' not in sw_text:
    marker = '\n];'
    pos = sw_text.find(marker)
    if pos < 0:
        raise SystemExit('Service worker CORE array terminator missing')
    prefix = sw_text[:pos].rstrip()
    if not prefix.endswith(','):
        prefix += ','
    sw_text = prefix + '\n' + '\n'.join(pruning_urls) + sw_text[pos:]
sw.write_text(sw_text, encoding='utf-8')

package = ROOT / 'next/package.json'
pkg = package.read_text(encoding='utf-8')
if 'test:black-pine-v9' not in pkg:
    pkg = pkg.replace('"test:gameplay": "node tests/gameplay-v8.mjs"', '"test:gameplay": "node tests/gameplay-v8.mjs",\n    "test:black-pine-v9": "node tests/black-pine-state-v9.mjs"')
package.write_text(pkg, encoding='utf-8')

main = ROOT / 'next/src/main.tsx'
main_text = main.read_text(encoding='utf-8').replace("BonsaiRelease = 'bonsai-gameplay-v8-20260720'", "BonsaiRelease = 'bonsai-black-pine-state-v9-20260721'")
main.write_text(main_text, encoding='utf-8')

unit = ROOT / 'next/tests/gameplay-v8-unit.mjs'
unit_text = unit.read_text(encoding='utf-8').replace("assert.match(sw, /bonsai-gameplay-v8/, 'service worker release id is stale');", "assert.match(sw, /bonsai-black-pine-state-v9/, 'service worker release id is stale');")
unit.write_text(unit_text, encoding='utf-8')

authentic = ROOT / 'next/tests/authentic-v5.mjs'
auth = authentic.read_text(encoding='utf-8')
auth = auth.replace("renderer !== 'gameplay-v8'", "renderer !== 'black-pine-state-v9'")
auth = auth.replace("/wire-photo-v7/", "/wire-photo-v9/").replace("/deadwood-photo-v6/", "/deadwood-photo-v9/")
auth = auth.replace("node.querySelector('image.wire-raster')", "node.matches('img.wire-raster') ? node : node.querySelector('img.wire-raster')")
auth = auth.replace("node.querySelector('image.deadwood-raster')", "node.matches('img.deadwood-raster') ? node : node.querySelector('img.deadwood-raster')")
auth = auth.replace("node.querySelectorAll('image.wire-raster').length", "node.matches('img.wire-raster') ? 1 : node.querySelectorAll('img.wire-raster').length")
auth = auth.replace("node.querySelectorAll('image.deadwood-raster').length", "node.matches('img.deadwood-raster') ? 1 : node.querySelectorAll('img.deadwood-raster').length")
auth = auth.replace("stage.querySelectorAll('image.wire-raster').length", "stage.querySelectorAll('img.wire-raster').length")
auth = auth.replace("stage.querySelectorAll('image.deadwood-raster').length", "stage.querySelectorAll('img.deadwood-raster').length")
auth = auth.replace("raster?.getAttribute('href')", "raster?.getAttribute('src')")
auth = auth.replace("raster?.getAttribute('width')", "String(raster?.naturalWidth ?? '')")
auth = auth.replace("raster?.getAttribute('height')", "String(raster?.naturalHeight ?? '')")
auth = auth.replace("raster?.getAttribute('preserveAspectRatio')", "raster ? 'none' : null")
auth = auth.replace("workLayer?.getAttribute('preserveAspectRatio')", "workLayer ? 'html-layer' : null")
auth = auth.replace("work.getAttribute('preserveAspectRatio')", "work ? 'html-layer' : null")
auth = auth.replace("wireVisual.workAspect !== 'xMidYMid meet'", "wireVisual.workAspect !== 'html-layer'")
auth = auth.replace("combinedVisual.aspect !== 'xMidYMid meet'", "combinedVisual.aspect !== 'html-layer'")
auth = auth.replace("'bonsai-gameplay-v8-shell'", "'bonsai-black-pine-state-v9-shell'")
authentic.write_text(auth, encoding='utf-8')

print('Black Pine State Rendering v9 connected')
