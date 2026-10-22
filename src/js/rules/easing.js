/* ---- easing changes ---- Challenge mode: a change that makes a quest easier (lower goal, delete, pause, optional, fewer
     days, later start, daily -> total, raised limit) takes effect tomorrow via cfg.lockDay = {date, defs}: today keeps the
     old definitions, so a change can never rescue a failing day. Setup week (first 7 days) and Casual mode apply at once. */
import { START_KEY } from "../core/00-state.js";
import { add, todayKey } from "../core/days.js";
import { clone, fmtD, num } from "../core/util.js";
import { isPaused, rewardsOff } from "./modes.js";

export function easeInfo() {
  var T = todayKey(),
    setupEnd = add(START_KEY, 7);
  return { T: T, setup: T < setupEnd, setupEnd: setupEnd };
}
export function allDays(q) {
  return q.days && q.days.length ? q.days : [0, 1, 2, 3, 4, 5, 6];
}
export function isEasier(o, n, T) {
  if (n.type !== o.type) return true;
  if (!o.opt && n.opt) return true;
  if ((o.type === "time" || o.type === "target") && o.type === n.type) {
    if (!o.roll && n.roll) return true;
    if (o.roll && n.roll && num(n.roll) < num(o.roll)) return true;
  }
  if (n.startOn && n.startOn > (o.startOn || "")) return true;
  if (n.pausedUntil && n.pausedUntil !== o.pausedUntil && isPaused(n, add(T, 1))) return true;
  var nd = allDays(n);
  if (
    allDays(o).some(function (d) {
      return nd.indexOf(d) < 0;
    })
  )
    return true;
  if (
    (o.type === "time" || o.type === "target" || o.type === "weekly" || o.type === "scale") &&
    num(n.min) < num(o.min)
  )
    return true;
  if (o.type === "scale" && (n.scale || 5) !== (o.scale || 5)) return true;
  if (o.type === "limit" && (num(n.max) > num(o.max) || (n.unit || "") !== (o.unit || ""))) return true;
  if (o.type === "wake" && (n.from < o.from || n.to > o.to)) return true;
  return false;
}
export function easedIds(oldQ, newQ, T) {
  var nm = {};
  newQ.forEach(function (q) {
    nm[q.id] = q;
  });
  var ids = [];
  oldQ.forEach(function (o) {
    if (o.type === "todo") return;
    var n = nm[o.id];
    if (!n || isEasier(o, n, T)) ids.push(o.id);
  });
  return ids;
}
export function guardEasing(c, oldQ, ids) {
  var inf = easeInfo();
  if (inf.setup || !ids.length || rewardsOff()) return { ok: true, eased: 0 };
  var L = c.lockDay && c.lockDay.date === inf.T ? c.lockDay.defs : {};
  oldQ.forEach(function (o) {
    if (ids.indexOf(o.id) >= 0 && !L[o.id]) L[o.id] = clone(o);
  });
  c.lockDay = { date: inf.T, defs: L };
  return { ok: true, eased: ids.length };
}
export function easeNote() {
  var inf = easeInfo();
  if (rewardsOff()) return "Casual mode: changes apply right away.";
  if (inf.setup) return "Setup week: every change is immediate through " + fmtD(add(inf.setupEnd, -1)) + ".";
  return "Changes that make a quest easier start tomorrow, so they can\u2019t rescue today.";
}
