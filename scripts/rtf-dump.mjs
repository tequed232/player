/**
 * Convert the RTF course-schedule document (学生课表.doc is RTF inside a .doc
 * container) into plain text so the table structure can be inspected.
 *
 * Usage: node scripts/rtf-dump.mjs <input.rtf> [output.txt]
 */
import { readFile, writeFile } from 'node:fs/promises';

const input = process.argv[2];
const output = process.argv[3];
if (!input) {
  console.error('usage: node scripts/rtf-dump.mjs <input.rtf> [output.txt]');
  process.exit(2);
}

const raw = await readFile(input, 'latin1');

/** Drop RTF destination groups that carry no document text. */
function stripDestinations(text) {
  const skip = ['fonttbl', 'colortbl', 'stylesheet', 'info', 'listtable', 'listoverridetable', 'generator', 'pict', 'footer', 'header'];
  let out = '';
  let i = 0;
  while (i < text.length) {
    const char = text[i];
    if (char === '{') {
      // look ahead for a destination we should skip entirely
      const match = /^\{\\(\*?)([a-z]+)/.exec(text.slice(i, i + 40));
      if (match && (match[1] === '*' || skip.includes(match[2]))) {
        let depth = 0;
        let j = i;
        while (j < text.length) {
          if (text[j] === '\\' && text[j + 1] === '{') j += 1;
          else if (text[j] === '{') depth += 1;
          else if (text[j] === '}') {
            depth -= 1;
            if (depth === 0) break;
          }
          j += 1;
        }
        i = j + 1;
        continue;
      }
      out += char;
      i += 1;
      continue;
    }
    out += char;
    i += 1;
  }
  return out;
}

function rtfToBytes(text) {
  /** The document text is stored as raw UTF-8 bytes; keep bytes intact. */
  const bytes = [];
  const pushChar = (char) => {
    const code = char.codePointAt(0);
    if (code <= 0x7f) {
      bytes.push(code);
      return;
    }
    if (code <= 0xff) {
      // a raw byte of a multi byte sequence
      bytes.push(code);
      return;
    }
    bytes.push(...Buffer.from(String.fromCodePoint(code), 'utf8'));
  };

  let i = 0;
  while (i < text.length) {
    const char = text[i];
    if (char === '{' || char === '}') {
      i += 1;
      continue;
    }
    if (char !== '\\') {
      pushChar(char);
      i += 1;
      continue;
    }

    const rest = text.slice(i);
    let match = /^\\u(-?\d+)\s?\??/.exec(rest);
    if (match) {
      const code = Number(match[1]);
      bytes.push(...Buffer.from(String.fromCharCode(code < 0 ? code + 65536 : code), 'utf8'));
      i += match[0].length;
      continue;
    }
    match = /^\\'([0-9a-fA-F]{2})/.exec(rest);
    if (match) {
      bytes.push(parseInt(match[1], 16));
      i += match[0].length;
      continue;
    }
    match = /^\\([a-zA-Z]+)(-?\d+)?\s?/.exec(rest);
    if (match) {
      const word = match[1];
      const put = (value) => bytes.push(...Buffer.from(value, 'utf8'));
      if (word === 'par' || word === 'line' || word === 'row') put('\n');
      else if (word === 'cell') put('\t');
      else if (word === 'tab') put('\t');
      else if (word === 'page') put('\n--- page ---\n');
      else if (word === 'emdash') put('—');
      else if (word === 'endash') put('–');
      i += match[0].length;
      continue;
    }
    i += 1;
  }
  return Buffer.from(bytes);
}

const stripped = stripDestinations(raw);
const text = rtfToBytes(stripped)
  .toString('utf8')
  .split('\n')
  .map((line) => line.replace(/[ \t]+$/g, '').replace(/^\s+/, ''))
  .filter((line, index, all) => !(line === '' && all[index - 1] === ''))
  .join('\n');

if (output) {
  await writeFile(output, text, 'utf8');
  console.log(`wrote ${output} (${text.length} chars)`);
} else {
  console.log(text);
}
