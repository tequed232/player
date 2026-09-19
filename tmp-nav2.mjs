import { chromium } from "playwright";
const browser = await chromium.launch({ channel: "chromium" });
const page = await browser.newPage({ viewport: { width: 412, height: 892 }, hasTouch: true });
await page.goto("http://127.0.0.1:4173/", { waitUntil: "load" });
await page.waitForTimeout(1500);
const top = () => page.locator('.screen:not([aria-hidden="true"])');
const dump = async (label) => {
  const info = await page.evaluate(() => {
    const bars = Array.from(document.querySelectorAll('.screen:not([aria-hidden="true"]) md-navigation-bar'));
    return bars.map((bar) => ({
      activeIndex: bar.activeIndex,
      tabs: Array.from(bar.querySelectorAll('md-navigation-tab')).map((tab) => `${tab.textContent.trim()}:${tab.active}`),
    }));
  });
  console.log(label, JSON.stringify(info));
};
await dump("home");
await top().locator('md-navigation-tab').nth(1).click();
await page.waitForTimeout(1000);
await dump("history");
await top().locator('md-navigation-tab').nth(2).click();
await page.waitForTimeout(1200);
await dump("schedule");
await browser.close();
