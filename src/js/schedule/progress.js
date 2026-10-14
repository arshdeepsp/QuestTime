/* ---- how much of each block was done, and re-planning what's short ---- */
import { G } from "../core/g.js";
import { S } from "../core/00-state.js";
import { atMin, dayWin, nowMinInDay, todayKey } from "../core/days.js";
import { hm } from "../core/util.js";
import { metQ } from "../rules/day-rules.js";
import { SCH_STEP } from "./51-schedule.js";
import { hhmmOf, schAll, schFree, schLeft, schLen, schNewId, schOfQ, schQuests, schSave } from "./model.js";

/* Start/resume a block under way: now inside it, no timer on its quest, time left (what's left of the block, never more
     than the time until its end). "Resume" once some minutes were timed inside it, else "Start". Once its end has passed (or you pull the end in to finish early) there's nothing to resume.
     The schedule footer (with or without the block selected) and the quest row offer Resume whenever that holds. The persistent
     notification (id 905, ongoing; strict) also needs today's share/minimum not done yet and the block not re-planned since you
     last worked in it, so it never nags after you've deliberately finished. */
/* Minutes credited to a block: every timed stretch of its quest (sessions, plus a running timer) that overlaps it gives
     the block the overlap; the part outside all of that quest's blocks goes to the block it overlaps most. So starting late
     or running over still counts for the block, and nothing is counted twice. Stretches that touch no block credit none. */
export function schSess(T, qid) {
  var L = ((S.days[T] || {}).sess || [])
    .filter(function (z) {
      return z.id === qid;
    })
    .map(function (z) {
      return { s: z.s, e: z.e };
    });
  if (S.timer && S.timer.id === qid && S.timer.day === T) L.push({ s: S.timer.start, e: Date.now() });
  return L;
}
export function schDoneIn(T, b) {
  if (!b || !b.q) return 0;
  var Bs = schOfQ(T, b.q),
    ix = -1,
    m = 0;
  Bs.forEach(function (x, i) {
    if (x.id === b.id) ix = i;
  });
  if (ix < 0) return 0;
  schSess(T, b.q).forEach(function (z) {
    var ov = Bs.map(function (x) {
        return Math.max(0, Math.min(z.e, atMin(T, x.t)) - Math.max(z.s, atMin(T, x.f)));
      }),
      tot = 0,
      top = 0;
    ov.forEach(function (v, i) {
      tot += v;
      if (v > ov[top]) top = i;
    });
    if (!ov[ix]) return;
    m += ov[ix];
    if (top === ix) m += Math.max(0, z.e - z.s - tot);
  });
  return Math.round(m / 60000);
}
/* After a block ends short: what's missing from it, but never more than the quest still needs today (share/minimum minus
     time logged and blocks still ahead). Blocks already re-planned for it (rf = the short block's id) count against it, so
     removing one brings the shortfall back. Re-plan places that in the next free time. */
export function schShort(T, b) {
  /* A pomodoro recorded after the fact (pm) is a record of work done, never short. */
  if (T !== todayKey() || !b || !b.q || b.j5 || b.pm || nowMinInDay() < b.t) return 0;
  var q = schQuests(T).filter(function (x) {
    return x.id === b.q;
  })[0];
  if (!q) return 0;
  var rp = schOfQ(T, b.q).reduce(function (a, x) {
      return a + (x.rf === b.id ? x.t - x.f : 0);
    }, 0),
    s = Math.min(b.t - b.f - schDoneIn(T, b) - rp, schLeft(T, q));
  return s >= 5 ? s : 0;
}
export function schReplan(id) {
  var T = todayKey(),
    b = schAll(T).filter(function (x) {
      return x.id === id;
    })[0],
    amt = schShort(T, b);
  if (!amt) return;
  var q = schQuests(T).filter(function (x) {
      return x.id === b.q;
    })[0],
    w = dayWin(T),
    from = Math.max(Math.ceil(nowMinInDay() / SCH_STEP) * SCH_STEP, Math.floor(w.s / SCH_STEP) * SCH_STEP),
    put = [];
  schSave(function (L) {
    var all = schAll(T)
        .filter(function (x) {
          return x.busy || x.rep;
        })
        .concat(
          L.filter(function (x) {
            return !x.rep;
          }),
        ),
      left = Math.max(amt, SCH_STEP);
    while (left >= SCH_STEP) {
      var g =
        schFree(all, from, w.e, SCH_STEP, Math.min(left, SCH_STEP * 2))[0] || schFree(all, from, w.e, 0, SCH_STEP)[0];
      if (!g) break;
      var len = Math.max(SCH_STEP, Math.floor(Math.min(left, g[1] - g[0]) / 5) * 5),
        nb = { id: schNewId(), q: q.id, f: g[0], t: g[0] + len, rf: b.id };
      L.push(nb);
      all.push(nb);
      put.push(nb);
      left -= len;
    }
  });
  G.schSel = null;
  G.schMsg = put.length
    ? "Re-planned " +
      hm(amt) +
      ": " +
      put
        .map(function (x) {
          return hhmmOf(x.f) + "–" + hhmmOf(x.t);
        })
        .join(", ") +
      "."
    : "No free time left today to re-plan it.";
}
export function schDayDone(q, e, k) {
  return q.roll ? ((e || {})[q.id] | 0) >= schLen(q, k) : metQ(q, e);
}
