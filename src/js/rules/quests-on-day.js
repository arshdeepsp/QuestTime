/* ---- which quests are on a day, and which are required ---- */
import { isTotal, logOnly } from "./26-periods.js";
import { LEGACY, S } from "../core/00-state.js";
import { cfg } from "../core/config.js";
import { dayMidMin, nowMinInDay, parse, todayKey } from "../core/days.js";
import { hasEntry } from "./day-rules.js";
import { ignoredOn, isPaused, isVac } from "./modes.js";
import { vowDefs } from "./vow.js";
import { dlMin } from "../tools/deadline-breakdown.js";

export function slim(q) {
  var o = { id: q.id, type: q.type, label: q.label };
  [
    "min",
    "max",
    "from",
    "to",
    "unit",
    "note",
    "vow",
    "days",
    "opt",
    "ul",
    "step",
    "scale",
    "total",
    "due",
    "roll",
    "per",
    "lim",
    "dl",
    "subj",
    "subjs",
    "topics",
    "fin",
    "addedOn",
    "addedMin",
    "startOn",
    "rem",
  ].forEach(function (f) {
    if (q[f] != null && q[f] !== "") o[f] = q[f];
  });
  return o;
}
export function scheduled(q, k) {
  return !q.days || !q.days.length || q.days.indexOf(parse(k).getDay()) >= 0;
}
export function activeDefs(k) {
  var vc = isVac(k),
    c0 = cfg(),
    LD = c0.lockDay && c0.lockDay.date === k ? c0.lockDay.defs : null,
    src = c0.quests.map(function (q) {
      return LD && LD[q.id] ? LD[q.id] : q;
    });
  if (LD)
    Object.keys(LD).forEach(function (id) {
      if (
        !c0.quests.some(function (q) {
          return q.id === id;
        })
      )
        src.push(LD[id]);
    });
  var vw = vowDefs(k).map(function (q) {
    return vc ? Object.assign({}, q, { opt: true }) : q;
  });
  return vw.concat(
    src
      .filter(function (q) {
        if (q.completed && q.completed.on < k) return false;
        if (q.startOn && k < q.startOn && q.type !== "todo") return false;
        if (q.type === "todo") return !q.doneOn || q.doneOn === k;
        if (q.dl && (k > q.dl.due || k < q.dl.from)) return false;
        return !isPaused(q, k) && (scheduled(q, k) || isTotal(q));
      })
      .map(function (q) {
        var o = slim(q);
        if (isTotal(q) && q.opt) o.uopt = true;
        if (isTotal(q) && !scheduled(q, k)) {
          o.opt = true;
          o.off = true;
        }
        if (q.dl) {
          o.min = dlMin(q, k);
          if (!o.min) o.opt = true;
        }
        if (vc) o.opt = true;
        if (lateStart(q, k)) o.opt = true;
        if (ignoredOn(q.id, k)) {
          o.opt = true;
          o.ign = true;
        }
        return o;
      }),
  );
}
export function stampAdded(q) {
  q.addedOn = todayKey();
  q.addedMin = nowMinInDay();
  return q;
}
export function lateStart(q, k) {
  if (!q.addedOn || q.type === "todo" || q.type === "weekly") return false;
  if (q.startOn) return false;
  if (isTotal(q)) return false;
  return k === q.addedOn && (q.addedMin || 0) >= dayMidMin(k);
}
/* Required each day: not optional, not X-times-a-week, not a to-do, and not a period total (q.roll): totals are judged
     once, at the end of their period (see periodCheck in compute). */
export function reqOf(d) {
  return d.filter(function (q) {
    return !q.opt && q.type !== "weekly" && q.type !== "todo" && !isTotal(q) && !logOnly(q);
  });
}
export function reqDefsFor(k) {
  if (isVac(k)) return [];
  var e = S.days[k];
  return reqOf(e && e.q ? e.q : hasEntry(e) ? LEGACY : activeDefs(k));
}
export function defsOf(e) {
  return (e && e.q) || (hasEntry(e) ? LEGACY : activeDefs(todayKey()));
}
