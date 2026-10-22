import { test, expect } from "@playwright/test";
import { openApp } from "./helpers.mjs";

const mock = `window.__ln=[];window.Capacitor={isNativePlatform:()=>true,Plugins:{
  FocusNotify:{show:()=>Promise.resolve({}),hide:()=>Promise.resolve(),takeTap:()=>Promise.resolve({tap:null})},
  LocalNotifications:{requestPermissions:()=>Promise.resolve({display:'granted'}),createChannel:()=>Promise.resolve(),getPending:()=>Promise.resolve({notifications:[]}),cancel:()=>Promise.resolve(),schedule:(o)=>{o.notifications.forEach(n=>window.__ln.push({id:n.id,title:n.title,body:n.body,extra:n.extra,at:new Date(n.schedule.at).toString()}));return Promise.resolve()},addListener:(n,cb)=>{if(n==='localNotificationActionPerformed')window.__tap=cb;return Promise.resolve({})}},
  App:{addListener:()=>Promise.resolve({})},KeepAwake:{keepAwake:()=>Promise.resolve(),allowSleep:()=>Promise.resolve()}}};`;

const Q = [
  { id: "cs", type: "time", label: "CS work", min: 60, rem: "18:00" },
  { id: "j", type: "check", label: "Journal", rem: "21:30" },
  { id: "lo", type: "time", label: "Reading log", min: 0, rem: "20:00" },
  { id: "w", type: "weekly", label: "Gym", min: 2, rem: "17:00" },
  { id: "fr", type: "time", label: "French", min: 30, roll: 300, days: [1, 2, 3, 4, 5], rem: "19:00" },
  { id: "n", type: "check", label: "No reminder" },
];
const ln = (page) => page.evaluate(() => window.__ln);
const tap = (page, id, extra = {}) =>
  page.evaluate(([id, extra]) => window.__tap({ notification: { id, extra } }), [id, extra]).then(() => page.clock.runFor(800));
const store = (page) => page.evaluate(() => JSON.parse(localStorage.getItem("pc-cache-v1")));

test("a quest's reminder is planned at its time on each day it's on the list, unless it's done", async ({ page }) => {
  await page.addInitScript(mock);
  await openApp(page, {
    cfg: { quests: Q, nf: { on: true } },
    days: { "2026-11-02": { cs: 20, j: true, q: Q }, "2026-10-27": { w: true }, "2026-11-01": {} },
  });
  await page.clock.runFor(2000);
  const L = await ln(page);
  const cs = L.find((x) => x.id === 4100);
  expect(cs.title).toBe("CS work isn’t done yet");
  expect(cs.body).toBe("20m of 1h so far.");
  expect(cs.at).toContain("18:00");
  expect(cs.extra.q).toBe("cs");
  expect(L.some((x) => x.id === 4101)).toBe(false);
  expect(L.find((x) => x.id === 4140 + 1).at).toContain("21:30");
  expect(L.some((x) => x.id >= 4100 && x.id < 4380 && x.extra.q === "lo")).toBe(false);
  expect(L.some((x) => x.id >= 4100 && x.id < 4380 && x.extra.q === "n")).toBe(false);
  expect(L.find((x) => x.id === 4103).body).toBe("0 of 2 days this week so far.");
  expect(L.find((x) => x.id === 4104).body).toBe("0m of 1h today so far.");
  expect(L.some((x) => x.id === 4100 + 5 * 40 + 4)).toBe(false);
});

test("a weekly quest whose week is made, or a running timer, stops today's reminder", async ({ page }) => {
  await page.addInitScript(mock);
  const state = {
    days: { "2026-11-02": { w: true, q: Q } },
    cfg: { quests: Q, rules: [], idleGrove: 0, start: "2026-10-01T04:00:00.000Z", updated: "2026-10-01T10:00:00Z", nf: { on: true } },
    timer: { id: "cs", label: "CS work", start: Date.parse("2026-11-02T08:50:00-05:00"), day: "2026-11-02" },
  };
  await page.addInitScript((s) => {
    if (!localStorage.getItem("pc-cache-v1")) localStorage.setItem("pc-cache-v1", s);
  }, JSON.stringify(state));
  await openApp(page, {});
  await page.clock.runFor(2000);
  const L = await ln(page);
  expect(L.some((x) => x.id === 4100)).toBe(false);
  expect(L.some((x) => x.id === 4103)).toBe(false);
  expect(L.some((x) => x.id === 4140)).toBe(true);
});

test("the Quest reminders switch turns them all off", async ({ page }) => {
  await page.addInitScript(mock);
  await openApp(page, { cfg: { quests: Q, nf: { on: true, qrem: false } } });
  await page.clock.runFor(2000);
  expect((await ln(page)).some((x) => x.id >= 4100 && x.id < 4380)).toBe(false);
});

test("the quest editor sets and clears the reminder under More options", async ({ page }) => {
  const P = [{ id: "cs", type: "time", label: "CS work", min: 60 }];
  await openApp(page, { cfg: { quests: P } });
  await page.click("#hdrEdit");
  await page.click("#qmgr [data-tog='cs']");
  await page.click("#qmgr [data-more='cs']");
  await expect(page.locator("#qmgr .moreb")).toContainText("Remind me if not done by");
  await expect(page.locator("#qmgr .moreb")).toContainText("Sent by the Android app");
  await page.fill("#qmgr input[data-p=rem]", "18:30");
  await page.click("#qmgr [data-more='cs']");
  await expect(page.locator("#qmgr [data-more='cs'] small")).toContainText("reminder 18:30");
  await page.click("#mgrSaveTop");
  await expect.poll(async () => (await store(page)).cfg.quests[0].rem).toBe("18:30");
  await page.click("#hdrEdit");
  await page.click("#qmgr [data-tog='cs']");
  await page.click("#qmgr [data-more='cs']");
  await page.fill("#qmgr input[data-p=rem]", "");
  await page.click("#mgrSaveTop");
  await expect.poll(async () => "rem" in (await store(page)).cfg.quests[0]).toBe(false);
});

test("the new-quest form takes a reminder; limits have none", async ({ page }) => {
  await openApp(page, { cfg: { quests: [] } });
  await page.click("#hdrAdd");
  await page.click("#aoQuest");
  await page.click("#nqMore");
  await page.click("#nqBody .tcard[data-t='limit']");
  await page.click("#nqMoreOpt");
  await expect(page.locator("#nqBody input[data-s=rem]")).toHaveCount(0);
  await page.click("#nqBody .tcard[data-t='check']");
  if ((await page.locator("#nqBody .moreb").count()) === 0) await page.click("#nqMoreOpt");
  await page.fill("#nqName", "Stretch");
  await page.fill("#nqBody input[data-s=rem]", "20:15");
  await page.click("#nqSave");
  await expect.poll(async () => (await store(page)).cfg.quests.map((q) => [q.label, q.rem])).toEqual([["Stretch", "20:15"]]);
});

test("tapping a quest reminder shows where it stands, with Just 5; once done it just says so", async ({ page }) => {
  await page.addInitScript(mock);
  await openApp(page, {
    now: "2026-11-02T18:00:30-05:00",
    cfg: { quests: Q, nf: { on: true } },
    days: { "2026-11-02": { cs: 20, j: true, q: Q } },
  });
  await tap(page, 4100, { q: "cs" });
  await expect(page.locator("#gBody .mhead")).toHaveText("CS work isn’t done yet.");
  await expect(page.locator("#gBody .nfrow b")).toHaveText("20m / 1h");
  await expect(page.locator("#gBody [data-nb='0']")).toHaveText("Just 5 on CS work");
  await page.click("#gBody [data-nb='1']");
  await tap(page, 4101, { q: "j" });
  await expect(page.locator("#gModal")).toBeHidden();
  await expect(page.locator("#sync")).toContainText("Journal is done for today.");
});
