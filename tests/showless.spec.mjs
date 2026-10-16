import { test, expect } from "@playwright/test";
import { openApp } from "./helpers.mjs";

const store = (page) => page.evaluate(() => JSON.parse(localStorage.getItem("pc-cache-v1")));
const C = (n) => Array.from({ length: n }, (_, i) => ({ id: "c" + i, type: "check", label: "Chore " + i }));
const vis = (page) => page.locator("#quests > .q:visible");

test("a group with more than 3 quests can show less: 3 stay, the rest fold behind Show n more, and it's remembered", async ({ page }) => {
  const Q = C(5);
  await openApp(page, { cfg: { quests: Q }, days: { "2026-11-02": { q: Q } } });
  const b = page.locator("#qMore-q");
  await expect(b).toHaveText("Show less");
  await expect(vis(page)).toHaveCount(5);
  await b.click();
  await expect(b).toHaveText("Show 2 more");
  await expect(vis(page)).toHaveCount(3);
  await expect(page.locator("#quests > .q:visible .lbl")).toHaveText(["Chore 0", "Chore 1", "Chore 2"]);
  await expect.poll(async () => (await store(page)).cfg.ui.less).toEqual({ q: 1 });
  await page.reload();
  await expect(page.locator("#qMore-q")).toHaveText("Show 2 more");
  await expect(vis(page)).toHaveCount(3);
  await page.click("#qMore-q");
  await expect(vis(page)).toHaveCount(5);
  await expect.poll(async () => (await store(page)).cfg.ui.less).toEqual({});
});

test("3 or fewer quests in a group get no toggle", async ({ page }) => {
  const Q = C(3);
  await openApp(page, { cfg: { quests: Q } });
  await expect(page.locator("#quests > .q")).toHaveCount(3);
  await expect(page.locator("#qMore-q")).toBeHidden();
});

test.describe("phone", () => {
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  test("Done today folds on its own, and the toggle sits under its rows", async ({ page }) => {
    const Q = C(6);
    await openApp(page, { cfg: { quests: Q }, days: { "2026-11-02": { c0: true, c1: true, c2: true, c3: true, q: Q } }, extra: { "pc-doneopen": "1" } });
    const d = page.locator("#qMore-d");
    await expect(page.locator("#qMore-q")).toBeHidden();
    await expect(d).toHaveText("Show less");
    await d.click();
    await expect(d).toHaveText("Show 1 more");
    await expect(page.locator("#quests > .q.indone:visible")).toHaveCount(3);
    await expect(page.locator("#quests > .q:not(.indone):visible")).toHaveCount(2);
    const [last, btn, sep] = await Promise.all([page.locator("#quests > .q.indone:visible").last().boundingBox(), d.boundingBox(), page.locator("#doneSep").boundingBox()]);
    expect(btn.y).toBeGreaterThan(last.y);
    expect(btn.y).toBeGreaterThan(sep.y);
    await page.click("#doneSep");
    await expect(d).toBeHidden();
  });
});
