/* ---- period totals: periods, work days, targets and pace ---- */
import { G } from "../core/g.js";
import { MID_FRAC, S, START_KEY } from "../core/00-state.js";
import { cfg } from "../core/config.js";
import { add, daysBetween, key, parse, todayKey, weekStart } from "../core/days.js";
import { isVac, noStreakIn } from "./modes.js";
import { dayDefMap, firstSeen } from "./past-days.js";
import { scheduled, slim } from "./quests-on-day.js";

export var eKey, PER_NAME;

export function indexDays() {
  eKey = new WeakMap();
  Object.keys(S.days).forEach(function (k) {
    if (S.days[k]) eKey.set(S.days[k], k);
  });
}
export function perOf(q) {
  return q && (q.per === "2w" || q.per === "month") ? q.per : "";
}
export function perStart(q, k) {
  var p = perOf(q);
  if (p === "month") return k.slice(0, 8) + "01";
  var ws = weekStart(k);
  if (p === "2w") {
    var n = Math.round(daysBetween(weekStart(rollFrom(q)), ws) / 7);
    if (((n % 2) + 2) % 2 === 1) ws = add(ws, -7);
  }
  return ws;
}
export function perEnd(q, k) {
  var p = perOf(q),
    s = perStart(q, k);
  if (p === "month") {
    var d = parse(s);
    return key(new Date(d.getFullYear(), d.getMonth() + 1, 0));
  }
  return add(s, p === "2w" ? 13 : 6);
}
/* Scheduled days in the period, each day judged by that day's version of the quest (so changing its days mid-period
     keeps the target's numerator and denominator on the same footing). */
export function perWorkDays(q, k) {
  var n = 0;
  for (var d = perStart(q, k), e = perEnd(q, k); d <= e; d = add(d, 1)) if (scheduled(dayDefMap(d)[q.id] || q, d)) n++;
  return n || 1;
}
export function perWord(q) {
  return PER_NAME[perOf(q)];
}
export function cfgQ(id) {
  return cfg().quests.filter(function (q) {
    return q.id === id;
  })[0];
}
export function rollSum(id, k, q) {
  q = q || cfgQ(id);
  var s = 0,
    ws = q ? perStart(q, k) : weekStart(k);
  for (var d = ws; d <= k; d = add(d, 1)) {
    if (d < START_KEY) continue;
    s += (S.days[d] || {})[id] | 0;
  }
  return s;
}
export function weekFrom(q, k) {
  var ws = perStart(q, k),
    f = rollFrom(q);
  return f > ws ? f : ws;
}
/* A work day for a total: it's on that day's list, not an off day, not on vacation (a paused day isn't on the list). */
export function workOn(q, d) {
  var x = dayDefMap(d)[q.id];
  return !!x && !x.off && scheduled(x, d) && !isVac(d);
}
export function workDaysIn(q, a, b) {
  var n = 0;
  for (var d = a; d <= b; d = add(d, 1)) if (workOn(q, d)) n++;
  return n;
}
/* Halfway checkpoint: the ceil(n/2)-th work day of the period (from the quest's start in a first period). By the end
     of it you need a third (MID_FRAC) of the period's target, so work can't all pile up at the end. Once a day has passed with the
     checkpoint on it, that's fixed (e.ck); if a later change would move it onto a day already gone, it's today. */
export function midAt(q, k, now) {
  var f = weekFrom(q, k),
    e = perEnd(q, k),
    L = [],
    cf = S.cfg && S.cfg.ckFrom;
  if (cf && perStart(q, k) < cf) return null;
  for (var d = f; d <= e; d = add(d, 1)) {
    if (d < now) {
      var x = S.days[d];
      if (x && x.ck && x.ck.indexOf(q.id) >= 0) return d;
    }
    if (workOn(q, d)) L.push(d);
  }
  if (!L.length) return null;
  var m = L[Math.ceil(L.length / 2) - 1];
  return m < now ? (now <= e ? now : null) : m;
}
export function midDay(q, k) {
  return midAt(q, k, todayKey());
}
export function midNeed(q, k) {
  return Math.round(weekTarget(q, k) * MID_FRAC);
}
/* Totals judged in the period around day k: every total on the list on any day of the period so far or still to
     come (so pausing it or deleting it doesn't skip the check), unless it's marked optional. Latest version wins. */
export function periodList(k) {
  var C = {},
    T = todayKey();
  cfg().quests.forEach(function (q) {
    if (q.type === "time" && q.roll) C[q.id] = q;
  });
  for (var d = add(k, -31); d < k; d = add(d, 1)) {
    var e = S.days[d];
    ((e && e.q) || []).forEach(function (q) {
      if (q.type === "time" && q.roll && !C[q.id]) C[q.id] = q;
    });
  }
  var out = [];
  Object.keys(C).forEach(function (id) {
    var q0 = C[id],
      last = null,
      uo = false;
    for (var d = perStart(q0, k), e = perEnd(q0, k); d <= e; d = add(d, 1)) {
      var x = dayDefMap(d)[id];
      if (!x) continue;
      last = x;
      if (x.uopt) uo = true;
      else if (!isVac(d) && !x.off) uo = !!x.opt;
    }
    var md0 = midDay(q0, k),
      upto = md0 && md0 >= k ? md0 : perEnd(q0, k);
    if (last && !uo && !noStreakIn(weekFrom(q0, k), upto)) out.push(slim(cfgQ(id) || last));
  });
  return out;
}
export function weekTarget(q, k) {
  var f = weekFrom(q, k);
  return Math.round((q.roll * workDaysIn(q, f, perEnd(q, k))) / perWorkDays(q, k));
}
export function rollFrom(q) {
  var f = q.startOn || q.addedOn || firstSeen(q.id) || START_KEY;
  return f > START_KEY ? f : START_KEY;
}
/* Pace needed by the end of day k: the straight-line share (so a surplus covers later empty days), but if you're
     behind, the shortfall is spread over the period's remaining work days instead of landing on the next one. */
export function rollNeed(q, k) {
  var lin = Math.round((q.roll * workDaysIn(q, weekFrom(q, k), k)) / perWorkDays(q, k)),
    before = rollSum(q.id, k, q) - ((S.days[k] || {})[q.id] | 0);
  if (!scheduled(q, k)) return Math.min(lin, before);
  var left = workDaysIn(q, k, perEnd(q, k));
  if (left < 1) return lin;
  return Math.min(lin, Math.round(before + Math.max(0, weekTarget(q, k) - before) / left));
}
export function timeMet(q, e) {
  var v = e[q.id] | 0;
  if (q.roll) {
    var k = eKey.get(e);
    if (!k) return false;
    return rollSum(q.id, k, q) >= rollNeed(q, k);
  }
  return v >= q.min;
}

/* Runs once at startup, in file-number order (main.js). */
export function init() {
  /* eKey: day entry → its date, rebuilt by compute() (indexDays), so code holding only an entry can find its day. */
  eKey = new WeakMap();
  /* Time totals run over a period: the calendar week (default), two weeks (q.per "2w", counted from the week the
     quest started) or the calendar month (q.per "month"). Pace spreads the total across the period's work days. */
  PER_NAME = { "": "week", "2w": "2 weeks", month: "month" };
  /* Past days are frozen: lockPast() gives every passed day a snapshot of its quests (e.q, if it has none) and its
     halfway checkpoints (e.ck = quest ids whose checkpoint fell on it), as they stood when the day ended. Later edits,
     pauses or deletions then never rewrite history. dayDefMap(d) = quests on day d: the snapshot for past days, the
     live settings for today and later. */
  G.lockedThru = null;
  G.lockDays = null;
  G.lockStart = null;
  G.ddm = {};
  G.ddmKey = "";
  G.firstSeenCache = {};
  G.firstSeenSig = "";
}
