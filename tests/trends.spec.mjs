import { test, expect } from "@playwright/test";
import { openApp } from "./helpers.mjs";

const Q = [{ id: "cs", type: "time", label: "CS work", min: 60 }];
const SJ = [{ id: "s1", name: "Maths", topics: [{ id: "a", name: "Algebra", p: 3, target: 4, hist: [{ d: "2026-09-01", p: 1 }, { d: "2026-10-20", p: 3 }] }, { id: "b", name: "Bayes", p: 2, hist: [] }] }];
const at = (d, h, m) => new Date(`${d}T${String(h).padStart(2, "0")}:00:00-05:00`).getTime() + m * 60000;

test("Trends shows this week's topic time, plan kept and reminders, and the top topics", async ({ page }) => {
  const days = {
    "2026-11-02": { cs: 90, q: Q, tt: { a: 60, b: 30 }, calls: 2, sched: [{ id: "x", q: "cs", f: 600, t: 660 }] },
    "2026-11-01": { cs: 120, q: Q, tt: { b: 120 }, sess: [{ id: "cs", s: at("2026-11-01", 14, 0), e: at("2026-11-01", 16, 0), m: 120 }] }
  };
  const errors = await openApp(page, { cfg: { quests: Q, subjects: SJ, addTrends: true }, days, extra: { "pc-rerate": "2026-11-02" }, hash: "#trends" });
  const tile = (l) => page.locator(".ttile", { hasText: l });
  await expect(tile("Topic time").locator(".tt-v")).toHaveText("1h 30m");
  await expect(tile("Topic time").locator(".tt-s")).toHaveText("Most: Algebra");
  await expect(tile("Plan kept").locator(".tt-v")).toHaveText("1/1");
  await expect(tile("Reminders").locator(".tt-v")).toHaveText("2");
  await expect(page.locator(".ttop-n b")).toHaveText(["Bayes", "Algebra"]);
  await expect(page.locator(".ttop-r").last()).toContainText("3/5 → 4/5");
  await expect(page.locator(".ttop-f")).toContainText("▲ 2 levels gained in 30 days");
  await expect(page.locator(".tnote")).toHaveText("Most focus around 14:00");
  await expect(page.locator(".tsec-h")).toHaveText(["This week", "Topics", "Pomodoro", "Charts", "Records"]);
  expect(errors).toEqual([]);
});
