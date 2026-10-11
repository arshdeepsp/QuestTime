/* ---- XP, levels and weekly counts ---- */
import { CALL_CAP, CALL_XP, S, START_KEY } from "../core/00-state.js";
import { add, todayKey, weekStart } from "../core/days.js";
import { completionXP } from "../quests/35c-finish-lines.js";
import { gold, hasEntry, metQ, ok, planOf } from "./day-rules.js";
import { defsOf } from "./quests-on-day.js";

export function dayXP(e) {
  if (!e) return 0;
  var x = 0;
  defsOf(e).forEach(function (q) {
    if (q.type !== "time") {
      if (metQ(q, e) && q.type !== "limit" && q.type !== "wake" && hasEntry(e)) x += q.opt ? 10 : 20;
      return;
    }
    var d = Math.min(240, e[q.id] | 0);
    x += d;
    if (d > 0 && d >= planOf(q, e)) x += 30;
  });
  x +=
    (e.sess || []).filter(function (z) {
      return z.m >= 90;
    }).length * 25;
  x += Math.min(CALL_CAP, e.calls | 0) * CALL_XP;
  if (ok(e)) x += 50;
  if (gold(e)) x += 100;
  return Math.max(0, x);
}
export function weekCount(id, k, upto) {
  var s0 = weekStart(k),
    n = 0;
  for (var i = 0; i < 7; i++) {
    var d = add(s0, i);
    if (upto && d > k) break;
    if ((S.days[d] || {})[id] === true) n++;
  }
  return n;
}
export function totalXP(upto) {
  var t = upto || todayKey(),
    x = completionXP(t);
  Object.keys(S.days).forEach(function (k) {
    if (k >= START_KEY && k <= t) {
      var e = S.days[k];
      x += dayXP(e);
      if (e)
        defsOf(e).forEach(function (q) {
          if (q.type === "weekly" && e[q.id] === true && weekCountOn(q.id, k) === q.min) x += 100;
        });
    }
  });
  return x;
}
export function weekCountOn(id, k) {
  var n = 0;
  for (var d = weekStart(k); d <= k; d = add(d, 1)) if ((S.days[d] || {})[id] === true) n++;
  return n;
}
/* XP spent on streak repairs comes off the level, never off the day totals. */
export function xpNet(upto) {
  return Math.max(0, totalXP(upto) - ((S.cfg && S.cfg.xpSpent) | 0));
}
export function level(x) {
  var l = 1,
    need = 300;
  while (x >= need) {
    x -= need;
    l++;
    need = 300 * l;
  }
  return { l: l, cur: x, need: need };
}
