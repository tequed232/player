/**
 * Guard: every icon name referenced in web/src must exist in the generated
 * Material Symbols subset (scripts/subset-icons.mjs), otherwise it would render
 * as literal ligature text.
 *
 * Usage: node scripts/check-icons.mjs
 */
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';

const SRC = path.resolve('web/src');
const MAP = path.join(SRC, 'theme', 'icon-codepoints.ts');

async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...(await walk(full)));
    else if (/\.(tsx?|jsx?)$/.test(entry.name)) files.push(full);
  }
  return files;
}

const map = await readFile(MAP, 'utf8');
const names = new Set();
for (const file of await walk(SRC)) {
  const text = await readFile(file, 'utf8');
  for (const match of text.matchAll(/\b(?:name|icon)\b\s*[=:]\s*([^,;}\n]+)/g)) {
    for (const literal of match[1].matchAll(/['"]([a-z0-9_]+)['"]/g)) names.add(literal[1]);
  }
}

const missing = [...names].filter((name) => !map.includes(`"${name}"`)).sort();
console.log(`icon names used: ${names.size}`);
if (missing.length) {
  console.error(`icons missing from the subset: ${missing.join(', ')}`);
  process.exitCode = 1;
} else {
  console.log('all icon names are present in the subset');
}
