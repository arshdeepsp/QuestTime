import { test, expect } from "@playwright/test";
import { openApp } from "./helpers.mjs";

const Q = [{ id: "th", type: "time", label: "Thesis", min: 90, addedOn: "2026-10-01" }, { id: "cs", type: "time", label: "CS", min: 30, addedOn: "2026-10-01" }, { id: "gym", type: "check", label: "Gym", addedOn: "2026-10-01" }];
const T = "2026-11-02";
const state = (page) => page.evaluate(() => JSON.parse(localStorage.getItem("pc-cache-v1")));
const day = async (page) => (await state(page)).days[T] || {};
/* Type a length into Set up and commit it (a number input saves on change: Enter or leaving the field). */
/* Long break comes: press − / + on Set up's counter until it reads n ("never" = 0). */
const evOf = async (page) => { const t = await page.locator(".pm-set > .pm-rows .pm-ev").textContent(); return t === "never" ? 0 : +t.replace("every ", ""); };
const setEvery = async (page, n) => { for (let i = 0; i < 20; i++) { const v = await evOf(page); if (v === n) return; await page.click(`.pm-set > .pm-rows [data-pm=ev][data-d="${v < n ? 1 : -1}"]`); } };
const evUp = (page) => page.locator('.pm-set > .pm-rows [data-pm=ev][data-d="1"]');
const setNum = async (page, k, v) => { const i = page.locator(`input[data-pk=${k}]`); await i.fill(String(v)); await i.blur(); };
/* Jump to just past the running pomodoro's end ("end") or its break's end ("bend"), measured from the page's clock now.
   A fixed jump drifts: the fake clock also runs in real time, and a transition caught more than PM_LATE_MS (5 s) late is
   applied silently, so on a loaded machine the beep a sound test waits for never played. */
const ffTo = async (page, k, pad = 1000) => {
  const ms = await page.evaluate((k) => JSON.parse(localStorage.getItem("pc-cache-v1")).pomo[k] - Date.now(), k);
  await page.clock.fastForward(Math.max(0, ms) + pad);
};
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
  for (const [k, lo, hi] of [["w", "15", "90"], ["b", "5", "30"], ["l", "10", "60"]]) {
    await expect(page.locator(`input[data-pk=${k}]`)).toHaveAttribute("min", lo);
    await expect(page.locator(`input[data-pk=${k}]`)).toHaveAttribute("max", hi);
  }
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
  const errors = await openApp(page, { cfg: { quests: Q, pomo: { w: 15, b: 5, l: 10, every: 2 } }, now: `${T}T10:00:00-05:00` });
  await openPm(page);
  await expect(page.locator(".pm-set summary")).toContainText("15/5 · long 10 every 2");
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
  await expect(page.locator("#pomoPage .pm-k")).toHaveText("Set done");
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
  await setNum(page, "w", 50);
  await setEvery(page, 0);
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
  await ffTo(page, "end");
  await expect(page.locator("#pomoPage .pm-k")).toHaveText("Short break");
  await expect.poll(() => page.evaluate(() => window.__bp.length)).toBe(2);
  await expect.poll(() => chan(page, 1202)).toEqual(["pc_beep1"]);
  await ffTo(page, "bend");
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
  await ffTo(page, "end");
  await expect(page.locator("#pomoPage .pm-k")).toHaveText("Long break");
  await expect.poll(() => page.evaluate(() => window.__bp.length)).toBe(4);
  await page.click("[data-pm=skip]");
  await expect(page.locator("#pomoPage .pm-k")).toHaveText("Set done");
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
  await openApp(page, { cfg: { quests: Q, pomo: { w: 15, b: 5, l: 10, every: 2 } }, now: `${T}T10:00:00-05:00` });
  await openPm(page);
  await expect(page.locator("input[data-pk=w]")).toBeEnabled();
  await page.click("[data-pm=start]");
  await page.click(".pm-set summary");
  await expect(page.locator("input[data-pk=w]")).toBeDisabled();
  await expect(page.locator(".pm-lock")).toHaveText("Locked until this set ends · 2 of 2 to go");
  await page.evaluate(() => { const s = document.querySelector("input[data-pk=w]"); s.value = "50"; s.dispatchEvent(new Event("change", { bubbles: true })); });
  expect((await state(page)).cfg.pomo.w).toBe(15);
  await page.click("[data-pm=auto]");
  expect((await state(page)).cfg.pomo.auto).toBe(true);
  await page.click("[data-pm=auto]");
  await page.clock.fastForward(15 * 60000 + 1500);
  await expect(page.locator("#pomoPage .pm-k")).toHaveText("Short break");
  await page.click("[data-pm=end]");
  await expect(page.locator("#pomoPage .pm-k")).toHaveText("1 today");
  await expect(page.locator(".pm-set")).toHaveAttribute("open", "");
  await expect(page.locator("input[data-pk=w]")).toBeDisabled();
  await expect(page.locator(".pm-lock")).toContainText("1 of 2 to go");
  await page.click("[data-pm=start]");
  await page.clock.fastForward(15 * 60000 + 1500);
  await expect(page.locator("#pomoPage .pm-k")).toHaveText("Long break");
  await page.click(".pm-set summary");
  await expect(page.locator("input[data-pk=w]")).toBeEnabled();
  await setNum(page, "w", 25);
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
  await openApp(page, { cfg: { quests: QT, subjects: SJ, pomo: { w: 15, b: 5, l: 10, every: 4 } }, days, now: `${T}T10:00:00-05:00` });
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
  await page.clock.runFor(5 * 60000);
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
  await expect(page.locator("input[data-pk=w]")).toBeEnabled();
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


test("auto-start catches up after the app slept: the next pomodoro is back-dated to the break's end, and one already over is logged too", async ({ page }) => {
  await page.addInitScript((s) => { if (!localStorage.getItem("pc-cache-v1")) localStorage.setItem("pc-cache-v1", s); }, JSON.stringify({ days: {}, cfg: { quests: Q, rules: [], idleGrove: 0, pomo: { w: 25, b: 5, l: 15, every: 4, auto: true }, start: "2026-10-01T04:00:00.000Z", updated: "2026-10-01T10:00:00Z" }, pomo: { q: "th", label: "Thesis", topic: null, phase: "work", start: at(9, 0), end: at(9, 25), n: 0, paused: null, pausedTotal: 0, ints: 0, w: 25, b: 5, l: 15, every: 4, auto: true } }));
  /* asleep from 9:25 (first done) through 9:30 (break over → #2 starts) and 9:55 (#2 done) to 10:05: now in #2's break, 5 minutes in */
  const errors = await openApp(page, { cfg: { quests: Q }, now: `${T}T10:05:00-05:00`, hash: "#pomodoro" });
  await expect(page.locator("#pomoPage")).toBeVisible();
  const e = await day(page);
  expect(e.th).toBe(50);
  expect(e.pomo.map((r) => [r.s, r.e])).toEqual([[at(9, 0), at(9, 25)], [at(9, 30), at(9, 55)]]);
  const p = (await state(page)).pomo;
  expect(p.phase).toBe("work");
  expect(p.start).toBe(at(10, 0));
  expect(p.end).toBe(at(10, 25));
  expect(p.n).toBe(2);
  await expect(page.locator("#pomoPage .pm-k")).toHaveText("Focus · pomodoro 3 of 4");
  await expect(page.locator("#pomoPage .pm-time")).toHaveText(/^19:5\d$/);
  expect(errors).toEqual([]);
});

test("with auto-start on, the next pomodoros' reminders are scheduled ahead, and a tap on any of them opens the page", async ({ page }) => {
  await page.addInitScript(() => {
    window.__ln = [];
    window.Capacitor = { isNativePlatform: () => true, getPlatform: () => "android", Plugins: {
      LocalNotifications: { requestPermissions: () => Promise.resolve({ display: "granted" }), registerActionTypes: () => Promise.resolve(), createChannel: () => Promise.resolve(), getPending: () => Promise.resolve({ notifications: [] }), cancel: () => Promise.resolve(), schedule: (o) => { o.notifications.forEach((n) => window.__ln.push({ id: n.id, at: n.schedule.at.getTime(), ch: n.channelId, title: n.title })); return Promise.resolve(); }, addListener: (ev, fn) => { if (ev === "localNotificationActionPerformed") window.__tap = fn; return Promise.resolve({}); }, removeDeliveredNotifications: () => Promise.resolve() },
      App: { addListener: () => Promise.resolve({}) }
    } };
  });
  await openApp(page, { cfg: { quests: Q, nf: { on: true, timer: true }, pomo: { w: 25, b: 5, l: 15, every: 4, auto: true } }, now: `${T}T10:00:00-05:00` });
  await openPm(page);
  await page.click("[data-pm=start]");
  const ids = async () => page.evaluate(() => { const m = {}; window.__ln.forEach((n) => { if (n.id >= 1201 && n.id <= 1209) m[n.id] = n; }); return m; });
  await expect.poll(async () => Object.keys(await ids()).map(Number).sort()).toEqual([1201, 1203, 1204, 1205, 1206, 1207, 1208, 1209]);
  const m = await ids();
  /* the fake clock runs in real time after install, so the start is a few hundred ms past 10:00 */
  const near = (id, h, mi) => expect(Math.abs(m[id].at - at(h, mi)), String(id)).toBeLessThan(5000);
  near(1201, 10, 25);
  near(1203, 10, 30);
  near(1204, 10, 55);
  near(1205, 11, 0);
  near(1206, 11, 25);
  near(1207, 11, 30);
  near(1208, 11, 55);
  expect(m[1208].ch).toBe("pc_beep3");
  near(1209, 12, 10);
  expect(m[1204].ch).toBe("pc_beep2");
  await page.click("#pmOk");
  await expect(page.locator("#pomoPage")).toBeHidden();
  await page.evaluate(() => window.__tap({ notification: { id: 1206, extra: {} } }));
  await expect(page.locator("#pomoPage")).toBeVisible();
});

test("without auto-start only the current pomodoro's reminders are planned", async ({ page }) => {
  await page.addInitScript(() => {
    window.__ln = [];
    window.Capacitor = { isNativePlatform: () => true, getPlatform: () => "android", Plugins: {
      LocalNotifications: { requestPermissions: () => Promise.resolve({ display: "granted" }), registerActionTypes: () => Promise.resolve(), createChannel: () => Promise.resolve(), getPending: () => Promise.resolve({ notifications: [] }), cancel: () => Promise.resolve(), schedule: (o) => { o.notifications.forEach((n) => window.__ln.push(n.id)); return Promise.resolve(); }, addListener: () => Promise.resolve({}), removeDeliveredNotifications: () => Promise.resolve() },
      App: { addListener: () => Promise.resolve({}) }
    } };
  });
  await openApp(page, { cfg: { quests: Q, nf: { on: true, timer: true } }, now: `${T}T10:00:00-05:00` });
  await openPm(page);
  await page.click("[data-pm=start]");
  await expect.poll(() => page.evaluate(() => [...new Set(window.__ln.filter((i) => i >= 1201 && i <= 1209))].sort())).toEqual([1201, 1203]);
});

test("a finished set stays finished when the cadence changes: every 3 → 5 right after three doesn't lock, and End set has nothing to wipe", async ({ page }) => {
  await openApp(page, { cfg: { quests: Q, pomo: { w: 15, b: 5, l: 15, every: 3 } }, now: `${T}T10:00:00-05:00` });
  await openPm(page);
  for (let i = 0; i < 3; i++) {
    await page.click("[data-pm=start]");
    await page.clock.fastForward(15 * 60000 + 1500);
    await expect(page.locator("#pomoPage .pm-k")).toHaveText(i < 2 ? "Short break" : "Long break");
    await page.click("[data-pm=skip]");
    await expect(page.locator("#pomoPage .pm-k")).toHaveText(i < 2 ? "Break over" : "Set done");
  }
  await page.click("[data-pm=end]");
  await expect(page.locator("#pomoPage .pm-k")).toHaveText("3 today");
  const recs = (await day(page)).pomo;
  expect(recs.map((r) => !!r.c)).toEqual([false, false, true]);
  await expect(page.locator(".pm-set")).toHaveAttribute("open", "");
  await expect(evUp(page)).toBeEnabled();
  await setEvery(page, 5);
  expect((await state(page)).cfg.pomo.every).toBe(5);
  await expect(evUp(page)).toBeEnabled();
  await expect(page.locator(".pm-lock")).toHaveCount(0);
  await expect(page.locator("[data-pm=endset]")).toHaveCount(0);
  await page.click("[data-pm=start]");
  await expect(page.locator("#pomoPage .pm-k")).toHaveText("Focus · pomodoro 1 of 5");
  await page.click(".pm-set summary");
  await expect(page.locator(".pm-lock")).toHaveText("Locked until this set ends · 5 of 5 to go");
  await page.click("[data-pm=endset]");
  await page.click("[data-pm=endset]");
  await expect(page.locator("#pomoPage .pm-k")).toHaveText("3 today");
  expect((await day(page)).th).toBe(45);
});

test("auto-start stops at the end of a set: after the long break the card waits, and a new set starts only by hand", async ({ page }) => {
  await openApp(page, { cfg: { quests: Q, pomo: { w: 15, b: 5, l: 15, every: 2, auto: true, chain: true } }, now: `${T}T10:00:00-05:00` });
  await openPm(page);
  await page.click(".pm-set summary");
  /* the old "start the next set too" switch is gone, and a leftover chain: true from an older build does nothing */
  await expect(page.locator("[data-pm=chain]")).toHaveCount(0);
  await expect(page.locator(".pm-set")).toContainText("Start the next pomodoro when a short break ends");
  await page.click("[data-pm=start]");
  await page.clock.fastForward(15 * 60000 + 1500);
  await expect(page.locator("#pomoPage .pm-k")).toHaveText("Short break");
  await page.clock.fastForward(5 * 60000 + 1500);
  await expect(page.locator("#pomoPage .pm-k")).toHaveText("Focus · pomodoro 2 of 2");
  await page.clock.fastForward(15 * 60000 + 1500);
  await expect(page.locator("#pomoPage .pm-k")).toHaveText("Long break");
  await page.clock.fastForward(15 * 60000 + 1500);
  await expect(page.locator("#pomoPage .pm-k")).toHaveText("Set done");
  await page.clock.fastForward(30 * 60000);
  await expect(page.locator("#pomoPage .pm-k")).toHaveText("Set done");
  await expect(page.locator("[data-pm=start]:visible")).toHaveText("Start a new set");
  expect((await state(page)).pomo.phase).toBe("break");
  expect((await state(page)).cfg.pomo.chain).toBeUndefined();
  await page.click("[data-pm=start]:visible");
  await expect(page.locator("#pomoPage .pm-k")).toHaveText("Focus · pomodoro 1 of 2");
  expect((await day(page)).pomo.length).toBe(2);
});

test("with auto-start the reminders ahead stop at the set's end, and the last one says the set is done", async ({ page }) => {
  await page.addInitScript(() => {
    window.__ln = [];
    window.Capacitor = { isNativePlatform: () => true, getPlatform: () => "android", Plugins: {
      LocalNotifications: { requestPermissions: () => Promise.resolve({ display: "granted" }), registerActionTypes: () => Promise.resolve(), createChannel: () => Promise.resolve(), getPending: () => Promise.resolve({ notifications: [] }), cancel: () => Promise.resolve(), schedule: (o) => { o.notifications.forEach((n) => window.__ln.push({ id: n.id, title: n.title, body: n.body, act: n.actionTypeId })); return Promise.resolve(); }, addListener: () => Promise.resolve({}), removeDeliveredNotifications: () => Promise.resolve() },
      App: { addListener: () => Promise.resolve({}) }
    } };
  });
  await openApp(page, { cfg: { quests: Q, nf: { on: true, timer: true }, pomo: { w: 25, b: 5, l: 15, every: 2, auto: true } }, now: `${T}T10:00:00-05:00` });
  await openPm(page);
  await page.click("[data-pm=start]");
  const ids = async () => page.evaluate(() => { const m = {}; window.__ln.forEach((n) => { if (n.id >= 1201 && n.id <= 1209) m[n.id] = n; }); return m; });
  await expect.poll(async () => Object.keys(await ids()).map(Number).sort()).toEqual([1201, 1203, 1204, 1205]);
  const m = await ids();
  expect(m[1203].body).toBe("The next pomodoro has started.");
  expect(m[1205].title).toBe("Set done");
  expect(m[1205].body).toBe("Tap to start a new set.");
  expect(m[1205].act).toBe("pc_pomo_brk");
});

test("the tally shows the current set: a finished set shows full, and a new set with more pomodoros starts empty", async ({ page }) => {
  await openApp(page, { cfg: { quests: Q, pomo: { w: 15, b: 5, l: 15, every: 3 } }, now: `${T}T10:00:00-05:00` });
  await openPm(page);
  const lit = page.locator(".pm-tally .tomato:not(.dim)"), all = page.locator(".pm-tally .tomato");
  for (let i = 0; i < 3; i++) {
    await page.click("[data-pm=start]");
    await page.clock.fastForward(15 * 60000 + 1500);
    if (i < 2) await page.click("[data-pm=skip]");
  }
  await expect(page.locator("#pomoPage .pm-k")).toHaveText("Long break");
  await expect(lit).toHaveCount(3);
  await expect(all).toHaveCount(3);
  await expect(page.locator(".pm-tally")).toHaveAttribute("aria-label", "Set of 3 done · 3 today");
  await page.click(".pm-set summary");
  await setEvery(page, 5);
  await expect(lit).toHaveCount(3);
  await page.click("[data-pm=skip]");
  await expect(page.locator("#pomoPage .pm-k")).toHaveText("Set done");
  await page.click("[data-pm=start]:visible");
  await expect(page.locator("#pomoPage .pm-k")).toHaveText("Focus · pomodoro 1 of 5");
  await expect(lit).toHaveCount(0);
  await expect(all).toHaveCount(5);
  await expect(page.locator(".pm-tally")).toHaveAttribute("aria-label", "0 of 5 in this set · 3 today");
  await page.clock.fastForward(15 * 60000 + 1500);
  await expect(page.locator("#pomoPage .pm-k")).toHaveText("Short break");
  await expect(lit).toHaveCount(1);
  await expect(all).toHaveCount(5);
  await page.click("[data-pm=end]");
  await expect(lit).toHaveCount(1);
});

test("after a finished set and End session, a bigger cadence shows an empty set, not the day's pomodoros", async ({ page }) => {
  const done = Array.from({ length: 3 }, (_, i) => ({ q: "th", s: at(8, i * 30), e: at(8, i * 30 + 25), m: 25, ok: true, ...(i === 2 ? { c: 1 } : {}) }));
  await openApp(page, { cfg: { quests: Q, pomo: { every: 5 } }, days: { [T]: { q: Q, th: 75, pomo: done } }, now: `${T}T10:00:00-05:00` });
  await openPm(page);
  await expect(page.locator("#pomoPage .pm-k")).toHaveText("3 today");
  await expect(page.locator(".pm-tally .tomato:not(.dim)")).toHaveCount(0);
  await expect(page.locator(".pm-tally .tomato")).toHaveCount(5);
});

test("in the set-done state a changed cadence takes effect on the new set: every 2 → 4 then Start a new set is pomodoro 1 of 4", async ({ page }) => {
  await openApp(page, { cfg: { quests: Q, pomo: { w: 15, b: 5, l: 15, every: 2 } }, now: `${T}T10:00:00-05:00` });
  await openPm(page);
  for (let i = 0; i < 2; i++) {
    await page.click("[data-pm=start]");
    await page.clock.fastForward(15 * 60000 + 1500);
    if (i === 0) { await page.click("[data-pm=skip]"); }
  }
  await expect(page.locator("#pomoPage .pm-k")).toHaveText("Long break");
  await page.click(".pm-set summary");
  await expect(evUp(page)).toBeEnabled();
  await setEvery(page, 4);
  await page.click("[data-pm=skip]");
  await expect(page.locator("#pomoPage .pm-k")).toHaveText("Set done");
  await page.click("[data-pm=start]:visible");
  await expect(page.locator("#pomoPage .pm-k")).toHaveText("Focus · pomodoro 1 of 4");
  await page.click(".pm-set summary");
  await expect(page.locator(".pm-lock")).toHaveText("Locked until this set ends · 4 of 4 to go");
});

test("the Set up selects survive the once-a-second redraw during the long break (only the countdown is rewritten)", async ({ page }) => {
  await openApp(page, { cfg: { quests: Q, pomo: { w: 15, b: 5, l: 15, every: 1 } }, now: `${T}T10:00:00-05:00` });
  await openPm(page);
  await page.click("[data-pm=start]");
  await page.clock.fastForward(15 * 60000 + 1500);
  await expect(page.locator("#pomoPage .pm-k")).toHaveText("Long break");
  await page.click(".pm-set summary");
  await expect(page.locator("input[data-pk=w]")).toBeEnabled();
  await page.evaluate(() => { window.__sel = document.querySelector("input[data-pk=w]"); });
  const t0 = await page.locator("#pomoPage .pm-time").textContent();
  await page.clock.runFor(2500);
  expect(await page.locator("#pomoPage .pm-time").textContent()).not.toBe(t0);
  expect(await page.evaluate(() => window.__sel === document.querySelector("input[data-pk=w]"))).toBe(true);
  await expect(page.locator(".pm-set")).toHaveAttribute("open", "");
});

test("a reminder tap that lands before the catch-up tick still sees the finished pomodoro: End session on 'done' keeps it logged", async ({ page }) => {
  await page.addInitScript(() => {
    window.Capacitor = { isNativePlatform: () => true, getPlatform: () => "android", Plugins: {
      LocalNotifications: { requestPermissions: () => Promise.resolve({ display: "granted" }), registerActionTypes: () => Promise.resolve(), createChannel: () => Promise.resolve(), getPending: () => Promise.resolve({ notifications: [] }), cancel: () => Promise.resolve(), schedule: () => Promise.resolve(), addListener: (ev, fn) => { if (ev === "localNotificationActionPerformed") window.__tap = fn; return Promise.resolve({}); }, removeDeliveredNotifications: () => Promise.resolve() },
      App: { addListener: () => Promise.resolve({}) }
    } };
  });
  await page.addInitScript((s) => { if (!localStorage.getItem("pc-cache-v1")) localStorage.setItem("pc-cache-v1", s); }, JSON.stringify({ days: {}, cfg: { quests: Q, rules: [], idleGrove: 0, nf: { on: true, timer: true }, start: "2026-10-01T04:00:00.000Z", updated: "2026-10-01T10:00:00Z" }, pomo: { q: "th", label: "Thesis", topic: null, phase: "work", start: at(9, 20), end: at(9, 45), n: 0, paused: null, pausedTotal: 0, ints: 0, w: 25, b: 5, l: 15, every: 4, auto: false } }));
  await openApp(page, { cfg: { quests: Q }, now: `${T}T09:50:00-05:00` });
  await page.evaluate(() => window.__tap({ notification: { id: 1201, extra: {} }, actionId: "end" }));
  await expect(page.locator("#pomoPage")).toBeVisible();
  await expect(page.locator("#pomoPage .pm-k")).toHaveText("1 today");
  expect((await day(page)).th).toBe(25);
  expect((await state(page)).pomo).toBeNull();
});

test("a timer started right after a pomodoro on the same quest keeps its own session, so End set can still take the pomodoro back exactly", async ({ page }) => {
  await openApp(page, { cfg: { quests: Q, pomo: { w: 15, b: 5, l: 15, every: 4 } }, now: `${T}T10:00:00-05:00` });
  await openPm(page);
  await page.click("[data-pm=start]");
  await page.clock.fastForward(15 * 60000 + 1500);
  await expect(page.locator("#pomoPage .pm-k")).toHaveText("Short break");
  await page.click("[data-pm=end]");
  await page.click("#pmOk");
  await page.locator("#quests .q", { hasText: "Thesis" }).locator(".tmr, .qplay").first().click();
  await page.clock.fastForward(5 * 60000 + 500);
  await page.click("#quests .q.running .tmr, #quests .q.running .qplay");
  await expect(page.locator("#quests .q.running")).toHaveCount(0);
  const e = await day(page);
  expect(e.sess.length).toBe(2);
  expect(e.sess[0].a).toBe(1);
  expect(e.th).toBe(20);
  await openPm(page);
  await expect(page.locator(".pm-set")).toHaveAttribute("open", "");
  await page.click("[data-pm=endset]");
  await page.click("[data-pm=endset]");
  const e2 = await day(page);
  expect(e2.th).toBe(5);
  expect((e2.sess || []).length).toBe(1);
});

test("turning the long break on after pomodoros ran without sets settles them: every 0 → 4 with two done starts a fresh set", async ({ page }) => {
  await openApp(page, { cfg: { quests: Q, pomo: { w: 15, b: 5, l: 15, every: 0 } }, now: `${T}T10:00:00-05:00` });
  await openPm(page);
  for (let i = 0; i < 2; i++) {
    await page.click("[data-pm=start]");
    await page.clock.fastForward(15 * 60000 + 1500);
    await page.click("[data-pm=skip]");
  }
  await page.click("[data-pm=end]");
  await expect(page.locator("#pomoPage .pm-k")).toHaveText("2 today");
  await setEvery(page, 4);
  await expect(evUp(page)).toBeEnabled();
  await expect(page.locator(".pm-lock")).toHaveCount(0);
  expect((await day(page)).pomo.map((r) => !!r.c)).toEqual([false, true]);
  await page.click("[data-pm=start]");
  await expect(page.locator("#pomoPage .pm-k")).toHaveText("Focus · pomodoro 1 of 4");
});

test("lengths are any whole minutes in their range: typed values outside it are pulled back in", async ({ page }) => {
  await openApp(page, { cfg: { quests: Q } });
  await openPm(page);
  await setNum(page, "w", 37);
  await setNum(page, "b", 3);
  await setNum(page, "l", 75);
  expect((await state(page)).cfg.pomo).toMatchObject({ w: 37, b: 5, l: 60 });
  await expect(page.locator("input[data-pk=b]")).toHaveValue("5");
  await expect(page.locator("input[data-pk=l]")).toHaveValue("60");
  await setNum(page, "w", 120);
  expect((await state(page)).cfg.pomo.w).toBe(90);
  await setNum(page, "w", 9);
  expect((await state(page)).cfg.pomo.w).toBe(15);
  /* an empty field changes nothing */
  await setNum(page, "w", "");
  expect((await state(page)).cfg.pomo.w).toBe(15);
  await expect(page.locator(".pm-set summary")).toContainText("15/5 · long 60 every 4");
  await expect(page.locator("[data-pm=start]")).toHaveText("Start 15-min pomodoro");
});

test("a setting from an older build or another device outside the ranges is clamped when used", async ({ page }) => {
  await openApp(page, { cfg: { quests: Q } });
  await page.evaluate(() => { const S = JSON.parse(localStorage.getItem("pc-cache-v1")); S.cfg.pomo = { w: 10, b: 3, l: 90, every: 2 }; localStorage.setItem("pc-cache-v1", JSON.stringify(S)); });
  await page.reload();
  await openPm(page);
  await expect(page.locator(".pm-set summary")).toContainText("15/5 · long 60 every 2");
  await page.click("[data-pm=start]");
  const p = (await state(page)).pomo;
  expect([p.w, p.b, p.l]).toEqual([15, 5, 60]);
  expect(p.end - p.start).toBe(15 * 60000);
});

test("presets: save up to four (named or not), apply with a tap, delete with an armed ✕; they wait while a set is under way", async ({ page }) => {
  await openApp(page, { cfg: { quests: Q, pomo: { w: 25, b: 5, l: 15, every: 4 } }, now: `${T}T10:00:00-05:00` });
  await openPm(page);
  const chips = page.locator(".pm-pchip [data-pm=preset]");
  await expect(chips).toHaveCount(0);
  await page.fill("#pmPName", "Classic");
  await page.click("[data-pm=psave]");
  await expect(chips).toHaveText(["Classic"]);
  await expect(page.locator(".pm-pchip.on")).toHaveCount(1);
  /* the current settings are saved already: no Save until something changes */
  await expect(page.locator("[data-pm=psave]")).toHaveCount(0);
  await setNum(page, "w", 50);
  await setNum(page, "b", 10);
  await setEvery(page, 2);
  await page.click("[data-pm=psave]");
  await setNum(page, "w", 90);
  await setNum(page, "b", 30);
  await page.click("[data-pm=psave]");
  await setNum(page, "w", 15);
  await page.click("[data-pm=psave]");
  await expect(chips).toHaveText(["Classic", "50/10 · 15 ×2", "90/30 · 15 ×2", "15/30 · 15 ×2"]);
  /* four is the most: no Save */
  await setNum(page, "w", 20);
  await expect(page.locator("[data-pm=psave]")).toHaveCount(0);
  expect((await state(page)).cfg.pomo.presets.length).toBe(4);
  /* tap one: all four settings at once */
  await chips.filter({ hasText: "50/10" }).click();
  expect((await state(page)).cfg.pomo).toMatchObject({ w: 50, b: 10, l: 15, every: 2 });
  await expect(page.locator(".pm-pchip.on [data-pm=preset]")).toHaveText("50/10 · 15 ×2");
  await expect(page.locator("[data-pm=start]")).toHaveText("Start 50-min pomodoro");
  /* delete lives in the preset's editor (Edit) and is armed: first tap asks, second removes */
  await page.locator(".pm-pchip", { hasText: "90/30" }).locator("[data-pm=pedit]").click();
  const del = page.locator(".pm-ped [data-pm=pdel]");
  await del.click();
  await expect(del).toHaveText("Delete?");
  await del.click();
  await expect(page.locator(".pm-ped")).toHaveCount(0);
  await expect(chips).toHaveText(["Classic", "50/10 · 15 ×2", "15/30 · 15 ×2"]);
  /* while a set is under way the others can't be applied (the lit one stays as it is) */
  await page.click("[data-pm=start]");
  await page.click(".pm-set summary");
  await expect(chips.filter({ hasText: "Classic" })).toBeDisabled();
  await page.evaluate(() => document.querySelector(".pm-pchip [data-pm=preset]").click());
  expect((await state(page)).cfg.pomo.w).toBe(50);
});

test("a preset is edited from its Edit button: name, lengths and long break; saving changes the preset, not the current settings", async ({ page }) => {
  await openApp(page, { cfg: { quests: Q, pomo: { w: 25, b: 5, l: 15, every: 4, presets: [{ id: "p1", name: "Classic", w: 25, b: 5, l: 15, every: 4 }, { id: "p2", w: 50, b: 10, l: 20, every: 2 }] } }, now: `${T}T10:00:00-05:00` });
  await openPm(page);
  await page.click(".pm-pchip:has-text('Classic') [data-pm=pedit]");
  const ed = page.locator(".pm-ped");
  await expect(ed.locator("input[data-pe=name]")).toHaveValue("Classic");
  await expect(ed.locator("input[data-pe=w]")).toHaveValue("25");
  await expect(ed.locator(".pm-ev")).toHaveText("every 4");
  await ed.locator("input[data-pe=name]").fill("Deep work");
  await ed.locator("input[data-pe=name]").blur();
  await ed.locator("input[data-pe=w]").fill("52");
  await ed.locator("input[data-pe=w]").blur();
  await ed.locator("input[data-pe=b]").fill("2");
  await ed.locator("input[data-pe=b]").blur();
  await expect(ed.locator("input[data-pe=b]")).toHaveValue("5");
  for (let i = 0; i < 3; i++) await ed.locator('[data-pm=pev][data-d="-1"]').click();
  await expect(ed.locator(".pm-ev")).toHaveText("every 1");
  /* nothing is saved until Save, and a redraw keeps the draft */
  expect((await state(page)).cfg.pomo.presets[0].w).toBe(25);
  await ed.locator("[data-pm=pesave]").click();
  await expect(page.locator(".pm-ped")).toHaveCount(0);
  const c = (await state(page)).cfg.pomo;
  expect(c.presets[0]).toEqual({ id: "p1", name: "Deep work", w: 52, b: 5, l: 15, every: 1 });
  expect(c.presets[1]).toEqual({ id: "p2", w: 50, b: 10, l: 20, every: 2 });
  /* the current settings didn't move; the edited preset applies on a tap */
  expect([c.w, c.b, c.l, c.every]).toEqual([25, 5, 15, 4]);
  await page.click(".pm-pchip:has-text('Deep work') [data-pm=preset]");
  expect((await state(page)).cfg.pomo).toMatchObject({ w: 52, b: 5, l: 15, every: 1 });
  /* clearing the name falls back to the values; Cancel drops a draft */
  await page.click(".pm-pchip:has-text('50/10') [data-pm=pedit]");
  await page.locator(".pm-ped input[data-pe=w]").fill("60");
  await page.locator(".pm-ped input[data-pe=w]").blur();
  await page.click(".pm-ped [data-pm=pecancel]");
  expect((await state(page)).cfg.pomo.presets[1].w).toBe(50);
  /* a preset can be edited while a set is under way (only applying waits) */
  await page.click("[data-pm=start]");
  await page.click(".pm-set summary");
  await page.click(".pm-pchip:has-text('50/10') [data-pm=pedit]");
  await page.locator(".pm-ped input[data-pe=name]").fill("Long");
  await page.locator(".pm-ped input[data-pe=name]").blur();
  await page.click(".pm-ped [data-pm=pesave]");
  expect((await state(page)).cfg.pomo.presets[1].name).toBe("Long");
});

test("long break comes is a − / + counter from never to every 12, held while a set is under way", async ({ page }) => {
  await openApp(page, { cfg: { quests: Q, pomo: { w: 25, b: 5, l: 15, every: 10 } }, now: `${T}T10:00:00-05:00` });
  await openPm(page);
  const ev = page.locator(".pm-set > .pm-rows .pm-ev");
  await expect(ev).toHaveText("every 10");
  await evUp(page).click();
  await evUp(page).click();
  await expect(ev).toHaveText("every 12");
  await expect(evUp(page)).toBeDisabled();
  expect((await state(page)).cfg.pomo.every).toBe(12);
  await setEvery(page, 0);
  await expect(ev).toHaveText("never");
  await expect(page.locator('.pm-set > .pm-rows [data-pm=ev][data-d="-1"]')).toBeDisabled();
  await setEvery(page, 7);
  expect((await state(page)).cfg.pomo.every).toBe(7);
  await page.click("[data-pm=start]");
  await expect(page.locator("#pomoPage .pm-k")).toHaveText("Focus · pomodoro 1 of 7");
  await page.click(".pm-set summary");
  await expect(evUp(page)).toBeDisabled();
  await expect(page.locator('.pm-set > .pm-rows [data-pm=ev][data-d="-1"]')).toBeDisabled();
});
