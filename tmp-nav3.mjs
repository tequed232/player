import { chromium } from "playwright";
const browser = await chromium.launch({ channel: "chromium" });
const page = await browser.newPage({ viewport: { width: 412, height: 892 }, hasTouch: true });
await page.goto("http://127.0.0.1:4173/", { waitUntil: "load" });
await page.waitForTimeout(1500);
const top = () => page.locator('.screen:not([aria-hidden="true"])');
await top().locator('md-navigation-tab').nth(1).click();
await page.waitForTimeout(900);
await top().locator('md-navigation-tab').nth(2).click();
await page.waitForTimeout(1800);
const info = await page.evaluate(() => {
  const screen = document.querySelector('.screen:not([aria-hidden="true"])');
  const bars = Array.from(screen.querySelectorAll('md-navigation-bar'));
  const tabs = Array.from(screen.querySelectorAll('md-navigation-tab'));
  const el = document.elementFromPoint(206, 850);
  return {
    bars: bars.length,
    tabs: tabs.map((tab) => {
      const r = tab.getBoundingClientRect();
      return {
        text: tab.textContent?.trim() || '',
        active: tab.active,
        hover: tab.matches(':hover'),
        focus: tab.matches(':focus'),
        focusVisible: tab.matches(':focus-visible'),
        rect: `${Math.round(r.x)},${Math.round(r.y)} ${Math.round(r.width)}x${Math.round(r.height)}`,
      };
    }),
    atPoint: el ? `${el.tagName}.${el.className}` : null,
    activeElement: document.activeElement ? document.activeElement.tagName + '.' + document.activeElement.className : null,
  };
});
console.log(JSON.stringify(info, null, 1));
await browser.close();
