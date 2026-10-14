import { test, expect } from "@playwright/test";
import { openApp } from "./helpers.mjs";

const Q = [{ id: "cs", type: "time", label: "Coursework", min: 60 }];
const NOW = "2026-11-02T09:00:00-05:00";
const T0 = Date.parse(NOW);
const DAY = 86400000;
const store = (page) => page.evaluate(() => JSON.parse(localStorage.getItem("pc-cache-v1")));
const openCat = async (page, id) => { const b = page.locator(`[data-st='${id}']`); if (await b.count()) await b.click(); };
const note = (t, b, ageMs, more = {}) => ({ t, b, c: T0 - ageMs - DAY, u: T0 - ageMs, ...more });

test("the Notes page is an add-on: off by default and #notes falls back to Today; the Add-ons switch puts it in the title bar", async ({ page }) => {
  await openApp(page, { cfg: { quests: Q }, now: NOW, hash: "#notes" });
  await expect(page.locator("#notesBtn")).toBeHidden();
  await expect(page.locator("[data-view=today]")).toBeVisible();
  expect(await page.evaluate(() => location.hash)).toBe("#today");
  await page.click("#setBtn");
  await openCat(page, "extras");
  await page.click("#setNotes");
  await expect(page.locator("#setNotes")).toHaveAttribute("aria-checked", "true");
  await expect(page.locator("#notesBtn")).toBeVisible();
  await page.click("#notesBtn");
  await expect(page.locator("[data-view=notes]")).toBeVisible();
  expect(await page.evaluate(() => location.hash)).toBe("#notes");
  await expect(page.locator("#notesBtn")).toHaveClass(/on/);
  await expect(page.locator(".nt-empty")).toContainText("30 days");
  expect((await store(page)).cfg.addNotes).toBe(true);
});

test("Take a note saves as you type, closes into a card that says when it was edited and how long it has left", async ({ page }) => {
  await openApp(page, { cfg: { quests: Q, addNotes: true }, now: NOW, hash: "#notes" });
  await expect(page.locator("[data-view=notes]")).toBeVisible();
  await page.click("#ntNew");
  await expect(page.locator("#gTitle")).toHaveText("New note");
  await page.fill("#ntT", "Office hours");
  await page.fill("#ntB", "Tue 2–3\nDC 2306");
  await page.clock.runFor(700);
  const s = await store(page);
  const ids = Object.keys(s.notes);
  expect(ids).toHaveLength(1);
  expect(s.notes[ids[0]]).toMatchObject({ t: "Office hours", b: "Tue 2–3\nDC 2306" });
  expect(s.notes[ids[0]].u).toBeGreaterThanOrEqual(T0);
  expect(s.meta.u.notes).toBeGreaterThan(0);
  await expect(page.locator("#ntMeta")).toContainText("Edited just now · 30 days left");
  await page.click("#gClose");
  const card = page.locator(".nt-card");
  await expect(card).toHaveCount(1);
  await expect(card.locator(".nt-t")).toHaveText("Office hours");
  await expect(card.locator(".nt-b")).toHaveText("Tue 2–3\nDC 2306");
  await expect(card.locator(".nt-f")).toHaveText("just now · 30 days left");
  await card.click();
  await expect(page.locator("#gTitle")).toHaveText("Note");
  await expect(page.locator("#ntB")).toHaveValue("Tue 2–3\nDC 2306");
});

test("an empty new note is never stored, and clearing a note's text deletes it", async ({ page }) => {
  await openApp(page, { cfg: { quests: Q, addNotes: true }, now: NOW, hash: "#notes", notes: { n1: note("Milk", "", 1000) } });
  await page.click("#ntNew");
  await page.click("#gClose");
  expect(Object.keys((await store(page)).notes)).toEqual(["n1"]);
  await expect(page.locator(".nt-card")).toHaveCount(1);
  await page.locator(".nt-card").click();
  await page.fill("#ntT", "");
  await page.click("#gClose");
  await expect(page.locator(".nt-card")).toHaveCount(0);
  const n1 = (await store(page)).notes.n1;
  expect(Object.keys(n1)).toEqual(["x"]);
  expect(n1.x).toBeGreaterThanOrEqual(T0);
});

test("pin, colour and search: pinned notes come first under their own heading, a colour marks the card, search narrows the grid", async ({ page }) => {
  await openApp(page, { cfg: { quests: Q, addNotes: true }, now: NOW, hash: "#notes", notes: { a: note("Groceries", "eggs, bread", 2 * 3600000), b: note("Thesis", "ask Raouf about the RCA baseline", 5 * 60000) } });
  const cards = page.locator(".nt-card .nt-t");
  await expect(cards).toHaveText(["Thesis", "Groceries"]);
  await expect(page.locator(".nt-h")).toHaveCount(0);
  await page.locator(".nt-card", { hasText: "Groceries" }).click();
  await page.click("#ntPin");
  await expect(page.locator("#ntPin")).toHaveText("Unpin");
  await page.click(".nt-c[data-col='2']");
  await expect(page.locator("#ntEd")).toHaveClass(/c2/);
  await page.click("#gClose");
  await expect(page.locator(".nt-h")).toHaveText(["Pinned", "Others"]);
  await expect(cards).toHaveText(["Groceries", "Thesis"]);
  const g = page.locator(".nt-card", { hasText: "Groceries" });
  await expect(g).toHaveClass(/pinned/);
  await expect(g).toHaveClass(/\bc2\b/);
  await expect(g.locator(".nt-pin")).toBeVisible();
  expect((await store(page)).notes.a).toMatchObject({ pin: true, col: 2 });
  await page.fill("#ntQ", "rca");
  await page.clock.runFor(200);
  await expect(cards).toHaveText(["Thesis"]);
  await expect(page.locator("#ntQ")).toBeFocused();
  await page.fill("#ntQ", "zzz");
  await page.clock.runFor(200);
  await expect(page.locator(".nt-empty")).toContainText("No note matches");
});

test("Delete arms first, then leaves a tombstone so the deletion wins on other devices", async ({ page }) => {
  await openApp(page, { cfg: { quests: Q, addNotes: true }, now: NOW, hash: "#notes", notes: { a: note("Old", "gone soon", 1000) } });
  await page.locator(".nt-card").click();
  await page.click("#ntDel");
  await expect(page.locator("#ntDel")).toHaveText("Delete?");
  await expect(page.locator(".nt-card")).toHaveCount(1);
  await page.click("#ntDel");
  await expect(page.locator("#gModal")).toBeHidden();
  await expect(page.locator(".nt-card")).toHaveCount(0);
  const n = (await store(page)).notes.a;
  expect(Object.keys(n)).toEqual(["x"]);
  expect(n.x).toBeGreaterThanOrEqual(T0);
});

test("a note clears itself 30 days after its last edit; tombstones that old go too; the card counts the days down", async ({ page }) => {
  await openApp(page, {
    cfg: { quests: Q, addNotes: true },
    now: NOW,
    hash: "#notes",
    notes: {
      old: note("Stale", "", 31 * DAY),
      edge: note("Edge", "", 30 * DAY),
      soon: note("Soon", "", 29 * DAY + 3600000),
      fresh: note("Fresh", "", 3 * DAY),
      tomb: { x: T0 - 31 * DAY },
      tomb2: { x: T0 - 2 * DAY },
      back: { t: "Back", b: "", c: 1, x: T0 - 10 * DAY, u: T0 - DAY },
    },
  });
  await expect(page.locator(".nt-card .nt-t")).toHaveText(["Back", "Fresh", "Soon"]);
  await expect(page.locator(".nt-card", { hasText: "Soon" }).locator(".nt-f")).toHaveText("29d ago · 1 day left");
  await expect(page.locator(".nt-card", { hasText: "Fresh" }).locator(".nt-f")).toHaveText("3d ago · 27 days left");
  const s = await store(page);
  expect(Object.keys(s.notes).sort()).toEqual(["back", "fresh", "soon", "tomb2"]);
});

test("typing in a note never re-renders the quest list", async ({ page }) => {
  await openApp(page, { cfg: { quests: Q, addNotes: true }, now: NOW, hash: "#notes" });
  await page.click("#ntNew");
  await page.evaluate(() => {
    window.__mut = 0;
    new MutationObserver((m) => { window.__mut += m.length; }).observe(document.getElementById("quests"), { childList: true, subtree: true, attributes: true, characterData: true });
  });
  await page.fill("#ntB", "first line");
  await page.clock.runFor(700);
  await page.type("#ntB", " and more");
  await page.clock.runFor(700);
  expect((await store(page)).notes[Object.keys((await store(page)).notes)[0]].b).toBe("first line and more");
  expect(await page.evaluate(() => window.__mut)).toBe(0);
});

test("turning the add-on off while on the page goes back to Today", async ({ page }) => {
  await openApp(page, { cfg: { quests: Q, addNotes: true }, now: NOW, hash: "#notes" });
  await expect(page.locator("[data-view=notes]")).toBeVisible();
  await page.click("#setBtn");
  await openCat(page, "extras");
  await page.click("#setNotes");
  await expect(page.locator("#notesBtn")).toBeHidden();
  await page.goto("http://127.0.0.1:4173/index.html#notes");
  await expect(page.locator("[data-view=today]")).toBeVisible();
});

test.describe("phone", () => {
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  test("an existing note opens full screen to read, keyboard closed; a new note starts in the title", async ({ page }) => {
    await openApp(page, { cfg: { quests: Q, addNotes: true }, now: NOW, hash: "#notes", notes: { a: note("Thesis", "ask about the baseline", 5 * 60000) } });
    await page.locator(".nt-card").click();
    await expect(page.locator("#gModal")).toBeVisible();
    expect(await page.evaluate(() => document.activeElement && document.activeElement.id)).not.toMatch(/^nt[TB]$/);
    await page.evaluate(() => document.documentElement.style.setProperty("--sat", "40px"));
    const card = await page.locator("#gModal .modal-card").boundingBox();
    expect(Math.round(card.y)).toBe(40);
    expect(Math.round(card.height)).toBeGreaterThanOrEqual(800);
    const ta = await page.locator("#ntB").boundingBox();
    expect(ta.height).toBeGreaterThan(300);
    await page.click("#gClose");
    await expect(page.locator("#gModal")).toHaveClass(/^((?!nt).)*$/);
    await page.click("#ntNew");
    await expect(page.locator("#ntT")).toBeFocused();
  });
});

test("opening several notes in a row doesn't stack editor handlers: Delete still arms first, Pin toggles once", async ({ page }) => {
  await openApp(page, { cfg: { quests: Q, addNotes: true }, now: NOW, hash: "#notes", notes: { a: note("A", "one", 1000), b: note("B", "two", 2000), c: note("C", "three", 3000) } });
  for (const id of ["a", "b"]) {
    await page.locator(`.nt-card[data-nt=${id}]`).click();
    await page.click("#gClose");
  }
  await page.locator(".nt-card[data-nt=c]").click();
  await page.click("#ntPin");
  await expect(page.locator("#ntPin")).toHaveText("Unpin");
  expect((await store(page)).notes.c.pin).toBe(true);
  await page.click("#ntDel");
  await expect(page.locator("#ntDel")).toHaveText("Delete?");
  await expect(page.locator("#gModal")).toBeVisible();
  await page.click("#ntDel");
  await expect(page.locator("#gModal")).toBeHidden();
  await expect(page.locator(".nt-card")).toHaveCount(2);
});
