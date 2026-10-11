import { test, expect } from "@playwright/test";
import { openApp } from "./helpers.mjs";

const J = { id: "j", type: "check", label: "Journal" };
const CS = { id: "cs", type: "time", label: "Coursework", min: 60 };
const store = (page) => page.evaluate(() => JSON.parse(localStorage.getItem("pc-cache-v1")));

test("the store stamps each document it wrote: a day on an edit, cfg on a settings change, a deletion as a tombstone", async ({ page }) => {
  await openApp(page, { now: "2026-11-02T09:00:00-05:00", cfg: { quests: [J, CS], repFrozen: true } });
  const t0 = Date.parse("2026-11-02T09:00:00-05:00");
  let s = await store(page);
  expect(s.meta.u.cfg).toBeUndefined();
  await page.locator("#quests .q .sw").click();
  s = await store(page);
  expect(s.meta.u["days/2026-11-02"]).toBeGreaterThanOrEqual(t0);
  expect(s.meta.u.cfg).toBeUndefined();
  await page.goto("http://127.0.0.1:4173/index.html#settings");
  await page.click("[data-st='quests']");
  await page.click("#setPlan");
  s = await store(page);
  expect(s.meta.u.cfg).toBeGreaterThanOrEqual(t0);
  await page.goto("http://127.0.0.1:4173/index.html#today");
  await page.click("#schBtn");
  await page.click("#schDN");
  await page.click("#schAuto");
  s = await store(page);
  expect(s.days["2026-11-03"].sched.length).toBeGreaterThan(0);
  expect(s.meta.u["days/2026-11-03"]).toBeGreaterThanOrEqual(t0);
  await page.click("#schClr");
  await page.click("#schClr");
  s = await store(page);
  expect(s.days["2026-11-03"]).toBeUndefined();
  expect(s.meta.u["days/2026-11-03"]).toBeUndefined();
  expect(s.meta.del["days/2026-11-03"]).toBeGreaterThanOrEqual(t0);
});

test("older data loads; the passed days it snapshots on first open are stamped, untouched docs are not", async ({ page }) => {
  await openApp(page, { cfg: { quests: [J], repFrozen: true }, days: { "2026-11-01": { j: true, q: [J] } } });
  let s = await store(page);
  expect(s.meta.u.cfg).toBeUndefined();
  expect(s.meta.u["days/2026-11-02"]).toBeUndefined();
  expect(s.meta.u["days/2026-10-20"]).toBeGreaterThan(0);
  await page.locator("#quests .q .sw").click();
  s = await store(page);
  expect(s.meta.u["days/2026-11-02"]).toBeGreaterThan(0);
  expect(s.meta.u.cfg).toBeUndefined();
  expect(s.days["2026-11-01"]).toMatchObject({ j: true });
});

test("a saved change re-renders on its own: Show plan updates Today without an explicit render", async ({ page }) => {
  await openApp(page, { cfg: { quests: [{ id: "rd", type: "time", label: "Reading", min: 30 }], showPlan: true } });
  await expect(page.locator("#gui")).not.toHaveClass(/noplan/);
  await page.goto("http://127.0.0.1:4173/index.html#settings");
  await page.click("[data-st='quests']");
  await page.click("#setPlan");
  await expect(page.locator("#gui")).toHaveClass(/noplan/);
  await page.click("#setPlan");
  await expect(page.locator("#gui")).not.toHaveClass(/noplan/);
});
