/* ---- past days are frozen: each keeps the quests it had ---- */
import { G } from "../core/g.js";
import { S, START_KEY } from "../core/00-state.js";
import { add, todayKey } from "../core/days.js";
import { cache } from "../core/storage.js";
import { midAt } from "./26-periods.js";
import { hasEntry } from "./day-rules.js";
import { activeDefs, defsOf } from "./quests-on-day.js";
import { schAll, schNorm } from "../schedule/model.js";

export function lockReset() {
  G.lockedThru = null;
  G.ddm = {};
}
/* Quest list for a passed day: as the settings stand (queued changes were removed in SCHEMA 16). */
export function lockDefs(d) {
  return activeDefs(d);
}
/* Repeats that fell on a passed day are copied onto it (as one-offs with src, plus a skip), so stopping or editing a
     repeat later never changes that day's plan or "Plan kept". */
export function lockReps(d, e) {
  if (!(S.cfg.rep || []).length) return;
  var R = schAll(d).filter(function (b) {
    return b.rep;
  });
  if (!R.length) return;
  e.sched = schNorm(e.sched).concat(
    R.map(function (b) {
      var x = { id: "x" + b.rep + d.replace(/-/g, ""), f: b.f, t: b.t, src: b.rep };
      if (b.q) x.q = b.q;
      if (b.lb) x.lb = b.lb;
      if (b.j5) x.j5 = true;
      return x;
    }),
  );
  e.schSkip = (e.schSkip || []).concat(
    R.map(function (b) {
      return b.rep;
    }),
  );
}
export function lockPast() {
  if (!S.cfg || G.cacheBlock) return;
  if (G.lockDays !== S.days || G.lockStart !== START_KEY) {
    G.lockDays = S.days;
    G.lockStart = START_KEY;
    G.lockedThru = null;
  }
  var T = todayKey(),
    d = G.lockedThru ? add(G.lockedThru, 1) : START_KEY,
    ch = false;
  if (!S.cfg.repFrozen) {
    for (var r0 = START_KEY; r0 < T; r0 = add(r0, 1)) {
      var e0 = S.days[r0];
      if (e0 && e0.ck && !(e0.schSkip || []).length) {
        e0 = S.days[r0] = Object.assign({}, e0);
        lockReps(r0, e0);
      }
    }
    S.cfg = Object.assign({}, S.cfg, { repFrozen: true });
    ch = true;
  }
  for (; d < T; d = add(d, 1)) {
    var e = S.days[d];
    if (e && e.ck) continue;
    if (!e || (!e.q && !hasEntry(e))) {
      e = S.days[d] = Object.assign({}, e || {});
      e.q = lockDefs(d);
    } else e = S.days[d] = Object.assign({}, e);
    G.ddm = {};
    e.ck = [];
    lockReps(d, e);
    (e.q || []).forEach(function (q) {
      if (q.type === "time" && q.roll && midAt(q, d, d) === d) e.ck.push(q.id);
    });
    ch = true;
  }
  if (d >= T) G.lockedThru = add(T, -1);
  if (ch) {
    G.ddm = {};
    cache();
  }
}
export function dayDefMap(d) {
  var T = todayKey(),
    kk = T + "|" + (S.cfg && S.cfg.updated);
  if (kk !== G.ddmKey || G.ddm.__c !== S.cfg || G.ddm.__d !== S.days) {
    G.ddm = { __c: S.cfg, __d: S.days };
    G.ddmKey = kk;
  }
  if (G.ddm[d]) return G.ddm[d];
  var e = S.days[d],
    L = d < T && e && e.q ? e.q : activeDefs(d),
    m = {};
  L.forEach(function (q) {
    m[q.id] = q;
  });
  return (G.ddm[d] = m);
}
export function firstSeen(id) {
  var sig = Object.keys(S.days).length + "";
  if (sig !== G.firstSeenSig) {
    G.firstSeenCache = {};
    G.firstSeenSig = sig;
  }
  if (id in G.firstSeenCache) return G.firstSeenCache[id];
  var best = null;
  Object.keys(S.days).forEach(function (d) {
    if (best && d >= best) return;
    var e = S.days[d];
    if (
      e &&
      (hasEntry(e) || !e.ck) &&
      defsOf(e).some(function (q) {
        return q.id === id;
      })
    )
      best = d;
  });
  return (G.firstSeenCache[id] = best);
}
