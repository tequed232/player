/**
 * Print a compact inventory of a wireframe definition JSON so a screen can be
 * implemented from it.
 *
 * Usage: node scripts/inspect-wireframe.mjs <wireframe.json> [--all | --id <groupId> | --keyword <text>]
 */
import { readFile } from 'node:fs/promises';

const file = process.argv[2];
const args = process.argv.slice(3);
const all = args.includes('--all');
const idIndex = args.indexOf('--id');
const onlyId = idIndex >= 0 ? args[idIndex + 1] : null;
const kwIndex = args.indexOf('--keyword');
const keyword = kwIndex >= 0 ? args[kwIndex + 1] : null;

const doc = JSON.parse(await readFile(file, 'utf8'));
const groups = doc.groups ?? doc.screens ?? [];

const brief = (value, max = 70) => {
  const text = typeof value === 'string' ? value : JSON.stringify(value ?? '');
  return text.length > max ? `${text.slice(0, max)}…` : text;
};

if (doc.brief) console.log(`brief: ${brief(doc.brief, 400)}`);
if (doc.title) console.log(`title: ${doc.title}`);
console.log(`groups: ${groups.length}\n`);

for (const group of groups) {
  const items = group.items ?? [];
  const haystack = JSON.stringify(group);
  if (!all && !onlyId && !keyword) continue;
  if (onlyId && group.id !== onlyId) continue;
  if (keyword && !haystack.includes(keyword)) continue;

  console.log(`=== group ${group.id} (x=${group.x} y=${group.y} axis=${group.axis}) ===`);
  for (const item of items) {
    const parts = [
      `kind=${item.kind}`,
      item.label ? `label="${brief(item.label, 40)}"` : null,
      item.icon ? `icon=${item.icon}` : null,
      item.icon2 ? `icon2=${item.icon2}` : null,
      item.variant ? `variant=${item.variant}` : null,
      item.size !== undefined ? `size=${item.size}` : null,
      item.size2 !== undefined ? `size2=${item.size2}` : null,
      item.selected !== undefined ? `selected=${item.selected}` : null,
      item.tabs ? `tabs=${item.tabs.map((tab) => tab.label).join('/')}` : null,
      item.items ? `items=${item.items.length}` : null,
      item.action ? `action=${brief(item.action, 60)}` : null,
    ].filter(Boolean);
    console.log(`  [${item.id}] ${parts.join(' | ')}`);
    if (item.note) console.log(`      note: ${item.note}`);
    for (const [key, action] of Object.entries(item.actions ?? {})) {
      console.log(`      ${key} -> ${brief(action, 80)}`);
    }
    if (item.items) {
      for (const child of item.items) {
        console.log(`      child: ${brief(child, 160)}`);
      }
    }
  }
  console.log('');
}
