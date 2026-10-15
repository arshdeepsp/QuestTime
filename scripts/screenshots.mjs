/* Screenshots for the README: node scripts/screenshots.mjs (after npm run build). Seeds the test fixture (a realistic
   account) plus a few pomodoros and notes, then captures phone and desktop screens into docs/screens/. */
import { chromium } from "@playwright/test";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { join, extname, resolve } from "node:path";
import { Q, SUBJ, RULES, days, busy, rep } from "../tests/fixture.mjs";

const root = resolve("dist"),
  port = 4175,
  types = {
    ".html": "text/html",
    ".js": "text/javascript",
    ".json": "application/json",
    ".png": "image/png",
    ".ttf": "font/ttf",
    ".wav": "audio/wav",
  };
const srv = createServer(async (req, res) => {
  const path = decodeURIComponent(new URL(req.url, "http://x").pathname);
  try {
    const body = await readFile(join(root, path === "/" ? "index.html" : path));
    res.writeHead(200, { "Content-Type": types[extname(path)] || "application/octet-stream" });
    res.end(body);
  } catch {
    res.writeHead(404).end();
  }
}).listen(port, "127.0.0.1");

const NOW = "2026-11-02T10:12:00-05:00",
  T0 = Date.parse(NOW),
  rec = (k, n, h0) =>
    Array.from({ length: n }, (_, i) => ({
      q: "th",
      s: Date.parse(`${k}T${String(h0 + Math.floor(i / 2)).padStart(2, "0")}:${i % 2 ? "30" : "00"}:00-05:00`),
      e: Date.parse(`${k}T${String(h0 + Math.floor(i / 2)).padStart(2, "0")}:${i % 2 ? "55" : "25"}:00-05:00`),
      m: 25,
      ok: true,
      ...(i % 4 === 3 ? { c: 1 } : {}),
    }));
const D = days();
[
  ["2026-10-21", 4],
  ["2026-10-22", 6],
  ["2026-10-24", 8],
  ["2026-10-27", 12],
  ["2026-10-28", 3],
  ["2026-10-29", 7],
  ["2026-10-31", 5],
  ["2026-11-01", 4],
].forEach(([k, n]) => {
  D[k] = { ...D[k], pomo: rec(k, n, 8) };
});
D["2026-11-02"] = { ...D["2026-11-02"], pomo: rec("2026-11-02", 2, 8) };
const notes = {
  n1: {
    t: "Chapter 3 fixes",
    b: "Tighten the related-work section.\nRe-run the ablation with the new seed.\nAsk Raouf about the baseline.",
    c: T0,
    u: T0 - 3600000,
    col: 3,
    pin: true,
  },
  n2: { t: "Groceries", b: "eggs, bread, coffee, spinach", c: T0, u: T0 - 2 * 86400000, col: 1 },
  n3: { t: "", b: "Office hours moved to Tue 2–3, DC 2306", c: T0, u: T0 - 5 * 60000, col: 2 },
  n4: { t: "Ideas", b: "weekly review on Sundays\nread one paper before lunch", c: T0, u: T0 - 9 * 86400000 },
  n5: { t: "Gym", b: "Squat 3×5, press 3×5, row 3×8", c: T0, u: T0 - 86400000, col: 5 },
};
const state = {
  schema: 24,
  days: D,
  notes,
  cfg: {
    quests: Q,
    subjects: SUBJ,
    rules: RULES,
    busy,
    rep,
    idleGrove: 0,
    addTrends: true,
    addNotes: true,
    sparkTools: true,
    quick: ["j5", "pomo"],
    repFrozen: true,
    badges: { first: "2026-10-03", week: "2026-10-08" },
    pomo: { w: 25, b: 5, l: 15, every: 4, auto: true },
    start: "2026-10-01T04:00:00.000Z",
    updated: "2026-10-01T10:00:00Z",
  },
};

const br = await chromium.launch();
async function ctx(phone) {
  const c = await br.newContext({
    viewport: phone ? { width: 390, height: 844 } : { width: 1200, height: 860 },
    isMobile: phone,
    hasTouch: phone,
    deviceScaleFactor: 2,
    timezoneId: "America/Toronto",
    serviceWorkers: "block",
  });
  const page = await c.newPage();
  await page.clock.install({ time: new Date(NOW) });
  await page.addInitScript((s) => {
    localStorage.setItem("pc-welcomed", "1");
    localStorage.setItem("pc-splash", "off");
    localStorage.setItem("pc-todoreview", "2026-11-02");
    sessionStorage.setItem("pc-noacct", "1");
    localStorage.setItem("pc-cache-v1", s);
  }, JSON.stringify(state));
  return [c, page];
}
async function shot(page, name, el) {
  await page.mouse.move(0, 0);
  await page.waitForTimeout(400);
  await (el ? page.locator(el) : page).screenshot({ path: `docs/screens/${name}.png` });
  console.log(name);
}
const go = (page, h) => page.goto(`http://127.0.0.1:${port}/index.html${h}`);

let [c, page] = await ctx(true);
await go(page, "#today");
await shot(page, "phone-today");
await go(page, "#schedule");
await shot(page, "phone-schedule");
await go(page, "#notes");
await shot(page, "phone-notes");
await go(page, "#subjects");
await shot(page, "phone-subjects");
await go(page, "#trends");
await page.locator(".tsec:has(.pm-gcard)").scrollIntoViewIfNeeded();
await shot(page, "phone-trends");
await go(page, "#achievements");
await shot(page, "phone-badges");
await go(page, "#pomodoro");
await page.click("[data-pm=start]");
await page.clock.fastForward(9 * 60000 + 20000);
await shot(page, "phone-pomodoro");
await c.close();

[c, page] = await ctx(false);
await go(page, "#today");
await shot(page, "desktop-today");
await go(page, "#trends");
await shot(page, "desktop-trends");
await go(page, "#schedule");
await shot(page, "desktop-schedule");
await c.close();
await br.close();
srv.close();
