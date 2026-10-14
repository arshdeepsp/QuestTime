/* ---- hash routes ----
     The address bar names what's on screen. Views are "#today", "#subjects", "#rules", "#achievements", "#trends" and
     "#settings" (go() in 44-navigation.js); Settings categories add "#settings/<cat>"; the full-screen pages have
     "#pomodoro", "#schedule" ("#schedule/<date>" for a later day) and "#help" ("#help/<topic>"). Opening a page or a
     category pushes its hash (pageNav); closing it rewrites the entry to the view beneath (pageBack), so a deep link
     closes in place instead of leaving the site and the browser's Back closes a page too. popstate/hashchange and startup run applyRoute, which opens or closes whatever the hash says; the open and
     close functions themselves are idempotent and only touch the hash when it doesn't already match. */
import { G } from "../core/g.js";
import { add, todayKey } from "../core/days.js";
import { SCH_AHEAD } from "../schedule/51-schedule.js";
import { closeSchedule, openSchedule, schDraw, schOpen } from "../schedule/page.js";
import { renderSettings } from "../settings/10-settings.js";
import { closePomo, openPomo, pmOpen } from "../timer/43b-pomodoro.js";
import { closeHelp, hpOpen, openHelp } from "./24-help.js";
import { curView, go } from "./44-navigation.js";

export function pageNav(h) {
  if (location.hash === h) return;
  try {
    history.pushState(null, "", h);
  } catch (x) {
    location.hash = h.slice(1);
  }
}
/* Replace the current entry's hash (a schedule day change, say) without adding history. */
export function pageSwap(h) {
  if (location.hash === h) return;
  try {
    history.replaceState(history.state, "", h);
  } catch (x) {}
}
/* Leaving a page rewrites the current entry rather than calling history.back(): back() is asynchronous, and code that
     closes one page to open another (a schedule block's Pomodoro button, Resume) would race its popstate. The browser's
     Back still closes a page, since the entry beneath carries the view's hash. */
export function pageBack(fallback) {
  if (location.hash === fallback) return;
  try {
    history.replaceState(null, "", fallback);
  } catch (x) {}
}
export function viewHash() {
  return "#" + (curView || "today") + (curView === "settings" && G.setTab ? "/" + G.setTab : "");
}
export function applyRoute(h) {
  var parts = (h || "#today").slice(1).split("/"),
    head = parts[0],
    arg = parts[1] || "";
  if (head === "pomodoro") {
    openPomo();
    return;
  }
  if (head === "schedule") {
    var T = todayKey(),
      k = /^\d{4}-\d\d-\d\d$/.test(arg) && arg > T && arg <= add(T, SCH_AHEAD) ? arg : null;
    if (!schOpen()) openSchedule();
    if (G.schDay !== k && schOpen()) {
      G.schDay = k;
      schDraw(true);
    }
    return;
  }
  if (head === "help") {
    openHelp(arg || undefined);
    return;
  }
  if (pmOpen()) closePomo();
  if (schOpen()) closeSchedule();
  if (hpOpen()) closeHelp();
  go(head, true);
  if (head === "settings" && (arg || null) !== (G.setTab || null)) {
    G.setTab = arg || null;
    renderSettings();
  }
}
/* At startup the view is shown at once, but a page in the hash opens only once every module's init has run (the
     schedule's init comes after the boot's). */
export function bootRoute() {
  var head = (location.hash || "#today").slice(1).split("/")[0];
  if (["pomodoro", "schedule", "help"].indexOf(head) >= 0) {
    go("today", true);
    setTimeout(function () {
      applyRoute(location.hash);
    }, 0);
  } else applyRoute(location.hash);
}
