/* CSS refactor check: renders the app in two builds and compares the computed style of every rendered element (and its
   ::before/::after) in ~440 states: 7 widths from 360 to 1366 px across every screen, modal, menu and page, plus themes,
   Casual, calm, a fresh account, dark scheme and reduced motion. Animations are frozen at their start and transitions
   finished, on a paused clock. Build A is rendered twice; elements that differ between those two runs are noise and
   are ignored (a build compared with itself reports 0).
   Usage: cp -r dist /tmp/dist-before; (edit CSS); npm run build; node scripts/css-diff.mjs /tmp/dist-before dist [runRegex] */
import { chromium } from "@playwright/test";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { join, extname, resolve } from "node:path";
import { Q, SUBJ, RULES, days, busy, rep } from "../tests/fixture.mjs";

const [dirA, dirB, only] = process.argv.slice(2);
if (!dirA || !dirB) {
  console.error("usage: node scripts/css-diff.mjs <distA> <distB> [runRegex]");
  process.exit(2);
}
const NOW = new Date("2026-11-02T10:30:00-05:00");
const types = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".json": "application/json",
  ".png": "image/png",
  ".ttf": "font/ttf",
  ".webmanifest": "application/manifest+json",
};
async function serve(dir) {
  const root = resolve(dir);
  const server = createServer(async (req, res) => {
    const p = decodeURIComponent(new URL(req.url, "http://x").pathname);
    try {
      const b = await readFile(join(root, p === "/" ? "index.html" : p));
      res.writeHead(200, {
        "Content-Type": types[extname(p)] || "application/octet-stream",
        "Cache-Control": "no-store",
      });
      res.end(b);
    } catch {
      res.writeHead(404).end();
    }
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  return { server, url: `http://127.0.0.1:${server.address().port}/index.html` };
}

const SNAP = (detail) => {
  const props = Array.from(getComputedStyle(document.documentElement)).sort();
  for (const a of document.getAnimations()) {
    try {
      if (a instanceof CSSTransition) a.finish();
      else {
        a.pause();
        a.currentTime = 0;
      }
    } catch (e) {}
  }
  const out = {};
  const key = (el) => {
    const p = [];
    for (let e = el; e && e !== document.documentElement; e = e.parentElement) {
      const i = Array.prototype.indexOf.call(e.parentElement ? e.parentElement.children : [], e);
      p.push(e.tagName.toLowerCase() + (e.id ? "#" + e.id : "") + ":" + i);
    }
    return p.reverse().join(">");
  };
  const h = (s) => {
    let x = 2166136261;
    for (let i = 0; i < s.length; i++) {
      x ^= s.charCodeAt(i);
      x = Math.imul(x, 16777619);
    }
    return (x >>> 0).toString(36);
  };
  for (const el of document.querySelectorAll("*")) {
    if (el !== document.body && el !== document.documentElement && !el.getClientRects().length) continue;
    const parts = [];
    for (const ps of [null, "::before", "::after"]) {
      const cs = getComputedStyle(el, ps);
      if (ps && (cs.content === "none" || cs.content === "normal")) continue;
      for (const p of props) parts.push((ps || "") + p + "=" + cs.getPropertyValue(p));
    }
    out[key(el)] = detail ? parts : h(parts.join("|"));
  }
  return out;
};

const WIDTHS = [
  [360, 780, true],
  [600, 900, true],
  [700, 900, true],
  [850, 1000, false],
  [1050, 900, false],
  [1200, 900, false],
  [1366, 900, false],
];
const challenge = {
  quests: Q,
  subjects: SUBJ,
  rules: RULES,
  busy,
  rep,
  nf: { on: true },
  showPlan: true,
  addTrends: true,
  sparkTools: true,
  repFrozen: true,
};
const RUNS = [];
for (const [w, hgt, mob] of WIDTHS)
  RUNS.push({
    name: `w${w}`,
    vp: { viewport: { width: w, height: hgt }, isMobile: mob, hasTouch: mob },
    cfg: challenge,
    full: true,
  });
for (const [w, hgt, mob] of [
  [390, 844, true],
  [850, 1000, false],
  [1366, 900, false],
]) {
  for (const theme of ["night", "ocean", "ember", "snow"])
    RUNS.push({
      name: `w${w}-${theme}`,
      vp: { viewport: { width: w, height: hgt }, isMobile: mob, hasTouch: mob },
      cfg: { ...challenge, theme },
    });
  RUNS.push({
    name: `w${w}-casual`,
    vp: { viewport: { width: w, height: hgt }, isMobile: mob, hasTouch: mob },
    cfg: { ...challenge, noStreak: [{ from: "2026-10-20" }] },
  });
  RUNS.push({
    name: `w${w}-calm`,
    vp: { viewport: { width: w, height: hgt }, isMobile: mob, hasTouch: mob },
    cfg: { ...challenge, calm: true },
  });
  RUNS.push({
    name: `w${w}-fresh`,
    vp: { viewport: { width: w, height: hgt }, isMobile: mob, hasTouch: mob },
    cfg: { quests: [], rules: [] },
    days: {},
  });
}
RUNS.push({
  name: "w390-dark",
  vp: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, colorScheme: "dark" },
  cfg: challenge,
});
RUNS.push({
  name: "w390-reduced",
  vp: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, reducedMotion: "reduce" },
  cfg: challenge,
});
RUNS.push({
  name: "w1366-reduced",
  vp: { viewport: { width: 1366, height: 900 }, reducedMotion: "reduce" },
  cfg: challenge,
});

async function shoot(browser, APP, run, detailState) {
  const ctx = await browser.newContext({ ...run.vp, timezoneId: "America/Toronto", serviceWorkers: "block" });
  const page = await ctx.newPage();
  page.setDefaultTimeout(1500);
  await page.clock.install({ time: NOW });
  const state = {
    days: run.days || days(),
    cfg: { idleGrove: 0, start: "2026-10-01T04:00:00.000Z", updated: "2026-10-01T10:00:00Z", ...run.cfg },
  };
  await page.addInitScript((s) => {
    localStorage.setItem("pc-welcomed", "1");
    localStorage.setItem("pc-splash", "off");
    sessionStorage.setItem("pc-noacct", "1");
    localStorage.setItem("pc-todoreview", "2026-11-02");
    localStorage.setItem("pc-rerate", "2026-11-02");
    if (!localStorage.getItem("pc-cache-v1")) localStorage.setItem("pc-cache-v1", s);
  }, JSON.stringify(state));
  await page.clock.pauseAt(new Date(NOW.getTime() + 1000));
  await page.goto(APP, { timeout: 30000 });
  const tick = async (ms = 300) => {
    await page.clock.runFor(ms);
    await page.waitForTimeout(60);
  };
  await tick(800);
  const tc = async (sel) => {
    try {
      const ok = await page
        .locator(sel)
        .first()
        .evaluate(
          (el) => {
            if (!el.getClientRects().length) return false;
            el.click();
            return true;
          },
          null,
          { timeout: 800 },
        );
      if (ok) {
        await tick();
        return true;
      }
      return false;
    } catch (e) {
      return false;
    }
  };
  const snaps = {};
  const snap = async (n) => {
    if (detailState && n !== detailState) return;
    snaps[n] = await page.evaluate(SNAP, !!detailState);
  };
  let nav = 0;
  const fresh = async (hash) => {
    await page.goto(APP + "?r=" + ++nav + "#" + hash, { timeout: 30000 });
    await tick(800);
  };
  await snap("today");
  if (!run.full) {
    await fresh("settings");
    await snap("settings");
    await fresh("subjects");
    await snap("subjects");
    await fresh("today");
    if (await tc("#schBtn")) await snap("schedule");
    await fresh("achievements");
    await snap("badges");
    await fresh("trends");
    await snap("trends");
  } else {
    await tc("#hudLine");
    await tc("#statsToggle");
    await snap("hud-open");
    await fresh("today");
    await tc("#quests .q:has-text('Thesis') .qsum");
    await snap("row-open");
    await fresh("today");
    await tc("#quests .q:has-text('Water') .qsum");
    await snap("row-open-target");
    await fresh("today");
    if (await tc("#toolsBtn")) await snap("tools-menu");
    await fresh("today");
    if (await tc("#schBtn")) {
      await snap("schedule");
      await tc("#schTl .sch-b:not(.past):not(.busy)");
      await snap("schedule-block");
    }
    await fresh("today");
    if (await tc("#schBtn")) {
      await tc("#schDN");
      await snap("schedule-tomorrow");
    }
    await fresh("today");
    if (await tc("#schBtn")) {
      await tc("#schTl .sch-b.busy, #schTl .sch-b.ro");
      await snap("schedule-busy-block");
    }
    await fresh("today");
    for (const x of ["#fabAdd", "#hdrAdd"]) if (await tc(x)) break;
    await snap("add-sheet");
    if (await tc("#aoQuest")) {
      await snap("new-quest");
      if (await tc("#nqBody .tcard[data-t='time']")) await snap("new-quest-time");
    }
    await fresh("today");
    if ((await tc("#hdrEdit")) || ((await tc("#toolsBtn")) && (await tc(".qmenu button:has-text('Edit quests')")))) {
      await snap("quest-manager");
      if (await tc("#qmgr [data-qid]")) await snap("quest-editor");
    }
    await fresh("today");
    if (await tc("#quests .q:has-text('Thesis') .sjchip")) await snap("subject-pick");
    await fresh("today");
    if (await tc("#carryNote")) await snap("carry-info");
    await fresh("today");
    if (await tc("#strip i[data-k='2026-10-30']")) {
      await snap("past-day");
      if (await tc("#gModal .stone:has-text('Open')")) await snap("past-day-view");
    }
    await fresh("today");
    if (await tc("#shareBtn")) await snap("share");
    await fresh("today");
    if (await tc("#helpBtn")) {
      await snap("help");
      if (await tc("#helpPage .hp-list button, #helpPage button.lnk, #helpPage li button")) await snap("help-topic");
    }
    await fresh("subjects");
    await snap("subjects");
    if (await tc(".tr [data-tedit]")) await snap("topic-edit");
    await fresh("rules");
    await snap("rules");
    if (await tc("[data-edit='0']")) await snap("rule-edit");
    await fresh("achievements");
    await snap("badges");
    if (await tc("#achGrid .ach")) await snap("badge-open");
    await fresh("grove");
    await tick(600);
    await snap("grove");
    await fresh("trends");
    await tick(500);
    await snap("trends");
    await fresh("settings");
    await snap("settings");
    for (const c of ["day", "quests", "alerts", "look", "sound", "extras", "data", "account"]) {
      await fresh("settings");
      if (await tc(`[data-st='${c}']`)) await snap("settings-" + c);
    }
    await fresh("settings");
    if ((await tc("[data-st='account']")) && (await tc("#acOpen"))) {
      await snap("auth-login");
      if (await tc("[data-av='signup']")) await snap("auth-signup");
    }
    await fresh("today");
    if (await tc("#toolsBtn")) {
      if (await tc(".qmenu button:has-text('Sprint')")) {
        await snap("sprint-setup");
        if (await tc("#spGo")) {
          await tick(3000);
          await snap("sprint-running");
          await tc("#spStop");
          await tc("#spStop");
          await tick();
          await snap("sprint-stopped");
        }
      }
    }
    await fresh("today");
    if (!(await tc("#quests .q:has-text('Thesis') .qplay"))) {
      await tc("#quests .q:has-text('Thesis') .qsum");
      await tc("#quests .q:has-text('Thesis') .tmr");
    }
    await tick(65000);
    await snap("timer-running");
  }
  await ctx.close();
  return snaps;
}
async function all(dir, label) {
  const { server, url } = await serve(dir);
  const browser = await chromium.launch();
  const runs = RUNS.filter((r) => !only || new RegExp(only).test(r.name)),
    out = {};
  let next = 0;
  await Promise.all(
    [0, 1, 2, 3].map(async () => {
      while (next < runs.length) {
        const r = runs[next++];
        out[r.name] = await shoot(browser, url, r);
      }
    }),
  );
  await browser.close();
  server.close();
  process.stderr.write(label + ": " + Object.values(out).reduce((n, v) => n + Object.keys(v).length, 0) + " states\n");
  return out;
}
const A1 = await all(dirA, "A"),
  A2 = await all(dirA, "A again"),
  B = await all(dirB, "B");
const noise = new Set();
for (const run of Object.keys(A1))
  for (const st of Object.keys(A1[run])) {
    const a = A1[run][st],
      b = (A2[run] || {})[st] || {};
    for (const k of new Set([...Object.keys(a), ...Object.keys(b)]))
      if (a[k] !== b[k]) noise.add(run + "|" + st + "|" + k);
  }
const diffs = [];
for (const run of Object.keys(A1))
  for (const st of Object.keys(A1[run])) {
    const a = A1[run][st],
      b = (B[run] || {})[st];
    if (!b) {
      diffs.push({ run, st, el: "(state not reached in B)" });
      continue;
    }
    for (const k of new Set([...Object.keys(a), ...Object.keys(b)]))
      if (a[k] !== b[k] && !noise.has(run + "|" + st + "|" + k))
        diffs.push({ run, st, el: k, kind: a[k] ? (b[k] ? "changed" : "not rendered in B") : "rendered only in B" });
  }
const states = Object.values(A1).reduce((n, v) => n + Object.keys(v).length, 0);
if (!diffs.length) {
  console.log(`0 differences in ${states} states (${noise.size} noisy elements ignored)`);
  process.exit(0);
}
console.log(`${diffs.length} differing elements (${noise.size} noisy ignored). First ones, with properties:`);
const shown = new Set();
for (const d of diffs) {
  if (shown.size >= 8 || shown.has(d.el) || d.el.startsWith("(")) {
    if (d.el.startsWith("(")) console.log(`  ${d.run} ${d.st}: ${d.el}`);
    continue;
  }
  shown.add(d.el);
  const run = RUNS.find((r) => r.name === d.run);
  const det = async (dir) => {
    const { server, url } = await serve(dir);
    const browser = await chromium.launch();
    const s = await shoot(browser, url, run, d.st);
    await browser.close();
    server.close();
    return (s[d.st] || {})[d.el] || [];
  };
  const x = await det(dirA),
    y = await det(dirB);
  const ch = [];
  for (let i = 0; i < Math.max(x.length, y.length); i++)
    if (x[i] !== y[i])
      ch.push(
        `${(x[i] || y[i] || "").split("=")[0]}: ${(x[i] || "").split("=").slice(1).join("=")} → ${(y[i] || "").split("=").slice(1).join("=")}`,
      );
  console.log(
    `  ${d.run} ${d.st} ${d.kind}\n    ${d.el}\n      ` + (ch.slice(0, 6).join("\n      ") || "(only on some runs)"),
  );
}
process.exit(1);
