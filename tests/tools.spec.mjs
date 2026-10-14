import { test, expect } from "@playwright/test";
import { openApp } from "./helpers.mjs";

const Q = [{ id: "cs", type: "time", label: "CS work", min: 60 }];
const menu = (page) => page.locator(".qmenu button").allTextContents();

test("the bar shows Just 5, Schedule and a tools menu", async ({ page }) => {
  await openApp(page, { cfg: { quests: Q } });
  await expect(page.locator("#sp5Btn")).toBeVisible();
  await expect(page.locator("#schBtn")).toBeVisible();
  await expect(page.locator("#toolsBtn")).toBeVisible();
  await page.click("#schBtn");
  await expect(page.locator("#schPage")).toBeVisible();
});

test("the tools menu has Pomodoro and Sprint, plus Pick and Batch when quick-start tools are on", async ({ page }) => {
  await openApp(page, { cfg: { quests: Q } });
  await page.click("#toolsBtn");
  expect(await menu(page)).toEqual(["Pomodoro", "Sprint", "Edit quests", "Minimal view", "Cancel"]);
  await page.click("#toolsBtn");
  await expect(page.locator(".qmenu")).toHaveCount(0);
  await page.evaluate(() => { const c = JSON.parse(localStorage.getItem("pc-cache-v1")); c.cfg.sparkTools = true; localStorage.setItem("pc-cache-v1", JSON.stringify(c)); });
  await page.reload();
  await page.click("#toolsBtn");
  expect(await menu(page)).toEqual(["Pomodoro", "Sprint", "Pick for me", "Batch to-dos", "Edit quests", "Minimal view", "Cancel"]);
  await page.click(".qmenu button:has-text('Batch to-dos')");
  await expect(page.locator("#gTitle")).toHaveText("Batch to-dos");
});

test("Sprint opens from the tools menu", async ({ page }) => {
  await openApp(page, { cfg: { quests: Q } });
  await page.click("#toolsBtn");
  await page.click(".qmenu button:has-text('Sprint')");
  await expect(page.locator("#gTitle")).toHaveText("Start a sprint");
});

for (const width of [360, 390]) {
  test.describe(`phone ${width}`, () => {
    test.use({ viewport: { width, height: 800 }, isMobile: true, hasTouch: true });
    test("the three buttons fit on one row", async ({ page }) => {
      await openApp(page, { cfg: { quests: Q } });
      const tops = await page.evaluate(() => ["sp5Btn", "schBtn", "toolsBtn"].map((id) => Math.round(document.getElementById(id).getBoundingClientRect().top)));
      expect(new Set(tops).size).toBe(1);
      const over = await page.evaluate(() => { const b = document.getElementById("sparkBar").getBoundingClientRect(); return document.getElementById("toolsBtn").getBoundingClientRect().right > b.right + 1; });
      expect(over).toBe(false);
    });
  });
}

test("the daily wrap-up builds both pages of the PDF and downloads it", async ({ page }) => {
  const J = { id: "j", type: "check", label: "Journal" }, R = { id: "rd", type: "time", label: "Reading", min: 30 };
  await openApp(page, { cfg: { quests: [J, R] }, days: { "2026-11-01": { j: true, rd: 40, q: [J, R] }, "2026-10-31": { j: true, q: [J, R] } } });
  await expect(page.locator("#wrapBtn")).toBeEnabled();
  const dl = page.waitForEvent("download", { timeout: 15000 });
  await page.evaluate(() => document.getElementById("wrapBtn").click());
  expect((await dl).suggestedFilename()).toBe("productivitycraft-wrapup-2026-11-01.pdf");
  await expect(page.locator("#sync")).toHaveText("Wrap-up saved");
});

test("the two quick actions above the list can be chosen in Settings › Add-ons; the ⋮ menu offers the rest", async ({ page }) => {
  await openApp(page, { cfg: { quests: Q, sparkTools: true } });
  await expect(page.locator("#sparkBar [data-qk]")).toHaveText(["▶ Just 5 minutes", "◷ Schedule"]);
  await page.click("#setBtn");
  await page.click("[data-st='extras']");
  await page.selectOption("#setQk1", "pomo");
  await page.click("[data-go=today]");
  await expect(page.locator("#sparkBar [data-qk]")).toHaveText(["▶ Just 5 minutes", "● Pomodoro"]);
  await expect(page.locator("#schBtn")).toHaveCount(0);
  await page.click("#pmBtn");
  await expect(page.locator("#pomoPage")).toBeVisible();
  await page.click("#pmOk");
  await page.click("#toolsBtn");
  expect(await menu(page)).toEqual(["Schedule", "Sprint", "Pick for me", "Batch to-dos", "Edit quests", "Minimal view", "Cancel"]);
  await page.click(".qmenu button:has-text('Schedule')");
  await expect(page.locator("#schPage")).toBeVisible();
  await page.click("#schOk");
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("pc-cache-v1")).cfg.quick)).toEqual(["j5", "pomo"]);
});

test("picking the same action for both slots swaps them", async ({ page }) => {
  await openApp(page, { cfg: { quests: Q, sparkTools: true, quick: ["sprint", "sch"] } });
  await expect(page.locator("#sparkBar [data-qk]")).toHaveText(["▶▶ Sprint", "◷ Schedule"]);
  await page.click("#setBtn");
  await page.click("[data-st='extras']");
  await page.selectOption("#setQk0", "sch");
  await expect(page.locator("#setQk1")).toHaveValue("sprint");
  await page.click("[data-go=today]");
  await expect(page.locator("#sparkBar [data-qk]")).toHaveText(["◷ Schedule", "▶▶ Sprint"]);
  await page.click("#sprBtn");
  await expect(page.locator("#gTitle")).toHaveText("Start a sprint");
});
