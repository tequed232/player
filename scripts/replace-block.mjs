/**
 * Splice a generated block into web/src/components/schedule.tsx, replacing the old
 * FourDayBoard section.
 *
 * Usage: node scripts/replace-block.mjs <file> <startMarker> <endMarker> <replacementFile>
 */
import { readFile, writeFile } from 'node:fs/promises';

const [file, startMarker, endMarker, replacementFile] = process.argv.slice(2);
if (!file || !startMarker || !endMarker || !replacementFile) {
  console.error('usage: node scripts/replace-block.mjs <file> <startMarker> <endMarker> <replacementFile>');
  process.exit(2);
}

const source = await readFile(file, 'utf8');
const start = source.indexOf(startMarker);
const end = source.indexOf(endMarker);
if (start < 0 || end < 0 || end <= start) {
  console.error(`markers not found (start=${start}, end=${end})`);
  process.exit(1);
}

const replacement = await readFile(replacementFile, 'utf8');
const next = `${source.slice(0, start)}${replacement}\n${source.slice(end)}`;
await writeFile(file, next, 'utf8');
console.log(`replaced ${end - start} chars with ${replacement.length} chars (removed ${source.slice(start, end).split('\n').length} lines)`);
