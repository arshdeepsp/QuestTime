import { test, expect } from "@playwright/test";
import { openApp, dayRange } from "./helpers.mjs";

const store = (page) => page.evaluate(() => JSON.parse(localStorage.getItem("pc-cache-v1")));
const strip = (page) => page.evaluate(() => Object.fromEntries([...document.querySelectorAll("#strip i[data-k]")].map((i) => [i.getAttribute("data-k"), i.className.split(" ")[0]])));
async function details(page, label) {
  await page.waitForTimeout(200);
  if (!(await page.locator("#quests .q", { hasText: label }).locator(".pzb").isVisible()) && (await page.locator("#doneSep").isVisible())) await page.click("#doneSep");
  await page.locator("#quests .q", { hasText: label }).locator(".pzb").click();
  await page.click(".qmenu button:has-text('View details')");
  return page.locator("#gBody .dt-r").evaluateAll((L) => Object.fromEntries(L.map((r) => [r.querySelector("span").textContent, r.querySelector("b").textContent])));
}

const J = { id: "j", type: "check", label: "Journal" };
const C = { id: "cf", type: "target", label: "Coffees", min: 0, ul: "cups", step: 1 };
const P = { id: "pu", type: "target", label: "Pull-ups", min: 10, roll: 21, ul: "reps", step: 1, addedOn: "2026-10-26" };

test("a count with no goal only counts: never required, never done, the row shows just the count", async ({ page }) => {
  await openApp(page, { cfg: { quests: [J, C] }, days: { "2026-11-02": { j: true, cf: 2, q: [J, C] } } });
  await expect(page.locator("#qCount")).toHaveText("1/1 done");
  const row = page.locator("#quests .q", { hasText: "Coffees" });
  await expect(row.locator(".req")).toHaveText("no goal, just counts");
  await expect(row).not.toHaveClass(/\bmet\b/);
  await expect(row.locator(".ctr.act output")).toHaveText("2");
  await row.locator(".ctr.act button").last().click();
  await expect(row.locator(".ctr.act output")).toHaveText("3");
  await expect(row).not.toHaveClass(/\bmet\b/);
});

test("a count total paces across the week and isn't required day to day", async ({ page }) => {
  await openApp(page, {
    now: "2026-11-04T09:00:00-05:00",
    cfg: { quests: [J, P], start: "2026-10-26T04:00:00.000Z" },
    days: { "2026-11-02": { j: true, pu: 3, q: [J, P] }, "2026-11-03": { j: true, q: [J, P] } },
  });
  const m = await strip(page);
  expect([m["2026-11-02"], m["2026-11-03"]]).toEqual(["ok", "ok"]);
  await expect(page.locator("#qCount")).toHaveText("0/1 done");
  await expect(page.locator("#quests .q", { hasText: "Pull-ups" }).locator(".req")).toHaveText("21 reps per week");
  await expect(page.locator("#carryNote")).toContainText("Keep this week: Pull-ups 3/7 reps by Thu");
  const r = await details(page, "Pull-ups");
  expect(r["This week"]).toBe("3 reps of 21 reps · 4 reps more today keeps you on pace");
});

test("on pace, a count total sits in Done today", async ({ page }) => {
  await openApp(page, {
    now: "2026-11-04T09:00:00-05:00",
    cfg: { quests: [J, P], start: "2026-10-26T04:00:00.000Z" },
    days: { "2026-11-02": { j: true, pu: 6, q: [J, P] }, "2026-11-03": { j: true, pu: 6, q: [J, P] }, "2026-11-04": { q: [J, P] } },
    extra: { "pc-doneopen": "1" },
  });
  await expect(page.locator("#quests .q", { hasText: "Pull-ups" })).toHaveClass(/\bmet\b/);
});

const JW = [J, P];
test("reaching a count total keeps the week; missing it loses the week", async ({ page }) => {
  const days = dayRange("2026-10-26", "2026-11-01", (k) => ({ j: true, pu: k <= "2026-10-29" ? 3 : 0, q: JW }));
  await openApp(page, { now: "2026-11-03T09:00:00-05:00", cfg: { quests: JW, start: "2026-10-26T04:00:00.000Z" }, days: { ...days, "2026-11-02": { j: true, q: JW } } });
  const m = await strip(page);
  expect(["2026-10-26", "2026-10-29", "2026-11-01", "2026-11-02"].map((d) => m[d])).toEqual(["lost", "lost", "lost", "ok"]);
});

test("a count total that's reached keeps the cleared days", async ({ page }) => {
  const days = dayRange("2026-10-26", "2026-11-01", () => ({ j: true, pu: 3, q: JW }));
  await openApp(page, { now: "2026-11-03T09:00:00-05:00", cfg: { quests: JW, start: "2026-10-26T04:00:00.000Z" }, days: { ...days, "2026-11-02": { j: true, q: JW } } });
  const m = await strip(page);
  expect(["2026-10-26", "2026-10-29", "2026-11-01", "2026-11-02"].map((d) => m[d])).toEqual(["ok", "ok", "ok", "ok"]);
});

test.describe("phone", () => {
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  test("the row box shows what's left today for a count total, and just the count for a no-goal count", async ({ page }) => {
    await openApp(page, {
      now: "2026-11-04T09:00:00-05:00",
      cfg: { quests: [P, C], start: "2026-10-26T04:00:00.000Z" },
      days: { "2026-11-02": { pu: 3, cf: 1, q: [P, C] }, "2026-11-04": { cf: 2, q: [P, C] } },
    });
    await expect(page.locator("#quests .q", { hasText: "Pull-ups" }).locator(".qsum")).toContainText("4 to go today");
    await expect(page.locator("#quests .q", { hasText: "Coffees" }).locator(".qsum")).toHaveText("2 cups");
  });
});

test("Edit quests: a count can be a weekly total, and a goal of 0 locks it to daily", async ({ page }) => {
  const T = { id: "t", type: "target", label: "Pages", min: 20, ul: "pages", step: 5 };
  await openApp(page, { cfg: { quests: [T] } });
  await page.click("#hdrEdit");
  await page.click("#qmgr [data-tog='t']");
  const sel = page.locator("#qmgr select[data-p=rollmode]");
  await page.fill("#qmgr input[data-p=min]", "0");
  await expect(sel).toBeDisabled();
  await expect(page.locator("#qmgr [data-lo]")).toBeVisible();
  await page.fill("#qmgr input[data-p=min]", "20");
  await expect(sel).toBeEnabled();
  await page.selectOption("#qmgr select[data-p=rollmode]", "roll");
  await expect(page.locator("#qmgr input[data-p=rollc]")).toHaveValue("140");
  await page.fill("#qmgr input[data-p=rollc]", "100");
  await page.click("#mgrSaveTop");
  await expect.poll(async () => (await store(page)).cfg.quests.map((q) => [q.id, q.roll, q.per])).toEqual([["t", 100, undefined]]);
  await expect(page.locator("#sync")).toContainText("takes effect tomorrow");
});

test("new quest: a count with goal 0 just counts; a count can also be a monthly total", async ({ page }) => {
  await openApp(page, { cfg: { quests: [] } });
  await page.click("#hdrAdd");
  await page.click("#aoQuest");
  await page.click("#nqMore");
  await page.click("#nqBody .tcard[data-t='target']");
  await page.fill("#nqBody input[data-n='min']", "0");
  await expect(page.locator("#nqBody [data-goal='1']")).toBeDisabled();
  await expect(page.locator("#nqLo")).toBeVisible();
  await page.fill("#nqName", "Coffees");
  await page.click("#nqSave");
  await expect.poll(async () => (await store(page)).cfg.quests.map((q) => [q.label, q.min, q.roll])).toEqual([["Coffees", 0, undefined]]);
  await page.click("#hdrAdd");
  await page.click("#aoQuest");
  await page.click("#nqMore");
  await page.click("#nqBody .tcard[data-t='target']");
  await page.click("#nqBody [data-goal='1']");
  await page.click("#nqBody [data-per='month']");
  await page.fill("#nqRollN", "300");
  await page.fill("#nqBody input[data-s='ul']", "km");
  await page.fill("#nqName", "Cycling");
  await page.click("#nqSave");
  await expect.poll(async () => (await store(page)).cfg.quests.filter((q) => q.label === "Cycling").map((q) => [q.roll, q.per, q.ul])).toEqual([[300, "month", "km"]]);
  await expect(page.locator("#quests .q", { hasText: "Cycling" }).locator(".req")).toContainText("300 km per month");
});
