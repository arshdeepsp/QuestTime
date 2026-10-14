export const APP = "http://127.0.0.1:4173/index.html";

export async function openApp(page, { now = "2026-11-02T09:00:00-05:00", cfg = {}, days = {}, notes, extra = {}, hash = "" } = {}) {
  await page.clock.install({ time: new Date(now) });
  const state = { days, ...(notes ? { notes } : {}), cfg: { quests: [], rules: [], idleGrove: 0, start: "2026-10-01T04:00:00.000Z", updated: "2026-10-01T10:00:00Z", ...cfg } };
  await page.addInitScript(([s, x]) => {
    localStorage.setItem("pc-welcomed", "1");
    if (!("pc-splash" in x)) localStorage.setItem("pc-splash", "off");
    if (!("pc-noacct" in x)) sessionStorage.setItem("pc-noacct", "1");
    if (!localStorage.getItem("pc-cache-v1")) localStorage.setItem("pc-cache-v1", s);
    for (const [k, v] of Object.entries(x)) localStorage.setItem(k, v);
  }, [JSON.stringify(state), extra]);
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.goto(APP + hash);
  await page.waitForTimeout(300);
  if (await page.evaluate(() => !document.getElementById("gModal").hidden)) await page.keyboard.press("Escape");
  return errors;
}

export const visibleLabels = (page) =>
  page.evaluate(() => [...document.querySelectorAll("#quests .q")].filter((r) => r.offsetParent).map((r) => r.querySelector(".lbl").textContent));

export function dayRange(from, to, make) {
  const out = {};
  for (let d = new Date(from + "T12:00:00"); d <= new Date(to + "T12:00:00"); d.setDate(d.getDate() + 1)) {
    const k = d.toISOString().slice(0, 10);
    out[k] = make(k);
  }
  return out;
}

/* Touch swipe over an element's left/right part (needs hasTouch); dir = "left" | "right". */
export async function swipe(page, locator, dir = "left") {
  await locator.evaluate((el) => el.scrollIntoView({ block: "center" }));
  await page.waitForTimeout(100);
  const b = await locator.boundingBox();
  const cdp = await page.context().newCDPSession(page);
  const y = b.y + b.height / 2, x = dir === "left" ? b.x + b.width * 0.55 : b.x + 10, step = dir === "left" ? -20 : 20;
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y, id: 1 }] });
  for (let i = 1; i <= 6; i++) await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: x + i * step, y, id: 1 }] });
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await cdp.detach();
  await page.waitForTimeout(200);
}
