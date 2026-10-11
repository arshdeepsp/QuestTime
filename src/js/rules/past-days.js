/* ---- past days are frozen: each keeps the quests it had ---- */
function lockReset() {
  lockedThru = null;
  ddm = {};
}
/* Quest list for a passed day: as the settings stand (queued changes were removed in SCHEMA 16). */
function lockDefs(d) {
  return activeDefs(d);
}
/* Repeats that fell on a passed day are copied onto it (as one-offs with src, plus a skip), so stopping or editing a
     repeat later never changes that day's plan or "Plan kept". */
function lockReps(d, e) {
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
function lockPast() {
  if (!S.cfg || cacheBlock) return;
  if (lockDays !== S.days || lockStart !== START_KEY) {
    lockDays = S.days;
    lockStart = START_KEY;
    lockedThru = null;
  }
  var T = todayKey(),
    d = lockedThru ? add(lockedThru, 1) : START_KEY,
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
    ddm = {};
    e.ck = [];
    lockReps(d, e);
    (e.q || []).forEach(function (q) {
      if (q.type === "time" && q.roll && midAt(q, d, d) === d) e.ck.push(q.id);
    });
    ch = true;
  }
  if (d >= T) lockedThru = add(T, -1);
  if (ch) {
    ddm = {};
    cache();
  }
}
function dayDefMap(d) {
  var T = todayKey(),
    kk = T + "|" + (S.cfg && S.cfg.updated);
  if (kk !== ddmKey || ddm.__c !== S.cfg || ddm.__d !== S.days) {
    ddm = { __c: S.cfg, __d: S.days };
    ddmKey = kk;
  }
  if (ddm[d]) return ddm[d];
  var e = S.days[d],
    L = d < T && e && e.q ? e.q : activeDefs(d),
    m = {};
  L.forEach(function (q) {
    m[q.id] = q;
  });
  return (ddm[d] = m);
}
function firstSeen(id) {
  var sig = Object.keys(S.days).length + "";
  if (sig !== firstSeenSig) {
    firstSeenCache = {};
    firstSeenSig = sig;
  }
  if (id in firstSeenCache) return firstSeenCache[id];
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
  return (firstSeenCache[id] = best);
}
