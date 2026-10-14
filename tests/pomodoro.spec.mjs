import { test, expect } from "@playwright/test";
import { openApp } from "./helpers.mjs";

const Q = [{ id: "th", type: "time", label: "Thesis", min: 90, addedOn: "2026-10-01" }, { id: "cs", type: "time", label: "CS", min: 30, addedOn: "2026-10-01" }, { id: "gym", type: "check", label: "Gym", addedOn: "2026-10-01" }];
const T = "2026-11-02";
const state = (page) => page.evaluate(() => JSON.parse(localStorage.getItem("pc-cache-v1")));
const day = async (page) => (await state(page)).days[T] || {};
const openPm = async (page) => { await page.click("#toolsBtn"); await page.click(".qmenu button:has-text('Pomodoro')"); };
const at = (h, m) => new Date(`${T}T${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:00-05:00`).getTime();

test("Pomodoro is its own full-screen page, opened from the tools menu and closed with Done", async ({ page }) => {
  const errors = await openApp(page, { cfg: { quests: Q } });
  await page.click("#toolsBtn");
  await page.click(".qmenu button:has-text('Pomodoro')");
  await expect(page.locator("#pomoPage")).toBeVisible();
  const box = await page.locator("#pomoPage").boundingBox();
  expect(box.x).toBe(0);
  expect(box.y).toBe(0);
  await expect(page.locator("#pomoPage .pm-k")).toHaveText("Ready");
  await expect(page.locator("#pomoPage .pm-time")).toHaveText("25:00");
  await expect(page.locator(".pm-q")).toHaveText(["Thesis 0m", "CS 0m"]);
  await expect(page.locator(".pm-set summary")).toContainText("25/5 · long 15 every 4");
  expect(await page.evaluate(() => document.body.classList.contains("pm-open"))).toBe(true);
  await page.click("#pmOk");
  await expect(page.locator("#pomoPage")).toBeHidden();
  expect(await page.evaluate(() => document.body.classList.contains("pm-open"))).toBe(false);
  expect(errors).toEqual([]);
});

test("a finished pomodoro logs its minutes, counts, lands on the schedule after the fact and starts the break", async ({ page }) => {
  const errors = await openApp(page, { cfg: { quests: Q }, now: `${T}T10:00:00-05:00` });
  await openPm(page);
  await page.click(".pm-q:has-text('CS')");
  await page.click("[data-pm=start]");
  await expect(page.locator("#pomoPage .pm-k")).toHaveText("Focus · pomodoro 1 of 4");
  await expect(page.locator("#pomoPage .pm-sub")).toContainText("CS");
  await page.clock.fastForward(10 * 60000);
  await expect(page.locator("#pomoPage .pm-time")).toHaveText("15:00");
  await page.clock.fastForward(15 * 60000 + 1500);
  await expect(page.locator("#pomoPage .pm-k")).toHaveText("Short break");
  await expect(page.locator("#pomoPage .pm-time")).toHaveText(/^(5:00|4:5\d)$/);
  const e = await day(page);
  expect(e.cs).toBe(25);
  expect(e.pomo.length).toBe(1);
  expect(e.pomo[0]).toMatchObject({ q: "cs", m: 25, ok: true });
  expect(Math.abs(e.pomo[0].s - at(10, 0))).toBeLessThan(3000);
  expect(e.pomo[0].e - e.pomo[0].s).toBe(25 * 60000);
  expect(e.sess.map((s) => [s.id, s.m])).toEqual([["cs", 25]]);
  expect(e.sched.map((b) => [b.q, b.f, b.t, !!b.pm])).toEqual([["cs", 600, 625, true]]);
  await expect(page.locator("#pmSum")).toHaveText("1 today · 1 this week");
  await expect(page.locator(".pm-tally .tomato:not(.dim)")).toHaveCount(1);
  await expect(page.locator(".pm-list li")).toHaveText(["10:00 · CS25m"]);
  await page.click("#pmOk");
  await page.click("#schBtn");
  await expect(page.locator(".sch-b.pm.past")).toContainText("CS");
  await expect(page.locator(".sch-b.pm.past")).toContainText("✔");
  await expect(page.locator(".sch-b.pm.past")).not.toContainText("short");
  await expect(page.locator(".sch-b.pm .sch-tm")).toHaveCount(1);
  expect(errors).toEqual([]);
});

test("the break ends with Start pomodoro 2, Skip break skips it, and the fourth break is the long one", async ({ page }) => {
  const errors = await openApp(page, { cfg: { quests: Q, pomo: { w: 15, b: 3, l: 10, every: 2 } }, now: `${T}T10:00:00-05:00` });
  await openPm(page);
  await expect(page.locator(".pm-set summary")).toContainText("15/3 · long 10 every 2");
  await page.click("[data-pm=start]");
  await page.clock.fastForward(15 * 60000 + 1500);
  await expect(page.locator("#pomoPage .pm-k")).toHaveText("Short break");
  await expect(page.locator("[data-pm=start]")).toBeHidden();
  await page.click("[data-pm=skip]");
  await expect(page.locator("#pomoPage .pm-k")).toHaveText("Break over");
  await expect(page.locator("[data-pm=start]")).toHaveText("Start pomodoro 2");
  await page.click("[data-pm=start]");
  await expect(page.locator("#pomoPage .pm-k")).toHaveText("Focus · pomodoro 2 of 2");
  await page.clock.fastForward(15 * 60000 + 1500);
  await expect(page.locator("#pomoPage .pm-k")).toHaveText("Long break");
  await expect(page.locator("#pomoPage .pm-time")).toHaveText(/^(10:00|9:5\d)$/);
  await page.clock.fastForward(10 * 60000 + 1500);
  await expect(page.locator("#pomoPage .pm-k")).toHaveText("Break over");
  expect((await day(page)).th).toBe(30);
  expect((await day(page)).pomo.length).toBe(2);
  await page.click("[data-pm=end]");
  await expect(page.locator("#pomoPage .pm-k")).toHaveText("2 today");
  expect((await state(page)).pomo).toBeNull();
  expect(errors).toEqual([]);
});

test("Stop arms first; a stopped pomodoro logs nothing to the quest and isn't counted", async ({ page }) => {
  await openApp(page, { cfg: { quests: Q }, now: `${T}T10:00:00-05:00` });
  await openPm(page);
  await page.click("[data-pm=start]");
  await page.clock.runFor(7 * 60000);
  await page.click("[data-pm=stop]");
  await expect(page.locator("[data-pm=stop]")).toHaveText("Stop? Nothing logged");
  await page.clock.runFor(5000);
  await expect(page.locator("[data-pm=stop]")).toHaveText("Stop");
  await page.click("[data-pm=stop]");
  await page.click("[data-pm=stop]");
  await expect(page.locator("#pomoPage .pm-k")).toHaveText("Ready");
  const e = await day(page);
  expect(e.th).toBeUndefined();
  expect(e.sess).toBeUndefined();
  expect(e.tt).toBeUndefined();
  expect(e.pomo.length).toBe(1);
  expect(e.pomo[0]).toMatchObject({ q: "th", m: 7, ok: false });
  expect(e.sched).toBeUndefined();
  await expect(page.locator("#sync")).toContainText("Nothing logged");
  await expect(page.locator(".pm-list li.no")).toContainText("stopped at 7m");
  await expect(page.locator("#pmSum")).toHaveText("None today · 0 this week");
});

test("pause stretches the end; the pill shows while the page is closed; the focus timer refuses to start", async ({ page }) => {
  await openApp(page, { cfg: { quests: Q }, now: `${T}T10:00:00-05:00` });
  await openPm(page);
  await page.click("[data-pm=start]");
  await page.clock.runFor(5 * 60000);
  await page.click("[data-pm=pause]");
  await expect(page.locator("#pomoPage .pm-k")).toContainText("Paused");
  await page.clock.runFor(3 * 60000);
  await expect(page.locator("#pomoPage .pm-time")).toHaveText(/^20:0[01]$/);
  await page.click("[data-pm=pause]");
  await page.click("#pmOk");
  await expect(page.locator("#pmPill")).toBeVisible();
  await expect(page.locator("#pmPill")).toContainText(/(20:0\d|19:5\d)/);
  await page.locator("#quests .q", { hasText: "Thesis" }).locator(".tmr, .qplay").first().click();
  await expect(page.locator("#sync")).toContainText("A pomodoro is running");
  expect((await state(page)).timer).toBeNull();
  await page.click("#pmPill");
  await expect(page.locator("#pomoPage")).toBeVisible();
  await expect(page.locator("#pmPill")).toBeHidden();
});

test("a pomodoro keeps the planned blocks around it and only fills the free part", async ({ page }) => {
  const days = { [T]: { q: Q, sched: [{ id: "x", q: "th", f: 610, t: 640 }] } };
  await openApp(page, { cfg: { quests: Q }, days, now: `${T}T10:00:00-05:00` });
  await openPm(page);
  await page.click(".pm-q:has-text('CS')");
  await page.click("[data-pm=start]");
  await page.clock.fastForward(25 * 60000 + 1500);
  const s = (await day(page)).sched.map((b) => [b.q, b.f, b.t, !!b.pm]);
  expect(s).toEqual([["cs", 600, 610, true], ["th", 610, 640, false]]);
});

test("Settings on the page change the next pomodoro and are kept in cfg", async ({ page }) => {
  await openApp(page, { cfg: { quests: Q } });
  await openPm(page);
  await page.selectOption("select[data-pk=w]", "50");
  await page.selectOption("select[data-pk=every]", "0");
  await page.click("[data-pm=auto]");
  await expect(page.locator(".pm-set summary")).toContainText("50/5 · auto");
  await expect(page.locator("[data-pm=start]")).toHaveText("Start 50-min pomodoro");
  await expect(page.locator("#pomoPage .pm-time")).toHaveText("50:00");
  expect((await state(page)).cfg.pomo).toEqual({ w: 50, b: 5, l: 15, every: 0, auto: true });
  await page.click("[data-pm=start]");
  await expect(page.locator("#pomoPage .pm-k")).toHaveText("Focus · pomodoro 1");
  await page.clock.fastForward(50 * 60000 + 1500);
  await expect(page.locator("#pomoPage .pm-k")).toHaveText("Short break");
  await page.clock.fastForward(5 * 60000 + 1500);
  await expect(page.locator("#pomoPage .pm-k")).toHaveText("Focus · pomodoro 2");
});

test("Trends has a Pomodoro section: week count, days in a row, best day, chain, finish rate, harvest and the garden", async ({ page }) => {
  const P = (k, h, n, ok = true) => Array.from({ length: n }, (_, i) => ({ q: "th", s: new Date(`${k}T${String(h).padStart(2, "0")}:00:00-05:00`).getTime() + i * 30 * 60000, e: new Date(`${k}T${String(h).padStart(2, "0")}:25:00-05:00`).getTime() + i * 30 * 60000, m: ok ? 25 : 9, ok }));
  const days = {
    "2026-11-02": { q: Q, th: 50, pomo: P("2026-11-02", 9, 2) },
    "2026-11-01": { q: Q, th: 75, pomo: P("2026-11-01", 9, 3).concat(P("2026-11-01", 14, 1, false)) },
    "2026-10-31": { q: Q, th: 25, pomo: P("2026-10-31", 9, 1) },
    "2026-10-28": { q: Q, th: 100, pomo: P("2026-10-28", 9, 4) }
  };
  const errors = await openApp(page, { cfg: { quests: Q, addTrends: true }, days, hash: "#trends" });
  const tile = (l) => page.locator(".pm-tile", { hasText: l });
  await expect(tile("This week").locator(".tt-v")).toHaveText("2");
  await expect(tile("This week").locator(".tt-s")).toHaveText("▲ 2 vs last week");
  await expect(tile("Days in a row").locator(".tt-v")).toHaveText("3");
  await expect(tile("Best day").locator(".tt-v")).toHaveText("4");
  await expect(tile("Best day").locator(".tt-s")).toHaveText("Oct 28");
  await expect(tile("Longest chain").locator(".tt-v")).toHaveText("4");
  await expect(tile("Finish rate").locator(".tt-v")).toHaveText("91%");
  await expect(tile("Harvest").locator(".tt-v")).toHaveText("10");
  await expect(tile("Harvest").locator(".tt-s")).toHaveText("4h 10m of focus · 15 more to 25");
  await expect(page.locator(".pm-gcol.today .tomato")).toHaveCount(2);
  await expect(page.locator(".pm-garden .tomato")).toHaveCount(10);
  await expect(page.locator(".tsec-h")).toHaveText(["This week", "Topics", "Pomodoro", "Charts", "Records"]);
  expect(errors).toEqual([]);
});

test("a day's a-posteriori pomodoro blocks don't count toward Plan kept", async ({ page }) => {
  const days = { "2026-11-01": { q: Q, cs: 25, sched: [{ id: "p", q: "cs", f: 600, t: 625, pm: true }] } };
  await openApp(page, { cfg: { quests: Q, addTrends: true }, days, hash: "#trends" });
  await expect(page.locator(".ttile", { hasText: "Plan kept" }).locator(".tt-v")).toHaveText("—");
});

test("a new session continues today's set, so the long break follows the day's fourth pomodoro", async ({ page }) => {
  const done = Array.from({ length: 3 }, (_, i) => ({ q: "th", s: at(8, i * 30), e: at(8, i * 30 + 25), m: 25, ok: true }));
  await openApp(page, { cfg: { quests: Q }, days: { [T]: { q: Q, th: 75, pomo: done } }, now: `${T}T10:00:00-05:00` });
  await openPm(page);
  await expect(page.locator("#pomoPage .pm-k")).toHaveText("3 today");
  await expect(page.locator(".pm-tally .tomato:not(.dim)")).toHaveCount(3);
  await expect(page.locator(".pm-set")).toHaveAttribute("open", "");
  await page.click("[data-pm=start]");
  await expect(page.locator("#pomoPage .pm-k")).toHaveText("Focus · pomodoro 4 of 4");
  await expect(page.locator(".pm-set")).not.toHaveAttribute("open", "");
  await page.clock.fastForward(25 * 60000 + 1500);
  await expect(page.locator("#pomoPage .pm-k")).toHaveText("Long break");
  await expect(page.locator(".pm-tally .tomato:not(.dim)")).toHaveCount(4);
});

test("start and finish play the recorded tomato squish, and the done notification goes on the pc_squish channel", async ({ page }) => {
  await page.addInitScript(() => {
    window.__sq = 0;
    const Real = window.AudioContext;
    window.AudioContext = function () { const ac = new Real(); const mk = ac.createBufferSource.bind(ac); ac.createBufferSource = () => { const o = mk(); const st = o.start.bind(o); o.start = (...a) => { if (o.buffer && o.buffer.duration > 0.3) window.__sq++; return st(...a); }; return o; }; return ac; };
    window.__ln = [];
    window.Capacitor = { isNativePlatform: () => true, getPlatform: () => "android", Plugins: {
      LocalNotifications: { requestPermissions: () => Promise.resolve({ display: "granted" }), createChannel: (c) => { (window.__ch = window.__ch || []).push(c.id); return Promise.resolve(); }, getPending: () => Promise.resolve({ notifications: [] }), cancel: () => Promise.resolve(), schedule: (o) => { o.notifications.forEach((n) => window.__ln.push({ id: n.id, channelId: n.channelId })); return Promise.resolve(); }, addListener: () => Promise.resolve({}), removeDeliveredNotifications: () => Promise.resolve() },
      App: { addListener: () => Promise.resolve({}) }
    } };
  });
  await openApp(page, { cfg: { quests: Q, nf: { on: true, timer: true } }, now: `${T}T10:00:00-05:00` });
  await openPm(page);
  await page.click("[data-pm=start]");
  await expect.poll(() => page.evaluate(() => window.__sq)).toBe(1);
  await expect.poll(() => page.evaluate(() => window.__ln.filter((n) => n.id === 1201).map((n) => n.channelId))).toEqual(["pc_squish"]);
  await expect.poll(() => page.evaluate(() => (window.__ch || []).includes("pc_squish"))).toBe(true);
  await page.clock.fastForward(25 * 60000 + 1500);
  await expect(page.locator("#pomoPage .pm-k")).toHaveText("Short break");
  await expect.poll(() => page.evaluate(() => window.__sq)).toBe(2);
});
