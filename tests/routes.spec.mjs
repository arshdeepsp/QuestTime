import { test, expect } from "@playwright/test";
import { openApp } from "./helpers.mjs";

const Q = [{ id: "th", type: "time", label: "Thesis", min: 90, addedOn: "2026-10-01" }, { id: "gym", type: "check", label: "Gym", addedOn: "2026-10-01" }];
const hash = (page) => page.evaluate(() => location.hash);

test("the Pomodoro page has its own hash: opening pushes it, Done and browser Back both close it", async ({ page }) => {
  await openApp(page, { cfg: { quests: Q } });
  expect(["", "#today"]).toContain(await hash(page));
  await page.click("#toolsBtn");
  await page.click(".qmenu button:has-text('Pomodoro')");
  await expect(page.locator("#pomoPage")).toBeVisible();
  expect(await hash(page)).toBe("#pomodoro");
  await page.goBack();
  await expect(page.locator("#pomoPage")).toBeHidden();
  expect(["", "#today"]).toContain(await hash(page));
  await page.click("#toolsBtn");
  await page.click(".qmenu button:has-text('Pomodoro')");
  await page.click("#pmOk");
  await expect(page.locator("#pomoPage")).toBeHidden();
  expect(["", "#today"]).toContain(await hash(page));
});

test("a deep link opens the page over the view beneath, and Done closes to that view without leaving the site", async ({ page }) => {
  await openApp(page, { cfg: { quests: Q }, hash: "#pomodoro" });
  await expect(page.locator("#pomoPage")).toBeVisible();
  await page.click("#pmOk");
  await expect(page.locator("#pomoPage")).toBeHidden();
  expect(await hash(page)).toBe("#today");
  await expect(page.locator("#quests .q", { hasText: "Thesis" })).toBeVisible();
});

test("the schedule's hash carries the day being planned", async ({ page }) => {
  await openApp(page, { cfg: { quests: Q }, now: "2026-11-02T09:00:00-05:00" });
  await page.click("#schBtn");
  expect(await hash(page)).toBe("#schedule");
  await page.click("#schDN");
  await expect(page.locator("#schTitle")).toHaveText("Tomorrow");
  expect(await hash(page)).toBe("#schedule/2026-11-03");
  await page.click("#schDP");
  expect(await hash(page)).toBe("#schedule");
  await page.click("#schOk");
  await expect(page.locator("#schPage")).toBeHidden();
  expect(["", "#today"]).toContain(await hash(page));
});

test("#schedule/<date> opens the schedule on that day; a date out of range falls back to today", async ({ page }) => {
  await openApp(page, { cfg: { quests: Q }, now: "2026-11-02T09:00:00-05:00", hash: "#schedule/2026-11-05" });
  await expect(page.locator("#schPage")).toBeVisible();
  await expect(page.locator("#schTitle")).toHaveText("Thu, Nov 5");
  await page.evaluate(() => { location.hash = "#schedule/2026-12-25"; });
  await expect(page.locator("#schTitle")).toHaveText("Today");
});

test("Settings categories have hashes; the back arrow and browser Back return to the list", async ({ page }) => {
  await openApp(page, { cfg: { quests: Q }, hash: "#settings" });
  await page.click("[data-st='extras']");
  expect(await hash(page)).toBe("#settings/extras");
  await expect(page.locator("#setTrends")).toBeVisible();
  await page.click("#setBack");
  expect(await hash(page)).toBe("#settings");
  await expect(page.locator("[data-st='extras']")).toBeVisible();
  await page.click("[data-st='look']");
  await page.goBack();
  await expect(page.locator("[data-st='look']")).toBeVisible();
  expect(await hash(page)).toBe("#settings");
});

test("#settings/<category> deep-links into that category, and #help/<topic> into How it works", async ({ page }) => {
  await openApp(page, { cfg: { quests: Q }, hash: "#settings/day" });
  await expect(page.locator("#setBack")).toBeVisible();
  await expect(page.locator("#setWkS")).toBeVisible();
  await page.evaluate(() => { location.hash = "#help/pomodoro"; });
  await expect(page.locator("#helpPage")).toBeVisible();
  await expect(page.locator("[data-hp='pomodoro']")).toHaveClass(/open/);
  await page.click("#hlpClose");
  await expect(page.locator("#helpPage")).toBeHidden();
  expect(await hash(page)).toBe("#settings/day");
  await expect(page.locator("#setWkS")).toBeVisible();
});

test("switching views while a page is open closes the page", async ({ page }) => {
  await openApp(page, { cfg: { quests: Q }, hash: "#pomodoro" });
  await page.evaluate(() => { location.hash = "#subjects"; });
  await expect(page.locator("#pomoPage")).toBeHidden();
  await expect(page.locator("[data-view='subjects']")).toBeVisible();
});
