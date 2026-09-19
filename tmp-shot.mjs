import { chromium } from "playwright";
const browser = await chromium.launch({ channel: "chromium" });
const page = await browser.newPage({ viewport: { width: 412, height: 892 }, hasTouch: true, deviceScaleFactor: 2 });
await page.goto("http://127.0.0.1:4173/", { waitUntil: "load" });
await page.waitForTimeout(1500);
const top = () => page.locator('.screen:not([aria-hidden="true"])');
await top().locator('md-navigation-tab').nth(1).click();
await page.waitForTimeout(900);
await top().locator('md-navigation-tab').nth(2).click();
await page.waitForTimeout(2500);
await page.screenshot({ path: "screenshots/check-schedule.png" });
// crop the nav bar region
await page.screenshot({ path: "screenshots/check-navbar.png", clip: { x: 0, y: 790, width: 412, height: 102 } });
console.log("screens:", await page.locator('.screen').count());
console.log("navbars visible:", await page.locator('.screen:not([aria-hidden="true"]) md-navigation-bar').count());
await browser.close();
