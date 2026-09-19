/**
 * One-off: rewrite the nav-bar selectTab handlers so 课表 is the home screen
 * (tapping it pops back to the schedule tab) while 记录/历史/设置 push.
 *
 * Usage: node scripts/retarget-tabs.mjs
 */
import { readFile, writeFile } from 'node:fs/promises';

const FILES = [
  'web/src/screens/HistoryScreen.tsx',
  'web/src/screens/SettingsScreen.tsx',
  'web/src/screens/ScheduleScreen.tsx',
];

const REPLACEMENT = `const selectTab = (tab: 'home' | 'history' | 'schedule' | 'settings') => {
    // 课表是主页：点它回到栈底的课表页；其余标签正常入栈
    if (tab === 'schedule') {
      nav.popTo('schedule');
      return;
    }
    if (tab === 'home') {
      nav.push('home', {}, 'slide');
      return;
    }
    nav.push(tab, {}, 'slide');
  };`;

const PATTERN = /const selectTab = \(tab: 'home' \| 'history' \| 'schedule' \| 'settings'\) => \{[\s\S]*?\n  \};/;

for (const file of FILES) {
  const source = await readFile(file, 'utf8');
  const lines = source.match(/const selectTab[\s\S]*?\n  \};/);
  if (!lines) {
    console.log(`! ${file}: selectTab not found`);
    continue;
  }
  const next = source.replace(lines[0], REPLACEMENT);
  await writeFile(file, next, 'utf8');
  console.log(`updated ${file}`);
}

void PATTERN;
