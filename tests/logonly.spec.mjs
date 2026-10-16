import { test, expect } from "@playwright/test";
import { openApp } from "./helpers.mjs";

const store = (page) => page.evaluate(() => JSON.parse(localStorage.getItem("pc-cache-v1")));
const R = { id: "rd", type: "time", label: "Reading", min: 0 };
const S = { id: "st", type: "time", label: "Study", min: 30 };
const J = { id: "j", type: "check", label: "Journal" };

test("a time quest with a minimum of 0 only logs time: never required, never done, no plan, row shows just the time", async ({ page }) => {
  await openApp(page, { cfg: { quests: [J, R], showPlan: true }, days: { "2026-11-02": { j: true, rd: 45, q: [J, R] } } });
  await expect(page.locator("#qCount")).toHaveText("1/1 done");
  const row = page.locator("#quests .q", { hasText: "Reading" });
  await expect(row.locator(".req")).toHaveText("no minimum");
  await expect(row).not.toHaveClass(/\bmet\b/);
  await expect(row.locator(".ctr.plan")).toBeHidden();
  await expect(row.locator(".ctr.act output")).toHaveText("45m");
});

test("Just 5 skips a log-only quest", async ({ page }) => {
  await openApp(page, { cfg: { quests: [R, S] }, days: { "2026-11-02": { q: [R, S] } } });
  await page.click("#sp5Btn");
  await expect.poll(async () => ((await store(page)).timer || {}).id).toBe("st");
});

test("Bonus 5 shows when every quest with a minimum is done", async ({ page }) => {
  await openApp(page, { cfg: { quests: [R, S] }, days: { "2026-11-02": { st: 30, q: [R, S] } } });
  await expect(page.locator("#sp5Btn")).toContainText("Bonus 5");
});

test("Edit quests: a minimum of 0 locks the goal type to daily and saves", async ({ page }) => {
  await openApp(page, { cfg: { quests: [S] } });
  await page.click("#hdrEdit");
  await page.click("#qmgr [data-tog='st']");
  const sel = page.locator("#qmgr select[data-p=rollmode]");
  await expect(sel).toBeEnabled();
  await page.fill("#qmgr input[data-p=min]", "0");
  await expect(sel).toBeDisabled();
  await expect(page.locator("#qmgr [data-lo]")).toBeVisible();
  await page.fill("#qmgr input[data-p=min]", "20");
  await expect(sel).toBeEnabled();
  await expect(page.locator("#qmgr [data-lo]")).toBeHidden();
  await page.fill("#qmgr input[data-p=min]", "0");
  await page.click("#mgrSaveTop");
  await expect.poll(async () => (await store(page)).cfg.quests.map((q) => [q.id, q.min, q.roll])).toEqual([["st", 0, undefined]]);
});

test("new quest: a daily minimum of 0 blocks the period-total goal and saves a log-only quest", async ({ page }) => {
  await openApp(page, { cfg: { quests: [] } });
  await page.click("#hdrAdd");
  await page.click("#aoQuest");
  await page.click("#nqBody .tcard[data-t='time']");
  await page.fill("#nqBody input[data-n='min']", "0");
  await expect(page.locator("#nqBody [data-goal='1']")).toBeDisabled();
  await expect(page.locator("#nqLo")).toBeVisible();
  await page.fill("#nqName", "Reading");
  await page.click("#nqSave");
  await expect.poll(async () => (await store(page)).cfg.quests.map((q) => [q.label, q.min, q.roll])).toEqual([["Reading", 0, undefined]]);
  await expect(page.locator("#quests .q", { hasText: "Reading" }).locator(".req")).toContainText("no minimum");
});

test.describe("phone", () => {
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  test("the row's box shows only the time logged, with no goal", async ({ page }) => {
    await openApp(page, { cfg: { quests: [J, R] }, days: { "2026-11-02": { rd: 90, q: [J, R] } } });
    await expect(page.locator("#quests .q", { hasText: "Reading" }).locator(".qsum")).toHaveText("1h 30m");
  });
});
