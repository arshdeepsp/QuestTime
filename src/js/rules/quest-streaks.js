/* ---- per-quest streaks (display only) ---- */
import { S, START_KEY, STREAK_TYPES } from "../core/00-state.js";
import { add } from "../core/days.js";
import { cfgQ, logOnly } from "./26-periods.js";
import { metQ } from "./day-rules.js";
import { isPaused } from "./modes.js";
import { dayDefMap, firstSeen } from "./past-days.js";
import { scheduled } from "./quests-on-day.js";

export function qStreakable(q) {
  return !!q && STREAK_TYPES[q.type] && !q.roll && !logOnly(q);
}
export function qDayState(id, d) {
  var cq = cfgQ(id),
    from = cq ? cq.addedOn || firstSeen(id) : null;
  if (from && d < from) return null;
  var q = dayDefMap(d)[id];
  if (!q) {
    if (!cq || !qStreakable(cq)) return null;
    return !scheduled(cq, d) || isPaused(cq, d) || (cq.startOn && d < cq.startOn) ? "skip" : null;
  }
  if (!qStreakable(q)) return null;
  if (q.off || q.ign || !scheduled(q, d)) return "skip";
  return metQ(q, S.days[d] || {}) ? "met" : "miss";
}
export function qStreak(id, k) {
  var n = 0,
    d = k,
    st = qDayState(id, k);
  if (st === "miss") d = add(k, -1);
  for (var i = 0; i < 400 && d >= START_KEY; i++, d = add(d, -1)) {
    var x = qDayState(id, d);
    if (x === null) break;
    if (x === "skip") continue;
    if (x === "met") n++;
    else break;
  }
  return n;
}
export function qConsist(id, k) {
  var met = 0,
    sch = 0;
  for (var i = 0; i < 30; i++) {
    var d = add(k, -i);
    if (d < START_KEY) break;
    var x = qDayState(id, d);
    if (x === "met") {
      met++;
      sch++;
    } else if (x === "miss") sch++;
  }
  return { met: met, sch: sch };
}
