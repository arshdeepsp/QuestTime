import { test, expect } from "@playwright/test";
import { openApp, dayRange } from "./helpers.mjs";

const store = (page) => page.evaluate(() => JSON.parse(localStorage.getItem("pc-cache-v1")));
const strip = (page) => page.evaluate(() => Object.fromEntries([...document.querySelectorAll("#strip i[data-k]")].map((i) => [i.getAttribute("data-k"), i.className.split(" ")[0]])));
const J = { id: "j", type: "check", label: "Journal" };
const mock = `window.__ln=[];window.Capacitor={isNativePlatform:()=>true,Plugins:{LocalNotifications:{requestPermissions:()=>Promise.resolve({display:'granted'}),createChannel:()=>Promise.resolve(),getPending:()=>Promise.resolve({notifications:[]}),cancel:()=>Promise.resolve(),schedule:(o)=>{o.notifications.forEach(n=>window.__ln.push({id:n.id}));return Promise.resolve()},addListener:()=>Promise.resolve({})},App:{addListener:()=>Promise.resolve({})},KeepAwake:{keepAwake:()=>Promise.resolve(),allowSleep:()=>Promise.resolve()}}};`;

test("Settings pauses streaks today; switching back the same day still leaves today paused and resumes tomorrow", async ({ page }) => {
  await openApp(page, { cfg: { quests: [J] }, hash: "#settings" });
  await page.click("[data-st='quests']");
  await expect(page.locator("#setStreak")).toHaveAttribute("aria-checked", "true");
  await page.click("#setStreak");
  expect((await store(page)).cfg.noStreak).toEqual([{ from: "2026-11-02" }]);
  await expect(page.locator("#setStreak")).toHaveAttribute("aria-checked", "false");
  await expect(page.locator(".srow", { has: page.locator("#setStreak") })).toContainText("Casual since");
  await expect(page.locator("body")).toHaveClass(/nostreak/);
  await page.click("#setStreak");
  expect((await store(page)).cfg.noStreak).toEqual([{ from: "2026-11-02", to: "2026-11-03" }]);
  await expect(page.locator("#setStreak")).toHaveAttribute("aria-checked", "true");
  await expect(page.locator("body")).toHaveClass(/nostreak/);
});

test("during setup both directions take effect today, so a same-day flip undoes the pause", async ({ page }) => {
  await openApp(page, { cfg: { quests: [J], start: "2026-10-30T04:00:00.000Z" }, hash: "#settings" });
  await page.click("[data-st='quests']");
  await page.click("#setStreak");
  expect((await store(page)).cfg.noStreak).toEqual([{ from: "2026-11-02" }]);
  await page.click("#setStreak");
  expect((await store(page)).cfg.noStreak).toBeUndefined();
});

test("in Casual the streak, badges and grove are hidden, rank and level stay, and Badges or Grove can't be opened", async ({ page }) => {
  await openApp(page, { cfg: { quests: [J], noStreak: [{ from: "2026-11-01" }], addTrends: true }, hash: "#achievements" });
  await expect(page.locator("[data-view='today']")).toBeVisible();
  await expect(page.locator("body")).toHaveClass(/nostreak/);
  await expect(page.locator("#hudNote")).toContainText("Casual mode: XP and levels");
  await expect(page.locator("#hudLine")).toContainText("Casual");
  await expect(page.locator("#hudLine")).toContainText("Lv");
  await expect(page.locator(".mainnav [data-go='achievements']")).toBeHidden();
  await expect(page.locator(".mainnav [data-go='grove']")).toBeHidden();
  await expect(page.locator("#stStreak")).toBeHidden();
  await expect(page.locator("#rankName")).toBeVisible();
  await expect(page.locator("#lvlText")).toBeVisible();
  await page.locator("#quests .q .sw").click();
  await expect(page.locator("#cleared")).toHaveText("All done today!");
  await expect(page.locator("#lvlText")).toHaveText("170 / 300 XP");
  await page.evaluate(() => { location.hash = "grove"; });
  await page.waitForTimeout(200);
  await expect(page.locator("#grove")).toBeHidden();
  await page.click("#trendsBtn");
  await expect(page.locator(".ttile", { hasText: "Gold days" })).toHaveCount(0);
});

test("switching back on ends the pause tomorrow; switching again the same day cancels that", async ({ page }) => {
  await openApp(page, { cfg: { quests: [J], noStreak: [{ from: "2026-10-20" }] }, hash: "#settings" });
  await page.click("[data-st='quests']");
  await expect(page.locator("#setStreak")).toHaveAttribute("aria-checked", "false");
  await page.click("#setStreak");
  expect((await store(page)).cfg.noStreak).toEqual([{ from: "2026-10-20", to: "2026-11-03" }]);
  await expect(page.locator("#setStreak")).toHaveAttribute("aria-checked", "true");
  await expect(page.locator(".srow", { has: page.locator("#setStreak") })).toContainText("Challenge again from tomorrow");
  await expect(page.locator("body")).toHaveClass(/nostreak/);
  await page.click("#setStreak");
  expect((await store(page)).cfg.noStreak).toEqual([{ from: "2026-10-20" }]);
  await expect(page.locator("#setStreak")).toHaveAttribute("aria-checked", "false");
});

test("during setup switching back on ends the pause today", async ({ page }) => {
  await openApp(page, { cfg: { quests: [J], start: "2026-10-30T04:00:00.000Z", noStreak: [{ from: "2026-10-31" }], ignore: ["j"] }, hash: "#settings" });
  await page.click("[data-st='quests']");
  await page.click("#setStreak");
  const c = (await store(page)).cfg;
  expect(c.noStreak).toEqual([{ from: "2026-10-31", to: "2026-11-02" }]);
  expect(c.ignore).toBeUndefined();
  await expect(page.locator("body")).not.toHaveClass(/nostreak/);
});

test("a paused day between two misses stays paused", async ({ page }) => {
  const days = dayRange("2026-10-27", "2026-10-30", () => ({ j: true, q: [J] }));
  await openApp(page, { now: "2026-11-03T09:00:00-05:00", cfg: { quests: [J], start: "2026-10-27T04:00:00.000Z", noStreak: [{ from: "2026-11-01", to: "2026-11-02" }] }, days });
  const m = await strip(page);
  expect([m["2026-10-31"], m["2026-11-01"], m["2026-11-02"]]).toEqual(["miss", "pause", "miss"]);
});

test("a weekly quest's bonus counts a check-off made in Casual (XP is earned in both modes)", async ({ page }) => {
  const W = { id: "w", type: "weekly", label: "Gym", min: 2 };
  await openApp(page, { now: "2026-11-03T09:00:00-05:00", cfg: { quests: [W], start: "2026-11-02T05:00:00.000Z", noStreak: [{ from: "2026-11-02", to: "2026-11-03" }] }, days: { "2026-11-02": { w: true, q: [W] }, "2026-11-03": { w: true, q: [W] } } });
  await expect(page.locator("#lvlText")).toHaveText("140 / 300 XP");
});

test("timers start at once in both modes; old strict-mode fields are dropped on upgrade", async ({ page }) => {
  const CS = { id: "cs", type: "time", label: "Coursework", min: 30, lock: "fortnight", lockFrom: "2026-10-20", pending: { op: "delete", due: "2026-11-20" } };
  await openApp(page, { cfg: { quests: [CS], strict: true, easeLog: [{ date: "2026-11-02", n: 1 }], capSet: "2026-11-01", noStreak: [{ from: "2026-11-01" }] }, days: { "2026-11-01": { cs: 10, brk: 1, q: [CS] } } });
  await page.click("#quests .q .tmr");
  await expect(page.locator("#quests .q.running")).toHaveCount(1);
  await expect(page.locator("#gModal")).toBeHidden();
  const s = await store(page);
  expect(s.schema).toBe(21);
  expect(s.cfg.strict).toBeUndefined();
  expect(s.cfg.easeLog).toBeUndefined();
  expect(s.cfg.capSet).toBeUndefined();
  expect(s.cfg.quests[0].lock).toBeUndefined();
  expect(s.cfg.quests[0].pending).toBeUndefined();
  expect(s.days["2026-11-01"].brk).toBeUndefined();
});

test("paused days are neutral: the streak picks up where it was", async ({ page }) => {
  const days = { ...dayRange("2026-10-27", "2026-10-31", () => ({ j: true, q: [J] })), "2026-11-04": { j: true, q: [J] } };
  await openApp(page, { now: "2026-11-05T09:00:00-05:00", cfg: { quests: [J], start: "2026-10-27T04:00:00.000Z", noStreak: [{ from: "2026-11-01", to: "2026-11-04" }] }, days });
  await expect(page.locator("#stStreak")).toHaveText("6 days");
  const m = await strip(page);
  expect([m["2026-11-01"], m["2026-11-03"], m["2026-11-04"]]).toEqual(["pause", "pause", "ok"]);
});

test("a Casual day earns XP, and keeps it after switching back to Challenge", async ({ page }) => {
  await openApp(page, { now: "2026-11-03T09:00:00-05:00", cfg: { quests: [J], start: "2026-11-02T05:00:00.000Z", noStreak: [{ from: "2026-11-02", to: "2026-11-03" }] }, days: { "2026-11-02": { j: true, q: [J] } } });
  await expect(page.locator("#lvlText")).toHaveText("170 / 300 XP");
});

test("a total isn't judged in a period that had a paused day", async ({ page }) => {
  const CS = { id: "cs", type: "time", label: "Coursework", min: 30, roll: 420, addedOn: "2026-10-01" };
  const days = dayRange("2026-11-02", "2026-11-08", () => ({ j: true, q: [J, CS] }));
  await openApp(page, { now: "2026-11-09T09:00:00-05:00", cfg: { quests: [J, CS], noStreak: [{ from: "2026-11-05", to: "2026-11-06" }] }, days });
  const m = await strip(page);
  expect(["2026-11-02", "2026-11-05", "2026-11-08"].map((k) => m[k])).toEqual(["ok", "pause", "ok"]);
});

test("badges don't count paused days", async ({ page }) => {
  const at = (h) => Date.parse(`2026-11-02T${h}:00:00-05:00`);
  await openApp(page, { now: "2026-11-03T09:00:00-05:00", cfg: { quests: [J], noStreak: [{ from: "2026-11-02", to: "2026-11-03" }] }, days: { "2026-11-02": { j: true, q: [J], sess: [{ id: "x", s: at(10), e: at(12), m: 120 }] } } });
  await page.waitForTimeout(300);
  expect((await store(page)).cfg.badges || {}).not.toHaveProperty("deep");
});

for (const paused of [false, true]) {
  test(`streak-risk and checkpoint alerts ${paused ? "stop while paused" : "fire normally"}`, async ({ page }) => {
    await page.addInitScript(mock);
    const CS = { id: "cs", type: "time", label: "Coursework", min: 30, roll: 420, addedOn: "2026-10-01" };
    const days = dayRange("2026-10-27", "2026-10-31", () => ({ j: true, cs: 90, q: [J, CS] }));
    await openApp(page, { now: "2026-11-02T09:00:00-05:00", cfg: { quests: [J, CS], start: "2026-10-27T04:00:00.000Z", nf: { on: true }, ...(paused ? { noStreak: [{ from: "2026-11-02" }] } : {}) }, days });
    await page.clock.runFor(2000);
    const ids = (await page.evaluate(() => window.__ln)).map((x) => x.id);
    expect(ids.includes(2200)).toBe(!paused);
    expect(ids.includes(2600)).toBe(!paused);
  });

  test(`after a streak reset the reflection card ${paused ? "stays away in Casual" : "shows, and never blocks the quests"}`, async ({ page }) => {
    const days = dayRange("2026-10-27", "2026-10-30", () => ({ j: true, q: [J] }));
    await openApp(page, { now: "2026-11-02T09:00:00-05:00", cfg: { quests: [J], ...(paused ? { noStreak: [{ from: "2026-11-02" }] } : {}) }, days });
    await expect(page.locator("#quests .q")).toHaveCount(1);
    if (paused) { await expect(page.locator("#resetCard")).toBeHidden(); return; }
    await expect(page.locator("#resetCard")).toBeVisible();
    await expect(page.locator("#resetCard")).toContainText("Streak reset on Nov 1");
    await page.locator("#quests .q .sw").click();
    await expect(page.locator("#quests .q")).toHaveClass(/met/);
    await page.fill("#rcText", "No plan for the weekend");
    await page.click("#rcSave");
    await expect(page.locator("#resetCard")).toBeHidden();
    expect((await store(page)).refl["2026-11-01"].text).toBe("No plan for the weekend");
    await page.reload();
    await expect(page.locator("#quests .q")).toHaveCount(1);
    await expect(page.locator("#resetCard")).toBeHidden();
  });
}

test.describe("ignore list (phone)", () => {
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const CS = { id: "cs", type: "time", label: "Coursework", min: 60 };
  async function swipeRight(page, row) {
    const b = await row.locator(".lbl").boundingBox();
    const cdp = await page.context().newCDPSession(page);
    const y = b.y + b.height / 2, x = b.x + 10;
    await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y, id: 1 }] });
    for (let i = 1; i <= 6; i++) await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: x + i * 20, y, id: 1 }] });
    await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    await page.waitForTimeout(300);
  }

  test("while paused, swipe right ignores a quest and swipe right in Ignored adds it back", async ({ page }) => {
    await openApp(page, { cfg: { quests: [J, CS], noStreak: [{ from: "2026-11-01" }] } });
    await swipeRight(page, page.locator("#quests .q", { hasText: "Coursework" }));
    expect((await store(page)).cfg.ignore).toEqual(["cs"]);
    await expect(page.locator("#ignSep")).toContainText("Ignored (1)");
    await expect(page.locator("#quests .q", { hasText: "Coursework" })).toBeHidden();
    await page.click("#ignSep");
    await swipeRight(page, page.locator("#quests .q", { hasText: "Coursework" }));
    expect((await store(page)).cfg.ignore).toBeUndefined();
    await expect(page.locator("#ignSep")).toBeHidden();
  });

  test("with streaks on, swipe right still marks a check quest done instead", async ({ page }) => {
    await openApp(page, { cfg: { quests: [J, CS] } });
    await swipeRight(page, page.locator("#quests .q", { hasText: "Journal" }));
    expect((await store(page)).cfg.ignore).toBeUndefined();
    expect((await store(page)).days["2026-11-02"].j).toBe(true);
  });
});

test("an ignored quest leaves the schedule, its reminders, Just 5 and the count", async ({ page }) => {
  await page.addInitScript(`window.__ln=[];window.Capacitor={isNativePlatform:()=>true,Plugins:{LocalNotifications:{requestPermissions:()=>Promise.resolve({display:'granted'}),createChannel:()=>Promise.resolve(),getPending:()=>Promise.resolve({notifications:[]}),cancel:()=>Promise.resolve(),schedule:(o)=>{o.notifications.forEach(n=>window.__ln.push({id:n.id,title:n.title}));return Promise.resolve()},addListener:()=>Promise.resolve({})},App:{addListener:()=>Promise.resolve({})},KeepAwake:{keepAwake:()=>Promise.resolve(),allowSleep:()=>Promise.resolve()}}};`);
  const CS = { id: "cs", type: "time", label: "Coursework", min: 60 }, FR = { id: "fr", type: "time", label: "French", min: 30 };
  const rep = [{ id: "r1", q: "cs", f: 780, t: 840, dows: [1, 2, 3, 4, 5], from: "2026-11-02", until: "2026-11-29" }];
  await openApp(page, { cfg: { quests: [CS, FR], rep, nf: { on: true }, noStreak: [{ from: "2026-11-01" }], ignore: ["cs"] }, days: { "2026-11-02": { q: [CS, FR], sched: [{ id: "a", q: "cs", f: 600, t: 660 }] } } });
  await page.clock.runFor(2000);
  const titles = (await page.evaluate(() => window.__ln)).filter((x) => x.id >= 3500 && x.id < 4000).map((x) => x.title);
  expect(titles.some((t) => t.includes("Coursework"))).toBe(false);
  await expect(page.locator("#qCount")).toHaveText("0/1 done");
  await page.click("#schBtn");
  await expect(page.locator(".sch-b")).toHaveCount(0);
  await expect(page.locator("[data-sq='cs']")).toHaveCount(0);
  await page.click("#schOk");
  await page.click("#sp5Btn");
  await expect.poll(async () => ((await store(page)).timer || {}).id).toBe("fr");
});

test("the row menu ignores too; the list stays for the paused day left and a fresh pause starts without it", async ({ page }) => {
  const CS = { id: "cs", type: "time", label: "Coursework", min: 60 };
  await openApp(page, { cfg: { quests: [J, CS], noStreak: [{ from: "2026-11-01" }] } });
  await page.locator("#quests .q", { hasText: "Coursework" }).locator(".pzb").click();
  await page.click(".qmenu button:has-text('Ignore')");
  expect((await store(page)).cfg.ignore).toEqual(["cs"]);
  await page.goto("http://127.0.0.1:4173/index.html#settings");
  await page.click("[data-st='quests']");
  await page.click("#setStreak");
  const c = (await store(page)).cfg;
  expect(c.ignore).toEqual(["cs"]);
  expect(c.noStreak).toEqual([{ from: "2026-11-01", to: "2026-11-03" }]);
  await page.goto("http://127.0.0.1:4173/index.html#home");
  await expect(page.locator("#quests .q.ignq")).toHaveCount(1);
  await page.clock.setFixedTime(new Date("2026-11-04T09:00:00-05:00"));
  await page.goto("http://127.0.0.1:4173/index.html#settings");
  await page.click("[data-st='quests']");
  await page.click("#setStreak");
  const c2 = (await store(page)).cfg;
  expect(c2.ignore).toBeUndefined();
  expect(c2.noStreak).toEqual([{ from: "2026-11-01", to: "2026-11-03" }, { from: "2026-11-04" }]);
});

test("while paused, totals show done out of target, with no pace or need figures", async ({ page }) => {
  const CS = { id: "cs", type: "time", label: "Coursework", min: 30, roll: 900, days: [1, 2, 3, 4, 5], addedOn: "2026-10-01" };
  await openApp(page, { now: "2026-11-04T09:00:00-05:00", cfg: { quests: [J, CS], noStreak: [{ from: "2026-11-01" }] }, days: { "2026-11-02": { cs: 60, q: [J, CS] } } });
  await expect(page.locator("#quests .q", { hasText: "Coursework" }).locator(".req")).toContainText("1h of 15h done this week");
  await expect(page.locator("#carryNote")).toBeHidden();
  await page.locator("#quests .q", { hasText: "Coursework" }).locator(".pzb").click();
  await page.click(".qmenu button:has-text('View details')");
  const row = await page.locator("#gBody .dt-r").filter({ has: page.locator("span", { hasText: /^This week$/ }) }).textContent();
  expect(row).toContain("1h of 15h done");
  expect(row).not.toContain("need");
  expect(row).not.toContain("pace");
});

test("on the day before a pause starts, a checkpoint due today still shows", async ({ page }) => {
  const CS = { id: "cs", type: "time", label: "Coursework", min: 30, roll: 900, days: [1, 2, 3, 4, 5], addedOn: "2026-10-01" };
  await openApp(page, { now: "2026-11-04T09:00:00-05:00", cfg: { quests: [J, CS], noStreak: [{ from: "2026-11-05" }] }, days: { "2026-11-02": { j: true, cs: 60, q: [J, CS] } } });
  await expect(page.locator("#carryNote")).toContainText("Checkpoint today: Coursework 1h/5h");
});

test("Trends' plan kept leaves out shots for ignored quests", async ({ page }) => {
  const CS = { id: "cs", type: "time", label: "Coursework", min: 60 };
  await openApp(page, { cfg: { quests: [J, CS], noStreak: [{ from: "2026-11-01" }], ignore: ["cs"], addTrends: true }, days: { "2026-11-02": { q: [J, { ...CS, opt: true, ign: true }], sched: [{ id: "a", q: "cs", f: 600, t: 660 }] } }, extra: { "pc-rerate": "2026-11-02" }, hash: "#trends" });
  await expect(page.locator(".ttile", { hasText: "Plan kept" }).locator(".tt-v")).toHaveText("—");
});
