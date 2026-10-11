/* ---- focus timer ---- */
function fmtT(ms) {
  var s = Math.floor(ms / 1000),
    m = Math.floor(s / 60);
  return (
    (m >= 60 ? Math.floor(m / 60) + ":" + String(m % 60).padStart(2, "0") : m) + ":" + String(s % 60).padStart(2, "0")
  );
}
function toggleTimer(q) {
  if (locked()) return;
  var now = Date.now(),
    T = todayKey();
  if (S.timer && S.timer.id === q.id) {
    var el0 = (Date.now() - S.timer.start) / 60000;
    if (S.timer.quick && S.timer.commit && el0 < S.timer.commit) {
      var left = Math.max(1, Math.ceil(S.timer.commit - el0));
      openG("Almost there", function (b) {
        b.innerHTML =
          '<p class="mhead">Only ' +
          left +
          " more minute" +
          (left === 1 ? "" : "s") +
          ' to your 5.</p><p class="help">No penalty either way, but reaching the chime is the whole point. Keep going?</p><div class="edrow end"><button type="button" class="stone" id="j5Stop">Stop now</button><button type="button" class="stone save" id="j5Keep">Keep going</button></div>';
        b.querySelector("#j5Keep").addEventListener("click", closeG);
        b.querySelector("#j5Stop").addEventListener("click", function () {
          closeG();
          stopTimer();
        });
      });
      return;
    }
    stopTimer();
    return;
  }
  var quick = !!S.noTopicAsk;
  function startNow(first) {
    var now2 = Date.now();
    if (S.timer) stopTimer();
    var e0 = S.days[T] || {},
      lg = e0[q.id] | 0;
    if (limOf(q) && lg >= q.lim) {
      setSync("Daily limit reached for " + q.label + " (" + hmL(q.lim) + "). Nothing more is tracked today.");
      return;
    }
    S.timer = {
      id: q.id,
      label: q.label,
      start: now2,
      day: T,
      minHit: lg >= timerMin(q),
      planHit: lg >= planOf(q, e0),
      first: first || null,
      quick: quick,
      autoFocus: !focusView,
    };
    timerTopicStart(q);
    callCheck();
    if (!focusView) {
      focusView = true;
      applyHide();
    }
    cache();
    timerTick();
    setSync(first ? "Timer started. First step: " + first : "Timer started: " + q.label);
    notifSync();
    setTimeout(focusSync, 0);
  }
  startNow("");
}
/* stopTimer(end): end defaults to now; timerCap passes the moment the daily limit was reached so nothing past it is logged. */
function stopTimer(end) {
  rollTimer();
  var t = S.timer;
  if (!t) return;
  S.timer = null;
  cache();
  notifSync();
  setTimeout(function () {
    focusSync(true);
  }, 0);
  if (t.autoFocus) {
    focusView = !!uiGet("focus");
    applyHide();
  }
  var at = end || Date.now(),
    cap = !!end,
    m = Math.round((at - t.start) / 60000),
    T0 = todayKey(),
    T = t.day && t.day < T0 ? t.day : T0;
  if (m < 1) {
    setSync(cap ? "Daily limit reached for " + t.label + ". Timer stopped." : "Timer stopped (under a minute).");
    timerTick();
    return;
  }
  if (logTimer(t, T, at)) {
    render(true);
    setSync(
      cap
        ? "Daily limit reached: " + hm(m) + " added to " + t.label + ". Timer stopped."
        : "+" + hm(m) + " added to " + t.label + (T < T0 ? " (for " + fmtD(T) + ")" : ""),
    );
    return;
  }
  setSync("Timer stopped: " + hm(m) + " could not be added (day locked or quest not active).");
  render();
}
/* Log a running timer's minutes from t.start to end onto day k: session, topic time and the quest's minutes. */
function logTimer(t, k, end) {
  var m = Math.round((end - t.start) / 60000);
  if (m < 1) return false;
  var e0 = S.days[k] || {},
    L = (k < todayKey() && e0.q) || activeDefs(k);
  if (
    !L.some(function (x) {
      return x.id === t.id;
    })
  )
    return false;
  addSession(k, t.id, t.start, end);
  var tsp = topicSplit(t, end);
  Object.keys(tsp).forEach(function (id) {
    addTopicTime(k, id, tsp[id]);
  });
  var e = Object.assign({}, S.days[k] || {}),
    qd = L.filter(function (x) {
      return x.id === t.id;
    })[0];
  if (k >= todayKey()) e.q = activeDefs(k);
  e[t.id] = Math.min(MAXM, limOf(qd) || MAXM, (e[t.id] | 0) + m);
  S.days[k] = e;
  dirty[k] = true;
  cache();
  clearTimeout(timer);
  timer = setTimeout(flush, 300);
  return true;
}
/* A timer still running when its day locks keeps counting for the day it started for ROLL_GRACE minutes, so a session
     that runs a little past midnight/bedtime is logged whole on that day. Past the grace it's treated as left running:
     the minutes up to the lock go to that day and the rest start fresh on today (from today's start, so a timer forgotten
     for days doesn't pile the gap onto today). */
var ROLL_GRACE = 60;
function rollTimer() {
  var t = S.timer,
    T = todayKey();
  if (!t || !t.day || t.day >= T) return;
  var cut = atMin(add(t.day, 1), dayEnd() * 60),
    now = Date.now();
  if (t.day === add(T, -1) && now < cut + ROLL_GRACE * 60000) return;
  cut = Math.max(t.start, Math.min(cut, now));
  logTimer(t, t.day, cut);
  cut = Math.min(now, Math.max(cut, atMin(T, dayEnd() * 60)));
  t.start = cut;
  t.day = T;
  t.tAt = cut;
  t.tacc = {};
  t.noPenalty = true;
  var q = cfgQ(t.id),
    e0 = S.days[T] || {};
  t.minHit = !!q && (e0[t.id] | 0) >= timerMin(q);
  t.planHit = !!q && (e0[t.id] | 0) >= planOf(q, e0);
  t.c5 = true;
  cache();
  setTimeout(focusSync, 0);
}
/* The first goal a running timer celebrates: a daily quest's minimum, or a period total's daily share (its own min field
     is only a leftover default and means nothing for totals). */
function timerMin(q) {
  return q.roll ? schLen(q) : q.min;
}
/* Daily limit: once today's logged minutes plus the running timer reach q.lim, stop the timer at that exact moment and log it (sound "stop"). Returns true if it did. Also run from the Time's up notification (1004). */
function timerCap() {
  var t = S.timer,
    T = todayKey();
  if (!t) return false;
  var q = activeDefs(T).filter(function (x) {
      return x.id === t.id;
    })[0],
    lim = limOf(q);
  if (!lim || t.day !== T) return false;
  var lg = (S.days[T] || {})[q.id] | 0,
    end = t.start + Math.max(0, lim - lg) * 60000;
  if (Date.now() < end) return false;
  stopTimer(end);
  sfx("stop");
  showToast({
    icon: "flame",
    kicker: "Time\u2019s up",
    title: q.label,
    desc: "Daily limit of " + hmL(lim) + " reached. Timer stopped and logged.",
  });
  try {
    if (navigator.vibrate) navigator.vibrate([300, 100, 300]);
  } catch (x) {}
  return true;
}
function timerGoals() {
  var t = S.timer;
  if (!t) return;
  if (timerCap()) return;
  if (t.commit && !t.c5 && Date.now() - t.start >= t.commit * 60000) {
    t.c5 = true;
    cache();
    sfx("chime");
    try {
      if (navigator.vibrate) navigator.vibrate([120, 60, 120]);
    } catch (x) {}
    setSync("5 minutes in! Keep going, or stop the timer to log it.");
  }
  var T = todayKey(),
    q = activeDefs(T).filter(function (x) {
      return x.id === t.id;
    })[0];
  if (!q || q.type !== "time") return;
  var e = S.days[T] || {},
    tot = (e[q.id] | 0) + Math.floor((Date.now() - t.start) / 60000),
    pl = planOf(q, e),
    hit = null;
  var mn = timerMin(q);
  if (!t.minHit && tot >= mn) {
    t.minHit = true;
    hit = (q.roll ? "Today\u2019s share done for " : "Minimum reached for ") + q.label + " (" + hmL(mn) + ")";
  }
  if (cfg().showPlan && !q.roll && pl > q.min && !t.planHit && tot >= pl) {
    t.planHit = true;
    t.minHit = true;
    hit = "Plan reached for " + q.label + " (" + hm(pl) + ")";
  }
  if (hit) {
    cache();
    sfx("chime");
    try {
      if (navigator.vibrate) navigator.vibrate([120, 60, 120, 60, 200]);
    } catch (x) {}
    setSync(hit + ". Keep going or stop the timer to log it.");
  }
  var el = qEls[t.id];
  if (el && el.tmr) {
    el.tmr.classList.toggle("hit", !!t.minHit && tot >= mn);
    el.tmr.classList.toggle("gold", !!t.planHit && pl > q.min && tot >= pl);
  }
}
function timerTick() {
  var tmOn = !!(S.timer && qEls[S.timer.id] && !ro());
  qWrap.classList.toggle("timing", tmOn);
  document.getElementById("gui").classList.toggle("timing", tmOn);
  timerGoals();
  Object.keys(qEls).forEach(function (id) {
    runBox(id);
    var el = qEls[id];
    if (!el || !el.tmr) return;
    var on = S.timer && S.timer.id === id;
    el.tmr.classList.toggle("on", !!on);
    el.tmr.querySelector("span").textContent = on ? fmtT(Date.now() - S.timer.start) : "";
    el.tmr.setAttribute("aria-label", (on ? "Stop" : "Start") + " focus timer");
  });
}
setInterval(function () {
  if (S.timer) timerTick();
  renderHeat();
}, 1000);
function renderHeat() {
  var el = document.getElementById("heatBar");
  if (!el) return;
  var h = heat(),
    pc = Math.round((h / 180) * 100),
    lab = h >= 120 ? "On fire" : h >= 60 ? "Hot" : h >= 20 ? "Warm" : "Cold";
  el.querySelector("i").style.width = pc + "%";
  el.className = "heat " + (h >= 120 ? "h3" : h >= 60 ? "h2" : h >= 20 ? "h1" : "h0");
  document.getElementById("heatLab").textContent = "Momentum: " + lab;
}
