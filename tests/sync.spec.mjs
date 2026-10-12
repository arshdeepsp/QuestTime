import { test, expect as baseExpect } from "@playwright/test";
/* Pushes wait PUSH_DELAY (3 s) and sign-in reloads the page, so under a loaded full run 5 s polls flaked; sync waits get 15 s. */
const expect = baseExpect.configure({ timeout: 15000 });
import { openApp } from "./helpers.mjs";
import { Q, SUBJ, RULES, days, busy, rep } from "./fixture.mjs";
import { fake } from "./fakecloud.mjs";

const J = { id: "j", type: "check", label: "Journal" };
const CS = { id: "cs", type: "time", label: "Coursework", min: 60 };
/* The signed-in account's copy (pc-cache-u-<uid>), else the guest copy. */
const store = (page) => page.evaluate(() => { const a = JSON.parse(localStorage.getItem("pc-account") || "null"); return JSON.parse(localStorage.getItem(a ? "pc-cache-u-" + a.uid : "pc-cache-v1")); });
const gate = { "pc-noacct": "" };
/* Sign-in, sign-out and account switches reload the page; this waits for the reloaded document. */
/* page.evaluate that survives a reload in progress (returns null instead of throwing). */
const ev = async (page, fn) => { try { return await page.evaluate(fn); } catch (e) { return null; } };
async function reloadOn(page, fn) {
  await page.evaluate(() => { window.__pre = 1; });
  await fn();
  await expect.poll(async () => { try { return await page.evaluate(() => !window.__pre && document.readyState === "complete"); } catch (e) { return false; } }, { timeout: 10000 }).toBe(true);
}

/* In-memory stand-in for window.PCFB (see src/firebase/fb.js): docs keyed by path, snapshot listeners, auth with one
   known user. window.__cloud exposes the docs and a remote() helper that writes "from another device". */


async function signIn(page) {
  await page.goto("http://127.0.0.1:4173/index.html#settings");
  await page.click("[data-st='account']");
  await page.click("#acOpen");
  await page.fill("#auEmail", "arsh@example.com");
  await page.fill("#auPw", "secret1");
  await reloadOn(page, () => page.click("#auGo"));
  await page.click("[data-st='account']");
  await expect(page.locator(".srow", { hasText: "Signed in as" })).toContainText("arsh@example.com");
}
const docs = (page) => page.evaluate(() => window.__cloud.docs);

test("signing in pushes local data as documents under users/<uid>, with stamps", async ({ page }) => {
  await page.addInitScript(fake);
  await openApp(page, { cfg: { quests: [J, CS], repFrozen: true }, days: { "2026-11-01": { j: true, cs: 30, q: [J, CS] } } });
  await page.locator("#quests .q .sw").first().click();
  await signIn(page);
  await expect.poll(async () => Object.keys(await docs(page)).sort()).toEqual(expect.arrayContaining(["users/u1/data/cfg", "users/u1/days/2026-11-01", "users/u1/days/2026-11-02"]));
  const d = await docs(page);
  expect(d["users/u1/data/cfg"].quests.map((q) => q.id)).toEqual(["j", "cs"]);
  expect(d["users/u1/data/cfg"].u).toBeGreaterThan(0);
  expect(d["users/u1/days/2026-11-02"]).toMatchObject({ j: true });
  expect(d["users/u1/days/2026-11-02"].u).toBeGreaterThan(0);
  expect(d["users/u1/days/2026-11-02"].sess).toBeUndefined();
  expect(d["users/u1/days/2026-11-01"].u).toBeGreaterThan(0);
  expect((await store(page)).meta.u["days/2026-11-01"]).toBe(d["users/u1/days/2026-11-01"].u);
  await expect(page.locator(".srow", { has: page.locator("b", { hasText: /^Sync$/ }) })).toContainText("Up to date");
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("pc-account")))).toEqual({ uid: "u1", email: "arsh@example.com" });
});

test("later edits push only the changed documents; a removed day is pushed as a tombstone", async ({ page }) => {
  await page.addInitScript(fake);
  await openApp(page, { now: "2026-11-02T09:00:00-05:00", cfg: { quests: [J, CS], repFrozen: true } });
  await signIn(page);
  await expect.poll(async () => (await docs(page))["users/u1/data/cfg"]).toBeTruthy();
  await page.evaluate(() => { window.__cloud.writes = 0; });
  await page.goto("http://127.0.0.1:4173/index.html#today");
  await page.locator("#quests .q .sw").first().click();
  await expect.poll(async () => (await docs(page))["users/u1/days/2026-11-02"]).toMatchObject({ j: true });
  expect(await page.evaluate(() => window.__cloud.writes)).toBe(1);
  await page.click("#schBtn"); await page.click("#schDN"); await page.click("#schAuto");
  await expect.poll(async () => ((await docs(page))["users/u1/days/2026-11-03"] || {}).sched).toBeTruthy();
  await page.click("#schClr"); await page.click("#schClr");
  await expect.poll(async () => (await docs(page))["users/u1/days/2026-11-03"]).toMatchObject({ del: true });
});

test("a signed-in device with nothing local pulls everything; remote changes arrive on return to the app, even from a device whose clock is behind", async ({ page }) => {
  await page.addInitScript(fake);
  await page.addInitScript(() => { if (localStorage.getItem("__fc")) return; localStorage.setItem("pc-account", JSON.stringify({ uid: "u1", email: "arsh@example.com" })); window.__cloud.user = { uid: "u1", email: "arsh@example.com" };
    const now = Date.parse("2026-11-02T08:00:00-05:00");
    window.__cloud.docs["users/u1/data/cfg"] = { quests: [{ id: "r", type: "check", label: "Remote quest" }], rules: [], idleGrove: 0, start: "2026-10-01T04:00:00.000Z", updated: "2026-11-01T10:00:00Z", repFrozen: true, u: now };
    window.__cloud.docs["users/u1/days/2026-11-01"] = { r: true, q: [{ id: "r", type: "check", label: "Remote quest" }], u: now };
    window.__cloud.docs["users/u1/data/refl"] = { map: { "2026-10-20": { text: "late night" } }, u: now }; });
  await openApp(page, { cfg: { quests: [] } });
  await expect(page.locator("#quests .q .lbl")).toHaveText(["Remote quest"]);
  let s = await store(page);
  expect(s.days["2026-11-01"]).toMatchObject({ r: true });
  expect(s.refl["2026-10-20"].text).toBe("late night");
  expect(s.meta.u.cfg).toBe(Date.parse("2026-11-02T08:00:00-05:00"));
  await page.evaluate(() => window.__cloud.remote("users/u1/days/2026-11-01", { r: false, q: [{ id: "r", type: "check", label: "Remote quest" }], u: Date.parse("2026-11-02T09:30:00-05:00") }));
  await expect.poll(async () => (await store(page)).days["2026-11-01"].r).toBe(false);
  await page.evaluate(() => window.__cloud.remote("users/u1/days/2026-11-01", { r: true, q: [{ id: "r", type: "check", label: "Remote quest" }], u: Date.parse("2026-11-02T07:00:00-05:00") }));
  await expect.poll(async () => (await store(page)).days["2026-11-01"].r).toBe(true);
  await page.evaluate(() => window.__cloud.remote("users/u1/data/cfg", { quests: [{ id: "r", type: "check", label: "Renamed remotely" }], rules: [], idleGrove: 0, start: "2026-10-01T04:00:00.000Z", repFrozen: true, u: Date.parse("2026-11-02T09:40:00-05:00") }));
  await expect(page.locator("#quests .q .lbl")).toHaveText(["Renamed remotely"]);
  await page.evaluate(() => window.__cloud.remote("users/u1/days/2026-11-05", { sched: [{ id: "z", q: "r", f: 600, t: 660 }], u: Date.parse("2026-11-02T09:45:00-05:00") }));
  await expect.poll(async () => ((await store(page)).days["2026-11-05"] || {}).sched).toHaveLength(1);
  await page.evaluate(() => window.__cloud.remote("users/u1/days/2026-11-05", { del: true, u: Date.parse("2026-11-02T09:50:00-05:00") }));
  await expect.poll(async () => (await store(page)).days["2026-11-05"]).toBeUndefined();
  expect((await store(page)).meta.del["days/2026-11-05"]).toBe(Date.parse("2026-11-02T09:50:00-05:00"));
});

test("sign out removes the account's data from this device and signing back in brings it back; a wrong password is explained", async ({ page }) => {
  await page.addInitScript(fake);
  await openApp(page, { cfg: { quests: [J], repFrozen: true }, extra: gate });
  await page.fill("#auEmail", "arsh@example.com");
  await page.fill("#auPw", "nope");
  await page.click("#auGo");
  await expect(page.locator("#auMsg")).toHaveText("Wrong email or password.");
  await page.fill("#auPw", "secret1");
  await reloadOn(page, () => page.click("#auGo"));
  await expect(page.locator("#authPage")).toHaveCount(0);
  await page.locator("#quests .q .sw").first().click();
  await expect.poll(async () => ((await docs(page))["users/u1/days/2026-11-02"] || {}).j).toBe(true);
  await page.goto("http://127.0.0.1:4173/index.html#settings");
  await page.click("[data-st='account']");
  await reloadOn(page, () => page.click("#acOut"));
  await expect(page.locator("#auNote")).toHaveText("Signed out. Your data is in your account and comes back when you sign in.");
  expect(await page.evaluate(() => [localStorage.getItem("pc-account"), localStorage.getItem("pc-cache-u-u1")])).toEqual([null, null]);
  expect(((await store(page)).days["2026-11-02"] || {}).j).toBeFalsy();
  await page.fill("#auEmail", "arsh@example.com");
  await page.fill("#auPw", "secret1");
  await page.click("#auGo");
  await expect.poll(async () => { try { return (((await store(page)) || { days: {} }).days["2026-11-02"] || {}).j; } catch (e) { return null; } }).toBe(true);
});

test("sign out asks first when changes haven't synced, and waits for a running timer", async ({ page }) => {
  await page.addInitScript(fake);
  await openApp(page, { cfg: { quests: [J, CS], repFrozen: true } });
  await signIn(page);
  await expect(page.locator(".srow", { has: page.locator("b", { hasText: /^Sync$/ }) })).toContainText("Up to date");
  await page.evaluate(() => { window.__cloud.fail = true; });
  await page.goto("http://127.0.0.1:4173/index.html#today");
  await page.locator("#quests .q .sw").first().click();
  await page.waitForTimeout(600);
  await page.goto("http://127.0.0.1:4173/index.html#settings");
  await page.click("[data-st='account']");
  await page.click("#acOut");
  await expect(page.locator("#sync")).toHaveText("Some changes haven’t synced yet. Signing out now loses them.");
  await expect(page.locator("#acOut")).toHaveText("Sign out anyway");
  expect(await page.evaluate(() => localStorage.getItem("pc-account"))).not.toBeNull();
  await reloadOn(page, () => page.click("#acOut"));
  expect(await page.evaluate(() => [localStorage.getItem("pc-account"), localStorage.getItem("pc-cache-u-u1")])).toEqual([null, null]);
});

test("a failed push is retried on the next change, and the Account page says so", async ({ page }) => {
  await page.addInitScript(fake);
  await openApp(page, { cfg: { quests: [J], repFrozen: true } });
  await signIn(page);
  await expect(page.locator(".srow", { has: page.locator("b", { hasText: /^Sync$/ }) })).toContainText("Up to date");
  await page.evaluate(() => { window.__cloud.fail = true; });
  await page.goto("http://127.0.0.1:4173/index.html#today");
  await page.locator("#quests .q .sw").first().click();
  await page.waitForTimeout(600);
  await page.goto("http://127.0.0.1:4173/index.html#settings");
  await page.click("[data-st='account']");
  await expect(page.locator(".srow", { has: page.locator("b", { hasText: /^Sync$/ }) })).toContainText("Problem: offline");
  await page.evaluate(() => { window.__cloud.fail = false; });
  await page.click("#acSync");
  await expect.poll(async () => (await docs(page))["users/u1/days/2026-11-02"]).toMatchObject({ j: true });
  await expect(page.locator(".srow", { has: page.locator("b", { hasText: /^Sync$/ }) })).toContainText("Up to date");
});

test("a full account's worth of data pushes as documents Firestore accepts, and comes back whole on another device", async ({ page, browser }) => {
  await page.addInitScript(fake);
  const D = days();
  const cfg = { quests: Q, subjects: SUBJ, rules: RULES, busy, rep, nf: { on: true, checkinAt: "20:00" }, showPlan: true, addTrends: true, sparkTools: true, badges: { first: "2026-10-03" }, noStreak: [{ from: "2026-10-10", to: "2026-10-15" }], ignore: ["cl"], xpSpent: 200, weekStart: 0 };
  await openApp(page, { cfg, days: D, extra: { "pc-todoreview": "2026-11-02" } });
  await page.evaluate(() => { const S = JSON.parse(localStorage.getItem("pc-cache-v1")); S.refl = { "2026-10-12": { text: "exam week", tags: ["tired"] } }; localStorage.setItem("pc-cache-v1", JSON.stringify(S)); });
  await page.reload();
  await signIn(page);
  await expect(page.locator(".srow", { has: page.locator("b", { hasText: /^Sync$/ }) })).toContainText("Up to date");
  const d = await docs(page);
  expect(await page.evaluate(() => window.__cloud.bad || [])).toEqual([]);
  const local = await store(page);
  const dayKeys = Object.keys(local.days).sort();
  expect(dayKeys.length).toBeGreaterThanOrEqual(Object.keys(D).length);
  expect(Object.keys(d).sort()).toEqual(["users/u1/data/cfg", "users/u1/data/refl"].concat(dayKeys.map((k) => "users/u1/days/" + k)).sort());
  const clean = (o) => { const x = JSON.parse(JSON.stringify(o)); delete x.u; delete x.at; return x; };
  expect(clean(d["users/u1/data/cfg"])).toEqual(local.cfg);
  expect(clean(d["users/u1/data/refl"]).map).toEqual(local.refl);
  for (const k of dayKeys) expect(clean(d["users/u1/days/" + k])).toEqual(local.days[k]);
  // a second, empty device signed into the same account ends up with the same data
  const ctx = await browser.newContext({ timezoneId: "America/Toronto", serviceWorkers: "block" });
  const other = await ctx.newPage();
  await other.addInitScript(fake);
  await other.addInitScript((remote) => { if (localStorage.getItem("__fc")) return; window.__cloud.docs = remote; window.__cloud.user = { uid: "u1", email: "arsh@example.com" }; localStorage.setItem("pc-account", JSON.stringify(window.__cloud.user)); }, d);
  await openApp(other, { now: "2026-11-02T09:00:00-05:00", cfg: { quests: [] } });
  await expect(other.locator("#quests .q .lbl").first()).toBeVisible();
  const mirror = await store(other);
  expect(mirror.cfg).toEqual(local.cfg);
  expect(mirror.refl).toEqual(local.refl);
  for (const k of dayKeys) expect(mirror.days[k]).toEqual(local.days[k]);
  expect(await other.evaluate(() => window.__cloud.bad || [])).toEqual([]);
  await ctx.close();
});

test("a running timer pushes nothing until it is stopped", async ({ page }) => {
  await page.addInitScript(fake);
  await openApp(page, { now: "2026-11-02T09:00:00-05:00", cfg: { quests: [CS], repFrozen: true } });
  await signIn(page);
  await expect(page.locator(".srow", { has: page.locator("b", { hasText: /^Sync$/ }) })).toContainText("Up to date");
  await page.goto("http://127.0.0.1:4173/index.html#today");
  await page.evaluate(() => { window.__cloud.writes = 0; });
  await page.click("#quests .q.t-time .tmr");
  await expect(page.locator("#quests .q.running")).toHaveCount(1);
  await page.clock.runFor(10 * 60000);
  await page.waitForTimeout(400);
  expect(await page.evaluate(() => window.__cloud.writes)).toBe(0);
  await page.click("#quests .q.running .tmr");
  await expect.poll(async () => ((await docs(page))["users/u1/days/2026-11-02"] || {}).cs).toBe(10);
  expect(await page.evaluate(() => window.__cloud.writes)).toBe(1);
});

test("signing out and back in works without live listeners; a session that ends elsewhere signs this device out but keeps its copy", async ({ page }) => {
  await page.addInitScript(fake);
  await page.addInitScript(() => { if (localStorage.getItem("__fc")) return; localStorage.setItem("pc-account", JSON.stringify({ uid: "u1", email: "arsh@example.com" })); window.__cloud.user = { uid: "u1", email: "arsh@example.com" }; window.__cloud.save(); });
  await openApp(page, { cfg: { quests: [J], repFrozen: true }, extra: gate });
  await expect.poll(async () => (await docs(page))["users/u1/data/cfg"]).toBeTruthy();
  await expect.poll(async () => !!(await docs(page))["users/u1/data/cfg"]).toBe(true);
  await page.goto("http://127.0.0.1:4173/index.html#settings");
  await page.click("[data-st='account']");
  await reloadOn(page, () => page.click("#acOut"));
  await expect(page.locator("#authPage")).toBeVisible();
  expect(await page.evaluate(() => window.__cloud.listeners.length)).toBe(0);
  await page.fill("#auEmail", "arsh@example.com");
  await page.fill("#auPw", "secret1");
  await page.click("#auGo");
  await expect.poll(() => ev(page, () => !!window.__cloud.docs["users/u1/data/cfg"])).toBe(true);
  await expect.poll(() => ev(page, () => localStorage.getItem("pc-cache-u-u1"))).not.toBeNull();
  await page.evaluate(() => { window.__cloud.user = null; window.__cloud.save(); window.__cloud.authCbs.forEach((cb) => cb(null)); });
  await expect.poll(() => ev(page, () => document.querySelector("#auNote") && document.querySelector("#auNote").textContent)).toContain("You were signed out.");
  expect(await page.evaluate(() => localStorage.getItem("pc-account"))).toBeNull();
  expect(await page.evaluate(() => localStorage.getItem("pc-cache-u-u1"))).not.toBeNull();
  expect(await page.evaluate(() => window.__cloud.listeners.length)).toBe(0);
});

test("a sync error on sign-in still signs you in and shows the problem in Settings", async ({ page }) => {
  await page.addInitScript(fake);
  await page.addInitScript(() => { if (!sessionStorage.getItem("thrown")) { window.__cloud.throwGet = "Invalid document reference"; } });
  await openApp(page, { cfg: { quests: [J], repFrozen: true } });
  await page.goto("http://127.0.0.1:4173/index.html#settings");
  await page.click("[data-st='account']");
  await page.click("#acOpen");
  await page.fill("#auEmail", "arsh@example.com");
  await page.fill("#auPw", "secret1");
  await reloadOn(page, () => page.click("#auGo"));
  await page.click("[data-st='account']");
  await expect(page.locator(".srow", { has: page.locator("b", { hasText: /^Sync$/ }) })).toContainText("Problem: Invalid document reference");
  await page.evaluate(() => { window.__cloud.throwGet = ""; sessionStorage.setItem("thrown", "1"); });
  await page.click("#acSync");
  await expect(page.locator(".srow", { has: page.locator("b", { hasText: /^Sync$/ }) })).toContainText("Up to date");
  expect(Object.keys(await docs(page))).toContain("users/u1/data/cfg");
});

test("signing in to an account that already has data shows that account's data; this device's own data stays apart and is back after signing out", async ({ page }) => {
  await page.addInitScript(fake);
  await page.addInitScript(() => { if (localStorage.getItem("__fc")) return; const now = Date.parse("2026-11-02T08:00:00-05:00");
    window.__cloud.docs["users/u1/data/cfg"] = { quests: [{ id: "r", type: "check", label: "Account quest" }], rules: [], idleGrove: 0, start: "2026-10-01T04:00:00.000Z", repFrozen: true, u: now }; window.__cloud.save(); });
  await openApp(page, { cfg: { quests: [{ id: "g", type: "check", label: "Device quest" }], repFrozen: true }, extra: gate });
  await page.fill("#auEmail", "arsh@example.com");
  await page.fill("#auPw", "secret1");
  await reloadOn(page, () => page.click("#auGo"));
  await expect(page.locator("#quests .q .lbl")).toHaveText(["Account quest"]);
  expect(((await docs(page))["users/u1/data/cfg"].quests || []).map((q) => q.label)).toEqual(["Account quest"]);
  expect(JSON.parse(await page.evaluate(() => localStorage.getItem("pc-cache-v1"))).cfg.quests.map((q) => q.label)).toEqual(["Device quest"]);
  await page.goto("http://127.0.0.1:4173/index.html#settings");
  await page.click("[data-st='account']");
  await reloadOn(page, () => page.click("#acOut"));
  await page.click("#auSkip");
  await expect(page.locator("#quests .q .lbl")).toHaveText(["Device quest"]);
});

test("a new account takes the data made without an account", async ({ page }) => {
  await page.addInitScript(fake);
  await openApp(page, { cfg: { quests: [{ id: "g", type: "check", label: "Device quest" }], repFrozen: true }, extra: gate });
  await page.click("[data-av='signup']");
  await page.fill("#auEmail", "new@example.com");
  await page.fill("#auPw", "abcdef");
  await page.fill("#auPw2", "abcdef");
  await reloadOn(page, () => page.click("#auGo"));
  await expect(page.locator("#quests .q .lbl")).toHaveText(["Device quest"]);
  await expect.poll(async () => (((await docs(page))["users/u1/data/cfg"] || {}).quests || []).map((q) => q.label)).toEqual(["Device quest"]);
  expect(await page.evaluate(() => localStorage.getItem("pc-cache-u-u1"))).not.toBeNull();
});

test("a device that was signed in before data was linked to accounts hands its data to that account", async ({ page }) => {
  await page.addInitScript(fake);
  await page.addInitScript(() => { if (localStorage.getItem("__fc")) return; localStorage.setItem("pc-account", JSON.stringify({ uid: "u1", email: "arsh@example.com" })); window.__cloud.user = { uid: "u1", email: "arsh@example.com" }; window.__cloud.save(); });
  await openApp(page, { cfg: { quests: [{ id: "g", type: "check", label: "My quest" }], repFrozen: true } });
  await expect(page.locator("#quests .q .lbl")).toHaveText(["My quest"]);
  const slots = await page.evaluate(() => [!!localStorage.getItem("pc-cache-u-u1"), localStorage.getItem("pc-slots")]);
  expect(slots).toEqual([true, "1"]);
  await expect.poll(async () => (((await docs(page))["users/u1/data/cfg"] || {}).quests || []).map((q) => q.label)).toEqual(["My quest"]);
});

test("look and feel lives in the account: a toggle here is pushed, and one from another device applies at once", async ({ page }) => {
  await page.addInitScript(fake);
  await page.addInitScript(() => { if (localStorage.getItem("__fc")) return; localStorage.setItem("pc-account", JSON.stringify({ uid: "u1", email: "arsh@example.com" })); window.__cloud.user = { uid: "u1", email: "arsh@example.com" }; window.__cloud.save(); });
  await openApp(page, { cfg: { quests: [J], repFrozen: true } });
  await expect.poll(async () => !!(await docs(page))["users/u1/data/cfg"]).toBe(true);
  await page.evaluate(() => document.getElementById("sndBtn").click());
  await expect.poll(async () => ((await docs(page))["users/u1/data/cfg"].ui || {}).sfx).toBe(false);
  await page.evaluate(() => window.__cloud.remote("users/u1/data/cfg", Object.assign({}, window.__cloud.docs["users/u1/data/cfg"], { theme: "ocean", ui: { sfx: true, focus: true }, u: Date.now() + 60000 })));
  await expect(page.locator("#sndBtn")).toHaveText("SFX on");
  await expect(page.locator("body")).toHaveClass(/focusview/);
  await expect(page.locator("#fx")).toHaveClass(/ocean/);
});

test("a burst of +/- taps is one write a few seconds later, and nothing from the cloud lands in between", async ({ page }) => {
  await page.addInitScript(fake);
  await page.addInitScript(() => { if (localStorage.getItem("__fc")) return; localStorage.setItem("pc-account", JSON.stringify({ uid: "u1", email: "arsh@example.com" })); window.__cloud.user = { uid: "u1", email: "arsh@example.com" }; window.__cloud.save(); });
  await openApp(page, { cfg: { quests: [CS], repFrozen: true } });
  await expect.poll(async () => !!(await docs(page))["users/u1/data/cfg"]).toBe(true);
  await page.evaluate(() => { window.__cloud.writes = 0; });
  const plus = page.locator("#quests .q .act button[aria-label^='More']").last();
  for (let i = 0; i < 5; i++) await plus.click();
  await page.waitForTimeout(800);
  expect(await page.evaluate(() => window.__cloud.writes)).toBe(0);
  await expect.poll(async () => ((await docs(page))["users/u1/days/2026-11-02"] || {}).cs, { timeout: 8000 }).toBe(50);
  expect(await page.evaluate(() => window.__cloud.writes)).toBe(1);
  expect(await page.evaluate(() => window.__cloud.listeners.length)).toBe(0);
  await expect(page.locator("#quests .q output.tapnum").last()).toHaveText("50m");
});

test("launch reads only what changed since the last pull, and an edit that never reached the cloud goes up on the next launch", async ({ page }) => {
  await page.addInitScript(fake);
  await page.addInitScript(() => { if (localStorage.getItem("__fc")) return; localStorage.setItem("pc-account", JSON.stringify({ uid: "u1", email: "arsh@example.com" })); window.__cloud.user = { uid: "u1", email: "arsh@example.com" };
    const u = Date.parse("2026-11-01T08:00:00-05:00");
    window.__cloud.put("users/u1/data/cfg", { quests: [{ id: "cs", type: "time", label: "Coursework", min: 60 }], rules: [], idleGrove: 0, start: "2026-09-01T04:00:00.000Z", repFrozen: true, u });
    window.__cloud.put("users/u1/data/refl", { map: {}, u });
    for (let i = 1; i <= 30; i++) { const k = "2026-10-" + String(i).padStart(2, "0"); window.__cloud.put("users/u1/days/" + k, { cs: 30, q: [{ id: "cs", type: "time", label: "Coursework", min: 60 }], ck: [], u: u - (31 - i) * 3600000 }); }
    window.__cloud.save(); });
  await openApp(page, { cfg: { quests: [] } });
  await expect(page.locator("#quests .q .lbl")).toHaveText(["Coursework"]);
  await expect.poll(async () => (await store(page)).meta.pat).toBeGreaterThan(0);
  expect(await page.evaluate(() => window.__cloud.reads)).toBeGreaterThan(30);
  await page.evaluate(() => { const t = Date.now(); window.__cloud.put("users/u1/data/refl", { map: { "2026-10-30": { text: "from the phone" } }, u: t }); window.__cloud.put("users/u1/days/2026-10-29", { cs: 45, q: [{ id: "cs", type: "time", label: "Coursework", min: 60 }], ck: [], u: t - 86400000 * 3 }); window.__cloud.fail = true; });
  await page.locator("#quests .q .act button[aria-label^='More']").last().click();
  await page.reload();
  await expect.poll(async () => (await store(page)).refl["2026-10-30"]?.text).toBe("from the phone");
  expect((await store(page)).days["2026-10-29"].cs).toBe(45);
  expect(await page.evaluate(() => window.__cloud.reads)).toBeLessThan(10);
  await expect.poll(async () => ((await docs(page))["users/u1/days/2026-11-02"] || {}).cs).toBe(10);
});

test.describe("on a phone", () => {
  test.use({ viewport: { width: 390, height: 800 }, isMobile: true, hasTouch: true });
test("two devices editing different things in settings both keep their edits, whatever their clocks say", async ({ page }) => {
  const A = { id: "a", type: "check", label: "Alpha" }, B = { id: "b", type: "check", label: "Bravo" }, C = { id: "c", type: "check", label: "Charlie" };
  await page.addInitScript(fake);
  await page.addInitScript(([A, B, C]) => { if (localStorage.getItem("__fc")) return; localStorage.setItem("pc-account", JSON.stringify({ uid: "u1", email: "arsh@example.com" })); window.__cloud.user = { uid: "u1", email: "arsh@example.com" };
    window.__cloud.put("users/u1/data/cfg", { quests: [A, B, C], rules: [], idleGrove: 0, start: "2026-09-01T04:00:00.000Z", repFrozen: true, u: Date.parse("2026-11-01T08:00:00-05:00") }); }, [A, B, C]);
  await openApp(page, { cfg: { quests: [] } });
  await expect(page.locator("#quests .q .lbl")).toHaveText(["Alpha", "Bravo", "Charlie"]);
  await expect.poll(async () => !!(await store(page)).meta.cb).toBe(true);
  await page.evaluate(() => { window.__cloud.fail = true; });
  await page.locator("#tdGhost input").fill("Buy milk");
  await page.locator("#tdGhost input").press("Enter");
  await page.goto("http://127.0.0.1:4173/index.html#settings");
  await page.click("[data-st='quests']");
  await page.click("#setPlan");
  await page.evaluate(([A, B]) => { window.__cloud.put("users/u1/data/cfg", { quests: [A, Object.assign({}, B, { label: "Bravo (phone)" }), { id: "d", type: "check", label: "Delta" }], rules: [], idleGrove: 0, start: "2026-09-01T04:00:00.000Z", repFrozen: true, u: Date.parse("2026-10-01T08:00:00-05:00") }); window.__cloud.fail = false; document.dispatchEvent(new Event("visibilitychange")); }, [A, B]);
  await page.goto("http://127.0.0.1:4173/index.html#today");
  await expect.poll(async () => ((await docs(page))["users/u1/data/cfg"].quests || []).map((q) => q.label)).toEqual(["Alpha", "Bravo (phone)", "Buy milk", "Delta"]);
  const s = await store(page);
  expect(s.cfg.quests.map((q) => q.label)).toEqual(["Alpha", "Bravo (phone)", "Buy milk", "Delta"]);
  expect(s.cfg.showPlan).toBe(true);
  expect((await docs(page))["users/u1/data/cfg"].showPlan).toBe(true);
  await expect(page.locator("#quests .q .lbl").first()).toHaveText("Alpha");
});
});

test("a day deleted on another device goes here too, unless this device changed it meanwhile", async ({ page }) => {
  await page.addInitScript(fake);
  await page.addInitScript(() => { if (localStorage.getItem("__fc")) return; localStorage.setItem("pc-account", JSON.stringify({ uid: "u1", email: "arsh@example.com" })); window.__cloud.user = { uid: "u1", email: "arsh@example.com" };
    const Q = [{ id: "cs", type: "time", label: "Coursework", min: 60 }];
    window.__cloud.put("users/u1/data/cfg", { quests: Q, rules: [], idleGrove: 0, start: "2026-09-01T04:00:00.000Z", repFrozen: true, u: 1 });
    window.__cloud.put("users/u1/days/2026-11-02", { cs: 20, u: 1 });
    window.__cloud.put("users/u1/days/2026-11-05", { sched: [{ id: "z", q: "cs", f: 600, t: 660 }], u: 1 }); });
  await openApp(page, { cfg: { quests: [] } });
  await expect.poll(async () => Object.keys((await store(page)).meta.h || {})).toEqual(expect.arrayContaining(["days/2026-11-02", "days/2026-11-05"]));
  await page.evaluate(() => { window.__cloud.fail = true; });
  await page.locator("#quests .q .act button[aria-label^='More']").last().click();
  await page.evaluate(() => { window.__cloud.put("users/u1/days/2026-11-02", { del: true, u: 2 }); window.__cloud.put("users/u1/days/2026-11-05", { del: true, u: 2 }); window.__cloud.fail = false; document.dispatchEvent(new Event("visibilitychange")); });
  await expect.poll(async () => (await store(page)).days["2026-11-05"]).toBeUndefined();
  expect((await store(page)).days["2026-11-02"].cs).toBe(30);
  await expect.poll(async () => (await docs(page))["users/u1/days/2026-11-02"].cs).toBe(30);
});

test("settings arriving from a device that saved a quest twice are taken without the copies, and the repair goes back up", async ({ page }) => {
  await page.addInitScript(fake);
  await page.addInitScript(() => { if (localStorage.getItem("__fc")) return; localStorage.setItem("pc-account", JSON.stringify({ uid: "u1", email: "arsh@example.com" })); window.__cloud.user = { uid: "u1", email: "arsh@example.com" };
    const P = { id: "pp", type: "time", label: "Piano Practice", min: 30 }, J = { id: "j", type: "check", label: "Journal" };
    window.__cloud.put("users/u1/data/cfg", { quests: [P, J, P, P], rules: [], idleGrove: 0, start: "2026-09-01T04:00:00.000Z", repFrozen: true, u: 1 }); });
  await openApp(page, { cfg: { quests: [] } });
  await expect(page.locator("#quests .q .lbl")).toHaveText(["Piano Practice", "Journal"]);
  expect((await store(page)).cfg.quests.map((q) => q.id)).toEqual(["pp", "j"]);
  await expect.poll(async () => (await docs(page))["users/u1/data/cfg"].quests.map((q) => q.id)).toEqual(["pp", "j"]);
});

test.describe("on a phone, mid-drag", () => {
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  test("a list rebuilt while a quest is held (settings arriving from the cloud) never writes a quest twice or swallows another", async ({ page }) => {
    const QS = [{ id: "a", type: "time", label: "Alpha", min: 30 }, { id: "b", type: "time", label: "Bravo", min: 30 }, { id: "c", type: "check", label: "Charlie" }];
    await page.addInitScript(fake);
    await page.addInitScript((QS) => { if (localStorage.getItem("__fc")) return; localStorage.setItem("pc-account", JSON.stringify({ uid: "u1", email: "arsh@example.com" })); window.__cloud.user = { uid: "u1", email: "arsh@example.com" };
      window.__cloud.put("users/u1/data/cfg", { quests: QS, rules: [], idleGrove: 0, start: "2026-09-01T04:00:00.000Z", repFrozen: true, u: 1 }); }, QS);
    await openApp(page, { cfg: { quests: [] } });
    await expect(page.locator("#quests .q .lbl")).toHaveText(["Alpha", "Bravo", "Charlie"]);
    await page.clock.pauseAt(Date.parse("2026-11-02T09:00:30-05:00"));
    const cdp = await page.context().newCDPSession(page);
    const a = await page.locator("#quests .q", { hasText: "Alpha" }).locator(".lbl").boundingBox(), b = await page.locator("#quests .q", { hasText: "Bravo" }).locator(".lbl").boundingBox();
    const x = a.x + 5, y = a.y + a.height / 2, y2 = b.y + b.height + 6;
    await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y, id: 1 }] });
    await page.clock.runFor(450);
    await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x, y: y - 10, id: 1 }] });
    await page.evaluate((QS) => window.__cloud.remote("users/u1/data/cfg", { quests: [QS[0], Object.assign({}, QS[1], { label: "Bravo 2" }), QS[2]], rules: [], idleGrove: 0, start: "2026-09-01T04:00:00.000Z", repFrozen: true, u: 5 }), QS);
    await page.clock.runFor(200);
    await expect(page.locator("#quests .q .lbl")).toContainText(["Bravo 2"]);
    for (let i = 1; i <= 5; i++) await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x, y: y + (y2 - y) * i / 5, id: 1 }] });
    await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    await page.waitForTimeout(300);
    expect((await store(page)).cfg.quests.map((q) => q.id).sort()).toEqual(["a", "b", "c"]);
    await expect(page.locator("#quests .q .lbl")).toHaveText(["Alpha", "Bravo 2", "Charlie"]);
  });
});

test("signing out clears this account's reminders, pending and shown; signing back in plans them again", async ({ page }) => {
  const ln = `(function(){var L=function(){return JSON.parse(localStorage.getItem("__ln")||'{"pend":[],"log":[]}')},W=function(x){localStorage.setItem("__ln",JSON.stringify(x))};
  window.Capacitor={isNativePlatform:()=>true,Plugins:{FocusNotify:{show:()=>Promise.resolve({}),hide:()=>Promise.resolve(),takeTap:()=>Promise.resolve({tap:null})},
  LocalNotifications:{requestPermissions:()=>Promise.resolve({display:'granted'}),createChannel:()=>Promise.resolve(),getPending:()=>Promise.resolve({notifications:L().pend}),
  cancel:(o)=>{var s=L();s.pend=s.pend.filter(n=>!o.notifications.some(c=>c.id===n.id));W(s);return Promise.resolve()},removeDeliveredNotifications:()=>Promise.resolve(),
  removeAllDeliveredNotifications:()=>{var s=L();s.log.push("clearShown");W(s);return Promise.resolve()},
  schedule:(o)=>{var s=L();s.pend=s.pend.filter(n=>!o.notifications.some(c=>c.id===n.id)).concat(o.notifications.map(n=>({id:n.id,title:n.title})));W(s);return Promise.resolve()},addListener:()=>Promise.resolve({})},
  App:{addListener:()=>Promise.resolve({})},KeepAwake:{keepAwake:()=>Promise.resolve(),allowSleep:()=>Promise.resolve()}}}})();`;
  await page.addInitScript(fake);
  await page.addInitScript(ln);
  const CS = { id: "cs", type: "time", label: "CS work", min: 60 };
  await openApp(page, { cfg: { quests: [CS], nf: { on: true }, repFrozen: true }, days: { "2026-11-02": { sched: [{ id: "a", q: "cs", f: 720, t: 780 }] } }, extra: gate });
  const st = () => page.evaluate(() => JSON.parse(localStorage.getItem("__ln") || '{"pend":[],"log":[]}'));
  await page.fill("#auEmail", "arsh@example.com");
  await page.fill("#auPw", "secret1");
  await reloadOn(page, () => page.click("#auGo"));
  await expect.poll(async () => (await st()).pend.some((n) => n.title === "Time for CS work")).toBe(true);
  await page.goto("http://127.0.0.1:4173/index.html#settings");
  await page.click("[data-st='account']");
  await reloadOn(page, () => page.click("#acOut"));
  await expect(page.locator("#authPage")).toBeVisible();
  const after = await st();
  expect(after.log).toContain("clearShown");
  expect(after.pend.filter((n) => n.id >= 900 && n.id < 5000)).toEqual([]);
  await page.fill("#auEmail", "arsh@example.com");
  await page.fill("#auPw", "secret1");
  await reloadOn(page, () => page.click("#auGo"));
  await expect.poll(async () => (await st()).pend.some((n) => n.title === "Time for CS work")).toBe(true);
});
