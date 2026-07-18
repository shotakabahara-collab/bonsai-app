import { cp, mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';

const projectRoot = process.cwd();
const repositoryRoot = path.resolve(projectRoot, '..');
const dist = path.join(projectRoot, 'dist');
await mkdir(dist, { recursive: true });

const photoSource = path.join(repositoryRoot, 'photo-assets.js');
const photoTarget = path.join(dist, 'photo-assets.js');
if (existsSync(photoSource)) {
  await cp(photoSource, photoTarget);
} else {
  const fallback = `window.BonsaiPhotos={pine:${JSON.stringify(makeFallback())}};\n`;
  await writeFile(photoTarget, fallback, 'utf8');
}

const kuromatsu = path.join(repositoryRoot, 'assets', 'kuromatsu');
if (existsSync(kuromatsu)) {
  await mkdir(path.join(dist, 'assets'), { recursive: true });
  await cp(kuromatsu, path.join(dist, 'assets', 'kuromatsu'), { recursive: true, force: true });
}

const indexPath = path.join(dist, 'index.html');
const html = await readFile(indexPath, 'utf8');
if (!html.includes('BONSAI') || !html.includes('photo-assets.js')) throw new Error('Built shell is incomplete');
const info = await stat(photoTarget);
if (info.size < 100) throw new Error('photo-assets.js was not copied');
console.log(`BONSAI build ready: ${info.size} byte photo asset bridge`);

function makeFallback() {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 500"><defs><radialGradient id="b"><stop stop-color="#344b3a"/><stop offset="1" stop-color="#0d1710"/></radialGradient></defs><rect width="400" height="500" fill="url(#b)"/><path d="M205 390c-17-70 11-123-7-187-8-28 1-74 28-114" fill="none" stroke="#764c35" stroke-width="27" stroke-linecap="round"/><path d="M205 241c-48-10-84-31-119-62M213 202c55-13 92-32 118-57M204 297c-44 5-77 22-101 45" fill="none" stroke="#6c4935" stroke-width="16" stroke-linecap="round"/><g fill="#315c3d"><ellipse cx="91" cy="159" rx="69" ry="44"/><ellipse cx="160" cy="139" rx="75" ry="49"/><ellipse cx="299" cy="137" rx="82" ry="49"/><ellipse cx="111" cy="327" rx="73" ry="45"/><ellipse cx="270" cy="273" rx="92" ry="54"/><ellipse cx="211" cy="103" rx="67" ry="47"/></g><ellipse cx="200" cy="393" rx="109" ry="20" fill="#29402d"/><path d="M77 390h246l-27 76H104z" fill="#5b4035"/><rect x="64" y="376" width="272" height="31" rx="9" fill="#735144"/></svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}
