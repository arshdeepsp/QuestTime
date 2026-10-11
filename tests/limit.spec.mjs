import { test, expect } from "@playwright/test";
import { openApp } from "./helpers.mjs";

const RD = { id: "rd", type: "time", label: "Reading", min: 30, lim: 60 };
const FR = { id: "fr", type: "time", label: "French", min: 30, roll: 300, lim: 90 };
const store = (page) => page.evaluate(() => JSON.parse(localStorage.getItem("pc-cache-v1")));
const seedTimer = (page, timer, days = {}, extra = {}) => page.addInitScript((s) => { if (!localStorage.getItem("pc-cache-v1")) localStorage.setItem("pc-cache-v1", s); },
  JSON.stringify({ days, cfg: { quests: [RD, FR], rules: [], idleGrove: 0, start: "2026-10-01T04:00:00.000Z", updated: "2026-10-01T10:00:00Z", ...extra }, timer }));

test("the row says how far a limited quest goes, and +/- and tap-to-type stop at the limit", async ({ page }) => {
  await openApp(page, { cfg: { quests: [RD] }, days: { "2026-11-02": { rd: 55, q: [RD] } }, extra: { "pc-doneopen": "1" } });
  await expect(page.locator("#quests .q .req")).toHaveText("min 30 min · up to 1 hour/day");
  await page.click("#quests .q .act button[aria-label^='More']");
  expect((await store(page)).days["2026-11-02"].rd).toBe(60);
  await page.click("#quests .q .act button[aria-label^='More']");
  expect((await store(page)).days["2026-11-02"].rd).toBe(60);
});

test("a running timer stops itself at the daily limit and logs exactly up to it", async ({ page }) => {
  await seedTimer(page, { id: "rd", label: "Reading", start: Date.parse("2026-11-02T08:00:00-05:00"), day: "2026-11-02" }, { "2026-11-02": { rd: 10, q: [RD, FR] } });
  await openApp(page, { now: "2026-11-02T08:40:00-05:00", cfg: { quests: [RD, FR] }, extra: { "pc-doneopen": "1" } });
  await expect(page.locator("#quests .q.running")).toHaveCount(1);
  await page.clock.runFor(9 * 60000);
  await expect(page.locator("#quests .q.running")).toHaveCount(1);
  await page.clock.runFor(2 * 60000);
  await expect(page.locator("#quests .q.running")).toHaveCount(0);
  await expect(page.locator("#toast .t1")).toHaveText("Time’s up");
  await expect(page.locator("#toast .t3")).toContainText("Daily limit of 1 hour reached");
  const s = await store(page);
  expect(s.timer).toBeNull();
  expect(s.days["2026-11-02"].rd).toBe(60);
  expect(s.days["2026-11-02"].sess.map((x) => x.m)).toEqual([50]);
});

test("a timer left running far past the limit is cut at the limit when the app opens; starting again is refused", async ({ page }) => {
  await seedTimer(page, { id: "fr", label: "French", start: Date.parse("2026-11-02T08:00:00-05:00"), day: "2026-11-02" });
  await openApp(page, { now: "2026-11-02T12:00:00-05:00", cfg: { quests: [RD, FR] }, extra: { "pc-doneopen": "1" } });
  await expect(page.locator("#quests .q.running")).toHaveCount(0);
  const s = await store(page);
  expect(s.days["2026-11-02"].fr).toBe(90);
  expect(s.days["2026-11-02"].sess[0].e - s.days["2026-11-02"].sess[0].s).toBe(90 * 60000);
  await page.click("#quests .q.t-time:has-text('French') .tmr");
  await expect(page.locator("#sync")).toContainText("Daily limit reached for French");
  expect((await store(page)).timer).toBeFalsy();
});

test("the limit is set in Edit quests and in the new-quest form, and can't be below the minimum", async ({ page }) => {
  await openApp(page, { cfg: { quests: [{ id: "rd", type: "time", label: "Reading", min: 30 }] } });
  await page.click("#hdrEdit");
  await page.click("#qmgr [data-tog='rd']");
  await page.click("#qmgr [data-more='rd']");
  await page.fill("#qmgr input[data-p=lim][data-i='0']", "20");
  await page.click("#mgrSaveTop");
  await expect(page.locator("#qmgr")).toBeVisible();
  await page.fill("#qmgr input[data-p=lim][data-i='0']", "120");
  await page.click("#mgrSaveTop");
  await expect.poll(async () => (await store(page)).cfg.quests[0].lim).toBe(120);
  await expect(page.locator("#quests .q .req")).toContainText("up to 2 hours/day");
  await page.click("#hdrAdd");
  await page.click("#aoQuest");
  await page.click("#nqBody .tcard[data-t='time']");
  await page.fill("#nqName", "Piano");
  await page.click("#nqMoreOpt");
  await page.fill("#nqBody input[data-n='lim']", "45");
  await page.click("#nqSave");
  await expect.poll(async () => (await store(page)).cfg.quests.map((q) => [q.label, q.lim])).toEqual([["Reading", 120], ["Piano", 45]]);
});

test("Time's up is scheduled on its own channel at the limit; tapping it stops and logs the timer", async ({ page }) => {
  await page.addInitScript(`window.__ln=[];window.Capacitor={isNativePlatform:()=>true,Plugins:{
    FocusNotify:{show:()=>Promise.resolve({}),hide:()=>Promise.resolve(),takeTap:()=>Promise.resolve({tap:null})},
    LocalNotifications:{requestPermissions:()=>Promise.resolve({display:'granted'}),createChannel:(c)=>{(window.__ch=window.__ch||[]).push(c);return Promise.resolve()},getPending:()=>Promise.resolve({notifications:[]}),cancel:()=>Promise.resolve(),schedule:(o)=>{o.notifications.forEach(n=>window.__ln.push({id:n.id,channelId:n.channelId,at:n.schedule.at.getTime?n.schedule.at.getTime():n.schedule.at,title:n.title}));return Promise.resolve()},addListener:(n,cb)=>{if(n==='localNotificationActionPerformed')window.__tap=cb;return Promise.resolve({})},removeDeliveredNotifications:()=>Promise.resolve()},
    App:{addListener:()=>Promise.resolve({})},KeepAwake:{keepAwake:()=>Promise.resolve(),allowSleep:()=>Promise.resolve()}}};`);
  await seedTimer(page, { id: "rd", label: "Reading", start: Date.parse("2026-11-02T08:00:00-05:00"), day: "2026-11-02" }, { "2026-11-02": { rd: 20, q: [RD, FR] } }, { nf: { on: true } });
  await openApp(page, { now: "2026-11-02T08:10:00-05:00", cfg: { quests: [RD, FR], nf: { on: true } } });
  await expect.poll(() => page.evaluate(() => window.__ln.filter((n) => n.id === 1004).map((n) => [n.channelId, new Date(n.at).toISOString()]))).toEqual([["pc_stop", "2026-11-02T13:40:00.000Z"]]);
  expect(await page.evaluate(() => (window.__ch || []).filter((c) => c.id === "pc_stop").map((c) => c.sound))).toEqual(["pc_stop.wav"]);
  await page.clock.setFixedTime(new Date("2026-11-02T08:45:00-05:00"));
  await page.evaluate(() => window.__tap({ notification: { id: 1004, extra: { q: "rd" } } }));
  await expect(page.locator("#quests .q.running")).toHaveCount(0);
  await expect(page.locator("#toast .t1")).toHaveText("Time’s up");
  await expect(page.locator("#sync")).toHaveText("Daily limit reached for Reading. Timer stopped and logged.");
  expect((await store(page)).days["2026-11-02"].rd).toBe(60);
});
