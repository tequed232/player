/**
 * Browser verification for the production build.
 *
 * - launches Chromium with a fake camera device so the live preview can be checked
 * - drives the real app: home -> panel -> history -> settings -> api -> camera -> shutter
 *   -> history -> detail -> image viewer -> persistence after reload -> dark mode + undo
 * - captures screenshots into ./screenshots and a JSON report (written after every step)
 *
 * Usage: node scripts/verify.mjs [url]
 */
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';

const URL = process.argv[2] ?? process.env.URL ?? 'http://127.0.0.1:4173/';
const OUT_DIR = path.resolve(process.env.OUT_DIR ?? 'screenshots');
const REPORT = path.join(OUT_DIR, 'report.json');

const consoleErrors = [];
const pageErrors = [];
const steps = [];
const extra = {};

await mkdir(OUT_DIR, { recursive: true });

const persist = async () => {
  await writeFile(REPORT, JSON.stringify({ url: URL, extra, consoleErrors, pageErrors, steps }, null, 2));
};

const watchdog = setTimeout(async () => {
  steps.push('FATAL: watchdog timeout');
  await persist().catch(() => {});
  process.exit(3);
}, 300000);

const browser = await chromium.launch({
  channel: 'chromium',
  args: [
    '--use-fake-ui-for-media-stream',
    '--use-fake-device-for-media-stream',
    '--autoplay-policy=no-user-gesture-required',
  ],
});

const context = await browser.newContext({
  viewport: { width: 412, height: 892 },
  deviceScaleFactor: 2,
  hasTouch: true,
  permissions: ['camera', 'microphone'],
  locale: 'zh-CN',
});

const page = await context.newPage();
page.setDefaultTimeout(8000);

page.on('console', (message) => {
  if (message.type() === 'error') consoleErrors.push(message.text());
});
page.on('pageerror', (error) => pageErrors.push(String(error?.stack ?? error)));

/** The screen on top of the stack (NavHost marks the others aria-hidden). */
const top = () => page.locator('.screen:not([aria-hidden="true"])');

const clickTop = async (selector, index = 0) => {
  await top().locator(selector).nth(index).click({ timeout: 7000 });
};

const waitTop = async (selector, index = 0) => {
  await top().locator(selector).nth(index).waitFor({ state: 'visible', timeout: 8000 });
};

const shot = async (name) => {
  const file = path.join(OUT_DIR, `${name}.png`);
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      await page.screenshot({ path: file });
      break;
    } catch (error) {
      if (attempt === 1) throw error;
      await page.waitForTimeout(500);
    }
  }
  steps.push(`shot:${name}`);
  await persist();
};

const step = async (name, fn) => {
  try {
    await fn();
    steps.push(`ok:${name}`);
  } catch (error) {
    steps.push(`FAIL:${name}: ${error instanceof Error ? error.message.split('\n')[0] : error}`);
  }
  await persist();
};

const evalWithTimeout = (fn, fallback = null, ms = 6000) =>
  Promise.race([
    page.evaluate(fn).catch(() => fallback),
    new Promise((resolve) => setTimeout(() => resolve(fallback), ms)),
  ]);

const readTheme = () =>
  page.evaluate(() => {
    const styles = getComputedStyle(document.documentElement);
    const role = (name) => styles.getPropertyValue(`--md-sys-color-${name}`).trim();
    return {
      theme: document.documentElement.dataset.theme,
      primary: role('primary'),
      onPrimary: role('on-primary'),
      primaryContainer: role('primary-container'),
      secondaryContainer: role('secondary-container'),
      tertiaryContainer: role('tertiary-container'),
      surface: role('surface'),
      surfaceContainerLow: role('surface-container-low'),
      surfaceContainer: role('surface-container'),
      surfaceContainerHigh: role('surface-container-high'),
      surfaceContainerHighest: role('surface-container-highest'),
      onSurface: role('on-surface'),
      onSurfaceVariant: role('on-surface-variant'),
      outlineVariant: role('outline-variant'),
      inverseSurface: role('inverse-surface'),
      inversePrimary: role('inverse-primary'),
      error: role('error'),
      springDuration: styles.getPropertyValue('--md-sys-motion-spring-spatial-default-duration'),
    };
  });

try {
  await page.goto(URL, { waitUntil: 'load' });
  await page.waitForTimeout(1600);

  extra.theme = await readTheme();

  await step('home renders', async () => {
    await waitTop('md-navigation-bar');
    await waitTop('.container-box.tertiary');
    await waitTop('md-filled-button', 0);
  });
  await shot('01-home');

  extra.layout = await page.evaluate(() => {
    const box = (selector) => {
      const element = document.querySelector(selector);
      if (!element) return null;
      const rect = element.getBoundingClientRect();
      const styles = getComputedStyle(element);
      return {
        w: Math.round(rect.width),
        h: Math.round(rect.height),
        x: Math.round(rect.x),
        y: Math.round(rect.y),
        bg: styles.backgroundColor,
        radius: styles.borderRadius,
      };
    };
    const read = (element, property) => (element ? getComputedStyle(element).getPropertyValue(property).trim() : null);
    const button = document.querySelector('.button-group > *');
    const field = document.querySelector('md-outlined-text-field');
    const nav = document.querySelector('md-navigation-bar');
    const icon = document.querySelector('md-navigation-tab md-icon');
    const iconRect = icon ? icon.getBoundingClientRect() : null;
    return {
      phone: box('.phone'),
      topBox: box('.container-box.surface-high'),
      middleBox: box('.container-box.tertiary'),
      navBar: box('md-navigation-bar'),
      buttonGroup: box('.button-group'),
      textField: box('md-outlined-text-field'),
      buttons: Array.from(document.querySelectorAll('.button-group > *')).map((element) => {
        const rect = element.getBoundingClientRect();
        return { w: Math.round(rect.width), h: Math.round(rect.height), y: Math.round(rect.y) };
      }),
      tokens: {
        buttonShapeStart: read(button, '--md-filled-button-container-shape-start-start'),
        buttonShapeInnerEnd: read(button, '--md-filled-button-container-shape-start-end'),
        fieldShape: read(field, '--md-outlined-text-field-container-shape'),
        fieldOutline: read(field, '--md-outlined-text-field-outline-color'),
        navContainerHeight: read(nav, '--md-navigation-bar-container-height'),
        navContainerColor: read(nav, '--md-navigation-bar-container-color'),
        navIndicatorWidth: read(nav, '--md-navigation-bar-active-indicator-width'),
        navIndicatorHeight: read(nav, '--md-navigation-bar-active-indicator-height'),
        navIndicatorColor: read(nav, '--md-navigation-bar-active-indicator-color'),
      },
      icon: icon
        ? {
            codepoint: icon.textContent ? icon.textContent.codePointAt(0).toString(16) : null,
            w: Math.round(iconRect.width),
            h: Math.round(iconRect.height),
            font: getComputedStyle(icon).fontFamily,
          }
        : null,
    };
  });

  await step('transcript panel expands', async () => {
    await clickTop('.container-box.surface-high');
    await waitTop('.sheet-panel');
    await page.waitForTimeout(800);
  });
  await shot('02-home-panel');

  await step('panel closes', async () => {
    await page.keyboard.press('Escape');
    await page.waitForTimeout(800);
  });

  await step('history tab', async () => {
    await clickTop('md-navigation-tab', 1);
    await page.waitForTimeout(1000);
  });
  await shot('03-history-empty');

  await step('settings tab', async () => {
    await clickTop('md-navigation-tab', 2);
    await page.waitForTimeout(1000);
  });
  await shot('04-settings');

  extra.settings = await page.evaluate(() => {
    const read = (element, property) => (element ? getComputedStyle(element).getPropertyValue(property).trim() : null);
    const box = (selector) => {
      const element = document.querySelector(selector);
      if (!element) return null;
      const rect = element.getBoundingClientRect();
      return { w: Math.round(rect.width), h: Math.round(rect.height), x: Math.round(rect.x), y: Math.round(rect.y) };
    };
    const sw = document.querySelector('md-switch');
    const slider = document.querySelector('md-slider');
    return {
      list: box('.list-group'),
      items: Array.from(document.querySelectorAll('md-list-item')).map((element) => {
        const rect = element.getBoundingClientRect();
        return { h: Math.round(rect.height), y: Math.round(rect.y), radius: getComputedStyle(element).borderRadius };
      }),
      overlays: Array.from(document.querySelectorAll('.group-overlay')).map((element) => {
        const rect = element.getBoundingClientRect();
        return { w: Math.round(rect.width), y: Math.round(rect.y) };
      }),
      switchTrack: [read(sw, '--md-switch-track-width'), read(sw, '--md-switch-track-height')],
      sliderTokens: [
        read(slider, '--md-slider-active-track-height'),
        read(slider, '--md-slider-handle-width'),
        read(slider, '--md-slider-handle-height'),
        read(slider, '--md-slider-inactive-track-color'),
      ],
    };
  });

  await step('api edit screen', async () => {
    await clickTop('md-list-item', 1);
    await page.waitForTimeout(1000);
  });
  await shot('05-api-edit');

  await step('api back', async () => {
    await clickTop('.app-bar md-icon-button', 0);
    await page.waitForTimeout(1000);
  });

  await step('home tab', async () => {
    await clickTop('md-navigation-tab', 0);
    await page.waitForTimeout(1000);
  });

  await step('open camera', async () => {
    await clickTop('md-filled-button', 0);
    await waitTop('.camera-frame video');
    await page.waitForTimeout(2600);
  });
  await shot('06-camera');

  extra.camera = await page.evaluate(() => {
    const video = document.querySelector('.camera-frame video');
    return video ? { w: video.videoWidth, h: video.videoHeight, paused: video.paused } : null;
  });

  await step('shutter creates a record', async () => {
    await clickTop('md-fab');
    await page.waitForTimeout(2200);
  });
  await shot('07-camera-after-shot');

  await step('camera back to home', async () => {
    await clickTop('md-filled-button', 0);
    await page.waitForTimeout(1200);
  });
  await shot('08-home-after-capture');

  await step('history with record', async () => {
    await clickTop('md-navigation-tab', 1);
    await waitTop('md-filled-card');
    await page.waitForTimeout(1000);
  });
  await shot('09-history');

  await step('open record detail', async () => {
    await clickTop('md-filled-card');
    await page.waitForTimeout(1300);
  });
  await shot('10-record-detail');

  await step('image viewer', async () => {
    await clickTop('.carousel-card');
    await waitTop('.viewer');
    await page.waitForTimeout(900);
  });
  await shot('11-image-viewer');

  await step('close viewer', async () => {
    await clickTop('.viewer md-icon-button', 0);
    await page.waitForTimeout(900);
  });

  await step('detail text panel', async () => {
    await clickTop('.container-box.surface-high');
    await waitTop('.sheet-panel');
    await page.waitForTimeout(900);
  });
  await shot('12-detail-panel');

  await step('close detail panel', async () => {
    await page.keyboard.press('Escape');
    await page.waitForTimeout(800);
  });

  await step('back to history', async () => {
    await clickTop('.app-bar md-icon-button', 0);
    await page.waitForTimeout(1100);
  });

  await step('reload keeps the record', async () => {
    await page.reload({ waitUntil: 'load' });
    await page.waitForTimeout(1600);
    await clickTop('md-navigation-tab', 1);
    await waitTop('md-filled-card');
  });
  await shot('13-history-after-reload');

  extra.persisted = await evalWithTimeout(
    () =>
      new Promise((resolve) => {
        const request = indexedDB.open('m3-expressive-notes');
        request.onsuccess = () => {
          const db = request.result;
          const tx = db.transaction('records', 'readonly');
          const all = tx.objectStore('records').getAll();
          all.onsuccess = () =>
            resolve((all.result ?? []).map((record) => ({ title: record.title, images: record.images.length })));
          all.onerror = () => resolve(null);
        };
        request.onerror = () => resolve(null);
      }),
  );

  await step('dark mode toggle', async () => {
    await clickTop('md-navigation-tab', 2);
    await page.waitForTimeout(900);
    await clickTop('md-switch');
    await page.waitForTimeout(1200);
  });
  await shot('14-settings-dark');
  extra.darkTheme = await readTheme();

  await step('undo dark mode', async () => {
    await page.locator('.snackbar md-text-button').first().click({ timeout: 7000 });
    await page.waitForTimeout(1100);
  });
  await shot('15-settings-light-again');
  extra.afterUndoTheme = await readTheme();

  await step('record detail still opens from history', async () => {
    await clickTop('md-navigation-tab', 1);
    await waitTop('md-filled-card');
    await clickTop('md-filled-card');
    await page.waitForTimeout(1200);
    await clickTop('.app-bar md-icon-button', 2);
    await page.waitForTimeout(900);
  });
  await shot('16-delete-dialog');

  await step('cancel delete dialog', async () => {
    // scoped to the screen on top: every screen renders its own (closed) dialog
    await top().locator('md-dialog md-text-button').nth(0).click({ timeout: 7000 });
    await page.waitForTimeout(900);
  });

  /* ------------------------------------------- long press = question mode */
  await step('back to history from detail', async () => {
    await clickTop('.app-bar md-icon-button', 0);
    await page.waitForTimeout(1200);
  });

  await step('long press enters question mode', async () => {
    await clickTop('md-navigation-tab', 0);
    await page.waitForTimeout(1000);
    const holder = top().locator('.home-input');
    const box = await holder.boundingBox();
    if (!box) throw new Error('home input not found');
    await page.mouse.move(box.x + box.width / 2, box.y + 14);
    await page.mouse.down();
    await page.waitForTimeout(800);
    await page.mouse.up();
    await page.waitForTimeout(600);
    extra.questionModeLabel = await top()
      .locator('md-outlined-text-field')
      .first()
      .evaluate((element) => element.label ?? element.getAttribute('label'));
    if (!String(extra.questionModeLabel).includes('提问')) throw new Error('question mode did not activate');
  });
  await shot('17-question-mode');

  await step('question creates a mind-map branch', async () => {
    await top().locator('md-outlined-text-field input').first().fill('这段记录讲了什么？');
    await page.waitForTimeout(300);
    await top().locator('md-outlined-text-field input').first().press('Enter');
    await page.waitForTimeout(1400);
    extra.branchCount = await top().locator('.mindmap-branch').count();
    extra.branchText = (await top().locator('.mindmap-branches').first().innerText()).slice(0, 200);
    if (!extra.branchCount) throw new Error('no branch rendered');
  });
  await shot('18-question-answer');

  /* ------------------------------------------------ slider + persistence */
  await step('slider drag saves and persists', async () => {
    await clickTop('md-navigation-tab', 2);
    await page.waitForTimeout(1000);
    const slider = top().locator('md-slider').nth(0);
    const box = await slider.boundingBox();
    if (!box) throw new Error('slider not found');
    await page.mouse.move(box.x + box.width * 0.2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width * 0.8, box.y + box.height / 2, { steps: 12 });
    await page.mouse.up();
    await page.waitForTimeout(900);
    extra.sliderSupporting = await top().locator('md-list-item').nth(2).innerText();
  });
  await shot('19-slider-drag');

  await step('slider value survives reload', async () => {
    await page.reload({ waitUntil: 'load' });
    await page.waitForTimeout(1600);
    await clickTop('md-navigation-tab', 2);
    await page.waitForTimeout(1000);
    extra.sliderSupportingAfterReload = await top().locator('md-list-item').nth(2).innerText();
    await page.waitForTimeout(200);
  });

  extra.storedSettings = await evalWithTimeout(
    () =>
      new Promise((resolve) => {
        const request = indexedDB.open('m3-expressive-notes');
        request.onsuccess = () => {
          const db = request.result;
          const tx = db.transaction('settings', 'readonly');
          const get = tx.objectStore('settings').get('settings');
          get.onsuccess = () => resolve(get.result ?? null);
          get.onerror = () => resolve(null);
        };
        request.onerror = () => resolve(null);
      }),
  );

  /* -------------------------------------------------- history overflow menu */
  await step('history overflow menu opens', async () => {
    await clickTop('md-navigation-tab', 1);
    await page.waitForTimeout(1000);
    await clickTop('.app-bar md-icon-button', 0);
    await page.waitForTimeout(800);
    extra.menuItems = await page.locator('md-menu md-menu-item').first().innerText();
  });
  await shot('20-history-menu');
} catch (error) {
  steps.push(`FATAL: ${error instanceof Error ? error.message : error}`);
} finally {
  clearTimeout(watchdog);
  await persist();
  await browser.close();
}

console.log(
  JSON.stringify({ extra, consoleErrors: consoleErrors.slice(0, 10), pageErrors: pageErrors.slice(0, 5), steps }, null, 2),
);
const failed = steps.some((entry) => entry.startsWith('FAIL') || entry.startsWith('FATAL'));
if (failed || pageErrors.length) process.exitCode = 1;
