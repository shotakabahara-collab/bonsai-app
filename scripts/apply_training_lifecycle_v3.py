#!/usr/bin/env python3
from __future__ import annotations

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "next" / "src"


def read(path: Path) -> str:
    return path.read_text(encoding="utf-8")


def write(path: Path, text: str) -> None:
    path.write_text(text, encoding="utf-8")


def replace_once(text: str, old: str, new: str, label: str) -> str:
    if old not in text:
        raise SystemExit(f"marker missing: {label}")
    return text.replace(old, new, 1)


def sub_once(text: str, pattern: str, repl: str, label: str, flags: int = re.S) -> str:
    next_text, count = re.subn(pattern, repl, text, count=1, flags=flags)
    if count != 1:
        raise SystemExit(f"regex marker missing or repeated: {label} ({count})")
    return next_text


def patch_model() -> None:
    path = SRC / "model.ts"
    text = read(path)
    if "./craft-v3" not in text:
        text = (
            "import {\n"
            "  advanceCraftLifecycle,\n"
            "  applyWireTraining,\n"
            "  craftSignature,\n"
            "  createCraftState,\n"
            "  exhibitionEligibility as craftExhibitionEligibility,\n"
            "  normalizeCraftState,\n"
            "  precisionStructureScore,\n"
            "  removeWireTraining,\n"
            "  startJinProjectInGame,\n"
            "  startShariProjectInGame\n"
            "} from './craft-v3';\n"
            "import type { CraftState, WireTrainingStatus } from './craft-v3';\n\n"
        ) + text

    text = sub_once(
        text,
        r"export interface WireState \{[\s\S]*?\n\}",
        """export interface WireState {
  intensity: 'light' | 'strong';
  direction: WireDirection;
  appliedAt: number;
  readyAt?: number;
  progress?: number;
  status?: WireTrainingStatus;
  lastRiskAt?: number;
}""",
        "WireState"
    )
    text = replace_once(
        text,
        "  wire?: WireState;\n  disease?: DiseaseId;",
        "  wire?: WireState;\n  trainedDirection?: WireDirection;\n  shapeRetention?: number;\n  wireRemovedAt?: number;\n  disease?: DiseaseId;",
        "PartState training fields"
    )
    text = replace_once(text, "  fertilizer: number;\n", "", "remove fertilizer interface")
    text = replace_once(
        text,
        "  parts: Record<PartId, PartState>;\n  shari?:",
        "  parts: Record<PartId, PartState>;\n  craft: CraftState;\n  shari?:",
        "craft interface"
    )
    text = replace_once(text, "    fertilizer: 0,\n", "", "remove create fertilizer")
    text = replace_once(
        text,
        "    parts: createParts(),\n    awards:",
        "    parts: createParts(),\n    craft: createCraftState(),\n    awards:",
        "create craft"
    )
    text = text.replace("    fertilizer: 0,\n", "")
    text = replace_once(
        text,
        "    parts: migrateParts(advanced.parts),\n    shari:",
        "    parts: migrateParts(advanced.parts),\n    craft: normalizeCraftState(advanced.craft, migrateParts(advanced.parts), advanced.shari),\n    shari:",
        "migrate craft"
    )
    text = replace_once(
        text,
        "    stress: clamp(finite(input?.stress, 2), 0, 1000),\n    fertilizer: 0,\n    potId:",
        "    stress: clamp(finite(input?.stress, 2), 0, 1000),\n    potId:",
        "normalize fertilizer"
    ) if "    fertilizer: 0,\n" in text else text
    text = replace_once(
        text,
        "    parts: migrateParts(input?.parts),\n    awards:",
        "    parts: migrateParts(input?.parts),\n    craft: normalizeCraftState(input?.craft, migrateParts(input?.parts), input?.shari),\n    awards:",
        "normalize craft"
    )

    text = sub_once(
        text,
        r"  const wire = livingParts\.filter\(part => bonsai\.parts\[part\.id\]\.wire\)\.length;\n  const artistry = clamp\([\s\S]*?\);\n  return \{ water:",
        """  const retainedShape = livingParts.map(part => bonsai.parts[part.id].shapeRetention ?? 0).reduce((sum, value) => sum + value, 0) / livingParts.length;
  const precision = precisionStructureScore(bonsai);
  const artistry = clamp(precision * .68 + pruning * 6 + retainedShape * .12 + Math.min(12, inGameAgeYears(bonsai) * 2));
  return { water:""",
        "metrics artistry"
    )
    text = replace_once(
        text,
        "  return `${bonsai.species}:${bonsai.potId}:${bonsai.water.toFixed(0)}:${bonsai.vitality.toFixed(0)}:${bonsai.shari?.side ?? '-'}:${bonsai.shari?.level ?? 0}|${parts}`;",
        "  return `${bonsai.species}:${bonsai.potId}:${bonsai.water.toFixed(0)}:${bonsai.vitality.toFixed(0)}:${bonsai.shari?.side ?? '-'}:${bonsai.shari?.level ?? 0}|${parts}|craft:${craftSignature(bonsai)}`;",
        "visual signature"
    )
    text = replace_once(
        text,
        "  const cleanliness = clamp(100 - diseaseCount * 24 - pestCount * 17 - rootRot * 20);\n\n  const structure = clamp(\n    92",
        "  const cleanliness = clamp(100 - diseaseCount * 24 - pestCount * 17 - rootRot * 20);\n  const precisionStructure = precisionStructureScore(bonsai);\n\n  const structure = clamp(\n    64 + precisionStructure * .31",
        "precision exhibition structure"
    )
    text = replace_once(
        text,
        "    bonsai.stress = Math.max(0, bonsai.stress - elapsedHours * .14);\n    bonsai.lastUpdatedAt = now;",
        "    bonsai.stress = Math.max(0, bonsai.stress - elapsedHours * .14);\n    advanceCraftLifecycle(bonsai, now);\n    bonsai.lastUpdatedAt = now;",
        "advance craft lifecycle"
    )

    text = sub_once(
        text,
        r"/\*\* @deprecated 施肥要素[\s\S]*?export function fertilizeBonsai\(game: GameState\): GameState \{[\s\S]*?\n\}\n\n",
        "",
        "remove fertilizer function"
    )
    text = sub_once(
        text,
        r"export function wirePart\(game: GameState, partId: PartId, intensity: 'light' \| 'strong', direction: WireDirection\): GameState \{[\s\S]*?\n\}\n\nexport function removeWire",
        """export function wirePart(game: GameState, partId: PartId, intensity: 'light' | 'strong', direction: WireDirection): GameState {
  return updateActiveBonsai(game, bonsai => applyWireTraining(bonsai, partId, intensity, direction));
}

export function removeWire""",
        "wire lifecycle apply"
    )
    text = sub_once(
        text,
        r"export function removeWire\(game: GameState, partId: PartId\): GameState \{[\s\S]*?\n\}\n\nfunction wireDirectionName",
        """export function removeWire(game: GameState, partId: PartId): GameState {
  return updateActiveBonsai(game, bonsai => removeWireTraining(bonsai, partId));
}

function wireDirectionName""",
        "wire lifecycle remove"
    )
    text = sub_once(
        text,
        r"export function createJin\(game: GameState, partId: PartId\): GameState \{[\s\S]*?\n\}\n\nexport function createShari\(game: GameState, side: 'left' \| 'right'\): GameState \{[\s\S]*?\n\}",
        """export function createJin(game: GameState, partId: PartId): GameState {
  return startJinProjectInGame(game, partId);
}

export function createShari(game: GameState, side: 'left' | 'right'): GameState {
  return startShariProjectInGame(game, side);
}""",
        "deadwood lifecycle wrappers"
    )
    text = replace_once(
        text,
        "  if (!bonsai) return { game: copy, notes: ['出展できる盆栽がありません。'] };\n  const evaluation = exhibitionScore(bonsai);",
        "  if (!bonsai) return { game: copy, notes: ['出展できる盆栽がありません。'] };\n  const eligibility = craftExhibitionEligibility(bonsai);\n  if (!eligibility.eligible) return { game: copy, notes: eligibility.reasons };\n  const evaluation = exhibitionScore(bonsai);",
        "show eligibility"
    )
    write(path, text)


def patch_app() -> None:
    path = SRC / "App.tsx"
    text = read(path)
    if "./CraftPanels" not in text:
        text = replace_once(
            text,
            "import { BonsaiStage } from './BonsaiStage';\n",
            "import { BonsaiStage } from './BonsaiStage';\nimport { DeadwoodLifecycleSheet, PrecisionPruningSheet, WireLifecycleStatus } from './CraftPanels';\nimport {\n  advanceDeadwoodProjectInGame,\n  applyPrecisionPruningToGame,\n  exhibitionEligibility,\n  startJinProjectInGame,\n  startShariProjectInGame\n} from './craft-v3';\n",
            "App craft imports"
        )
    text = text.replace("  createJin,\n", "").replace("  createShari,\n", "")

    care_pattern = r"\n      \{careMode && \(\n        <CareSheet[\s\S]*?\n      \)\}\n\n      \{wallMode"
    care_replacement = """
      {careMode === 'prune' && (
        <PrecisionPruningSheet
          bonsai={bonsai}
          onClose={() => setCareMode(null)}
          onApply={(siteId, technique) => {
            commit(current => applyPrecisionPruningToGame(current, siteId, technique), '精密剪定を不可逆で確定しました');
            setCareMode(null);
          }}
        />
      )}

      {careMode === 'deadwood' && (
        <DeadwoodLifecycleSheet
          bonsai={bonsai}
          onClose={() => setCareMode(null)}
          onStartJin={partId => {
            commit(current => startJinProjectInGame(current, partId), '神の工程を開始しました');
            setCareMode(null);
          }}
          onStartShari={side => {
            if (!window.confirm('生き筋を残して細い舎利の工程を始めます。加工は元に戻せません。')) return;
            commit(current => startShariProjectInGame(current, side), '舎利の工程を開始しました');
            setCareMode(null);
          }}
          onAdvance={projectId => commit(current => advanceDeadwoodProjectInGame(current, projectId), '神・舎利を次の工程へ進めました')}
        />
      )}

      {careMode && careMode !== 'prune' && careMode !== 'deadwood' && (
        <CareSheet
          mode={careMode}
          bonsai={bonsai}
          selectedPart={selectedPart}
          onSelectPart={setSelectedPart}
          onClose={() => setCareMode(null)}
          onPrune={() => undefined}
          onWire={(intensity, direction) => {
            commit(current => wirePart(current, selectedPart, intensity, direction), '部位と方向を指定して針金養成を始めました');
            setCareMode(null);
          }}
          onRemoveWire={() => {
            commit(current => removeWire(current, selectedPart), '針金を外し、枝姿の定着結果を記録しました');
            setCareMode(null);
          }}
          onTreat={() => {
            if (!activePart?.disease && !activePart?.pest) return;
            commit(current => treatPart(current, selectedPart), '病害虫へ対処しました');
            setCareMode(null);
          }}
          onJin={() => undefined}
          onShari={() => undefined}
        />
      )}

      {wallMode"""
    text = sub_once(text, care_pattern, care_replacement, "App care panels")

    text = replace_once(
        text,
        "  const evaluation = exhibitionScore(bonsai);\n  const latest = bonsai.awards[0];",
        "  const evaluation = exhibitionScore(bonsai);\n  const eligibility = exhibitionEligibility(bonsai);\n  const latest = bonsai.awards[0];",
        "Show eligibility const"
    )
    text = replace_once(
        text,
        "        <ul className=\"judge-notes\">{evaluation.notes.map(note => <li key={note}>{note}</li>)}</ul>\n        <button className=\"primary-button\" type=\"button\" onClick={onEnter}>今週の展覧会へ出展</button>",
        "        <ul className=\"judge-notes\">{evaluation.notes.map(note => <li key={note}>{note}</li>)}</ul>\n        {!eligibility.eligible && <div className=\"show-eligibility-blocker\"><b>現在は出展できません</b>{eligibility.reasons.map(reason => <span key={reason}>{reason}</span>)}</div>}\n        <button className=\"primary-button\" type=\"button\" disabled={!eligibility.eligible} onClick={onEnter}>今週の展覧会へ出展</button>",
        "Show blocker"
    )
    text = text.replace(
        "disabled={['trunk','roots'].includes(selectedPart)} onClick={() => onWire(wireIntensity, direction)}",
        "disabled={['trunk','roots'].includes(selectedPart) || Boolean(part.wire)} onClick={() => onWire(wireIntensity, direction)}"
    )
    text = replace_once(
        text,
        "{part.wire && <button className=\"ghost-button\" type=\"button\" onClick={onRemoveWire}>現在の針金を外す</button>}",
        "{part.wire && <WireLifecycleStatus wire={part.wire} species={bonsai.species} />}{part.wire && <button className=\"ghost-button\" type=\"button\" onClick={onRemoveWire}>{part.wire.status === 'ready' ? '適期に針金を外す' : part.wire.status === 'overdue' ? '食い込み前にすぐ外す' : '定着前に外す'}</button>}",
        "Wire lifecycle UI"
    )
    write(path, text)


def patch_stage() -> None:
    path = SRC / "BonsaiStage.tsx"
    text = read(path)
    if "precisionVisualSites" not in text:
        text = replace_once(
            text,
            "} from './model';\n",
            "} from './model';\nimport { activeDeadwoodProjects, deadwoodStageLabel, precisionVisualSites } from './craft-v3';\n",
            "Stage craft imports"
        )
    if "JIN_PATHS" not in text:
        marker = "const FALLBACK: Record<SpeciesId, string> = {"
        addition = """const JIN_PATHS: Partial<Record<PartId, string>> = {
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

"""
        text = replace_once(text, marker, addition + marker, "Stage paths")

    text = replace_once(
        text,
        "  const wiredCount = livingParts.filter(part => bonsai.parts[part.id]?.wire).length;",
        "  const wiredCount = livingParts.filter(part => bonsai.parts[part.id]?.wire).length;\n  const precisionSites = precisionVisualSites(bonsai);\n  const deadwoodProjects = bonsai.craft.deadwoodProjects;\n  const unfinishedDeadwood = activeDeadwoodProjects(bonsai);",
        "Stage state"
    )
    text = text.replace("            {part.deadwood && <span className=\"deadwood-mark\" />}\n", "")

    insertion = """
      <svg className="precision-prune-svg" viewBox="0 0 900 1500" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
        {precisionSites.map(site => (
          <g key={site.id}>
            <ellipse className="precision-prune-veil" cx={site.x * 9} cy={site.y * 15} rx={site.role === 'foliagePad' ? 62 : 45} ry={site.role === 'foliagePad' ? 42 : 30} opacity={site.opacity} />
            {site.removed && <circle className="precision-cut-scar" cx={site.x * 9} cy={site.y * 15} r="7" />}
          </g>
        ))}
      </svg>

"""
    text = replace_once(
        text,
        "      <svg\n        className={`wire-layer wire-layer-coils",
        insertion + "      <svg\n        className={`wire-layer wire-layer-coils",
        "precision svg"
    )

    deadwood_render = """
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
"""
    text = replace_once(
        text,
        "        {livingParts.map(({ id }) => {",
        deadwood_render + "        {livingParts.map(({ id }) => {",
        "deadwood render"
    )
    text = replace_once(
        text,
        "        {bonsai.shari && (",
        "        {bonsai.shari && !deadwoodProjects.some(project => project.kind === 'shari') && (",
        "legacy shari fallback"
    )
    text = replace_once(
        text,
        "      {!interactive && wiredCount > 0 && <span className=\"wire-status-tag\">整姿中 {wiredCount}枝</span>}",
        "      {!interactive && wiredCount > 0 && <span className=\"wire-status-tag\">整姿中 {wiredCount}枝</span>}\n      {!interactive && unfinishedDeadwood.length > 0 && <span className=\"deadwood-status-tag\">古木技法：{deadwoodStageLabel(unfinishedDeadwood[0].stage)}</span>}",
        "deadwood tag"
    )
    write(path, text)


def patch_storage() -> None:
    path = SRC / "storage.ts"
    text = read(path)
    text = text.replace("    fert: 0,\n", "")
    text = replace_once(
        text,
        "      shari: bonsai.shari\n    }",
        "      shari: bonsai.shari,\n      craft: bonsai.craft\n    }",
        "legacy craft mirror"
    )
    write(path, text)


def patch_main_and_worker() -> None:
    main = SRC / "main.tsx"
    text = read(main)
    if "./craft-v3.css" not in text:
        text = replace_once(text, "import './quality-v2.css';\n", "import './quality-v2.css';\nimport './craft-v3.css';\n", "craft css import")
    text = re.sub(r"BonsaiRelease = '[^']+'", "BonsaiRelease = 'bonsai-craft-v3-20260719'", text)
    write(main, text)

    sw = ROOT / "next" / "public" / "sw.js"
    text = read(sw)
    text = re.sub(r"const VERSION = '[^']+';", "const VERSION = 'bonsai-craft-v3';", text, count=1)
    write(sw, text)


def patch_tests() -> None:
    path = ROOT / "next" / "tests" / "smoke.mjs"
    text = read(path)
    text = replace_once(
        text,
        "  const bodyBackground = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);\n  if (/255, 255, 255/.test(bodyBackground)) throw new Error(`White screen background: ${bodyBackground}`);",
        "  const bodyBackground = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);\n  if (/255, 255, 255/.test(bodyBackground)) throw new Error(`White screen background: ${bodyBackground}`);\n  if (await page.getByRole('button', { name: '施肥' }).count()) throw new Error('fertilizer action remains');\n  if ('fertilizer' in migrated.bonsai[0]) throw new Error('fertilizer state remains');\n  if (!migrated.bonsai[0].craft || Object.keys(migrated.bonsai[0].craft.sites).length !== 26) throw new Error('26-site craft model was not migrated');",
        "test fertilizer and craft"
    )
    text = sub_once(
        text,
        r"  report.phase = 'care actions';\n  await page.getByRole\('button', \{ name: '水やり' \}\)\.click\(\);\n  await page.getByRole\('button', \{ name: '部位剪定' \}\)\.click\(\);\n  await page.getByRole\('button', \{ name: '第一枝を選択' \}\)\.click\(\);\n  page.once\('dialog', dialog => dialog.accept\(\)\);\n  await page.getByRole\('button', \{ name: /中剪定/ \}\)\.click\(\);\n  await page.waitForTimeout\(300\);",
        """  report.phase = 'care actions';
  await page.getByRole('button', { name: '水やり' }).click();
  await page.getByRole('button', { name: '部位剪定' }).click();
  await page.waitForSelector('.precision-pruning-sheet[data-total-sites="26"]');
  await page.locator('.precision-group-tabs button').filter({ hasText: '第一枝' }).click();
  await page.locator('.precision-site-grid button').filter({ hasText: '第一枝・先端' }).click();
  await page.getByRole('button', { name: /古葉取り・葉透かし/ }).click();
  page.once('dialog', dialog => dialog.accept());
  await page.getByRole('button', { name: 'この箇所へ確定する' }).click();
  await page.waitForTimeout(300);""",
        "precision prune test"
    )
    text = replace_once(
        text,
        "  report.afterPrune = active.parts.firstLeft;\n  if (active.parts.firstLeft.pruneLevel < 2 || active.parts.firstLeft.foliage >= 72) {\n    throw new Error(`Pruning was not persisted: ${JSON.stringify(active.parts.firstLeft)}`);\n  }",
        "  report.afterPrune = { part: active.parts.firstLeft, site: active.craft.sites.firstTip };\n  if (active.craft.sites.firstTip.foliage >= 72 || active.craft.sites.firstTip.lastTechnique !== 'needleThin') {\n    throw new Error(`Precision pruning was not persisted: ${JSON.stringify(active.craft.sites.firstTip)}`);\n  }\n\n  await page.getByRole('button', { name: '部位針金' }).click();\n  await page.getByRole('button', { name: '第一枝を選択' }).click();\n  await page.getByRole('button', { name: 'この部位へかける' }).click();\n  await page.waitForTimeout(250);\n  await page.getByRole('button', { name: /大会/ }).click();\n  await page.waitForSelector('.show-eligibility-blocker');\n  if (!(await page.getByRole('button', { name: '今週の展覧会へ出展' }).isDisabled())) throw new Error('wired bonsai can enter exhibition');\n  await page.getByRole('button', { name: /育成/ }).click();\n  await page.getByRole('button', { name: '部位針金' }).click();\n  await page.getByRole('button', { name: '第一枝を選択' }).click();\n  await page.getByRole('button', { name: /定着前に外す|適期に針金を外す|食い込み前にすぐ外す/ }).click();\n  await page.waitForTimeout(250);\n  const afterWireRemoval = await page.evaluate(() => JSON.parse(localStorage.getItem('bonsai:v2')));\n  const wiredTree = afterWireRemoval.bonsai.find(item => item.id === afterWireRemoval.activeBonsaiId);\n  if (wiredTree.parts.firstLeft.wire || !wiredTree.parts.firstLeft.shapeRetention) throw new Error('wire lifecycle removal was not persisted');",
        "precision and wire assertions"
    )
    text = text.replace("await page.getByRole('button', { name: /売却して山もみじへ買替/ }).click();", "await page.getByRole('button', { name: /売却して山もみじへ買替/ }).first().click();")
    write(path, text)


def main() -> None:
    patch_model()
    patch_app()
    patch_stage()
    patch_storage()
    patch_main_and_worker()
    patch_tests()
    print("training lifecycle v3 applied")


if __name__ == "__main__":
    main()
