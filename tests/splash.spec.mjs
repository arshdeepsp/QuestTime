import { test, expect } from "@playwright/test";
import { openApp } from "./helpers.mjs";

const Q = [{ id: "cs", type: "time", label: "CS work", min: 60 }];
const on = { "pc-splash": "on" };
const flip = (page, v) => page.evaluate((st) => { Object.defineProperty(document, "visibilityState", { configurable: true, get: () => st }); document.dispatchEvent(new Event("visibilitychange")); }, v);

test("the splash shows on launch with today's status, then gets out of the way", async ({ page }) => {
  await openApp(page, { cfg: { quests: Q }, extra: on });
  await expect(page.locator("#splash")).toBeVisible();
  await expect(page.locator("#splash .spl-t")).toHaveText("QuestTime");
  await expect(page.locator("#splS")).toHaveText("Streak 0 · Today: 0 of 1 done");
  await expect(page.locator("#splash")).toBeHidden({ timeout: 3000 });
  await page.click("#quests .q .tmr");
  await expect(page.locator("#quests .q.running")).toHaveCount(1);
});

test("tapping the splash skips it", async ({ page }) => {
  await openApp(page, { cfg: { quests: Q }, extra: on });
  await page.click("#splash");
  await expect(page.locator("#splash")).toBeHidden({ timeout: 500 });
});

test("coming back after 30 minutes away shows it again; a quick switch doesn't", async ({ page }) => {
  await openApp(page, { cfg: { quests: Q }, extra: on });
  await expect(page.locator("#splash")).toBeHidden({ timeout: 3000 });
  await flip(page, "hidden");
  await page.clock.fastForward(5 * 60000);
  await flip(page, "visible");
  await expect(page.locator("#splash")).toBeHidden();
  await flip(page, "hidden");
  await page.clock.fastForward(31 * 60000);
  await flip(page, "visible");
  await expect(page.locator("#splash")).toBeVisible();
  await expect(page.locator("#splash")).toBeHidden({ timeout: 3000 });
});

test("with a timer running, the splash says what you're focusing on", async ({ page }) => {
  await openApp(page, { cfg: { quests: Q } });
  await page.click("#quests .q .tmr");
  await page.evaluate(() => localStorage.setItem("pc-splash", "on"));
  await flip(page, "hidden");
  await page.clock.fastForward(40 * 60000);
  await flip(page, "visible");
  await expect(page.locator("#splS")).toHaveText("Focusing on CS work");
});
