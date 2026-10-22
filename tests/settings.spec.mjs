import { test, expect } from "@playwright/test";
import { openApp } from "./helpers.mjs";

test("settings open on a list of categories with live summaries", async ({ page }) => {
  await openApp(page, { hash: "#settings", cfg: { day: { wake: "06:30", bed: "01:00" }, nf: { on: true, checkinAt: "20:00" } } });
  await expect(page.locator(".scat b")).toHaveText(["Your day", "Quests & rules", "Notifications", "Look", "Sound & touch", "Extras", "Account", "Your data"]);
  await expect(page.locator("[data-st='day'] small")).toHaveText("06:30–01:00 · locks at 1:00 am");
  await expect(page.locator("[data-st='alerts'] small")).toHaveText("On · check-in 20:00");
});

test("a category opens its own page, and back returns to the list", async ({ page }) => {
  await openApp(page, { hash: "#settings" });
  await page.click("[data-st='sound']");
  await expect(page.locator(".stitle")).toHaveText("Sound & touch");
  await expect(page.locator(".srow-t b")).toHaveText(["Sound", "Tap sounds", "Vibration", "Keep screen on"]);
  await page.click("#setBack");
  await expect(page.locator(".scat")).toHaveCount(8);
});

test("toggles are switches that save and stay in place", async ({ page }) => {
  await openApp(page, { hash: "#settings" });
  await page.click("[data-st='extras']");
  await page.click("#setTrends");
  await expect(page.locator("#setTrends")).toHaveAttribute("aria-checked", "true");
  await expect(page.locator(".stitle")).toHaveText("Extras");
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("pc-cache-v1")).cfg.addTrends)).toBe(true);
});

test("notification types appear once notifications are on", async ({ page }) => {
  await openApp(page, { hash: "#settings" });
  await page.click("[data-st='alerts']");
  await expect(page.locator("[data-nf]")).toHaveCount(0);
  await page.click("#nfOn");
  await expect(page.locator("[data-nf]")).toHaveCount(9);
  await page.click("[data-nf='checkin']");
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("pc-cache-v1")).cfg.nf.checkin)).toBe(false);
});

test("leaving settings and coming back starts at the list", async ({ page }) => {
  await openApp(page, { hash: "#settings" });
  await page.click("[data-st='look']");
  await page.click("[data-go='today']");
  await page.click("#setBtn");
  await expect(page.locator(".scat")).toHaveCount(8);
});

test("a ? in a group opens How it works at that topic", async ({ page }) => {
  await openApp(page, { hash: "#settings" });
  await page.click("[data-st='day']");
  await page.click(".sgroup-h .sq >> nth=0");
  await expect(page.locator("#helpPage")).toBeVisible();
  await expect(page.locator(".hp-item.open")).toHaveAttribute("data-hp", "day");
  await page.click("#hlpClose");
  await expect(page.locator("#helpPage")).toBeHidden();
});

test("How it works is a full page of short topics that expand", async ({ page }) => {
  await openApp(page);
  await page.click("#helpBtn");
  await expect(page.locator(".hp-gh")).toHaveText(["The basics", "Planning", "Focus and tools"]);
  await expect(page.locator(".hp-item.open")).toHaveCount(0);
  await page.click("[data-hp='streak'] .hp-t");
  await expect(page.locator("[data-hp='streak'] .hp-b")).toContainText("grace day");
  await expect(page.locator("[data-hp='streak'] .hp-t")).toHaveAttribute("aria-expanded", "true");
});

for (const width of [360, 390]) {
  test.describe(`phone ${width}`, () => {
    test.use({ viewport: { width, height: 760 }, isMobile: true, hasTouch: true });
    test("no settings page or the help page scrolls sideways", async ({ page }) => {
      await openApp(page, { hash: "#settings", cfg: { nf: { on: true } } });
      for (const k of ["day", "quests", "alerts", "look", "sound", "extras", "data"]) {
        await page.click(`[data-st='${k}']`);
        expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth), k).toBe(false);
        await page.click("#setBack");
      }
      await page.click("#helpBtn");
      await page.click("[data-hp='weekly'] .hp-t");
      expect(await page.evaluate(() => document.getElementById("hpScroll").scrollWidth > document.getElementById("hpScroll").clientWidth)).toBe(false);
    });
  });
}

test("every settings page renders without script errors", async ({ page }) => {
  const errors = await openApp(page, { hash: "#settings", cfg: { nf: { on: true }, deadlines: [{ id: "d1", title: "Thesis", date: "2026-11-20" }], } });
  for (const k of ["day", "quests", "alerts", "look", "sound", "extras", "data"]) {
    await page.click(`[data-st='${k}']`);
    await expect(page.locator(".stitle")).toBeVisible();
    await page.click("#setBack");
  }
  expect(errors).toEqual([]);
});
