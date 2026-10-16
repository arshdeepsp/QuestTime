/* ---- daily quest limit (cfg.cap): required quests per weekday ---- */
import { logOnly } from "../rules/26-periods.js";
import { cfg } from "../core/config.js";

export var WDN, WDS;

export function capOf() {
  return cfg().cap || 10;
}
export function countsOnDay(q) {
  return q && q.type !== "todo" && q.type !== "weekly" && !q.completed && !q.opt && !logOnly(q);
}
export function dayLoad(L) {
  var c = [0, 0, 0, 0, 0, 0, 0];
  (L || cfg().quests).forEach(function (q) {
    if (!countsOnDay(q)) return;
    var d = q.days && q.days.length ? q.days : [0, 1, 2, 3, 4, 5, 6];
    d.forEach(function (w) {
      c[w]++;
    });
  });
  return c;
}
export function overDays(L, cap) {
  var c = dayLoad(L),
    k = cap || capOf(),
    out = [];
  c.forEach(function (n, w) {
    if (n > k) out.push({ w: w, n: n });
  });
  return out;
}
export function busiest(L) {
  var c = dayLoad(L),
    m = 0,
    w = 1;
  c.forEach(function (n, i) {
    if (n > m) {
      m = n;
      w = i;
    }
  });
  return { w: w, n: m };
}
export function overMsg(ov, cap) {
  return (
    ov
      .map(function (o) {
        return WDN[o.w] + " would have " + o.n;
      })
      .join(", ") +
    " quests (limit " +
    (cap || capOf()) +
    " per day). Untick some days, make one optional, or complete one first."
  );
}
export function wouldExceed(newQ) {
  var L = cfg().quests.concat([newQ]);
  return overDays(L);
}

/* Runs once at startup, in file-number order (main.js). */
export function init() {
  WDN = ["Sundays", "Mondays", "Tuesdays", "Wednesdays", "Thursdays", "Fridays", "Saturdays"];
  WDS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
}
