#!/usr/bin/env python3
from pathlib import Path

path = Path(__file__).resolve().parents[1] / 'next' / 'tests' / 'smoke.mjs'
text = path.read_text(encoding='utf-8')
old = """  await page.getByRole('button', { name: /定着前に外す|適期に針金を外す|食い込み前にすぐ外す/ }).click();
  await page.waitForTimeout(250);
  const afterWireRemoval = await page.evaluate(() => JSON.parse(localStorage.getItem('bonsai:v2')));
"""
new = """  await page.getByRole('button', { name: /定着前に外す|適期に針金を外す|食い込み前にすぐ外す/ }).click();
  await page.waitForSelector('.wire-status-tag', { state: 'detached', timeout: 5000 });
  const afterWireRemoval = await page.evaluate(() => JSON.parse(localStorage.getItem('bonsai:v2')));
"""
if old not in text:
    raise SystemExit('wire removal wait marker not found')
path.write_text(text.replace(old, new, 1), encoding='utf-8')
print('wire removal UI synchronization assertion patched')
