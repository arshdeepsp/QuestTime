/* ---- compute(): the day-by-day streak, freezes, grace and period-total judgments ---- */
function compute(asOf) {
  lockPast();
  indexDays();
  var T = asOf ? add(asOf, 1) : todayKey(),
    Y = add(T, -1),
    st = { fz: 0, streak: 0, best: 0, total: 0, miss: 0, resets: [], start: null, marks: {} },
    fzAt = [],
    gk = null;
  function success(k) {
    st.streak++;
    st.total++;
    st.miss = 0;
    if (st.streak % 14 === 0 && st.fz < fzCap()) {
      st.fz++;
      fzAt.push(k);
    }
    if (st.streak === 1) st.start = k;
    st.marks[k] = "ok";
  }
  function reset(k) {
    if (st.resets[st.resets.length - 1] !== k) st.resets.push(k);
    st.streak = 0;
    st.start = null;
    st.miss = 0;
  }
  st.lost = [];
  if (T < START_KEY) return st;
  function dayEval(k) {
    if (noStreakOn(k)) {
      st.marks[k] = "pause";
      return;
    }
    if (!reqDefsFor(k).length) {
      st.marks[k] = "rest";
      return;
    }
    if (ok(S.days[k])) {
      success(k);
      return;
    }
    if ((S.days[k] || {}).rep) {
      success(k);
      st.marks[k] = "repaired";
      return;
    }
    st.miss++;
    if (st.miss >= 2 && st.fz > 0 && st.streak > 0) {
      st.fz--;
      st.miss = 1;
      st.marks[k] = "frozen";
      gk = k;
    } else if (st.miss >= 2) {
      st.marks[k] = "miss";
      if (gk && (st.marks[gk] === "grace" || st.marks[gk] === "frozen")) st.marks[gk] = "miss";
      if (st.streak > 0) reset(k);
    } else {
      st.marks[k] = st.streak > 0 ? "grace" : "miss";
      gk = k;
    }
  }
  /* Period totals (weekly, 2-week, monthly) are checked at the halfway checkpoint (e.ck on the passed day) and on the
       last day of the period. Miss one and the period's days so far are lost: they stop counting ("lost"), don't count
       toward your best streak, freezes earned on them are taken back, and the streak resets. seen = every total on a
       day's list so far (latest version), so a total paused or deleted before the end is still checked, prorated. */
  var seen = {};
  function track(k) {
    var m = dayDefMap(k),
      vc = isVac(k);
    Object.keys(m).forEach(function (id) {
      var x = m[id];
      if (x.type !== "time" || !x.roll) return;
      var o = seen[id] || (seen[id] = { uo: false });
      o.q = x;
      o.last = k;
      if (x.uopt) o.uo = true;
      else if (!vc && !x.off) o.uo = !!x.opt;
    });
  }
  function periodCheck(k) {
    var fail = [],
      from = k,
      mid = false,
      ck = (S.days[k] || {}).ck;
    track(k);
    Object.keys(seen).forEach(function (id) {
      var o = seen[id],
        q = o.q;
      if (o.uo || o.last < perStart(q, k) || noStreakIn(weekFrom(q, k), k)) return;
      var end = perEnd(q, k) === k,
        half = !end && (ck ? ck.indexOf(id) >= 0 : midDay(q, k) === k);
      if (!end && !half) return;
      if (rollSum(id, k, q) < (end ? weekTarget(q, k) : midNeed(q, k))) {
        fail.push(q);
        if (half) mid = true;
        var wf = weekFrom(q, k);
        if (wf < from) from = wf;
      }
    });
    if (!fail.length) return;
    var n = 0;
    for (var d = from < START_KEY ? START_KEY : from; d <= k; d = add(d, 1)) {
      var mk = st.marks[d];
      if (mk === "ok" || mk === "grace" || mk === "frozen") {
        if (mk === "ok") st.total--;
        st.marks[d] = "lost";
        n++;
      }
    }
    var back = fzAt.filter(function (d) {
      return d >= from && d <= k;
    }).length;
    if (back) {
      fzAt = fzAt.filter(function (d) {
        return d < from || d > k;
      });
      st.fz = Math.max(0, st.fz - back);
    }
    st.lost.push({
      k: k,
      from: from,
      n: n,
      mid: mid,
      q: fail.map(function (q) {
        return q.label;
      }),
    });
    if (n || st.streak > 0) {
      if (st.marks[k] !== "miss" && st.marks[k] !== "rest") st.marks[k] = "lost";
      reset(k);
    }
  }
  for (var k = START_KEY; k < T; k = add(k, 1)) {
    dayEval(k);
    periodCheck(k);
  }
  if (!asOf && T >= START_KEY) {
    if (noStreakOn(T)) st.marks[T] = "pause";
    else if (!reqDefsFor(T).length) st.marks[T] = "rest";
    else if (ok(S.days[T])) success(T);
    else st.marks[T] = "pend";
  }
  /* Best streak = most cleared ("ok") days between two resets, so days lost later never count toward it. */
  var rs = {},
    run = 0;
  st.resets.forEach(function (d) {
    rs[d] = 1;
  });
  for (var d = START_KEY; d <= T; d = add(d, 1)) {
    if (rs[d]) {
      st.best = Math.max(st.best, run);
      run = 0;
    }
    if (st.marks[d] === "ok") run++;
  }
  st.best = Math.max(st.best, run);
  return st;
}
function fzCap() {
  return (S.cfg && S.cfg.style) === "spark" ? 4 : 3;
}
