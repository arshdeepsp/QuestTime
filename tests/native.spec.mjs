import { test, expect } from "@playwright/test";
import { openApp } from "./helpers.mjs";

const mock = (fail) => `
window.__fn=[];window.__ln=[];
window.Capacitor={isNativePlatform:()=>true,Plugins:{
  FocusNotify:{show:(o)=>{window.__fn.push(o);return ${fail ? "Promise.reject(new Error('not implemented'))" : "Promise.resolve()"}},hide:()=>{window.__fn.push('hide');return Promise.resolve()}},
  LocalNotifications:{requestPermissions:()=>Promise.resolve({display:'granted'}),createChannel:()=>Promise.resolve(),getPending:()=>Promise.resolve({notifications:[]}),cancel:(o)=>{(o.notifications||[]).forEach(n=>window.__ln.push('x'+n.id));return Promise.resolve()},schedule:(o)=>{o.notifications.forEach(n=>window.__ln.push(n.id));return Promise.resolve()}},
  App:{addListener:()=>Promise.resolve({})},KeepAwake:{keepAwake:()=>Promise.resolve(),allowSleep:()=>Promise.resolve()}}};`;

const Q = [{ id: "cs", type: "time", label: "CS work", min: 60 }];

test("live timer: counts up for a timer, counts down for Just 5, hides on stop", async ({ page }) => {
  await page.addInitScript(mock(false));
  await openApp(page, { cfg: { quests: Q, nf: { on: true } } });
  await page.click("#quests .q .tmr");
  await page.clock.runFor(4000);
  let calls = await page.evaluate(() => window.__fn);
  const up = calls.filter((c) => c && c.title).pop();
  expect(up.title).toBe("Focusing: CS work");
  expect(up.chrono).toBe(true);
  expect(up.countdown).toBe(false);
  await page.click("#quests .q.running .tmr");
  await page.clock.runFor(4000);
  calls = await page.evaluate(() => window.__fn);
  expect(calls[calls.length - 1]).toBe("hide");
  await page.click("#sp5Btn");
  await page.clock.runFor(4000);
  calls = await page.evaluate(() => window.__fn);
  const down = calls.filter((c) => c && c.title).pop();
  expect(down.title).toBe("Just 5 minutes: CS work");
  expect(down.countdown).toBe(true);
});

test("falls back to a plain notification if the native plugin is missing", async ({ page }) => {
  await page.addInitScript(mock(true));
  await openApp(page, { cfg: { quests: Q, nf: { on: true } } });
  await page.click("#quests .q .tmr");
  await page.clock.runFor(4000);
  await page.waitForTimeout(200);
  expect(await page.evaluate(() => window.__ln)).toContain(900);
});

test("stopping a timer clears both the live and the fallback notification", async ({ page }) => {
  await page.addInitScript(mock(true));
  await openApp(page, { cfg: { quests: Q, nf: { on: true } } });
  await page.click("#quests .q .tmr");
  await page.clock.runFor(4000);
  await page.click("#quests .q.running .tmr");
  await page.clock.runFor(1000);
  const ln = await page.evaluate(() => window.__ln);
  expect(ln.lastIndexOf("x900")).toBeGreaterThan(ln.lastIndexOf(900));
  expect((await page.evaluate(() => window.__fn)).pop()).toBe("hide");
});

test("stop always hides, even if the app thinks nothing is showing", async ({ page }) => {
  await page.addInitScript(mock(false));
  await openApp(page, { cfg: { quests: Q, nf: { on: true } } });
  await page.click("#quests .q .tmr");
  await page.clock.runFor(4000);
  await page.evaluate(() => { window.__fn = []; });
  await page.click("#quests .q.running .tmr");
  await page.clock.runFor(4000);
  const calls = await page.evaluate(() => window.__fn);
  expect(calls).toContain("hide");
  expect(calls.filter((c) => c && c.title)).toEqual([]);
});

test("a leftover live notification is cleared when the app opens with no timer", async ({ page }) => {
  await page.addInitScript(mock(false));
  await openApp(page, { cfg: { quests: Q, nf: { on: true } } });
  await page.clock.runFor(1000);
  expect(await page.evaluate(() => window.__fn)).toContain("hide");
});

test("the live timer grows a sapling toward the quest's goal", async ({ page }) => {
  await page.addInitScript(mock(false));
  await openApp(page, { cfg: { quests: Q, nf: { on: true } }, days: { "2026-11-02": { q: Q, cs: 20 } } });
  await page.click("#quests .q .tmr");
  await page.clock.runFor(4000);
  const up = (await page.evaluate(() => window.__fn)).filter((c) => c && c.title).pop();
  const start = await page.evaluate(() => JSON.parse(localStorage.getItem("pc-cache-v1")).timer.start);
  expect(up.grow.dur).toBe(60 * 60000);
  expect(up.grow.from).toBe(start - 20 * 60000);
  expect(up.grow.art.length).toBe(7);
  expect(up.grow.art.every((a) => typeof a === "string" && a.length > 40)).toBe(true);
});

test("Just 5 grows over 5 minutes, then hands off to the full goal", async ({ page }) => {
  await page.addInitScript(mock(false));
  await openApp(page, { cfg: { quests: [{ id: "fr", type: "time", label: "French", min: 30, roll: 300, days: [1, 2, 3, 4, 5] }], nf: { on: true } } });
  await page.click("#sp5Btn");
  await page.clock.runFor(4000);
  const down = (await page.evaluate(() => window.__fn)).filter((c) => c && c.title).pop();
  expect(down.grow.dur).toBe(5 * 60000);
  expect(down.next.grow.dur).toBe(60 * 60000);
});

test("a sprint block grows over the block, and a paused block doesn't", async ({ page }) => {
  await page.addInitScript(mock(false));
  await openApp(page, { cfg: { quests: Q, nf: { on: true } } });
  await page.click("#toolsBtn");
  await page.click(".qmenu button:has-text('Sprint')");
  await page.selectOption("#spLen", "50");
  await page.click("#spGo");
  await page.clock.runFor(4000);
  let last = (await page.evaluate(() => window.__fn)).filter((c) => c && c.title).pop();
  expect(last.grow.dur).toBe(50 * 60000);
  await page.click("#spPause");
  await page.clock.runFor(4000);
  last = (await page.evaluate(() => window.__fn)).filter((c) => c && c.title).pop();
  expect(last.grow).toBeNull();
});

test("the live notification gets a pixel sky: day with dark text, night with light text", async ({ page }) => {
  await page.addInitScript(mock(false));
  await openApp(page, { cfg: { quests: Q, nf: { on: true } } });
  await page.click("#sp5Btn");
  await page.clock.runFor(4000);
  const day = (await page.evaluate(() => window.__fn)).filter((c) => c && c.title).pop();
  expect(day.bg.dark).toBe(false);
  expect(day.bg.big.length).toBeGreaterThan(40);
  expect(day.bg.small.length).toBeGreaterThan(40);
  expect(day.next.bg).toEqual(day.bg);
  const size = (b64) => page.evaluate((d) => new Promise((r) => { const i = new Image(); i.onload = () => r([i.width, i.height]); i.src = "data:image/png;base64," + d; }), b64);
  expect(await size(day.bg.big)).toEqual([96, 54]);
  expect(await size(day.bg.small)).toEqual([120, 16]);
});

test("at night the live notification uses the night sky", async ({ page }) => {
  await page.addInitScript(mock(false));
  await openApp(page, { now: "2026-11-02T21:30:00-05:00", cfg: { quests: Q, nf: { on: true } } });
  await page.click("#quests .q .tmr");
  await page.clock.runFor(4000);
  const up = (await page.evaluate(() => window.__fn)).filter((c) => c && c.title).pop();
  expect(up.bg.dark).toBe(true);
});

test("a pomodoro's live notification carries a filling tomato, one frame a minute, and a whole one through the break", async ({ page }) => {
  await page.addInitScript(mock(false));
  await openApp(page, { cfg: { quests: Q, nf: { on: true }, pomo: { w: 20, b: 5, l: 15, every: 4 } } });
  await page.click("#toolsBtn");
  await page.click(".qmenu button:has-text('Pomodoro')");
  await page.click("[data-pm=start]");
  await page.clock.runFor(4000);
  let last = (await page.evaluate(() => window.__fn)).filter((c) => c && c.title).pop();
  expect(last.title).toBe("Pomodoro: CS work");
  expect(last.bg.dark).toBe(true);
  expect(last.bg.big.length).toBeGreaterThan(40);
  expect(last.next.bg.big).toBe(last.bg.big);
  expect(last.grow.dur).toBe(20 * 60000);
  expect(last.grow.art.length).toBe(21);
  expect(last.grow.art[0]).not.toBe(last.grow.art[20]);
  expect(last.next.title).toBe("Short break");
  expect(last.next.grow.dur).toBe(5 * 60000);
  expect(last.next.grow.art.length).toBe(6);
  expect(new Set(last.next.grow.art).size).toBe(1);
  await page.click("[data-pm=pause]");
  await page.clock.runFor(4000);
  last = (await page.evaluate(() => window.__fn)).filter((c) => c && c.title).pop();
  expect(last.grow).toBeNull();
  await page.click("[data-pm=pause]");
  await page.clock.fastForward(20 * 60000 + 2000);
  await page.clock.runFor(4000);
  last = (await page.evaluate(() => window.__fn)).filter((c) => c && c.title).pop();
  expect(last.title).toBe("Short break");
  expect(last.grow.dur).toBe(5 * 60000);
  expect(last.grow.art.length).toBe(6);
});

test("with auto-start the pomodoro's live notification hands off through the break into the next pomodoro and its break", async ({ page }) => {
  await page.addInitScript(mock(false));
  await openApp(page, { cfg: { quests: Q, nf: { on: true }, pomo: { w: 20, b: 5, l: 15, every: 4, auto: true } } });
  await page.click("#toolsBtn");
  await page.click(".qmenu button:has-text('Pomodoro')");
  await page.click("[data-pm=start]");
  await page.clock.runFor(4000);
  const last = (await page.evaluate(() => window.__fn)).filter((c) => c && c.title).pop();
  const t0 = last.when;
  expect(last.next.title).toBe("Short break");
  expect(last.next.body).toBe("Next pomodoro when this reaches zero");
  expect(last.next.when).toBe(t0 + 5 * 60000);
  const p2 = last.next.next;
  expect(p2.title).toBe("Pomodoro: CS work");
  expect(p2.body).toBe("Pomodoro 2 of 4");
  expect(p2.countdown).toBe(true);
  expect(p2.when).toBe(t0 + 25 * 60000);
  expect(p2.grow.from).toBe(t0 + 5 * 60000);
  expect(p2.grow.art.length).toBe(21);
  expect(p2.bg.big).toBe(last.bg.big);
  expect(p2.next.title).toBe("Short break");
  expect(p2.next.next.title).toBe("Pomodoro: CS work");
  expect(p2.next.next.body).toBe("Pomodoro 3 of 4");
  expect(p2.next.next.next.next.title).toBe("Break over");
  expect(p2.next.next.next.next.chrono).toBe(false);
});
