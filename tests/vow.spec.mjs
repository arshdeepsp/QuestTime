import { test, expect } from "@playwright/test";
import { openApp } from "./helpers.mjs";

const Q = [
  { id: "cs", type: "time", label: "CS work", min: 60 },
  { id: "j", type: "check", label: "Journal" }
];
const RULES = [
  { title: "Rest", motto: "", blocks: [{ h: "Sleep", t: "fact: 11:00 pm | bed\n8 hours, every day." }, { h: "Midday rest", t: "45 min, no devices." }] },
  { title: "Focus", motto: "", blocks: [{ h: "", t: "untitled block is skipped" }, { h: "The line", t: "+ Work within a quest\nx Streaming" }, { h: "Before starting", t: "Does it serve a lane?" }, { h: "Fifth rule", t: "Never shown" }] }
];
const VOW = [{ from: "2026-10-20" }];
const store = (page) => page.evaluate(() => JSON.parse(localStorage.getItem("pc-cache-v1")));
const rows = (page) => page.locator("#quests .q:visible .lbl");

test("turning on Morning promise asks for a start day; tomorrow by default leaves today unchanged", async ({ page }) => {
  await openApp(page, { cfg: { quests: Q, rules: RULES } });
  await page.click("#setBtn");
  await page.click("[data-st='quests']");
  await expect(page.locator("#setVow")).toHaveAttribute("aria-checked", "false");
  await page.click("#setVow");
  await expect(page.locator("#vowFrom")).toHaveValue("2026-11-03");
  await expect(page.locator("#vowFrom")).toHaveAttribute("min", "2026-11-02");
  await page.click("#vowGo");
  await expect(page.locator("#setVow")).toHaveAttribute("aria-checked", "true");
  await expect(page.locator(".srow", { hasText: "Morning promise" })).toContainText("Starts tomorrow");
  expect((await store(page)).cfg.vow).toEqual([{ from: "2026-11-03" }]);
  await page.goto("http://127.0.0.1:4173/index.html#today");
  await expect(page.locator("#vowNote")).toBeHidden();
  await expect(rows(page)).toHaveText(["CS work", "Journal"]);
});

test("starting today puts the rule quests on today's list at once", async ({ page }) => {
  await openApp(page, { cfg: { quests: Q, rules: RULES } });
  await page.click("#setBtn");
  await page.click("[data-st='quests']");
  await page.click("#setVow");
  await page.fill("#vowFrom", "2026-11-02");
  await page.click("#vowGo");
  await expect(page.locator("#sync")).toContainText("starts today");
  expect((await store(page)).cfg.vow).toEqual([{ from: "2026-11-02" }]);
  await page.goto("http://127.0.0.1:4173/index.html#today");
  await expect(page.locator("#vowNote")).toBeVisible();
  await expect(rows(page)).toHaveText(["Sleep", "Midday rest", "The line", "Before starting"]);
});

test("a later start day is kept and shown; Cancel changes nothing", async ({ page }) => {
  await openApp(page, { cfg: { quests: Q, rules: RULES } });
  await page.click("#setBtn");
  await page.click("[data-st='quests']");
  await page.click("#setVow");
  await page.click("#vowNo");
  expect((await store(page)).cfg.vow).toBeUndefined();
  await expect(page.locator("#setVow")).toHaveAttribute("aria-checked", "false");
  await page.click("#setVow");
  await page.fill("#vowFrom", "2026-11-09");
  await page.click("#vowGo");
  await expect(page.locator("#setVow")).toHaveAttribute("aria-checked", "true");
  await expect(page.locator(".srow", { hasText: "Morning promise" })).toContainText("Starts");
  expect((await store(page)).cfg.vow).toEqual([{ from: "2026-11-09" }]);
  await page.click("#setVow");
  expect((await store(page)).cfg.vow).toBeUndefined();
});

test("the first four rules open the day; other quests show once all are ticked", async ({ page }) => {
  await openApp(page, { cfg: { quests: Q, rules: RULES, vow: VOW } });
  await expect(page.locator("#vowNote")).toBeVisible();
  await expect(rows(page)).toHaveText(["Sleep", "Midday rest", "The line", "Before starting"]);
  await expect(page.locator("#sparkBar")).toBeHidden();
  await expect(page.locator("#quests .q", { hasText: "Sleep" }).locator(".vowt")).toHaveText("11:00 pm, bed · 8 hours, every day.");
  for (const l of ["Sleep", "Midday rest", "The line", "Before starting"]) await page.locator("#quests .q", { hasText: l }).locator(".sw").click();
  await expect(page.locator("#vowNote")).toBeHidden();
  await expect(page.locator("#quests .q:visible", { hasText: "CS work" })).toHaveCount(1);
  await expect(page.locator("#quests .q.vowq:visible")).toHaveCount(0);
  await page.locator("#quests .q", { hasText: "Journal" }).locator(".sw").click();
  await expect(page.locator("#doneSep")).toContainText("Done today (1)");
  const e = (await store(page)).days["2026-11-02"];
  const ids = e.q.filter((q) => q.vow).map((q) => q.id);
  expect(ids.length).toBe(4);
  expect(ids.every((id) => e[id] === true)).toBe(true);

});

test("rule quests are required: an unticked promise keeps the day from clearing", async ({ page }) => {
  await openApp(page, { cfg: { quests: [{ id: "j", type: "check", label: "Journal" }], rules: RULES.slice(0, 1), vow: VOW }, days: { "2026-11-02": { j: true } } });
  await expect(rows(page)).toHaveText(["Sleep", "Midday rest"]);
  await expect(page.locator("#qCount")).not.toHaveText(/3\/3/);
  await page.locator("#quests .q", { hasText: "Sleep" }).locator(".sw").click();
  await page.locator("#quests .q", { hasText: "Midday rest" }).locator(".sw").click();
  await expect(page.locator("#vowNote")).toBeHidden();
  await expect(page.locator("#qCount")).toHaveText(/3\/3/);
});

test("turning it off ends after today; today keeps its promise", async ({ page }) => {
  await openApp(page, { cfg: { quests: Q, rules: RULES, vow: VOW } });
  await page.click("#setBtn");
  await page.click("[data-st='quests']");
  await page.click("#setVow");
  await expect(page.locator(".srow", { hasText: "Morning promise" })).toContainText("Ends after today");
  expect((await store(page)).cfg.vow).toEqual([{ from: "2026-10-20", to: "2026-11-03" }]);
  await page.click("#setVow");
  await page.click("#vowGo");
  expect((await store(page)).cfg.vow).toEqual([{ from: "2026-10-20" }]);
  await page.goto("http://127.0.0.1:4173/index.html#today");
  await expect(page.locator("#vowNote")).toBeVisible();
});

test("with no rules in the Rulebook nothing is gated", async ({ page }) => {
  await openApp(page, { cfg: { quests: Q, rules: [], vow: VOW } });
  await expect(page.locator("#vowNote")).toBeHidden();
  await expect(rows(page)).toHaveText(["CS work", "Journal"]);
});

const mock = `window.__ln=[];window.__del=[];window.Capacitor={isNativePlatform:()=>true,Plugins:{
  FocusNotify:{show:()=>Promise.resolve({}),hide:()=>Promise.resolve(),takeTap:()=>Promise.resolve({tap:null})},
  LocalNotifications:{requestPermissions:()=>Promise.resolve({display:'granted'}),createChannel:()=>Promise.resolve(),getPending:()=>Promise.resolve({notifications:[]}),cancel:()=>Promise.resolve(),removeDeliveredNotifications:(o)=>{window.__del.push(o.notifications.map(n=>n.id));return Promise.resolve()},schedule:(o)=>{window.__ln=o.notifications.map(n=>({id:n.id,at:n.schedule.at.getTime(),ongoing:n.ongoing,title:n.title}));return Promise.resolve()},addListener:()=>Promise.resolve({})},
  App:{addListener:()=>Promise.resolve({})},KeepAwake:{keepAwake:()=>Promise.resolve(),allowSleep:()=>Promise.resolve()}}};`;

test("an ongoing reminder 15 minutes after waking repeats every 5 minutes until the rules are ticked", async ({ page }) => {
  await page.addInitScript(mock);
  await openApp(page, { now: "2026-11-02T06:00:00-05:00", cfg: { quests: Q, rules: RULES, vow: VOW, nf: { on: true }, day: { wake: "07:00", bed: "23:00" } } });
  await page.clock.runFor(1500);
  const vow = (page) => page.evaluate(() => window.__ln.filter((n) => n.id >= 2700 && n.id < 2770));
  await expect.poll(async () => (await vow(page)).length).toBeGreaterThan(4);
  const today = (await vow(page)).filter((n) => n.at < Date.parse("2026-11-02T12:00:00-05:00")).sort((a, b) => a.at - b.at);
  expect(today.map((n) => new Date(n.at).toISOString())).toEqual(["2026-11-02T12:15:00.000Z", "2026-11-02T12:20:00.000Z", "2026-11-02T12:25:00.000Z", "2026-11-02T12:30:00.000Z"]);
  expect(today.every((n) => n.ongoing)).toBe(true);
  for (const l of ["Sleep", "Midday rest", "The line", "Before starting"]) await page.locator("#quests .q", { hasText: l }).locator(".sw").click();
  await page.clock.runFor(1500);
  await expect.poll(async () => (await vow(page)).filter((n) => n.at < Date.parse("2026-11-02T12:00:00-05:00")).length).toBe(0);
  const del = await page.evaluate(() => window.__del.at(-1));
  expect(today.every((n) => del.includes(n.id))).toBe(true);
});
