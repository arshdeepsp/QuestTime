/* ---- 8-bit sound ---- */
var AC = null,
  sfxOn = uiGet("sfx", true) !== false;
function tone(f, t0, dur, type, vol) {
  var o = AC.createOscillator(),
    g = AC.createGain();
  o.type = type || "square";
  o.frequency.setValueAtTime(f, AC.currentTime + t0);
  g.gain.setValueAtTime(vol || 0.06, AC.currentTime + t0);
  g.gain.exponentialRampToValueAtTime(0.0001, AC.currentTime + t0 + dur);
  o.connect(g);
  g.connect(AC.destination);
  o.start(AC.currentTime + t0);
  o.stop(AC.currentTime + t0 + dur + 0.02);
}
function sfx(kind) {
  try {
    if (kind === "base") haptic("medium", true);
    else if (kind === "clear" || kind === "level" || kind === "chime") haptic("success", true);
    else if (kind === "stop") haptic("heavy", true);
    else if (kind === "fail") haptic("error", true);
  } catch (x) {}
  if (!sfxOn) return;
  try {
    AC = AC || new (window.AudioContext || window.webkitAudioContext)();
    if (AC.state === "suspended") AC.resume();
  } catch (e) {
    return;
  }
  if (kind === "base") {
    tone(988, 0, 0.07);
    tone(1319, 0.07, 0.12);
  } else if (kind === "clear") {
    [523, 659, 784, 1047].forEach(function (f, i) {
      tone(f, i * 0.09, 0.14);
    });
  } else if (kind === "gold") {
    [784, 988, 1175, 1568, 2093].forEach(function (f, i) {
      tone(f, i * 0.08, 0.16, "triangle", 0.08);
    });
  } else if (kind === "fail") {
    tone(110, 0, 0.35, "sawtooth", 0.07);
    tone(82, 0.18, 0.35, "sawtooth", 0.07);
  } else if (kind === "chime") {
    [1047, 1319, 1568, 2093].forEach(function (f, i) {
      tone(f, i * 0.11, 0.22, "triangle", 0.09);
    });
  } else if (kind === "stop") {
    [1568, 1175, 784, 523].forEach(function (f, i) {
      tone(f, i * 0.13, 0.26, "square", 0.07);
    });
    tone(392, 0.55, 0.4, "square", 0.06);
  } else if (kind === "level") {
    [392, 523, 659, 784, 659, 1047].forEach(function (f, i) {
      tone(f, i * 0.1, 0.18, "triangle", 0.09);
    });
  }
}
/* Tap sounds: a short 8-bit click that goes with every haptic tap. Off with Settings › Tap sounds, or with Sound off. */
var TAPS = { light: [1568, 0.03, 0.025], medium: [1175, 0.05, 0.035], heavy: [784, 0.07, 0.045] };
function tapSound(k) {
  var t = TAPS[k];
  if (!t || !sfxOn || (S.cfg && S.cfg.tapSound === false)) return;
  try {
    AC = AC || new (window.AudioContext || window.webkitAudioContext)();
    if (AC.state === "suspended") AC.resume();
    tone(t[0], 0, t[1], "square", t[2]);
  } catch (x) {}
}
function bases(e) {
  e = e || {};
  return reqOf(defsOf(e)).filter(function (q) {
    return metQ(q, e);
  }).length;
}
function svg(name) {
  var ic = D.icons[name],
    r = "";
  ic.rows.forEach(function (row, y) {
    for (var x = 0; x < 16; x++) {
      var ch = row[x];
      if (ch !== ".") r += '<rect x="' + x + '" y="' + y + '" width="1" height="1" fill="' + ic.pal[ch] + '"/>';
    }
  });
  return '<svg viewBox="0 0 16 16" aria-hidden="true">' + r + "</svg>";
}
function hm(m) {
  m = m | 0;
  var h = Math.floor(m / 60),
    r = m % 60;
  return h ? h + "h" + (r ? " " + r + "m" : "") : r + "m";
}

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
