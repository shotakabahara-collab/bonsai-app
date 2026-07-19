#!/usr/bin/env python3
from pathlib import Path

path = Path(__file__).resolve().parents[1] / 'next' / 'tests' / 'smoke.mjs'
text = path.read_text(encoding='utf-8')
old = """  await page.getByRole('button', { name: /大会/ }).click();
  await page.waitForSelector('.show-card');
  await page.waitForFunction(() => window.scrollY <= 2, { timeout: 5000 });
"""
new = """  await page.getByRole('button', { name: /大会/ }).click();
  await page.waitForSelector('.show-card');
  await page.waitForFunction(() => !document.querySelector('.wire-status-tag'), { timeout: 5000 });
  await page.waitForFunction(() => {
    const button = [...document.querySelectorAll('button')].find(item => item.textContent?.includes('今週の展覧会へ出展'));
    return button instanceof HTMLButtonElement && !button.disabled;
  }, { timeout: 5000 });
  await page.waitForFunction(() => window.scrollY <= 2, { timeout: 5000 });
"""
if old not in text:
    raise SystemExit('show page wait marker not found')
path.write_text(text.replace(old, new, 1), encoding='utf-8')
print('show eligibility synchronization assertion patched')
