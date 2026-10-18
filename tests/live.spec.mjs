import { test, expect as baseExpect } from "@playwright/test";
/* Moving a running pomodoro between two devices of one account (users/<uid>/data/live; sync/54-account.js). The other
   device is played by the fake cloud: __cloud.remote(path, doc) writes its live doc and returns the app to the front. */
const expect = baseExpect.configure({ timeout: 15000 });
import { openApp } from "./helpers.mjs";
import { fake } from "./fakecloud.mjs";

const CS = { id: "cs", type: "time", label: "Coursework", min: 60, addedOn: "2026-10-01" };
const T = "2026-11-02";
const LIVE = "users/u1/data/live";
const openCat = async (page, id) => { const b = page.locator(`[data-st='${id}']`); if (await b.count()) await b.click(); };
const store = (page) => page.evaluate(() => { const a = JSON.parse(localStorage.getItem("pc-account") || "null"); return JSON.parse(localStorage.getItem(a ? "pc-cache-u-" + a.uid : "pc-cache-v1")); });
const live = (page) => page.evaluate((p) => window.__cloud.docs[p] || null, LIVE);
async function reloadOn(page, fn) {
  await page.evaluate(() => { window.__pre = 1; });
  await fn();
  await expect.poll(async () => { try { return await page.evaluate(() => !window.__pre && document.readyState === "complete"); } catch (e) { return false; } }, { timeout: 10000 }).toBe(true);
}
async function signIn(page) {
  await page.goto("http://127.0.0.1:4173/index.html#settings");
  await openCat(page, "account");
  await page.click("#acOpen");
  await page.fill("#auEmail", "arsh@example.com");
  await page.fill("#auPw", "secret1");
  await reloadOn(page, () => page.click("#auGo"));
  await openCat(page, "account");
  await expect(page.locator(".srow", { has: page.locator("b", { hasText: /^Sync$/ }) })).toContainText("Up to date");
}
/* The other device's session: a 25-minute focus interval that started `ago` minutes ago. */
const remotePomo = (now, ago, extra = {}) => ({
  q: "cs", label: "Coursework", topic: null, phase: "work", start: now - ago * 60000, end: now + (25 - ago) * 60000,
  n: 0, paused: null, pausedTotal: 0, ints: 0, w: 25, b: 5, l: 15, every: 4, auto: false,
  sid: "sOther", gen: 1, dev: "dPhone", ...extra,
});
const remoteDoc = (pomo, extra = {}) => ({ pomo, dev: "dPhone", name: "phone", sid: pomo ? pomo.sid : "sOther", gen: pomo ? pomo.gen : 1, u: 1, ...extra });
/* Jump to just past the running session's end, measured from the page's clock (the fake clock also runs in real time). */
const ffEnd = async (page, k = "end") => {
  const ms = await page.evaluate((k) => { const a = JSON.parse(localStorage.getItem("pc-account")); return JSON.parse(localStorage.getItem("pc-cache-u-" + a.uid)).pomo[k] - Date.now(); }, k);
  await page.clock.fastForward(Math.max(0, ms) + 1000);
};
async function startHere(page) {
  await page.goto("http://127.0.0.1:4173/index.html#pomodoro");
  await page.click("[data-pm=start]");
  await expect(page.locator("#pomoPage .pm-k")).toHaveText("Focus · pomodoro 1 of 4");
  await expect.poll(async () => (await live(page)) && (await live(page)).pomo && (await live(page)).pomo.phase).toBe("work");
  return live(page);
}

test("a pomodoro running on the phone is offered here, and Continue here takes it over with its countdown and logs it once", async ({ page }) => {
  await page.addInitScript(fake);
  await openApp(page, { cfg: { quests: [CS], repFrozen: true } });
  await signIn(page);
  await page.goto("http://127.0.0.1:4173/index.html#today");
  const now = await page.evaluate(() => Date.now());
  await page.evaluate(([p, d]) => window.__cloud.remote(p, d), [LIVE, remoteDoc(remotePomo(now, 5))]);
  const card = page.locator("#liveCard .livecard");
  await expect(card).toContainText("Pomodoro running on your phone");
  await expect(card).toContainText("Focus on Coursework until");
  await expect(card).toContainText("pomodoro 1 of 4");
  await card.locator("[data-live=take]").click();
  await expect(page.locator("#pomoPage")).toBeVisible();
  await expect(page.locator("#pomoPage .pm-k")).toHaveText("Focus · pomodoro 1 of 4");
  const mine = await page.evaluate(() => localStorage.getItem("pc-dev"));
  await expect.poll(async () => { const d = await live(page); return d && [d.dev, d.gen, d.sid, d.pomo && d.pomo.end]; }).toEqual([mine, 2, "sOther", now + 20 * 60000]);
  await expect(page.locator("#liveCard .livecard")).toHaveCount(0);
  await ffEnd(page);
  await expect(page.locator("#pomoPage .pm-k")).toHaveText("Short break");
  const e = (await store(page)).days[T];
  expect(e.cs).toBe(25);
  expect(e.pomo.length).toBe(1);
  await expect.poll(async () => (await live(page)).pomo.phase).toBe("break");
});

test("a pomodoro started on the other device shows here while the app stays open, without a refresh or a return to the app", async ({ page }) => {
  await page.addInitScript(fake);
  await openApp(page, { cfg: { quests: [CS], repFrozen: true } });
  await signIn(page);
  await page.goto("http://127.0.0.1:4173/index.html#today");
  await expect(page.locator("#quests .q").first()).toBeVisible();
  const now = await page.evaluate(() => Date.now());
  await page.evaluate(([p, d]) => window.__cloud.push(p, d), [LIVE, remoteDoc(remotePomo(now, 1))]);
  await expect(page.locator("#liveCard .livecard")).toContainText("Pomodoro running on your phone");
  /* and when the phone ends it, the card goes */
  await page.evaluate(([p, d]) => window.__cloud.push(p, d), [LIVE, remoteDoc(null, { sid: "sOther", gen: 1 })]);
  await expect(page.locator("#liveCard .livecard")).toHaveCount(0);
});

test("on a phone the card's text has the whole width and the buttons sit on their own row", async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 360, height: 780 }, isMobile: true, hasTouch: true, timezoneId: "America/Toronto", serviceWorkers: "block" });
  const page = await ctx.newPage();
  await page.addInitScript(fake);
  await openApp(page, { cfg: { quests: [CS], repFrozen: true } });
  await signIn(page);
  await page.goto("http://127.0.0.1:4173/index.html#today");
  const now = await page.evaluate(() => Date.now());
  await page.evaluate(([p, d]) => window.__cloud.push(p, d), [LIVE, remoteDoc(remotePomo(now, 1))]);
  const card = page.locator("#liveCard .livecard");
  await expect(card).toBeVisible();
  const [t, b, x] = await Promise.all([card.locator(".lc-t").boundingBox(), card.locator("[data-live=take]").boundingBox(), card.locator("[data-live=hide]").boundingBox()]);
  const c = await card.boundingBox();
  expect(t.width).toBeGreaterThan(c.width * 0.7);
  expect(b.y).toBeGreaterThan(t.y + t.height - 1);
  expect(Math.abs(b.y - x.y)).toBeLessThan(4);
  await ctx.close();
});

test("a session taken over on the phone stops here before it finishes, and nothing is logged twice", async ({ page }) => {
  await page.addInitScript(fake);
  await openApp(page, { cfg: { quests: [CS], repFrozen: true } });
  await signIn(page);
  const d = await startHere(page);
  expect(d.gen).toBe(1);
  expect(d.name).toBe("computer");
  /* the phone took it over; this device hasn't heard yet */
  await page.evaluate(([p, x]) => window.__cloud.put(p, x), [LIVE, remoteDoc({ ...d.pomo, gen: 2, dev: "dPhone" })]);
  await ffEnd(page);
  await expect(page.locator("#sync")).toHaveText("Your pomodoro moved to your phone.");
  expect((await store(page)).pomo).toBeFalsy();
  const e = (await store(page)).days[T] || {};
  expect(e.cs || 0).toBe(0);
  expect(e.pomo || []).toEqual([]);
  /* the session stays on the phone: this device offers to take it back */
  await expect(page.locator("#pomoPage .livecard")).toContainText("Pomodoro running on your phone");
  expect((await live(page)).dev).toBe("dPhone");
});

test("the live doc is listened to: a take-over elsewhere ends it here at once; another session or an older write doesn't", async ({ page }) => {
  await page.addInitScript(fake);
  await openApp(page, { cfg: { quests: [CS], repFrozen: true } });
  await signIn(page);
  await page.goto("http://127.0.0.1:4173/index.html#today");
  const now = await page.evaluate(() => Date.now());
  const theirs = remotePomo(now, 2);
  await page.evaluate(([p, d]) => window.__cloud.remote(p, d), [LIVE, remoteDoc(theirs)]);
  await page.locator("#liveCard [data-live=take]").click();
  await expect(page.locator("#pomoPage .pm-k")).toHaveText("Focus · pomodoro 1 of 4");
  const mine = await page.evaluate(() => localStorage.getItem("pc-dev"));
  await expect.poll(async () => [(await live(page)).dev, (await live(page)).gen]).toEqual([mine, 2]);
  /* the phone's last write from before the take-over lands late (gen 1): ours is said again, the session goes on */
  await page.evaluate(([p, x]) => window.__cloud.push(p, x), [LIVE, remoteDoc({ ...theirs, ints: 1 })]);
  await page.waitForTimeout(300);
  await expect(page.locator("#pomoPage .pm-k")).toHaveText("Focus · pomodoro 1 of 4");
  await expect.poll(async () => [(await live(page)).dev, (await live(page)).gen]).toEqual([mine, 2]);
  /* a different session on the phone (another sid): both may run, ours goes on */
  await page.evaluate(([p, x]) => window.__cloud.push(p, x), [LIVE, remoteDoc(remotePomo(Date.now(), 1, { sid: "sElse", gen: 7 }))]);
  await page.waitForTimeout(300);
  await expect(page.locator("#pomoPage .pm-k")).toHaveText("Focus · pomodoro 1 of 4");
  /* now the phone takes it back (gen 3) */
  await page.evaluate(([p, x]) => window.__cloud.push(p, x), [LIVE, remoteDoc({ ...theirs, gen: 3 })]);
  await page.waitForTimeout(300);
  await expect(page.locator("#sync")).toHaveText("Your pomodoro moved to your phone.");
  await expect(page.locator("#pomoPage .pm-k")).not.toContainText("Focus");
  expect(((await store(page)).days[T] || {}).cs || 0).toBe(0);
});

test("a session ended on the other device ends here too; a stale or ended one is never offered", async ({ page }) => {
  await page.addInitScript(fake);
  await openApp(page, { cfg: { quests: [CS], repFrozen: true } });
  await signIn(page);
  const d = await startHere(page);
  await page.evaluate(([p, x]) => window.__cloud.remote(p, x), [LIVE, remoteDoc(null, { sid: d.sid, gen: 2 })]);
  await expect(page.locator("#sync")).toHaveText("The pomodoro session was ended on your phone.");
  expect((await store(page)).pomo).toBeFalsy();
  await expect(page.locator(".livecard")).toHaveCount(0);
  /* a session idle for hours (a phone that died mid-break) isn't offered */
  const now = await page.evaluate(() => Date.now());
  await page.evaluate(([p, x]) => window.__cloud.remote(p, x), [LIVE, remoteDoc(remotePomo(now - 4 * 3600000, 0, { sid: "sOld", phase: "break", bend: now - 3 * 3600000 }))]);
  await page.goto("http://127.0.0.1:4173/index.html#today");
  await page.waitForTimeout(500);
  await expect(page.locator(".livecard")).toHaveCount(0);
});

test("starting while the phone runs one asks first: Continue it here takes that session over", async ({ page }) => {
  await page.addInitScript(fake);
  await openApp(page, { cfg: { quests: [CS], repFrozen: true } });
  await signIn(page);
  await page.goto("http://127.0.0.1:4173/index.html#pomodoro");
  const now = await page.evaluate(() => Date.now());
  await page.evaluate(([p, d]) => window.__cloud.push(p, d), [LIVE, remoteDoc(remotePomo(now, 3))]);
  await expect(page.locator("#pomoPage .livecard")).toBeVisible();
  /* hiding the card doesn't make the other session go away */
  await page.click("#pomoPage .livecard [data-live=hide]");
  await page.click("[data-pm=start]");
  await expect(page.locator("#gModal")).toBeVisible();
  await expect(page.locator("#gTitle")).toHaveText("Pomodoro running elsewhere");
  await expect(page.locator("#gBody")).toContainText("A pomodoro is running on your phone: Focus on Coursework until");
  expect((await store(page)).pomo).toBeFalsy();
  await page.click("[data-lb=take]");
  await expect(page.locator("#gModal")).toBeHidden();
  await expect(page.locator("#pomoPage .pm-k")).toHaveText("Focus · pomodoro 1 of 4");
  await expect.poll(async () => [(await live(page)).sid, (await live(page)).gen]).toEqual(["sOther", 2]);
});

test("End it and start new ends the phone's session and starts a fresh one here; the phone drops its own when it hears", async ({ page }) => {
  await page.addInitScript(fake);
  await openApp(page, { cfg: { quests: [CS], repFrozen: true } });
  await signIn(page);
  await page.goto("http://127.0.0.1:4173/index.html#pomodoro");
  const now = await page.evaluate(() => Date.now());
  await page.evaluate(([p, d]) => window.__cloud.push(p, d), [LIVE, remoteDoc(remotePomo(now, 3))]);
  await page.click("[data-pm=start]");
  await page.click("[data-lb=fresh]");
  await expect(page.locator("#pomoPage .pm-k")).toHaveText("Focus · pomodoro 1 of 4");
  const mine = await page.evaluate(() => localStorage.getItem("pc-dev"));
  const s = await store(page);
  expect(s.pomo.sid).not.toBe("sOther");
  expect(s.pomo.end - s.pomo.start).toBe(25 * 60000);
  /* the doc now carries our new session and names the one it ended, so the phone stops even if it never saw the end */
  await expect.poll(async () => { const d = await live(page); return [d.dev, d.sid, d.ended]; }).toEqual([mine, s.pomo.sid, "sOther"]);
});

test("a session here ends when the other device starts a new one in its place", async ({ page }) => {
  await page.addInitScript(fake);
  await openApp(page, { cfg: { quests: [CS], repFrozen: true } });
  await signIn(page);
  const d = await startHere(page);
  await page.evaluate(([p, x]) => window.__cloud.push(p, x), [LIVE, remoteDoc(remotePomo(Date.now(), 0, { sid: "sNew" }), { ended: d.sid })]);
  await expect(page.locator("#sync")).toHaveText("The pomodoro session was ended on your phone.");
  expect((await store(page)).pomo).toBeFalsy();
  expect(((await store(page)).days[T] || {}).cs || 0).toBe(0);
});

test("a session idle for hours on another device doesn't block a start here", async ({ page }) => {
  await page.addInitScript(fake);
  await openApp(page, { cfg: { quests: [CS], repFrozen: true } });
  await signIn(page);
  await page.goto("http://127.0.0.1:4173/index.html#pomodoro");
  const now = await page.evaluate(() => Date.now());
  await page.evaluate(([p, d]) => window.__cloud.push(p, d), [LIVE, remoteDoc(remotePomo(now - 5 * 3600000, 0, { sid: "sOld" }))]);
  await page.click("[data-pm=start]");
  await expect(page.locator("#gModal")).toBeHidden();
  await expect(page.locator("#pomoPage .pm-k")).toHaveText("Focus · pomodoro 1 of 4");
});

test("signed out, nothing is written or offered; a pomodoro runs as before", async ({ page }) => {
  await page.addInitScript(fake);
  await openApp(page, { cfg: { quests: [CS], repFrozen: true }, hash: "#pomodoro" });
  await page.click("[data-pm=start]");
  await expect(page.locator("#pomoPage .pm-k")).toHaveText("Focus · pomodoro 1 of 4");
  const ms = await page.evaluate(() => JSON.parse(localStorage.getItem("pc-cache-v1")).pomo.end - Date.now());
  await page.clock.fastForward(ms + 1000);
  await expect(page.locator("#pomoPage .pm-k")).toHaveText("Short break");
  expect(await live(page)).toBeNull();
});
