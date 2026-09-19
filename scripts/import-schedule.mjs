/**
 * Parse the RTF course-schedule document (学生课表.doc is RTF inside a .doc
 * container) and generate web/src/data/schedule.ts so the app embeds the schedule
 * itself - no manual import needed at runtime.
 *
 * Usage: node scripts/import-schedule.mjs <input.doc> [--out web/src/data/schedule.ts]
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const input = process.argv[2];
const outIndex = process.argv.indexOf('--out');
const output = outIndex >= 0 ? process.argv[outIndex + 1] : 'web/src/data/schedule.ts';
if (!input) {
  console.error('usage: node scripts/import-schedule.mjs <input.doc> [--out file.ts]');
  process.exit(2);
}

const US = '\u001f';
const RS = '\u001e';

/* ------------------------------------------------------------------ RTF --- */

function stripDestinations(text) {
  const skip = ['fonttbl', 'colortbl', 'stylesheet', 'info', 'listtable', 'listoverridetable', 'generator', 'pict', 'header', 'footer'];
  let out = '';
  let i = 0;
  while (i < text.length) {
    if (text[i] === '{') {
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
    }
    out += text[i];
    i += 1;
  }
  return out;
}

function rtfToMarkedText(text) {
  const bytes = [];
  const pushRaw = (char) => {
    const code = char.codePointAt(0);
    if (code <= 0xff) bytes.push(code);
    else bytes.push(...Buffer.from(String.fromCodePoint(code), 'utf8'));
  };
  const pushText = (value) => bytes.push(...Buffer.from(value, 'utf8'));

  let i = 0;
  while (i < text.length) {
    const char = text[i];
    if (char === '{' || char === '}') {
      i += 1;
      continue;
    }
    if (char !== '\\') {
      pushRaw(char);
      i += 1;
      continue;
    }
    const rest = text.slice(i);
    let match = /^\\u(-?\d+)\s?\??/.exec(rest);
    if (match) {
      const code = Number(match[1]);
      pushText(String.fromCharCode(code < 0 ? code + 65536 : code));
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
      if (word === 'cell') pushText(US);
      else if (word === 'row' || word === 'nestrow') pushText(RS);
      else if (word === 'par' || word === 'line') pushText('\n');
      else if (word === 'tab') pushText('\t');
      else if (word === 'emdash') pushText('—');
      else if (word === 'endash') pushText('–');
      i += match[0].length;
      continue;
    }
    i += 1;
  }
  return Buffer.from(bytes).toString('utf8');
}

/* ---------------------------------------------------------------- parse --- */

function cleanCell(text) {
  return text
    .split('\n')
    .map((line) => line.replace(/[\u0000-\u0008\u000b-\u001d]/g, '').trim())
    .filter((line) => line && !/^-{3,}$/.test(line))
    .join('\n')
    .trim();
}

/** Split a cell (possibly holding odd/even week variants) into courses. */
function parseCourses(cell) {
  if (!cell) return [];
  const lines = cell.split('\n').map((line) => line.trim()).filter(Boolean);
  const courses = [];
  for (const line of lines) {
    const isDetail =
      /^\[.*\]$/.test(line) ||
      /周\[/.test(line) ||
      /班$|班\[/.test(line) ||
      /^\d+-\d+/.test(line) ||
      /[馆室楼]|校区|\[\d+人\]/.test(line);
    if (!isDetail || !courses.length) courses.push({ name: line, details: [] });
    else courses[courses.length - 1].details.push(line);
  }
  return courses.map((course) => {
    const weeks = course.details.find((line) => /周\[/.test(line)) ?? '';
    const teacher = course.details.find((line) => /^\[.*\]$/.test(line)) ?? '';
    const rest = course.details.filter((line) => line !== weeks && line !== teacher);
    const roomIndex = rest.findIndex((line) => /\d+-\d+|馆|室|校区|楼/.test(line));
    const room = roomIndex >= 0 ? rest[roomIndex] : '';
    const className = rest.find((line, index) => index !== roomIndex) ?? '';
    return {
      name: course.name,
      weeks: weeks.replace(/\[.*\]/, '').replace(/周$/, '').trim(),
      teacher: teacher.replace(/^\[|\]$/g, '').trim(),
      className: className.trim(),
      room: room.replace(/\[\d+人\]/g, '').trim(),
      raw: course.details.join(' / '),
    };
  });
}

/** 早 / 中 / 晚 segmentation used by the schedule screen's time axis. */
function sectionOf(period) {
  if (/中午/.test(period)) return 'noon';
  const match = /第(\d+)/.exec(period);
  const index = match ? Number(match[1]) : 0;
  if (index <= 4) return 'morning';
  if (index <= 8) return 'afternoon';
  return 'evening';
}

const raw = await readFile(input, 'latin1');
const marked = rtfToMarkedText(stripDestinations(raw));
const rows = marked
  .split(RS)
  .map((row) => row.split(US).map(cleanCell))
  .filter((cells) => cells.some(Boolean));

const header = rows.find((cells) => (cells[0] ?? '').includes('星期'));
const days = header ? header.slice(1).filter(Boolean) : ['星期一', '星期二', '星期三', '星期四', '星期五', '星期六', '星期日'];

const periods = [];
for (const cells of rows) {
  const first = (cells[0] ?? '').replace(/\n/g, ' ').trim();
  if (!/^第.*节/.test(first)) continue;
  const match = /^(第[^\s]*节)\s*(.*)$/.exec(first);
  const period = match?.[1] ?? first;
  const time = (match?.[2] ?? '').trim();
  periods.push({
    period,
    time,
    section: sectionOf(period),
    days: days.map((_, index) => parseCourses(cells[index + 1] ?? '')),
  });
}

// 不解析、不保存个人信息：文档里的姓名一律不落地，署名统一用班级版权行
const ATTRIBUTION = '广东财贸信创3班版权所有';
const owner = ATTRIBUTION;
const term = /(\d{4}-\d{4}-\d)/.exec(marked)?.[1] ?? '';

/* term start: the Monday on or before the first day of the term's first month */
const startYear = Number(term.slice(0, 4)) || new Date().getFullYear();
function mondayOnOrBefore(date) {
  const result = new Date(date);
  const day = result.getDay();
  const delta = day === 0 ? -6 : 1 - day;
  result.setDate(result.getDate() + delta);
  return result;
}
const termStart = mondayOnOrBefore(new Date(Date.UTC(startYear, 8, 1))).toISOString().slice(0, 10);

const schedule = { owner, term, termStart, days, periods };

/* ----------------------------------------------------------------- emit --- */

const ts = `/* AUTO-GENERATED by scripts/import-schedule.mjs - do not edit by hand.
   Source: 学生课表.doc (RTF table exported by the school system)
   ${owner} · ${term} · ${periods.length} 节次 × ${days.length} 天 */

import type { ScheduleData } from '../lib/schedule';

export const EMBEDDED_SCHEDULE: ScheduleData = ${JSON.stringify(schedule, null, 2)};
`;

await mkdir(path.dirname(path.resolve(output)), { recursive: true });
await writeFile(output, ts, 'utf8');

/* ------------------------------------------------------- Android (Kotlin) --- */

const kotlinOutput = process.argv.includes('--kotlin')
  ? process.argv[process.argv.indexOf('--kotlin') + 1]
  : 'app/src/main/java/com/app/m3expressive/ScheduleData.kt';

const kt = (value) => `"${String(value).replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\$/g, '\\$')}"`;
const courseLiteral = (course) =>
  `ScheduleCourse(${kt(course.name)}, ${kt(course.weeks)}, ${kt(course.teacher)}, ${kt(course.room)})`;

const kotlin = `package com.app.m3expressive

/* AUTO-GENERATED by scripts/import-schedule.mjs - do not edit by hand.
   Source: 学生课表.doc (${owner} · ${term} · ${periods.length} 节次 × ${days.length} 天) */

/** 一门课程（已从教务系统导出的课表中解析）。 */
data class ScheduleCourse(
    val name: String,
    /** 周次范围，例如 "4;6-9;12-20"；为空表示每周 */
    val weeks: String,
    val teacher: String,
    val room: String,
)

/** 某个节次在四天/一周里的安排。 */
data class SchedulePeriod(
    val period: String,
    val time: String,
    /** morning / noon / afternoon / evening */
    val section: String,
    /** 周一优先，每天可能有 0..n 门课 */
    val days: List<List<ScheduleCourse>>,
)

/** 内嵌课表：App 自带，无需手动导入。 */
object EmbeddedSchedule {
    const val OWNER = ${kt(owner)}
    const val TERM = ${kt(term)}
    const val TERM_START = ${kt(termStart)}

    val days = listOf(${days.map(kt).join(', ')})

    val periods = listOf(
${periods
  .map(
    (period) => `        SchedulePeriod(
            ${kt(period.period)},
            ${kt(period.time)},
            ${kt(period.section)},
            listOf(
${period.days.map((day) => `                listOf(${day.map(courseLiteral).join(', ')})`).join(',\n')}
            ),
        )`,
  )
  .join(',\n')}
    )
}
`;

await mkdir(path.dirname(path.resolve(kotlinOutput)), { recursive: true });
await writeFile(kotlinOutput, kotlin, 'utf8');
console.log(`wrote ${kotlinOutput}`);

console.log(
  `wrote ${output}\nowner=${owner} term=${term} termStart=${termStart} periods=${periods.length} days=${days.length} courses=${periods.reduce(
    (total, period) => total + period.days.reduce((sum, day) => sum + day.length, 0),
    0,
  )}`,
);
