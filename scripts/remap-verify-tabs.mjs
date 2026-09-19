/**
 * One-off: the nav bar order changed to 课表(0) / 记录(1) / 历史(2) / 设置(3) and the
 * app now opens on 课表. Remap the tab indices used by the verification script.
 *
 * Usage: node scripts/remap-verify-tabs.mjs
 */
import { readFile, writeFile } from 'node:fs/promises';

const file = 'scripts/verify.mjs';
let source = await readFile(file, 'utf8');

// 旧索引 → 新索引：home 0→1，history 1→2，schedule 2→0，settings 3→3
const MAP = { 0: 1, 1: 2, 2: 0, 3: 3 };

source = source.replace(/(md-navigation-tab',\s*)(\d)/g, (_all, prefix, digit) => `${prefix}@@${MAP[digit]}@@`);
source = source.replace(/@@(\d)@@/g, (_all, digit) => digit);

await writeFile(file, source, 'utf8');

const hits = [...source.matchAll(/md-navigation-tab',\s*(\d)/g)].map((match) => match[1]);
console.log(`remapped ${hits.length} tab clicks -> [${hits.join(', ')}]`);
