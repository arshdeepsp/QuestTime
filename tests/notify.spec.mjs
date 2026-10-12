import { test, expect } from "@playwright/test";
import { openApp, dayRange } from "./helpers.mjs";

const mock = (liveTap) => `window.__ln=[];window.__taps=${liveTap ? `["${liveTap}"]` : "[]"};window.Capacitor={isNativePlatform:()=>true,Plugins:{
  FocusNotify:{show:()=>Promise.resolve({}),hide:()=>Promise.resolve(),takeTap:()=>Promise.resolve({tap:window.__taps.shift()||null})},
  LocalNotifications:{requestPermissions:()=>Promise.resolve({display:'granted'}),createChannel:()=>Promise.resolve(),getPending:()=>Promise.resolve({notifications:[]}),cancel:()=>Promise.resolve(),schedule:(o)=>{o.notifications.forEach(n=>window.__ln.push({id:n.id,extra:n.extra}));return Promise.resolve()},addListener:(n,cb)=>{if(n==='localNotificationActionPerformed')window.__tap=cb;return Promise.resolve({})}},
  App:{addListener:()=>Promise.resolve({})},KeepAwake:{keepAwake:()=>Promise.resolve(),allowSleep:()=>Promise.resolve()}}};`;

const Q = [
  { id: "cs", type: "time", label: "CS work", min: 60 },
  { id: "fr", type: "time", label: "French", min: 30, roll: 300, days: [1, 2, 3, 4, 5] },
  { id: "j", type: "check", label: "Journal" }
];
const timer = { id: "cs", label: "CS work", start: Date.parse("2026-11-02T08:20:00-05:00"), day: "2026-11-02", minHit: true };

async function boot(page, { days = {}, cfg = {}, withTimer = false, live = null } = {}) {
  await page.addInitScript(mock(live));
  if (withTimer) {
    const state = { days, cfg: { quests: Q, rules: [], idleGrove: 0, start: "2026-10-01T04:00:00.000Z", updated: "2026-10-01T10:00:00Z", nf: { on: true }, ...cfg }, timer };
    await page.addInitScript((s) => { if (!localStorage.getItem("pc-cache-v1")) localStorage.setItem("pc-cache-v1", s); }, JSON.stringify(state));
  }
  await openApp(page, { cfg: { quests: Q, nf: { on: true }, ...cfg }, days });
}
const tap = (page, id, extra = {}) => page.evaluate(([id, extra]) => window.__tap({ notification: { id, extra } }), [id, extra]).then(() => page.clock.runFor(800));

test("minimum reached opens a prompt that can stop and log the timer", async ({ page }) => {
  await boot(page, { withTimer: true });
  await tap(page, 1001);
  await expect(page.locator("#gBody .mhead")).toHaveText("Minimum cleared!");
  await expect(page.locator("#gBody")).toContainText("40m this session");
  await page.click("#gBody [data-nb='0']");
  await expect(page.locator("#quests .q.running")).toHaveCount(0);
  await expect(page.locator("#quests .q", { hasText: "CS work" }).locator(".act output")).toHaveText("40m");
});

test("a timer prompt for a timer that already stopped just opens Today", async ({ page }) => {
  await boot(page);
  await tap(page, 1002);
  await expect(page.locator("#gModal")).toBeHidden();
  await expect(page.locator("#sync")).toContainText("already stopped");
});

test("tapping the live timer notification welcomes you back", async ({ page }) => {
  await boot(page, { withTimer: true, live: "live" });
  await page.clock.runFor(1500);
  await expect(page.locator("#gBody .mhead")).toHaveText("Welcome back. Still going.");
  await page.click("#gBody [data-nb='1']");
  await expect(page.locator("#quests .q.running")).toHaveCount(1);
});

test("evening check-in lists what's left and offers Just 5 on the furthest-behind quest", async ({ page }) => {
  await boot(page, { days: { "2026-11-02": { q: Q, cs: 50 } } });
  await tap(page, 2000);
  await expect(page.locator("#gTitle")).toHaveText("Evening check-in");
  await expect(page.locator("#gBody .mlist")).toContainText("CS work");
  await expect(page.locator("#gBody .mlist")).toContainText("Journal");
  await page.click("#gBody [data-nb='0']");
  await expect(page.locator("#quests .q.running")).toContainText("French");
});


test("streak at risk shows the streak at stake", async ({ page }) => {
  await boot(page);
  await tap(page, 2200);
  await expect(page.locator("#gTitle")).toHaveText("Streak at risk");
  await expect(page.locator("#gBody .mhead")).toContainText("streak is on the line");
});

test("midday and weekly checks show progress bars", async ({ page }) => {
  await boot(page, { days: { "2026-11-02": { q: Q, cs: 30, fr: 20 } } });
  await tap(page, 2500);
  await expect(page.locator("#gBody .nfrow")).toHaveText(["CS work30m / 1h"]);
  await page.click("#gClose");
  await tap(page, 2600);
  await expect(page.locator("#gBody .nfrow")).toHaveText(["French (a third by Wed)20m / 1h 40m"]);
});

test("deadline eve names the deadline and offers to plan today", async ({ page }) => {
  await boot(page, { cfg: { deadlines: [{ id: "d1", title: "Thesis draft", date: "2026-11-03" }] } });
  await page.clock.runFor(2000);
  const ln = await page.evaluate(() => window.__ln.filter((n) => n.id >= 3000 && n.id < 3500));
  expect(ln[0].extra).toMatchObject({ dl: "d1" });
  await tap(page, 3000, { dl: "d1" });
  await expect(page.locator("#gBody .mhead")).toHaveText("Tomorrow: Thesis draft");
  await page.click("#gBody [data-nb='0']");
  await expect(page.locator("#schPage")).toBeVisible();
});

test("open to-dos reminder opens the to-do review", async ({ page }) => {
  await boot(page, { cfg: { quests: [...Q, { id: "t", type: "todo", label: "Email advisor", addedOn: "2026-11-02" }] } });
  await tap(page, 2400);
  await expect(page.locator("#gTitle")).toHaveText("Still need these to-dos?");
});

test("review topics reminder lists the due topics", async ({ page }) => {
  await boot(page, { cfg: { subjects: [{ id: "s1", name: "Math", topics: [{ id: "t1", name: "Algebra", p: 2, hist: [], created: "2026-10-01" }] }] } });
  await tap(page, 4001);
  await expect(page.locator("#gBody")).toContainText("Math › Algebra");
});

const NOW = Date.parse("2026-11-02T09:00:00-05:00");
const calls = (page) => page.evaluate(() => (JSON.parse(localStorage.getItem("pc-cache-v1")).days["2026-11-02"] || {}).calls || 0);

test("starting from a fresh reminder answers the call for +10 XP", async ({ page }) => {
  await boot(page);
  await tap(page, 2000, { at: NOW - 30000 });
  await expect(page.locator("#gBody .nfxp")).toContainText("+10 XP");
  await page.click("#gBody [data-nb='0']");
  await expect(page.locator("#toast")).toContainText("Answered the call!");
  expect(await calls(page)).toBe(1);
  await expect(page.locator("#lvlText")).toHaveText("10 / 300 XP");
});

test("a reminder tapped too late gives no bonus", async ({ page }) => {
  await boot(page);
  await tap(page, 2000, { at: NOW - 5 * 60000 });
  await expect(page.locator("#gBody .nfxp")).toHaveCount(0);
  await page.click("#gBody [data-nb='0']");
  await page.clock.runFor(500);
  expect(await calls(page)).toBe(0);
});

test("a schedule start tapped on time answers the call", async ({ page }) => {
  await boot(page, { days: { "2026-11-02": { q: Q, sched: { cs: { f: 540, t: 600 } } } } });
  await tap(page, 3500, { at: NOW, sched: "cs" });
  await expect(page.locator("#quests .q.running")).toContainText("CS work");
  expect(await calls(page)).toBe(1);
});

test("the bonus is capped at 5 a day and needs a start, not just a tap", async ({ page }) => {
  await boot(page, { days: { "2026-11-02": { q: Q, calls: 5 } } });
  await tap(page, 2200, { at: NOW });
  await page.click("#gBody [data-nb='0']");
  await page.clock.runFor(500);
  expect(await calls(page)).toBe(5);
  await page.click("#quests .q.running .tmr");
  await tap(page, 2500, { at: NOW });
  await page.click("#gBody [data-nb='2']");
  await page.clock.runFor(500);
  expect(await calls(page)).toBe(5);
});

test("an answered call alone doesn't count as logging the day", async ({ page }) => {
  const RQ = [{ id: "cs", type: "time", label: "CS work", min: 60 }];
  const days = dayRange("2026-10-01", "2026-11-06", (k) => k <= "2026-11-02" ? { cs: 60, q: RQ } : { q: RQ, calls: 1 });
  await openApp(page, { now: "2026-11-07T09:00:00-05:00", cfg: { quests: RQ }, days });
  const marks = await page.evaluate(() => [...document.querySelectorAll("#strip i")].slice(-5, -1).map((i) => i.className));
  expect(marks).toEqual(["grace", "frozen", "miss", "miss"]);
});

test("a weekly total's timer celebrates today's share, not its leftover 30-minute minimum", async ({ page }) => {
  await page.addInitScript(mock(null));
  const TW = [{ id: "tw", type: "time", label: "Thesis Work", min: 30, roll: 1800, days: [1, 2, 3, 4], addedOn: "2026-10-01" }];
  const state = { days: {}, cfg: { quests: TW, rules: [], idleGrove: 0, start: "2026-10-01T04:00:00.000Z", updated: "2026-10-01T10:00:00Z", nf: { on: true } }, timer: { id: "tw", label: "Thesis Work", start: Date.parse("2026-11-02T08:20:00-05:00"), day: "2026-11-02" } };
  await page.addInitScript((s) => { if (!localStorage.getItem("pc-cache-v1")) localStorage.setItem("pc-cache-v1", s); }, JSON.stringify(state));
  await openApp(page, { cfg: { quests: TW, nf: { on: true } } });
  await page.clock.runFor(2000);
  await expect(page.locator("#sync")).not.toContainText("Minimum reached");
  await tap(page, 1001);
  await expect(page.locator("#gBody .mhead")).toHaveText("Today’s share done!");
  await expect(page.locator("#gBody")).toContainText("40m / 7h 30m");
});

test.describe("phone", () => {
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const PQ = [
    { id: "cs", type: "time", label: "CS work", min: 60 },
    { id: "st", type: "time", label: "Strength", min: 30, roll: 120, days: [0, 3, 5] },
    { id: "j", type: "check", label: "Journal" }
  ];
  for (const [what, id, logged] of [["Done today", "cs", { cs: 60 }], ["Off today", "st", {}]]) {
    test(`a timer started from a notification on a quest in ${what} shows its card at once`, async ({ page }) => {
      await page.addInitScript(mock(null));
      await openApp(page, { cfg: { quests: PQ, nf: { on: true } }, days: { "2026-11-02": { q: PQ, ...logged, sched: [{ id: "b1", q: id, f: 540, t: 600 }] } } });
      await tap(page, 3500, { sched: id });
      await expect(page.locator("#quests .q.running")).toBeVisible();
      await expect(page.locator("#quests .q.running .lbl")).toHaveText(PQ.find((q) => q.id === id).label);
    });
  }
});
