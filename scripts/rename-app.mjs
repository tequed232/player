/**
 * One-off rename helper: replace the old product name with 多分课表 across the
 * source files (app title, notifications, Android label, docs).
 *
 * Usage: node scripts/rename-app.mjs
 */
import { readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const REPLACEMENTS = [
  ['M3 Expressive · 语音图片笔记', '多分课表'],
  ['M3 Expressive 语音图片笔记', '多分课表'],
  ['四分课表', '多分课表'],
  ['四分 · M3 Expressive', '多分课表'],
  ['M3 Expressive Mobile App', '多分课表'],
  ['· 四分', '· 多分课表'],
  ['四分', '多分'], // 剩余的短名（例如开屏副标题）
];

const ROOTS = ['web/src', 'web/index.html', 'app/src', 'README.md', 'RELEASE_NOTES.md'];
const SKIP = [/node_modules/, /\.git\//, /data\/schedule\.(ts|json)$/, /icon-codepoints/];

async function* walk(target) {
  const stats = await readdir(target, { withFileTypes: true }).catch(() => null);
  if (!stats) {
    yield target;
    return;
  }
  for (const entry of stats) {
    const full = path.join(target, entry.name);
    if (SKIP.some((pattern) => pattern.test(full))) continue;
    if (entry.isDirectory()) yield* walk(full);
    else yield full;
  }
}

let changed = 0;
for (const root of ROOTS) {
  for await (const file of walk(root)) {
    if (!/\.(tsx?|jsx?|html|kt|xml|md|json)$/.test(file)) continue;
    const original = await readFile(file, 'utf8');
    let next = original;
    for (const [from, to] of REPLACEMENTS) next = next.split(from).join(to);
    if (next !== original) {
      await writeFile(file, next, 'utf8');
      changed += 1;
      console.log(`updated ${file}`);
    }
  }
}
console.log(`${changed} files updated`);
