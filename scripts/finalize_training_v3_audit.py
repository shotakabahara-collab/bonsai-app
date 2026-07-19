#!/usr/bin/env python3
from pathlib import Path

root = Path(__file__).resolve().parents[1]
path = root / 'next' / 'tests' / 'smoke.mjs'
text = path.read_text(encoding='utf-8')
marker = """  await page.screenshot({ path: 'test-artifacts/02b-wire-coils.png', fullPage: false });

  report.phase = 'show page';
"""
replacement = """  await page.screenshot({ path: 'test-artifacts/02b-wire-coils.png', fullPage: false });

  // The branch-aligned wire above is only a visual inspection step. A wired tree
  // is intentionally ineligible, so remove the second-branch wire before judging.
  await page.getByRole('button', { name: /育成/ }).click();
  await page.getByRole('button', { name: '部位針金' }).click();
  await page.getByRole('button', { name: '第二枝を選択' }).click();
  await page.getByRole('button', { name: /定着前に外す|適期に針金を外す|食い込み前にすぐ外す/ }).click();
  await page.waitForSelector('.wire-status-tag', { state: 'detached', timeout: 5000 });
  const afterSecondWireRemoval = await page.evaluate(() => JSON.parse(localStorage.getItem('bonsai:v2')));
  const preparedTree = afterSecondWireRemoval.bonsai.find(item => item.id === afterSecondWireRemoval.activeBonsaiId);
  const remainingWires = Object.entries(preparedTree.parts).filter(([, state]) => Boolean(state.wire));
  if (remainingWires.length) throw new Error(`wire remained before exhibition: ${JSON.stringify(remainingWires)}`);

  report.phase = 'show page';
"""
if marker not in text:
    raise SystemExit('second wire visual marker not found')
path.write_text(text.replace(marker, replacement, 1), encoding='utf-8')
print('final v3 exhibition preparation audit patched')
