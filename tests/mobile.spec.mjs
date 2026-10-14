import { test, expect } from "@playwright/test";
import { openApp } from "./helpers.mjs";

test.use({ viewport: { width: 360, height: 780 }, isMobile: true, hasTouch: true });

const Q = [
  { id: "cs", type: "time", label: "CS/Technical work", min: 60 },
  { id: "pg", type: "target", label: "Pages read", min: 10, ul: "pages" },
  { id: "ex", type: "weekly", label: "Gym", min: 3 },
  { id: "td", type: "todo", label: "Email advisor" }
];

test("no tab scrolls sideways on a small phone", async ({ page }) => {
  await openApp(page, { cfg: { quests: Q, addTrends: true, sparkTools: true } });
  for (const v of ["today", "subjects", "rules", "achievements", "trends", "settings"]) {
    await page.evaluate((h) => (location.hash = "#" + h), v);
    await page.waitForTimeout(150);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth), v).toBe(0);
  }
});

test("a page that fits the screen never scrolls: Notes, and Minimal view with a timer running", async ({ page }) => {
  await openApp(page, { cfg: { quests: Q, addNotes: true }, hash: "#notes" });
  await expect(page.locator("[data-view=notes]")).toBeVisible();
  const over = () => page.evaluate(() => { const w = document.querySelector(".wrap"); return Math.max(document.documentElement.scrollHeight - innerHeight, w.scrollHeight - w.clientHeight); });
  expect(await over()).toBeLessThanOrEqual(0);
  expect(await page.evaluate(() => getComputedStyle(document.querySelector(".wrap")).overscrollBehaviorY)).toBe("contain");
  await page.evaluate(() => (location.hash = "#today"));
  await page.click("#quests .q .qplay");
  await expect(page.locator("body")).toHaveClass(/focusview/);
  await page.waitForTimeout(150);
  expect(await over()).toBeLessThanOrEqual(0);
});

test("the + button adds a to-do", async ({ page }) => {
  await openApp(page, { cfg: { quests: Q } });
  await page.tap("#fabAdd");
  await page.fill("#aoTd", "Buy groceries");
  await page.keyboard.press("Enter");
  await page.keyboard.press("Escape");
  await expect(page.locator("#quests .lbl", { hasText: "Buy groceries" })).toBeVisible();
});

test("the app header stays pinned while scrolling every tab", async ({ page }) => {
  const SUBJ = [...Array(5)].map((_, i) => ({ id: "s" + i, name: "Subject " + i, topics: [...Array(4)].map((_, j) => ({ id: `t${i}${j}`, name: "Topic " + j, p: 2, hist: [] })) }));
  await openApp(page, { cfg: { quests: Q, subjects: SUBJ } });
  for (const v of ["subjects", "rules", "achievements"]) {
    await page.evaluate((h) => (location.hash = "#" + h), v);
    await page.waitForTimeout(150);
    for (const y of [600, 200, 0]) {
      await page.evaluate((y) => { document.querySelector(".wrap").scrollTop = y; }, y);
      await page.waitForTimeout(80);
      expect(await page.evaluate(() => Math.round(document.querySelector(".titlebar").getBoundingClientRect().top)), `${v} at ${y}`).toBe(0);
      expect(await page.evaluate(() => Math.round(document.querySelector("#mainnav").getBoundingClientRect().bottom)), `${v} nav at ${y}`).toBe(780);
    }
    expect(await page.evaluate(() => window.scrollY)).toBe(0);
  }
});

test("on a phone the document never scrolls: the content scrolls inside .wrap, and switching tabs starts at the top", async ({ page }) => {
  const SUBJ = [...Array(6)].map((_, i) => ({ id: "s" + i, name: "Subject " + i, topics: [...Array(4)].map((_, j) => ({ id: `t${i}${j}`, name: "Topic " + j, p: 2, hist: [] })) }));
  await openApp(page, { cfg: { quests: Q, subjects: SUBJ }, hash: "#subjects" });
  await page.evaluate(() => { document.querySelector(".wrap").scrollTop = 500; });
  expect(await page.evaluate(() => document.querySelector(".wrap").scrollTop)).toBeGreaterThan(100);
  expect(await page.evaluate(() => document.documentElement.scrollHeight - innerHeight)).toBeLessThanOrEqual(0);
  await page.click("#mainnav [data-go=rules]");
  expect(await page.evaluate(() => document.querySelector(".wrap").scrollTop)).toBe(0);
});

test("trends tiles fit on a small phone", async ({ page }) => {
  const TQ = [{ id: "cs", type: "time", label: "CS work", min: 60 }];
  const days = {};
  for (let i = 1; i <= 30; i++) days[`2026-10-${String(i).padStart(2, "0")}`] = { cs: 180, q: TQ, ended: true, sess: [{ id: "cs", s: 0, e: 1, m: 125 }] };
  await openApp(page, { now: "2026-11-02T20:00:00-05:00", cfg: { quests: TQ, addTrends: true }, days, hash: "#trends" });
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBe(0);
  expect(await page.evaluate(() => [...document.querySelectorAll(".ttile")].filter((t) => t.scrollWidth > t.clientWidth + 1).length)).toBe(0);
});

test("the on/off switch knob stays inside its track", async ({ page }) => {
  const SQ = [{ id: "j", type: "check", label: "Journal" }, { id: "k", type: "check", label: "Read" }];
  await openApp(page, { cfg: { quests: SQ } });
  const inside = () => page.evaluate(() => [...document.querySelectorAll("#quests .sw")].filter((s) => s.offsetParent).every((s) => {
    const t = s.getBoundingClientRect(), k = s.querySelector("span").getBoundingClientRect();
    return k.left >= t.left && k.right <= t.right && k.top >= t.top && k.bottom <= t.bottom;
  }));
  expect(await inside()).toBe(true);
  await page.tap("#quests .q:nth-child(2) .sw");
  await page.click("#doneSep");
  await page.waitForTimeout(200);
  expect(await inside()).toBe(true);
});

test("typing hides the tab bar and + button so the field sits above the keyboard", async ({ page }) => {
  await openApp(page, { cfg: { quests: Q } });
  await page.tap("#fabAdd");
  await page.click("#aoTd");
  expect(await page.evaluate(() => document.body.classList.contains("typing"))).toBe(true);
  await expect(page.locator("#mainnav")).toBeHidden();
  await page.keyboard.press("Escape");
  await page.waitForTimeout(200);
  expect(await page.evaluate(() => document.body.classList.contains("typing"))).toBe(false);
});

test("long quest names wrap instead of hiding under the time chip", async ({ page }) => {
  const LQ = [{ id: "a", type: "target", label: "Microservices observability readings", min: 10, ul: "pages" }];
  await openApp(page, { cfg: { quests: LQ } });
  const gap = await page.evaluate(() => { const r = document.querySelector("#quests .q"); return r.querySelector(".qsum").getBoundingClientRect().left - r.querySelector(".lbl").getBoundingClientRect().right; });
  expect(gap).toBeGreaterThanOrEqual(0);
});

for (const width of [320, 360]) {
  test.describe(`overflow ${width}`, () => {
    test.use({ viewport: { width, height: 800 }, isMobile: true, hasTouch: true });
    test("Subjects and Trends stay within the screen with long names", async ({ page }) => {
      const long = "Distributed systems and consensus protocols";
      const SJ = [{ id: "s1", name: long, topics: [{ id: "t1", name: "Root cause analysis for microservice architectures", p: 2, hist: [], target: 4, next: "read the whole Dapper paper and take notes" }] }, { id: "s2", name: "Maths", topics: [] }];
      const Q = [{ id: "m", type: "time", label: "A very long quest name for thesis reading", min: 60, subj: "s1", subjs: ["s1"], topics: ["t1"] }];
      await openApp(page, { cfg: { quests: Q, subjects: SJ }, days: { "2026-11-01": { m: 90, q: Q, tt: { t1: 90 } } }, extra: { "pc-rerate": "2026-11-02" }, hash: "#subjects" });
      await expect(page.locator(".sjsec")).toHaveCount(2);
      const over = () => page.evaluate(() => ({ doc: document.documentElement.scrollWidth - innerWidth, boxes: [...document.querySelectorAll(".sjsec,.ttile,.sjt,.trcard")].filter((b) => b.offsetParent && (b.getBoundingClientRect().right > innerWidth || b.getBoundingClientRect().left < 0)).length }));
      expect(await over()).toEqual({ doc: 0, boxes: 0 });
      const g = await page.evaluate(() => { const [a, b] = document.querySelectorAll(".sjsec"); return b.getBoundingClientRect().top - a.getBoundingClientRect().bottom; });
      expect(g).toBeGreaterThanOrEqual(12);
      await page.evaluate(() => (location.hash = "#trends"));
      await expect(page.locator(".ttile").first()).toBeVisible();
      expect(await over()).toEqual({ doc: 0, boxes: 0 });
      expect(await page.evaluate(() => [...document.querySelectorAll(".tt-v")].filter((v) => v.scrollWidth > v.clientWidth).map((v) => v.textContent))).toEqual([]);
    });
  });
}

test("opening Done today flips only its own chevron, not the Ignored group's", async ({ page }) => {
  const GQ = [{ id: "j", type: "check", label: "Journal" }, { id: "r", type: "check", label: "Read" }];
  await openApp(page, { cfg: { quests: GQ, noStreak: [{ from: "2026-11-01" }], ignore: ["r"] } });
  await page.tap("#quests .q:has-text('Journal') .sw");
  const rot = (sel) => page.locator(sel + " .chev").evaluate((el) => getComputedStyle(el).transform);
  await expect(page.locator("#doneSep")).toBeVisible();
  await expect(page.locator("#ignSep")).toBeVisible();
  const closed = await rot("#ignSep");
  await page.click("#doneSep");
  await page.waitForTimeout(300);
  expect(await rot("#doneSep")).not.toBe(closed);
  expect(await rot("#ignSep")).toBe(closed);
  await page.click("#ignSep");
  await page.waitForTimeout(300);
  expect(await rot("#ignSep")).not.toBe(closed);
});
