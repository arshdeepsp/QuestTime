import { test, expect } from "@playwright/test";
import { openApp, dayRange } from "./helpers.mjs";

const Q = [
  { id: "th", type: "time", label: "Thesis", min: 60, roll: 600, subj: "s1", subjs: ["s1"], topics: ["t1"] },
  { id: "rd", type: "time", label: "Reading", min: 30 },
  { id: "gym", type: "check", label: "Gym" }
];
const SUBJ = [{ id: "s1", name: "ML", topics: [{ id: "t1", name: "Transformers", p: 2, hist: [] }] }];
const store = (page) => page.evaluate(() => JSON.parse(localStorage.getItem("pc-cache-v1")));

test.describe("compact phone rows", () => {
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

  test("every time row has a play button; one tap starts the timer, and it hides while running or done", async ({ page }) => {
    await openApp(page, { cfg: { quests: Q, subjects: SUBJ }, days: { "2026-11-02": { rd: 30, q: Q } }, extra: { "pc-doneopen": "1" } });
    await expect(page.locator("#quests .q.t-time:has-text('Thesis') .qplay")).toBeVisible();
    await expect(page.locator("#quests .q.t-check .qplay")).toHaveCount(0);
    await expect(page.locator("#quests .q:has-text('Reading') .qplay")).toBeHidden();
    await expect(page.locator("#quests .q .qgrip")).toHaveCount(3);
    for (const g of await page.locator("#quests .q .qgrip").all()) await expect(g).toBeHidden();
    await page.click("#quests .q:has-text('Thesis') .qplay");
    await expect(page.locator("#quests .q.running:has-text('Thesis')")).toHaveCount(1);
    await expect(page.locator("#quests .q.running .qplay")).toBeHidden();
  });

  test("rows are slim: the subjects box sits inline after the label", async ({ page }) => {
    await openApp(page, { cfg: { quests: Q, subjects: SUBJ } });
    const row = page.locator("#quests .q:has-text('Thesis')");
    const [rb, lb, cb] = await Promise.all([row.boundingBox(), row.locator(".lbl").boundingBox(), row.locator(".sjchip").boundingBox()]);
    expect(rb.height).toBeLessThanOrEqual(60);
    expect(Math.abs((cb.y + cb.height / 2) - (lb.y + lb.height / 2))).toBeLessThan(8);
    expect(cb.x).toBeGreaterThan(lb.x + lb.width - 2);
  });

  test("holding a row and dragging it reorders the quests; a quick drag just scrolls", async ({ page }) => {
    await openApp(page, { cfg: { quests: Q, subjects: SUBJ } });
    await page.clock.pauseAt(Date.parse("2026-11-02T09:00:05-05:00"));
    const cdp = await page.context().newCDPSession(page);
    const box = async (t) => page.locator("#quests .q", { hasText: t }).locator(".lbl").boundingBox();
    async function drag(from, to, hold) {
      const a = await box(from), b = await box(to), x = a.x + 5, y = a.y + a.height / 2, y2 = b.y + b.height - 4;
      await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y, id: 1 }] });
      await page.clock.runFor(hold);
      for (let i = 1; i <= 5; i++) await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x, y: y + (y2 - y) * i / 5, id: 1 }] });
      await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
      await page.waitForTimeout(200);
    }
    await drag("Thesis", "Reading", 100);
    expect((await store(page)).cfg.quests.map((q) => q.id)).toEqual(["th", "rd", "gym"]);
    await drag("Thesis", "Reading", 450);
    await expect.poll(async () => (await store(page)).cfg.quests.map((q) => q.id)).toEqual(["rd", "th", "gym"]);
    await expect(page.locator("#quests .q .lbl")).toHaveText(["Reading", "Thesis", "Gym"]);
  });

  test("dragging next to a quest deleted today (still listed until tomorrow) never writes a quest twice", async ({ page }) => {
    const P = { id: "pp", type: "time", label: "Piano Practice", min: 30 };
    await openApp(page, { cfg: { quests: Q, subjects: SUBJ, lockDay: { date: "2026-11-02", defs: { pp: P } } } });
    await page.clock.pauseAt(Date.parse("2026-11-02T09:00:05-05:00"));
    await expect(page.locator("#quests .q .lbl")).toHaveText(["Thesis", "Reading", "Gym", "Piano Practice"]);
    const cdp = await page.context().newCDPSession(page);
    const box = async (t) => page.locator("#quests .q", { hasText: t }).locator(".lbl").boundingBox();
    async function drag(from, to) {
      const a = await box(from), b = await box(to), x = a.x + 5, y = a.y + a.height / 2, y2 = b.y + 4;
      await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y, id: 1 }] });
      await page.clock.runFor(450);
      for (let i = 1; i <= 5; i++) await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x, y: y + (y2 - y) * i / 5, id: 1 }] });
      await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
      await page.waitForTimeout(200);
    }
    await drag("Piano Practice", "Thesis");
    expect((await store(page)).cfg.quests.map((q) => q.id)).toEqual(["th", "rd", "gym"]);
    await drag("Gym", "Thesis");
    await expect.poll(async () => (await store(page)).cfg.quests.map((q) => q.id)).toEqual(["gym", "th", "rd"]);
    await expect(page.locator("#quests .q .lbl")).toHaveCount(4);
  });
});

test("settings saved with a quest twice are repaired on launch: one copy each, the others kept", async ({ page }) => {
  await openApp(page, { cfg: { quests: [Q[0], Q[1], Q[0], Q[2], Q[0]], subjects: SUBJ } });
  await expect(page.locator("#quests .q .lbl")).toHaveText(["Thesis", "Reading", "Gym"]);
  expect((await store(page)).cfg.quests.map((q) => q.id)).toEqual(["th", "rd", "gym"]);
  await expect(page.locator("#sync")).toContainText("Removed 2 duplicated quests");
});

test("a badge toast raised on launch waits for the first tap", async ({ page }) => {
  const G = [Q[2]];
  await openApp(page, { cfg: { quests: G }, days: dayRange("2026-10-26", "2026-11-01", () => ({ gym: true, q: G })) });
  await expect.poll(async () => (await store(page)).cfg.badges?.week).toBe("2026-11-02");
  await expect(page.locator("#toast")).not.toHaveClass(/show/);
  await page.mouse.click(5, 5);
  await expect(page.locator("#toast")).toHaveClass(/show/);
  await expect(page.locator("#toast .t1")).toHaveText("Badge earned!");
});

test.describe("today trims (phone)", () => {
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const CS = { id: "cs", type: "time", label: "Coursework", min: 30, roll: 900, days: [1, 2, 3, 4, 5], addedOn: "2026-10-01" };
  const J = { id: "j", type: "check", label: "Journal" };

  test("a total's row says what to do today, or that you're on pace or ahead", async ({ page }) => {
    await openApp(page, { now: "2026-11-04T09:00:00-05:00", cfg: { quests: [CS, J] }, days: { "2026-11-02": { cs: 60, q: [CS, J] } } });
    const sum = page.locator("#quests .q", { hasText: "Coursework" }).locator(".qsum");
    await expect(sum).toHaveText("4h 40m to go today");
    await page.click("#quests .q:has-text('Coursework') .qsum");
    for (let i = 0; i < 10; i++) await page.click("#quests .q:has-text('Coursework') .act button[aria-label^='More']");
    await expect(sum).toHaveText("3h to go today");
    await page.locator("#quests .q", { hasText: "Coursework" }).locator(".pzb").click();
    await page.click(".qmenu button:has-text('View details')");
    await expect(page.locator("#gBody")).toContainText("2h 40m of 15h");
  });

  test("ahead of pace, and on an off day, the row shows the period figure", async ({ page }) => {
    await openApp(page, { now: "2026-11-04T09:00:00-05:00", cfg: { quests: [CS, J] }, days: { "2026-11-02": { cs: 300, q: [CS, J] }, "2026-11-03": { cs: 300, q: [CS, J] } } });
    await expect(page.locator("#quests .q", { hasText: "Coursework" }).locator(".qsum")).toHaveText("+1h ahead of pace");
    await page.clock.setFixedTime(new Date("2026-11-07T09:00:00-05:00"));
    await page.reload();
    await page.click("#offSep");
    await expect(page.locator("#quests .q", { hasText: "Coursework" }).locator(".qsum")).toHaveText("10h of 15h this week");
  });

  test("the period note sits above the list and is quiet while on pace", async ({ page }) => {
    await openApp(page, { now: "2026-11-04T09:00:00-05:00", cfg: { quests: [CS, J] }, days: { "2026-11-02": { cs: 300, q: [CS, J] }, "2026-11-03": { cs: 300, q: [CS, J] } } });
    const note = page.locator("#carryNote");
    await expect(note).toContainText("Keep this week: Coursework 10h/15h by Sun");
    await expect(note).not.toContainText("How does this work");
    await expect(note).toHaveClass(/^carrynote$/);
    expect(await page.evaluate(() => document.querySelector("#carryNote").getBoundingClientRect().bottom <= document.querySelector("#quests .q").getBoundingClientRect().top)).toBe(true);
    await note.click();
    await expect(page.locator("#gTitle")).toHaveText("Weekly totals");
  });

  test("the period note is warm when behind pace, and red only on a checkpoint day that's behind", async ({ page }) => {
    await openApp(page, { now: "2026-11-03T09:00:00-05:00", cfg: { quests: [CS, J] }, days: { "2026-11-02": { cs: 60, q: [CS, J] } } });
    await expect(page.locator("#carryNote")).toContainText("by Wed");
    await expect(page.locator("#carryNote")).toHaveClass(/warm/);
    await page.clock.setFixedTime(new Date("2026-11-04T09:00:00-05:00"));
    await page.reload();
    await expect(page.locator("#carryNote")).toContainText("Checkpoint today");
    await expect(page.locator("#carryNote")).toHaveClass(/hot/);
  });

  test("a row opened from its summary box stays open when the list is rebuilt", async ({ page }) => {
    await openApp(page, { cfg: { quests: [CS, J] } });
    const row = page.locator("#quests .q", { hasText: CS.label });
    await row.locator(".qsum").tap();
    await expect(row).toHaveClass(/open/);
    await page.locator("#tdGhost input").fill("Email supervisor");
    await page.locator("#tdGhost input").press("Enter");
    await expect(page.locator("#quests .q.t-todo .lbl")).toHaveText(["Email supervisor"]);
    await expect(page.locator("#quests .q", { hasText: CS.label })).toHaveClass(/open/);
    await page.locator("#quests .q", { hasText: CS.label }).locator(".qsum").tap();
    await expect(page.locator("#quests .q", { hasText: CS.label })).not.toHaveClass(/open/);
  });

  test("the quick to-do box is the first thing in the list and adds a to-do", async ({ page }) => {
    await openApp(page, { cfg: { quests: [CS, J] } });
    const gh = page.locator("#tdGhost");
    await expect(gh).toBeVisible();
    expect(await page.evaluate(() => document.querySelector("#tdGhost").getBoundingClientRect().bottom <= document.querySelector("#quests .q").getBoundingClientRect().top)).toBe(true);
    await gh.locator("input").fill("Email supervisor");
    await gh.locator("input").press("Enter");
    await expect(page.locator("#quests .q.t-todo .lbl")).toHaveText(["Email supervisor"]);
    expect((await store(page)).cfg.quests.filter((q) => q.type === "todo").map((q) => q.label)).toEqual(["Email supervisor"]);
  });

  test("saving is silent; the privacy line lives in Settings › Backup", async ({ page }) => {
    await openApp(page, { cfg: { quests: [J] } });
    await page.click("#quests .q:has-text('Journal') .sw");
    await page.waitForTimeout(1200);
    await expect(page.locator("#sync")).not.toContainText("Saved");
    await expect(page.locator("footer .privacy")).toHaveCount(0);
    await page.goto("http://127.0.0.1:4173/index.html#settings");
    await page.click("[data-st='data']");
    await expect(page.locator(".srow", { hasText: "Your data" })).toContainText("Stays on this device");
  });
});

test("the phone play button doesn't show on a wide screen", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await openApp(page, { cfg: { quests: [{ id: "cs", type: "time", label: "CS", min: 45 }] } });
  await expect(page.locator("#quests .q .tmr").first()).toBeVisible();
  await expect(page.locator("#quests .q .qplay")).toBeHidden();
  await page.click("#quests .q .tmr");
  await expect(page.locator("#quests .q.running")).toHaveCount(1);
  await expect(page.locator("#quests .q .qplay")).toBeHidden();
});
