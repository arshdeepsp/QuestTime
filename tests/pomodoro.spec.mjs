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
  await expect(page.locator("select[data-pk=b] option")).toHaveText(["3 min", "5 min", "10 min", "15 min"]);
  await expect(page.locator("select[data-pk=l] option")).toHaveText(["10 min", "15 min", "20 min", "30 min", "45 min", "60 min"]);
  await expect(page.locator("[data-pm=auto] span")).toBeVisible();
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

test("Stop arms first; a stopped pomodoro logs nothing to the quest and isn't stored or shown", async ({ page }) => {
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
  expect(e.pomo).toBeUndefined();
  expect(e.sched).toBeUndefined();
  await expect(page.locator("#sync")).toContainText("Nothing logged");
  await expect(page.locator(".pm-list li")).toHaveCount(0);
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

test("Trends has a Pomodoro section: week count, days in a row, best day, chain, interruptions, harvest and the garden; old stop records are ignored", async ({ page }) => {
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
  await expect(page.locator(".pm-tile")).toHaveCount(6);
  await expect(tile("Harvest").locator(".tt-v")).toHaveText("10");
  await expect(tile("Harvest").locator(".tt-s")).toHaveText("4h 10m of focus · 15 more to 25");
  await expect(page.locator(".pm-gcol.today .pm-gbar")).toHaveAttribute("data-n", "2");
  expect(await page.evaluate(() => [...document.querySelectorAll(".pm-gbar")].reduce((a, b) => a + +b.dataset.n, 0))).toBe(10);
  expect(Math.round((await page.locator(".pm-gcol.today .pm-gbar").boundingBox()).height)).toBe(32);
  const grid = await page.locator(".tsec:has(.pm-gcard) .tgrid").boundingBox(), card = await page.locator(".pm-gcard").boundingBox();
  expect(card.y - (grid.y + grid.height)).toBeGreaterThanOrEqual(14);
  await expect(page.locator(".tsec-h")).toHaveText(["This week", "Topics", "Pomodoro", "Charts", "Records"]);
  expect(errors).toEqual([]);
});

test("the tomato garden stacks ten tomatoes a column and starts another column beside it for a bigger day", async ({ page }) => {
  const rec = (k, n) => Array.from({ length: n }, (_, i) => ({ q: "th", s: Date.parse(k + "T06:00:00-05:00") + i * 30 * 60000, e: Date.parse(k + "T06:00:00-05:00") + i * 30 * 60000 + 25 * 60000, m: 25, ok: true }));
  await openApp(page, { cfg: { quests: Q, addTrends: true }, days: { "2026-10-30": { q: Q, th: 500, pomo: rec("2026-10-30", 20) }, "2026-10-31": { q: Q, th: 75, pomo: rec("2026-10-31", 3) } }, now: `${T}T10:00:00-05:00` });
  await page.click("#trendsBtn");
  const big = page.locator(".pm-gcol", { has: page.locator(".pm-gn", { hasText: /^20$/ }) });
  await expect(big.locator(".pm-gbar")).toHaveCount(2);
  for (const b of await big.locator(".pm-gbar").all()) {
    await expect(b).toHaveAttribute("data-n", "10");
    expect(Math.round((await b.boundingBox()).height)).toBe(160);
  }
  const small = await page.locator(".pm-gbar[data-n='3']").boundingBox();
  expect(Math.round(small.height)).toBe(48);
  expect(Math.round(small.width)).toBe(13);
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

const SOUND_SPY = () => {
  /* __sq counts recorded-sample plays (the squish, > 0.3 s); __bp collects 880 Hz oscillator tones (the beeps). */
  window.__sq = 0;
  window.__bp = [];
  const Real = window.AudioContext;
  window.AudioContext = function () {
    const ac = new Real();
    const mk = ac.createBufferSource.bind(ac), mo = ac.createOscillator.bind(ac);
    ac.createBufferSource = () => { const o = mk(); const st = o.start.bind(o); o.start = (...a) => { if (o.buffer && o.buffer.duration > 0.3) window.__sq++; return st(...a); }; return o; };
    ac.createOscillator = () => { const o = mo(); const sv = o.frequency.setValueAtTime.bind(o.frequency); o.frequency.setValueAtTime = (f, t) => { if (f === 880) window.__bp.push(f); return sv(f, t); }; return o; };
    return ac;
  };
  window.__ln = [];
  window.Capacitor = { isNativePlatform: () => true, getPlatform: () => "android", Plugins: {
    LocalNotifications: { requestPermissions: () => Promise.resolve({ display: "granted" }), registerActionTypes: () => Promise.resolve(), createChannel: (c) => { (window.__ch = window.__ch || []).push(c.id); return Promise.resolve(); }, getPending: () => Promise.resolve({ notifications: [] }), cancel: () => Promise.resolve(), schedule: (o) => { o.notifications.forEach((n) => window.__ln.push({ id: n.id, channelId: n.channelId })); return Promise.resolve(); }, addListener: () => Promise.resolve({}), removeDeliveredNotifications: () => Promise.resolve() },
    App: { addListener: () => Promise.resolve({}) }
  } };
};
const chan = (page, id) => page.evaluate((id) => window.__ln.filter((n) => n.id === id).map((n) => n.channelId), id);

test("a new set starts with the squish; a finished pomodoro beeps twice, the break ending once, and the next start once", async ({ page }) => {
  await page.addInitScript(SOUND_SPY);
  await openApp(page, { cfg: { quests: Q, nf: { on: true, timer: true } }, now: `${T}T10:00:00-05:00` });
  await openPm(page);
  await page.click("[data-pm=start]");
  await expect.poll(() => page.evaluate(() => window.__sq)).toBe(1);
  await expect.poll(() => chan(page, 1201)).toEqual(["pc_beep2"]);
  await expect.poll(() => chan(page, 1203)).toEqual(["pc_beep1"]);
  await expect.poll(() => page.evaluate(() => ["pc_beep1", "pc_beep2", "pc_beep3"].every((c) => (window.__ch || []).includes(c)))).toBe(true);
  await page.clock.fastForward(25 * 60000 + 1500);
  await expect(page.locator("#pomoPage .pm-k")).toHaveText("Short break");
  await expect.poll(() => page.evaluate(() => window.__bp.length)).toBe(2);
  await expect.poll(() => chan(page, 1202)).toEqual(["pc_beep1"]);
  await page.clock.fastForward(5 * 60000 + 1500);
  await expect(page.locator("#pomoPage .pm-k")).toHaveText("Break over");
  await expect.poll(() => page.evaluate(() => window.__bp.length)).toBe(3);
  await page.click("[data-pm=start]:visible");
  await expect(page.locator("#pomoPage .pm-k")).toHaveText("Focus · pomodoro 2 of 4");
  await expect.poll(() => page.evaluate(() => window.__bp.length)).toBe(4);
  expect(await page.evaluate(() => window.__sq)).toBe(1);
});

test("the set's last pomodoro beeps three times and its notification goes on pc_beep3; the next session is a new set and squishes", async ({ page }) => {
  await page.addInitScript(SOUND_SPY);
  const done = Array.from({ length: 3 }, (_, i) => ({ q: "th", s: at(8, i * 30), e: at(8, i * 30 + 25), m: 25, ok: true }));
  await openApp(page, { cfg: { quests: Q, nf: { on: true, timer: true } }, days: { [T]: { q: Q, th: 75, pomo: done } }, now: `${T}T10:00:00-05:00` });
  await openPm(page);
  await page.click("[data-pm=start]");
  await expect(page.locator("#pomoPage .pm-k")).toHaveText("Focus · pomodoro 4 of 4");
  await expect.poll(() => page.evaluate(() => window.__bp.length)).toBe(1);
  expect(await page.evaluate(() => window.__sq)).toBe(0);
  await expect.poll(() => chan(page, 1201)).toEqual(["pc_beep3"]);
  await page.clock.fastForward(25 * 60000 + 1500);
  await expect(page.locator("#pomoPage .pm-k")).toHaveText("Long break");
  await expect.poll(() => page.evaluate(() => window.__bp.length)).toBe(4);
  await page.click("[data-pm=skip]");
  await expect(page.locator("#pomoPage .pm-k")).toHaveText("Break over");
  await page.click("[data-pm=start]:visible");
  await expect(page.locator("#pomoPage .pm-k")).toHaveText("Focus · pomodoro 1 of 4");
  await expect.poll(() => page.evaluate(() => window.__sq)).toBe(1);
});

test("a quest row's menu starts a pomodoro on that quest and opens the page", async ({ page }) => {
  await openApp(page, { cfg: { quests: Q }, now: `${T}T10:00:00-05:00` });
  await page.click("#quests .q:has-text('CS') .pzb");
  await page.click(".qmenu button:has-text('Pomodoro on this')");
  await expect(page.locator("#pomoPage")).toBeVisible();
  await expect(page.locator("#pomoPage .pm-k")).toHaveText("Focus · pomodoro 1 of 4");
  await expect(page.locator("#pomoPage .pm-sub")).toContainText("CS");
  await page.click("#pmOk");
  await page.click("#quests .q:has-text('Thesis') .pzb");
  await expect(page.locator(".qmenu button:has-text('Pomodoro on this')")).toHaveCount(0);
});

test("a schedule block's footer starts a pomodoro on its quest", async ({ page }) => {
  const days = { [T]: { q: Q, sched: [{ id: "x", q: "th", f: 600, t: 660 }] } };
  await openApp(page, { cfg: { quests: Q }, days, now: `${T}T10:05:00-05:00` });
  await page.click("#schBtn");
  await page.click(".sch-b[data-sb='x']");
  await page.click("#schPomo");
  await expect(page.locator("#schPage")).toBeHidden();
  await expect(page.locator("#pomoPage")).toBeVisible();
  await expect(page.locator("#pomoPage .pm-sub")).toContainText("Thesis");
});

test("interruptions are tallied on the running card, kept on the record and averaged in Trends", async ({ page }) => {
  await openApp(page, { cfg: { quests: Q, addTrends: true }, now: `${T}T10:00:00-05:00` });
  await openPm(page);
  await page.click("[data-pm=start]");
  await expect(page.locator("[data-pm=int]")).toHaveText("+ Interrupted");
  await page.click("[data-pm=int]");
  await page.click("[data-pm=int]");
  await expect(page.locator("[data-pm=int]")).toHaveText("+ Interrupted (2)");
  await page.clock.fastForward(25 * 60000 + 1500);
  await expect(page.locator("#pomoPage .pm-k")).toHaveText("Short break");
  expect((await day(page)).pomo[0].i).toBe(2);
  await expect(page.locator(".pm-list li em")).toHaveText("25m · 2 interrupts");
  await page.click("#pmOk");
  await page.goto("http://127.0.0.1:4173/index.html#trends");
  await expect(page.locator(".pm-tile", { hasText: "Interruptions" }).locator(".tt-v")).toHaveText("2");
  await expect(page.locator(".pm-tile", { hasText: "Interruptions" }).locator(".tt-s")).toHaveText("per pomodoro, 30 days");
});

test("the done notification carries action buttons: Skip break starts the next pomodoro, End session ends it", async ({ page }) => {
  await page.addInitScript(() => {
    window.__ln = []; window.__acts = null;
    window.Capacitor = { isNativePlatform: () => true, getPlatform: () => "android", Plugins: {
      LocalNotifications: { requestPermissions: () => Promise.resolve({ display: "granted" }), registerActionTypes: (o) => { window.__acts = o.types.map((t) => [t.id, t.actions.map((a) => a.id)]); return Promise.resolve(); }, createChannel: () => Promise.resolve(), getPending: () => Promise.resolve({ notifications: [] }), cancel: () => Promise.resolve(), schedule: (o) => { o.notifications.forEach((n) => window.__ln.push({ id: n.id, act: n.actionTypeId || null })); return Promise.resolve(); }, addListener: (n, cb) => { if (n === "localNotificationActionPerformed") window.__tap = cb; return Promise.resolve({}); }, removeDeliveredNotifications: () => Promise.resolve() },
      App: { addListener: () => Promise.resolve({}) }
    } };
  });
  await openApp(page, { cfg: { quests: Q, nf: { on: true, timer: true } }, now: `${T}T10:00:00-05:00` });
  await openPm(page);
  await page.click("[data-pm=start]");
  await expect.poll(() => page.evaluate(() => window.__acts)).toEqual([["pc_pomo_done", ["next", "end"]], ["pc_pomo_brk", ["next", "end"]], ["pc_pomo_auto", ["end"]]]);
  await expect.poll(() => page.evaluate(() => window.__ln.filter((n) => n.id >= 1201 && n.id <= 1203).map((n) => [n.id, n.act]))).toEqual([[1201, "pc_pomo_done"], [1203, "pc_pomo_brk"]]);
  await page.clock.fastForward(25 * 60000 + 1500);
  await expect(page.locator("#pomoPage .pm-k")).toHaveText("Short break");
  await page.evaluate(() => window.__tap({ actionId: "next", notification: { id: 1201, extra: {} } }));
  await page.clock.runFor(700);
  await expect(page.locator("#pomoPage .pm-k")).toHaveText("Focus · pomodoro 2 of 4");
  await page.evaluate(() => window.__tap({ actionId: "end", notification: { id: 1201, extra: {} } }));
  await page.clock.runFor(700);
  await expect(page.locator("#pomoPage .pm-k")).toHaveText("1 today");
  expect((await state(page)).pomo).toBeNull();
});

test("the lengths are locked while a set is under way, and open again at a set boundary or in the long break", async ({ page }) => {
  await openApp(page, { cfg: { quests: Q, pomo: { w: 15, b: 3, l: 10, every: 2 } }, now: `${T}T10:00:00-05:00` });
  await openPm(page);
  await expect(page.locator("select[data-pk=w]")).toBeEnabled();
  await page.click("[data-pm=start]");
  await page.click(".pm-set summary");
  await expect(page.locator("select[data-pk=w]")).toBeDisabled();
  await expect(page.locator(".pm-lock")).toHaveText("Locked until this set ends · 2 of 2 to go");
  await page.evaluate(() => { const s = document.querySelector("select[data-pk=w]"); s.value = "50"; s.dispatchEvent(new Event("change", { bubbles: true })); });
  expect((await state(page)).cfg.pomo.w).toBe(15);
  await page.click("[data-pm=auto]");
  expect((await state(page)).cfg.pomo.auto).toBe(true);
  await page.click("[data-pm=auto]");
  await page.clock.fastForward(15 * 60000 + 1500);
  await expect(page.locator("#pomoPage .pm-k")).toHaveText("Short break");
  await page.click("[data-pm=end]");
  await expect(page.locator("#pomoPage .pm-k")).toHaveText("1 today");
  await expect(page.locator(".pm-set")).toHaveAttribute("open", "");
  await expect(page.locator("select[data-pk=w]")).toBeDisabled();
  await expect(page.locator(".pm-lock")).toContainText("1 of 2 to go");
  await page.click("[data-pm=start]");
  await page.clock.fastForward(15 * 60000 + 1500);
  await expect(page.locator("#pomoPage .pm-k")).toHaveText("Long break");
  await page.click(".pm-set summary");
  await expect(page.locator("select[data-pk=w]")).toBeEnabled();
  await page.selectOption("select[data-pk=w]", "25");
  expect((await state(page)).cfg.pomo.w).toBe(25);
});

test("the tab title counts the pomodoro down and comes back when it ends", async ({ page }) => {
  await openApp(page, { cfg: { quests: Q }, now: `${T}T10:00:00-05:00` });
  const t0 = await page.title();
  await openPm(page);
  await page.click("[data-pm=start]");
  await page.clock.runFor(1500);
  await expect.poll(() => page.title()).toMatch(/^24:5\d · /);
  await page.click("#pmOk");
  await page.clock.fastForward(25 * 60000 + 1500);
  await page.clock.runFor(1200);
  await expect.poll(() => page.title()).toMatch(/^Break [45]:\d\d · /);
  await openPm(page);
  await page.click("[data-pm=end]");
  await page.clock.runFor(1200);
  await expect.poll(() => page.title()).toBe(t0);
});

test("End set early takes back every pomodoro of the unfinished set: minutes, sessions, topic time, schedule blocks", async ({ page }) => {
  const SJ = [{ id: "s1", name: "Maths", topics: [{ id: "a", name: "Algebra", p: 2, hist: [] }] }];
  const QT = [{ id: "th", type: "time", label: "Thesis", min: 90, addedOn: "2026-10-01", topics: ["a"], subjs: ["s1"], subj: "s1" }];
  const days = { [T]: { q: QT, th: 40, tt: { a: 40 }, sess: [{ id: "th", s: at(8, 0), e: at(8, 40), m: 40 }], sched: [{ id: "x", q: "th", f: 780, t: 840 }] } };
  await openApp(page, { cfg: { quests: QT, subjects: SJ, pomo: { w: 15, b: 3, l: 10, every: 4 } }, days, now: `${T}T10:00:00-05:00` });
  await openPm(page);
  await page.click("[data-pm=start]");
  await page.clock.fastForward(15 * 60000 + 1500);
  await page.click("[data-pm=skip]");
  await page.click("[data-pm=start]");
  await page.clock.fastForward(15 * 60000 + 1500);
  await expect(page.locator("#pomoPage .pm-k")).toHaveText("Short break");
  let e = await day(page);
  expect(e.th).toBe(70);
  expect(e.tt.a).toBe(70);
  expect(e.sess.length).toBe(3);
  expect(e.sched.filter((b) => b.pm).length).toBe(2);
  expect(e.pomo.length).toBe(2);
  await page.click("[data-pm=skip]");
  await page.click("[data-pm=start]");
  await page.clock.runFor(3 * 60000);
  await page.click(".pm-set summary");
  await expect(page.locator(".pm-row", { hasText: "End the set early" })).toContainText("3 pomodoros");
  await page.click("[data-pm=endset]");
  await expect(page.locator("[data-pm=endset]")).toHaveText("Wipe set?");
  await page.click("[data-pm=endset]");
  await expect(page.locator("#pomoPage .pm-k")).toHaveText("Ready");
  await expect(page.locator("#sync")).toContainText("2 pomodoros taken back");
  e = await day(page);
  expect(e.th).toBe(40);
  expect(e.tt).toEqual({ a: 40 });
  expect(e.sess.map((s) => s.m)).toEqual([40]);
  expect(e.sched.map((b) => b.id)).toEqual(["x"]);
  expect(e.pomo).toBeUndefined();
  expect((await state(page)).pomo).toBeNull();
  await expect(page.locator("select[data-pk=w]")).toBeEnabled();
  await expect(page.locator("#pmSum")).toHaveText("None today · 0 this week");
});

test("tapping the live notification while a pomodoro runs opens the Pomodoro page", async ({ page }) => {
  await page.addInitScript(`window.__taps=["live"];window.Capacitor={isNativePlatform:()=>true,Plugins:{
    FocusNotify:{show:()=>Promise.resolve({}),hide:()=>Promise.resolve(),takeTap:()=>Promise.resolve({tap:window.__taps.shift()||null})},
    LocalNotifications:{requestPermissions:()=>Promise.resolve({display:'granted'}),createChannel:()=>Promise.resolve(),getPending:()=>Promise.resolve({notifications:[]}),cancel:()=>Promise.resolve(),schedule:()=>Promise.resolve(),addListener:()=>Promise.resolve({}),removeDeliveredNotifications:()=>Promise.resolve()},
    App:{addListener:()=>Promise.resolve({})},KeepAwake:{keepAwake:()=>Promise.resolve(),allowSleep:()=>Promise.resolve()}}};`);
  await page.addInitScript((s) => { if (!localStorage.getItem("pc-cache-v1")) localStorage.setItem("pc-cache-v1", s); }, JSON.stringify({ days: {}, cfg: { quests: Q, rules: [], idleGrove: 0, start: "2026-10-01T04:00:00.000Z", updated: "2026-10-01T10:00:00Z", nf: { on: true, timer: true } }, pomo: { q: "th", label: "Thesis", topic: null, phase: "work", start: at(9, 59), end: at(10, 24), n: 0, paused: null, pausedTotal: 0, ints: 0, w: 25, b: 5, l: 15, every: 4, auto: false } }));
  await openApp(page, { cfg: { quests: Q, nf: { on: true, timer: true } }, now: `${T}T10:00:00-05:00` });
  await expect(page.locator("#pomoPage")).toBeVisible();
  await expect(page.locator("#pomoPage .pm-k")).toContainText("Focus");
  await expect(page.locator("#gModal")).toBeHidden();
});

test("a pomodoro whose interval ended while the app was closed is finished on launch without breaking startup", async ({ page }) => {
  await page.addInitScript((s) => { if (!localStorage.getItem("pc-cache-v1")) localStorage.setItem("pc-cache-v1", s); }, JSON.stringify({ days: {}, cfg: { quests: Q, rules: [], idleGrove: 0, start: "2026-10-01T04:00:00.000Z", updated: "2026-10-01T10:00:00Z" }, pomo: { q: "th", label: "Thesis", topic: null, phase: "work", start: at(9, 20), end: at(9, 45), n: 0, paused: null, pausedTotal: 0, ints: 0, w: 25, b: 5, l: 15, every: 4, auto: false } }));
  const errors = await openApp(page, { cfg: { quests: Q }, now: `${T}T10:00:00-05:00`, hash: "#pomodoro" });
  await expect(page.locator("#splash")).toBeHidden();
  await expect(page.locator("#pomoPage")).toBeVisible();
  await expect(page.locator("#pomoPage .pm-k")).toHaveText("Break over");
  const e = await day(page);
  expect(e.th).toBe(25);
  expect(e.pomo.length).toBe(1);
  expect(e.sched.filter((b) => b.pm).length).toBe(1);
  await page.click("#pmOk");
  await expect(page.locator("#quests .q").first()).toBeVisible();
  await expect(page.locator("#mainnav")).toBeVisible();
  expect(errors).toEqual([]);
});

