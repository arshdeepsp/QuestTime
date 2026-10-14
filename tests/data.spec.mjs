import { test, expect } from "@playwright/test";
import { openApp } from "./helpers.mjs";
import { writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
/* Settings › <category>; a no-op when the hash already opened it (a reload comes back on #settings/<cat>). */
const openCat = async (page, id) => { const b = page.locator(`[data-st='${id}']`); if (await b.count()) await b.click(); };

const Q = [{ id: "cs", type: "time", label: "CS work", min: 60 }];

test("export then import round-trips data and stamps the schema", async ({ page }) => {
  await openApp(page, { cfg: { quests: Q }, days: { "2026-11-01": { cs: 75, q: Q, ended: true } } });
  await page.click("#setBtn");
  await openCat(page, "data");
  const dl = page.waitForEvent("download");
  await page.click("#setExp");
  const file = join(tmpdir(), "pc-backup.json");
  await (await dl).saveAs(file);
  const data = JSON.parse(readFileSync(file, "utf8"));
  expect(data.schema).toBe(22);
  expect(data.days["2026-11-01"].cs).toBe(75);
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.click("#setBtn");
  await openCat(page, "data");
  const chooser = page.waitForEvent("filechooser");
  await page.click("#setImp");
  await (await chooser).setFiles(file);
  await page.waitForTimeout(300);
  const cs = await page.evaluate(() => JSON.parse(localStorage.getItem("pc-cache-v1")).days["2026-11-01"].cs);
  expect(cs).toBe(75);
});

test("old schema-2 backups import and lose retired settings", async ({ page }) => {
  await openApp(page, { cfg: { quests: Q } });
  const file = join(tmpdir(), "pc-old.json");
  writeFileSync(file, JSON.stringify({ app: "personal-operating-playbook", version: 2, days: { "2026-10-30": { cs: 60, q: Q } }, refl: {}, cfg: { quests: Q, bank: true, updated: "2026-12-01T00:00:00Z" } }));
  await page.click("#setBtn");
  await openCat(page, "data");
  const chooser = page.waitForEvent("filechooser");
  await page.click("#setImp");
  await (await chooser).setFiles(file);
  await page.waitForTimeout(300);
  const st = await page.evaluate(() => JSON.parse(localStorage.getItem("pc-cache-v1")));
  expect(st.days["2026-10-30"].cs).toBe(60);
  expect(st.cfg.bank).toBeUndefined();
  expect(st.schema).toBe(22);
});

test("newer backups are refused", async ({ page }) => {
  await openApp(page, { cfg: { quests: Q } });
  const file = join(tmpdir(), "pc-new.json");
  writeFileSync(file, JSON.stringify({ app: "personal-operating-playbook", version: 2, schema: 99, days: {}, cfg: { quests: Q } }));
  await page.click("#setBtn");
  await openCat(page, "data");
  const chooser = page.waitForEvent("filechooser");
  await page.click("#setImp");
  await (await chooser).setFiles(file);
  await expect(page.locator("#sync")).toContainText("newer version");
});

test("schema 4: a one-block-per-quest schedule becomes a list of shots", async ({ page }) => {
  await openApp(page, { cfg: { quests: Q }, days: { "2026-11-02": { q: Q, sched: { cs: { f: 600, t: 660, j5: true } } } } });
  await page.click("#quests .q .act button[aria-label^='More']");
  await page.waitForTimeout(900);
  const st = await page.evaluate(() => JSON.parse(localStorage.getItem("pc-cache-v1")));
  expect(st.schema).toBe(22);
  expect(st.days["2026-11-02"].sched).toEqual([{ id: "b-cs", q: "cs", f: 600, t: 660, j5: true }]);
});

test("schema 5: an old Day ends at becomes the bedtime, so the day still locks at the same hour", async ({ page }) => {
  await openApp(page, { now: "2026-11-03T01:30:00-05:00", cfg: { quests: Q, dayEnd: 2, day: { wake: "07:00", bed: "23:00" } } });
  await page.waitForTimeout(300);
  await page.click("#quests .q .act button[aria-label^='More']");
  await page.waitForTimeout(900);
  const st = await page.evaluate(() => JSON.parse(localStorage.getItem("pc-cache-v1")));
  expect(st.cfg.dayEnd).toBeUndefined();
  expect(st.cfg.day).toEqual({ wake: "07:00", bed: "02:00" });
  expect(Object.keys(st.days).filter((k) => st.days[k].cs)).toEqual(["2026-11-02"]);
});

test("schema 6: the old ended flag is dropped, so an already-ended today can be edited again", async ({ page }) => {
  await openApp(page, { cfg: { quests: Q }, days: { "2026-11-01": { cs: 75, q: Q, ended: true, endedAt: "x" }, "2026-11-02": { cs: 10, q: Q, ended: true } } });
  await page.click("#quests .q .act button[aria-label^='More']");
  await page.waitForTimeout(900);
  const st = await page.evaluate(() => JSON.parse(localStorage.getItem("pc-cache-v1")));
  expect(st.days["2026-11-01"]).toEqual({ cs: 75, q: Q, ck: [] });
  expect(st.days["2026-11-02"].cs).toBe(20);
  expect(st.days["2026-11-02"].ended).toBeUndefined();
});

test("schema 7: subject links become topic links, keeping a quest's old default topic", async ({ page }) => {
  const SJ = [{ id: "s1", name: "CS", topics: [{ id: "t1", name: "A", p: 1 }, { id: "t2", name: "B", p: 1 }] }, { id: "s2", name: "Maths", topics: [{ id: "t3", name: "C", p: 1 }] }, { id: "s3", name: "Stats", topics: [] }];
  const Qs = [
    { id: "cs", type: "time", label: "CS", min: 60, subj: "s1", subjs: ["s1", "s2"] },
    { id: "rd", type: "time", label: "Reading", min: 30, subj: "s1", topic: "t2", fin: { t: "topic", lvl: 4 } },
    { id: "st", type: "time", label: "Stats", min: 30, subj: "s3" }
  ];
  await openApp(page, { cfg: { quests: Qs, subjects: SJ } });
  await page.click("#quests .q .act button[aria-label^='More']");
  await page.waitForTimeout(900);
  const st = await page.evaluate(() => JSON.parse(localStorage.getItem("pc-cache-v1")));
  expect(st.schema).toBe(22);
  const [cs, rd, sq] = st.cfg.quests;
  expect(cs).toMatchObject({ topics: ["t1", "t2", "t3"], subjs: ["s1", "s2"] });
  expect(rd).toMatchObject({ topics: ["t2"], subj: "s1", fin: { t: "topic", lvl: 4 } });
  expect(rd.topic).toBeUndefined();
  expect(sq.topics).toBeUndefined();
  expect(sq.subj).toBe("s3");
});

test("schema 9: custom achievements are dropped", async ({ page }) => {
  await openApp(page, { cfg: { quests: Q, customAch: [{ id: "a", title: "Mine", desc: "", icon: "star", kind: "streak", n: 10 }] } });
  await page.click("#quests .q .act button[aria-label^='More']");
  await page.waitForTimeout(900);
  const st = await page.evaluate(() => JSON.parse(localStorage.getItem("pc-cache-v1")));
  expect(st.schema).toBe(22);
  expect(st.cfg.customAch).toBeUndefined();
});

test("streak pause ranges are kept through a backup", async ({ page }) => {
  await openApp(page, { cfg: { quests: Q, noStreak: [{ from: "2026-10-20", to: "2026-10-25" }] } });
  await page.click("#setBtn");
  await openCat(page, "data");
  const dl = page.waitForEvent("download");
  await page.click("#setExp");
  const file = join(tmpdir(), "pc-backup-13.json");
  await (await dl).saveAs(file);
  const data = JSON.parse(readFileSync(file, "utf8"));
  expect(data.schema).toBe(22);
  expect(data.cfg.noStreak).toEqual([{ from: "2026-10-20", to: "2026-10-25" }]);
});

test("schema 15: the ignore list is kept through a backup", async ({ page }) => {
  await openApp(page, { cfg: { quests: Q, noStreak: [{ from: "2026-10-20" }], ignore: ["cs"] } });
  await page.click("#setBtn");
  await openCat(page, "data");
  const dl = page.waitForEvent("download");
  await page.click("#setExp");
  const file = join(tmpdir(), "pc-backup-15.json");
  await (await dl).saveAs(file);
  const data = JSON.parse(readFileSync(file, "utf8"));
  expect(data.schema).toBe(22);
  expect(data.cfg.ignore).toEqual(["cs"]);
});

test("schema 17 moves this device's look-and-feel choices into the settings, so they sync", async ({ page }) => {
  await openApp(page, { cfg: { quests: [{ id: "j", type: "check", label: "Journal" }] }, extra: { "pc-sfx": "off", "pc-focusview": "1", "pc-doneopen": "1", "pc-groveinfo": "0", "pc-sjfold": "[\"s1\"]" } });
  const st = await page.evaluate(() => JSON.parse(localStorage.getItem("pc-cache-v1")));
  expect(st.schema).toBe(22);
  expect(st.cfg.ui).toEqual({ sfx: false, focus: true, done: true, groveInfo: false, sjfold: ["s1"] });
  await expect(page.locator("#sndBtn")).toHaveText("SFX off");
  await expect(page.locator("body")).toHaveClass(/focusview/);
});

test("schema 18 drops leftovers of retired features: the bank, the old limit stamp and Top 3", async ({ page }) => {
  await openApp(page, { cfg: { quests: [{ id: "j", type: "check", label: "Journal" }], bank: false, capSet: "2026-10-20", cap: 6 }, days: { "2026-11-01": { j: true, top: [{ t: "call mum", d: true }] }, "2026-10-31": { top: [{ t: "", d: false }] } } });
  const st = await page.evaluate(() => JSON.parse(localStorage.getItem("pc-cache-v1")));
  expect(st.schema).toBe(22);
  expect("bank" in st.cfg).toBe(false);
  expect("capSet" in st.cfg).toBe(false);
  expect(st.cfg.cap).toBe(6);
  expect(st.days["2026-11-01"].j).toBe(true);
  expect("top" in st.days["2026-11-01"]).toBe(false);
  expect("top" in (st.days["2026-10-31"] || {})).toBe(false);
  await page.goto("http://127.0.0.1:4173/index.html#settings");
  await page.click("[data-st='quests']");
  await page.selectOption("#setCap", "5");
  expect("capSet" in (await page.evaluate(() => JSON.parse(localStorage.getItem("pc-cache-v1")))).cfg).toBe(false);
});

test("schema 19 renames the Nether theme to Ember and draws its ground", async ({ page }) => {
  await openApp(page, { cfg: { quests: [{ id: "j", type: "check", label: "Journal" }], theme: "nether" } });
  const st = await page.evaluate(() => JSON.parse(localStorage.getItem("pc-cache-v1")));
  expect(st.schema).toBe(22);
  expect(st.cfg.theme).toBe("ember");
  await expect(page.locator("#fx")).toHaveClass("ember");
  expect(await page.evaluate(() => getComputedStyle(document.body).backgroundImage)).toContain("data:image/svg+xml");
});

test("schema 20 keeps the Morning promise ranges (schema 21 too)", async ({ page }) => {
  await openApp(page, { cfg: { quests: [{ id: "j", type: "check", label: "Journal" }], vow: [{ from: "2026-10-20", to: "2026-11-03" }] } });
  const st = await page.evaluate(() => JSON.parse(localStorage.getItem("pc-cache-v1")));
  expect(st.schema).toBe(22);
  expect(st.cfg.vow).toEqual([{ from: "2026-10-20", to: "2026-11-03" }]);
});

test("schema 21 keeps a locked day's schedule", async ({ page }) => {
  const lock = [{ id: "a", q: "j", f: 600, t: 660 }];
  await openApp(page, { cfg: { quests: [{ id: "j", type: "time", label: "Journal", min: 30 }] }, days: { "2026-11-02": { schLock: lock, sched: lock } } });
  const st = await page.evaluate(() => JSON.parse(localStorage.getItem("pc-cache-v1")));
  expect(st.schema).toBe(22);
  expect(st.days["2026-11-02"].schLock).toEqual(lock);
});

test("schema 22 keeps a day's pomodoros, the pomodoro settings and a-posteriori schedule blocks", async ({ page }) => {
  const pomo = [{ q: "j", s: 1793631600000, e: 1793633100000, m: 25, ok: true }, { q: "j", s: 1793634000000, e: 1793634300000, m: 5, ok: false }];
  const sched = [{ id: "p1", q: "j", f: 600, t: 625, pm: true }];
  await openApp(page, { cfg: { quests: [{ id: "j", type: "time", label: "Journal", min: 30 }], pomo: { w: 50, b: 10, l: 20, every: 2, auto: true } }, days: { "2026-11-02": { pomo, sched } } });
  const st = await page.evaluate(() => JSON.parse(localStorage.getItem("pc-cache-v1")));
  expect(st.schema).toBe(22);
  expect(st.days["2026-11-02"].pomo).toEqual(pomo);
  expect(st.days["2026-11-02"].sched).toEqual(sched);
  expect(st.cfg.pomo).toEqual({ w: 50, b: 10, l: 20, every: 2, auto: true });
  expect(st.pomo).toBeNull();
});
