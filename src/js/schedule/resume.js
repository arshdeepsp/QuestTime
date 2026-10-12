/* ---- resume a block under way, its notification, and block reminders ---- */
import { G } from "../core/g.js";
import { S } from "../core/00-state.js";
import { add, atMin, nowMinInDay, todayKey } from "../core/days.js";
import { locked } from "../core/entries.js";
import { hm } from "../core/util.js";
import { ensureChannels, nf, notifSync } from "../notifications/35d-plan.js";
import { nfGo } from "../notifications/52-taps.js";
import { SCH_AHEAD } from "./51-schedule.js";
import { hhmmOf, schAll, schOfQ, schQuests, schText } from "./model.js";
import { schDayDone, schDoneIn } from "./progress.js";
import { timerMin, toggleTimer } from "../timer/13-focus-timer.js";
import { start5 } from "../tools/28-spark-tools.js";
import { go } from "../ui/44-navigation.js";
import { setSync } from "../ui/feedback.js";

export function schLeftIn(T, b, strict) {
  var nw = nowMinInDay();
  if (T !== todayKey() || !b || !b.q || b.lb || b.j5 || nw < b.f || nw >= b.t || (S.timer && S.timer.id === b.q))
    return 0;
  var q = schQuests(T).filter(function (x) {
    return x.id === b.q;
  })[0];
  if (!q) return 0;
  var d = schDoneIn(T, b);
  if (strict && (d < 1 || ((S.days[T] || {})[q.id] | 0) >= timerMin(q) || (b.ed && schLastIn(T, b) <= b.ed))) return 0;
  var l = Math.min(b.t - b.f - d, b.t - nw);
  return l >= 1 ? l : 0;
}
export function schResWord(T, b) {
  return schDoneIn(T, b) >= 1 ? "Resume" : "Start";
}
/* End of the latest timed stretch inside the block. A block edited after that (shortened, moved, delayed) means you've
     re-planned it yourself, so there's nothing to resume until you work in it again. */
export function schLastIn(T, b) {
  var s0 = atMin(T, b.f),
    s1 = atMin(T, b.t),
    m = 0;
  ((S.days[T] || {}).sess || []).forEach(function (z) {
    if (z.id === b.q && z.e > s0 && z.s < s1 && z.e > m) m = z.e;
  });
  return m;
}
export function schResumable(T, strict) {
  var best = null;
  schAll(T).forEach(function (b) {
    var l = schLeftIn(T, b, strict);
    if (l && (!best || b.f > best.b.f)) best = { b: b, left: l };
  });
  return best;
}
export function resumeSync(ln) {
  var T = todayKey(),
    n0 = nf(),
    r = locked() || !n0.on || !n0.sched ? null : schResumable(T, true),
    k = r ? T + r.b.id + "|" + r.left : "";
  clearTimeout(G.resT);
  if (r) G.resT = setTimeout(notifSync, Math.max(1000, atMin(T, r.b.t) - Date.now() + 1000));
  if (k === G.resKey) return;
  var was = G.resKey;
  G.resKey = k;
  var p = Promise.resolve();
  if (was)
    p = p
      .then(function () {
        return ln.cancel({ notifications: [{ id: 905 }] });
      })
      .then(function () {
        return ln.removeDeliveredNotifications
          ? ln.removeDeliveredNotifications({ notifications: [{ id: 905 }] })
          : null;
      });
  if (r) {
    var q = schQuests(T).filter(function (x) {
      return x.id === r.b.q;
    })[0];
    p = p
      .then(function () {
        return ensureChannels();
      })
      .then(function () {
        return ln.schedule({
          notifications: [
            {
              id: 905,
              title: "Resume " + (q ? q.label : "your block"),
              body: hm(r.left) + " left of your " + schText(r.b) + " block. Tap to pick it back up.",
              channelId: "pc_alerts2",
              ongoing: true,
              autoCancel: false,
              extra: { sched: r.b.q, resume: 1 },
              schedule: { at: new Date(Date.now() + 1500), allowWhileIdle: true },
            },
          ],
        });
      });
  }
  p.catch(function (err) {
    console.warn("resume notif", err);
  });
}
export function schNotifs(T, e, push) {
  var Q = schQuests(T);
  schAll(T).forEach(function (bl, i) {
    var q = Q.filter(function (x) {
      return x.id === bl.q;
    })[0];
    if (!q || schDayDone(q, e, T) || (S.timer && S.timer.id === q.id)) return;
    push(
      3500 + i,
      (bl.j5 ? "5 minutes on " : "Time for ") + q.label,
      bl.j5
        ? "Tap to start a 5-minute timer. Planned until " + hhmmOf(bl.t) + "."
        : hhmmOf(bl.f) + "–" + hhmmOf(bl.t) + ". Tap to start the timer.",
      atMin(T, bl.f),
      { sched: q.id, j5: !!bl.j5 },
    );
    /* Get back to it: 10, 25 and 40 minutes into a block that isn't under a timer, unless the block or the day's share
         is already done (3600 + n). Re-planned on every sync, so starting the timer or finishing cancels the rest. */
    if (bl.j5 || schDoneIn(T, bl) >= bl.t - bl.f) return;
    [10, 25, 40].forEach(function (off, n) {
      var m = bl.f + off;
      if (m > bl.t - 5) return;
      push(
        3600 + (i % 25) * 4 + n,
        "Get back to " + q.label,
        hm(bl.t - m) +
          " left of your " +
          hhmmOf(bl.f) +
          "\u2013" +
          hhmmOf(bl.t) +
          " block. Tap to " +
          (schDoneIn(T, bl) >= 1 ? "resume" : "start") +
          " the timer.",
        atMin(T, m),
        { sched: q.id },
      );
    });
  });
  /* Blocks on the next SCH_AHEAD days (planned ahead or repeats) are scheduled too (3700 + day×20 + n), so they remind even if the app isn't opened that day. */
  for (var dd = 1; dd <= SCH_AHEAD; dd++) {
    var k = add(T, dd),
      Qk = schQuests(k),
      n = 0;
    schAll(k).forEach(function (bl) {
      if (!bl.q || n >= 20) return;
      var q = Qk.filter(function (x) {
        return x.id === bl.q;
      })[0];
      if (!q) return;
      push(
        3700 + dd * 20 + n++,
        (bl.j5 ? "5 minutes on " : "Time for ") + q.label,
        bl.j5
          ? "Tap to start a 5-minute timer. Planned until " + hhmmOf(bl.t) + "."
          : hhmmOf(bl.f) + "–" + hhmmOf(bl.t) + ". Tap to start the timer.",
        atMin(k, bl.f),
        { sched: q.id, j5: !!bl.j5 },
      );
    });
  }
}
/* A reminder tap only starts a timer if that quest still has a block today (or, for 905, is still resumable). */
export function schTap(x) {
  var T = todayKey(),
    q = schQuests(T).filter(function (z) {
      return z.id === x.sched;
    })[0];
  if (!q || locked() || (S.timer && S.timer.id === q.id)) return;
  var r = x.resume ? schResumable(T) : null;
  if (x.resume ? !r || r.b.q !== q.id : !schOfQ(T, q.id).length) {
    nfGo();
    setSync("That block has changed. Nothing to start.");
    return;
  }
  go("today");
  if (x.j5) start5(q);
  else toggleTimer(q);
}
