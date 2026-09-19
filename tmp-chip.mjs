import { chromium } from "playwright";
const browser = await chromium.launch({ channel: "chromium" });
const page = await browser.newPage({ viewport: { width: 412, height: 892 }, hasTouch: true });
page.setDefaultTimeout(7000);
await page.goto("http://127.0.0.1:4173/", { waitUntil: "load" });
await page.waitForTimeout(1500);
const top = () => page.locator('.screen:not([aria-hidden="true"])');
await top().locator('md-navigation-tab').nth(2).click();
await page.waitForTimeout(1200);
const info = await page.evaluate(() => {
  const chip = document.querySelector('.course-chip');
  if (!chip) return { found: false };
  const r = chip.getBoundingClientRect();
  const hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
  const styles = getComputedStyle(chip);
  return {
    found: true,
    rect: { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) },
    hit: hit ? `${hit.tagName}.${hit.className}` : null,
    pointerEvents: styles.pointerEvents,
    visibility: styles.visibility,
    display: styles.display,
    text: chip.textContent,
  };
});
console.log("chip:", JSON.stringify(info));
try {
  await top().locator('.course-chip').nth(0).click({ timeout: 5000 });
  console.log("normal click OK");
} catch (e) {
  console.log("normal click failed:", String(e).split("\n").slice(0, 6).join(" | "));
}
await page.waitForTimeout(900);
console.log("sheet open:", await page.locator('.sheet-panel').count());
await browser.close();
