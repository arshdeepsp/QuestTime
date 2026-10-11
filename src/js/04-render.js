/* ---- render ---- */
var statsOpen = !!uiGet("stats");
document.getElementById("statsToggle").addEventListener("click", function () {
  statsOpen = !statsOpen;
  uiSet("stats", statsOpen);
  render();
});
var hudOpen = !!uiGet("hud");
function hudSync() {
  var hd = document.querySelector(".hud"),
    hl = document.getElementById("hudLine");
  hd.classList.toggle("hud-open", hudOpen);
  hl.setAttribute("aria-expanded", hudOpen);
}
hudSync();
document.getElementById("hudLine").addEventListener("click", function () {
  hudOpen = !hudOpen;
  uiSet("hud", hudOpen);
  hudSync();
});
document.getElementById("mbNew").addEventListener("click", function () {
  document.getElementById("nqBtn").click();
});
document.getElementById("mbGrove").addEventListener("click", function () {
  openGrove(false);
});
document.getElementById("mbSprint").addEventListener("click", function () {
  openSprintSetup();
});
(function () {
  var st = document.getElementById("strip"),
    x0 = null,
    y0 = null;
  st.addEventListener(
    "touchstart",
    function (e) {
      var t = e.touches[0];
      x0 = t.clientX;
      y0 = t.clientY;
    },
    { passive: true },
  );
  st.addEventListener(
    "touchend",
    function (e) {
      if (x0 == null) return;
      var t = e.changedTouches[0],
        dx = t.clientX - x0,
        dy = t.clientY - y0;
      x0 = null;
      if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy) * 1.5) {
        var b = document.getElementById(dx > 0 ? "stripPrev" : "stripNext");
        if (!b.disabled) b.click();
      }
    },
    { passive: true },
  );
})();
var lastEval = { set: false },
  lastCleared = null,
  page = 0,
  selDay = null,
  lastSt = null;
function fmtD(k) {
  return parse(k).toLocaleDateString("en-CA", { month: "short", day: "numeric" });
}

var sndBtn = document.getElementById("sndBtn");
function sndLabel() {
  sndBtn.textContent = sfxOn ? "SFX on" : "SFX off";
  sndBtn.setAttribute("aria-pressed", sfxOn);
}
sndLabel();
sndBtn.addEventListener("click", function () {
  sfxOn = !sfxOn;
  uiSet("sfx", sfxOn);
  sndLabel();
  if (sfxOn) sfx("base");
});
document.getElementById("backToday").addEventListener("click", function () {
  viewKey = null;
  selDay = null;
  document.getElementById("dayInfo").textContent = "";
  render();
});
document.getElementById("stripPrev").addEventListener("click", function () {
  page++;
  render();
});
document.getElementById("stripNext").addEventListener("click", function () {
  if (page > 0) page--;
  render();
});
document.getElementById("strip").addEventListener("click", function (ev) {
  var k = ev.target && ev.target.getAttribute && ev.target.getAttribute("data-k");
  if (!k) return;
  selDay = k;
  viewKey = null;
  if (k >= START_KEY && k < todayKey())
    setTimeout(function () {
      openDayModal(k);
    }, 0);
  var info = document.getElementById("dayInfo"),
    m = k > todayKey() ? "future" : k < START_KEY ? "pre" : lastSt.marks[k] || "pend",
    e = S.days[k] || {};
  var label = {
    lost: "Lost: a weekly total was missed, so this period no longer counts",
    carried: "Carried: no work logged, but your weekly total covered it (streak held, no XP)",
    frozen: "Missed (saved by a streak freeze)",
    repaired: "Missed (repaired with XP)",
    rest: isVac(k) ? "Vacation day" : "Rest day (nothing required)",
    ok: gold(e) ? "Cleared (gold day)" : "Cleared",
    miss: "Missed",
    grace: "Missed (grace day)",
    pend: k === todayKey() ? "In progress" : "Not started",
    pre: "No data",
    future: "Coming up",
  }[m];
  var parts =
    m === "future"
      ? [label, parse(k).toLocaleDateString("en-CA", { weekday: "short", month: "short", day: "numeric" })]
      : [parse(k).toLocaleDateString("en-CA", { weekday: "short", month: "short", day: "numeric" }), label];
  if (m !== "pre" && m !== "future" && (m !== "pend" || k === todayKey())) {
    var dq = defsOf(e);
    parts.push(bases(e) + "/" + reqOf(dq).length + " done");
    var d = [];
    dq.forEach(function (q) {
      var v = e[q.id];
      if (v == null || v === "" || v === 0 || v === false) return;
      d.push(
        q.type === "wake"
          ? q.label + " " + v
          : q.type === "time"
            ? q.label + " " + hm(v)
            : q.type === "check"
              ? q.label
              : q.type === "scale"
                ? q.label + " " + v + "/" + (q.scale || 5)
                : q.label + " " + (q.unit === "min" ? hm(v) : num(v)),
      );
    });
    if (d.length) parts.push(d.join(", "));
  }
  info.textContent = parts.join(" \u00b7 ");
  render();
});
function render(fromClick) {
  try {
    lockPast();
    rollTimer();
  } catch (x) {}
  try {
    if (S.cfg) cleanDoneTodos();
  } catch (x) {}
  var st = compute(),
    T = todayKey(),
    k = dayKey(),
    e = S.days[k] || {},
    off = rewardsOff();
  document.body.classList.toggle("nostreak", off);
  if (off && (curView === "achievements" || groveOpen))
    setTimeout(function () {
      if (groveOpen) closeGrove();
      if (curView === "achievements") go("today");
    }, 0);
  // HUD
  var r = RANKS[0];
  RANKS.forEach(function (x) {
    if (st.streak >= x[0]) r = x;
  });
  var rn = document.getElementById("rankName"),
    ri = document.getElementById("rankIcon");
  rn.textContent = r[1];
  ri.innerHTML = svg(r[2]);
  document.getElementById("stStreak").textContent = st.streak + (st.streak === 1 ? " day" : " days");
  document.getElementById("stBest").textContent = st.best;
  document.getElementById("stTotal").textContent = st.total;
  var ms = document.getElementById("moreStats"),
    stb = document.getElementById("statsToggle");
  ms.hidden = !statsOpen;
  stb.textContent = statsOpen ? "Less" : "More";
  stb.setAttribute("aria-expanded", statsOpen);
  document.getElementById("stFz").textContent = st.fz;
  var note = document.getElementById("hudNote"),
    nx = null;
  RANKS.forEach(function (x) {
    if (!nx && x[0] > st.streak) nx = x;
  });
  note.className = "note";
  if (off) {
    note.textContent =
      "Casual mode: XP and levels, no streak or checkpoints. Your streak picks up where it was when you switch to Challenge.";
    note.className = "note";
  } else if (st.miss === 1) {
    note.textContent = "Grace day used. Clear today to keep the streak.";
    note.className = "note warn";
  } else
    note.textContent = nx ? "Next rank: " + nx[1] + " in " + (nx[0] - st.streak) + " clean days" : "Top rank reached.";
  // strip
  var strip = document.getElementById("strip"),
    h = "",
    T0 = add(T, -14 * page),
    first = add(T0, -13);
  if (first < START_KEY) {
    first = START_KEY;
    T0 = add(START_KEY, 13);
  }
  for (var i = 13; i >= 0; i--) {
    var dk = add(T0, -i),
      m = dk > T ? "future" : dk < START_KEY ? "pre" : st.marks[dk] || "pend";
    h +=
      '<i class="' +
      m +
      (m === "ok" && gold(S.days[dk]) ? " gold" : "") +
      (dk === T ? " today" : "") +
      (dk === selDay ? " sel" : "") +
      '" data-k="' +
      dk +
      '" title="' +
      dk +
      '"></i>';
  }
  strip.innerHTML = h;
  lastSt = st;
  document.getElementById("stripRange").textContent = fmtD(first) + " - " + fmtD(T0);
  if (T < START_KEY) document.getElementById("stripRange").textContent = "Starts " + fmtD(START_KEY);
  else if (T0 > T)
    document.getElementById("stripRange").textContent = "Day " + (daysBetween(START_KEY, T) + 1) + " of your first 14";
  document.getElementById("stripPrev").disabled = first <= START_KEY;
  document.getElementById("stripNext").disabled = page === 0;
  // quests
  var past = ro();
  document.getElementById("mbNew").disabled = locked();
  document.getElementById("questsWrap").hidden = false;
  if (ro() && mgrOpen) {
    mgrOpen = false;
    qmgr.hidden = true;
  }
  document.getElementById("qEditBtn").disabled = ro();
  document.getElementById("nqBtn").disabled = locked();
  document.getElementById("qEditBtn").innerHTML = mgrOpen
    ? 'Close<span class="lg"> editor</span>'
    : 'Edit<span class="lg"> quests</span>';
  document.getElementById("gui").classList.toggle("ro", past);
  document.getElementById("gui").classList.toggle("noplan", !cfg().showPlan);
  document.getElementById("guiTitleT").textContent = ro()
    ? parse(viewKey).toLocaleDateString("en-CA", { weekday: "short", month: "short", day: "numeric" })
    : "Today's quests";
  document.getElementById("backToday").hidden = !ro();
  lockIn();
  if (typeof wrapLabel === "function" && wrapBtn) wrapLabel();
  var defs = k === T ? activeDefs(T) : defsOf(e);
  buildQuests(defs);
  if (k === T && S.days[T] && JSON.stringify(S.days[T].q) !== JSON.stringify(defs)) {
    S.days[T] = Object.assign({}, S.days[T], { q: defs });
    dirty[T] = true;
    cache();
    clearTimeout(timer);
    timer = setTimeout(flush, 700);
  }
  defs.forEach(function (q) {
    var el = qEls[q.id];
    if (!el) return;
    var v = e[q.id];
    if (q.type === "wake") {
      if (document.activeElement !== el.inp) el.inp.value = v || "";
      var w = metQ(q, e);
      el.row.classList.toggle("met", w);
      el.row.classList.toggle("fail", !!v && !w);
    } else if (q.type === "todo") {
      el.row.querySelector(".req").textContent = reqText(q);
      el.td.setAttribute("aria-pressed", !!v);
      el.td.textContent = v ? "Done \u2713" : "Mark done";
      el.row.classList.toggle("met", !!v);
      el.row.classList.toggle("tddone", !!v);
      var od = q.due && !v && q.due < T;
      el.row.classList.toggle("fail", !!od);
    } else if (q.type === "weekly") {
      var wc = weekCount(q.id, k),
        pp = "";
      for (var z = 0; z < Math.max(q.min, wc); z++) pp += '<i class="' + (z < wc ? "on" : "") + '"></i>';
      el.pips.innerHTML = pp;
      el.wk.textContent = wc + "/" + q.min + " this week";
      el.wb.setAttribute("aria-pressed", !!v);
      el.wb.textContent = v ? "Done today \u2713" : "Done today";
      el.row.classList.toggle("met", !!v || wc >= q.min);
    } else if (q.type === "check") {
      el.sw.setAttribute("aria-checked", !!v);
      el.row.classList.toggle("met", !!v);
    } else if (q.type === "scale") {
      el.sc.forEach(function (bt) {
        bt.setAttribute("aria-pressed", +bt.getAttribute("data-v") === v);
      });
      el.row.classList.toggle("met", metQ(q, e));
      el.row.classList.toggle("fail", !!v && !metQ(q, e));
    } else if (q.type === "target") {
      el.out.textContent = num(v) + " / " + num(q.min);
      el.minus.disabled = !(num(v) > 0);
      el.row.classList.toggle("met", metQ(q, e));
    } else if (q.type === "limit") {
      var over = overQ(q, e);
      el.out.textContent = q.unit === "min" ? hm(v) + " / " + q.max + "m" : (v | 0) + " / " + q.max;
      el.minus.disabled = !(v > 0);
      el.row.classList.remove("met");
      el.row.classList.toggle("limok", !over);
      el.row.classList.toggle("fail", over);
    } else {
      el.out.textContent = hm(v);
      el.minus.disabled = !(v > 0);
      el.row.classList.toggle("met", !q.off && !q.ign && metQ(q, e));
      var pv = planOf(q, e);
      el.pout.textContent = hm(pv);
      el.pminus.disabled = pv <= q.min;
    }
  });
  defs.forEach(function (q) {
    var el = qEls[q.id];
    if (!el) return;
    var pj = el.row.querySelector(".proj");
    if (pj && q.total) {
      var sm = projSum(q.id, k),
        pc = Math.min(100, Math.round((sm / q.total) * 100));
      pj.querySelector("i").style.width = pc + "%";
      pj.querySelector("span").textContent =
        "Project: " +
        (q.type === "time" ? hm(sm) + " / " + hm(q.total) : sm + " / " + num(q.total) + (q.ul ? " " + q.ul : "")) +
        " (" +
        pc +
        "%)";
    }
  });
  var cf = cfg();
  document.getElementById("sparkBar").hidden = !cf.sparkTools || past;
  document.getElementById("shareBtn").hidden = !cf.addShare;
  document.getElementById("trendsBtn").hidden = !cf.addTrends;
  if (!past) {
    checkFinish();
    maybeReviewTodos();
  }
  renderCarryNote();
  var cqm = {};
  cfg().quests.forEach(function (q) {
    cqm[q.id] = q;
  });
  defs.forEach(function (q) {
    var el = qEls[q.id];
    if (!el) return;
    var sk = el.row.querySelector(".qstk");
    if (sk) {
      var n = qStreak(q.id, k);
      sk.hidden = n < 2;
      if (n >= 2) {
        sk.innerHTML = svg("flame") + "<b>" + n + "</b>";
        sk.setAttribute("aria-label", n + " days in a row");
      }
    }
    var ch = el.row.querySelector(".sjchip");
    if (ch) {
      var sl = qSubjs(q),
        pool = qTopicPool(q);
      if (sl.length) {
        var due = pool.some(function (id) {
          return topicStats(topicById(id).t).due;
        });
        ch.innerHTML = '<span class="sjn">...</span>' + (due ? '<i class="rdot"></i>' : "");
        ch.setAttribute(
          "aria-label",
          "Feeds " +
            (pool.length
              ? pool.map(topicName)
              : sl.map(function (id) {
                  return subjById(id).name;
                })
            ).join(", "),
        );
        ch.hidden = false;
      } else ch.hidden = true;
    }
    var cq = cqm[q.id];
    el.row.classList.toggle("doneq", !!(cq && cq.completed));
  });
  timerTick();
  renderHudExtras(T);
  renderShelf();
  notifSync();
  applyHide();
  mobileList(defs, e, past);
  renderPark();
  renderHeat();
  defs.forEach(function (q) {
    var el = qEls[q.id];
    if (!el || q.type !== "time") return;
    var rq = el.row.querySelector(".req"),
      base = reqText(q),
      xtra = "";
    if (q.roll) {
      var rk = k,
        rs = rollSum(q.id, rk),
        rn = rollNeed(q, rk),
        df = rs - rn;
      xtra =
        " \u00b7 7-day: " +
        hm(rs) +
        " / " +
        hm(rn) +
        (df >= 0
          ? df === 0
            ? " \u00b7 on pace"
            : " \u00b7 ahead " + hm(df)
          : " \u00b7 " + hm(-df) + " more today keeps you on pace");
    } else if (cfg().bank) {
      var cv = (bankCov.get(e) || {})[q.id] || 0,
        bk = bankNow[q.id] || 0;
      if (cv) xtra = " \u00b7 +" + hm(cv) + " from bank";
      else if (bk) xtra = " \u00b7 bank " + hm(bk);
    }
    rq.textContent = base;
  });
  /* Casual: totals just say how much of this period's target is done (no pace or "need" figures). */
  if (off && k === T)
    defs.forEach(function (q) {
      var el = qEls[q.id];
      if (!el || q.type !== "time" || !q.roll) return;
      var rq = el.row.querySelector(".req");
      if (rq)
        rq.textContent +=
          " \u00b7 " + hm(rollSum(q.id, k, q)) + " of " + hm(weekTarget(q, k)) + " done this " + perWord(q);
    });
  defs.forEach(function (q) {
    var el = qEls[q.id];
    if (!el || q.type !== "time" || !q.roll) return;
    var wt = weekTarget(q, k);
    if (wt < q.roll) {
      var rq = el.row.querySelector(".req");
      if (rq && rq.textContent.indexOf("this " + perWord(q)) < 0)
        rq.textContent += " \u00b7 " + hm(wt) + " this " + perWord(q) + " (started " + fmtD(weekFrom(q, k)) + ")";
    }
  });
  defs.forEach(function (q) {
    var el = qEls[q.id];
    if (!el || q.type !== "time" || !q.roll || scheduled(q, k)) return;
    var rq = el.row.querySelector(".req");
    if (rq && rq.textContent.indexOf("off day") < 0) rq.textContent += " \u00b7 off day, extra time still counts";
  });
  defs.forEach(function (q) {
    var el = qEls[q.id];
    if (!el || !lateStart(q, k)) return;
    var rq = el.row.querySelector(".req");
    if (rq && rq.textContent.indexOf("counts from") < 0)
      rq.textContent += " \u00b7 counts from " + (q.type === "time" && q.roll ? "next week" : "tomorrow");
  });
  schRows(defs, k);
  renderResetCard(st);
  document.getElementById("tdRow").hidden = past;
  var pn = document.getElementById("pausedNote"),
    pq =
      k === T
        ? cfg().quests.filter(function (q) {
            return isPaused(q, T);
          })
        : [],
    uq =
      k === T
        ? cfg().quests.filter(function (q) {
            return !isPaused(q, T) && !scheduled(q, T) && !(q.type === "time" && q.roll);
          })
        : [];
  var pt = [];
  if (pq.length)
    pt.push(
      "Paused: " +
        pq
          .map(function (q) {
            return q.label + " (until " + fmtD(add(q.pausedUntil, -1)) + ")";
          })
          .join(", "),
    );
  if (uq.length)
    pt.push(
      "Not scheduled today: " +
        uq
          .map(function (q) {
            return q.label;
          })
          .join(", "),
    );
  if (k === T && isVac(T)) pt.push("Vacation: everything is optional today.");
  else if (k === T && !reqOf(defs).length && cfg().quests.length) pt.push("Rest day: nothing required today.");
  pn.textContent = pt.join(" \u00b7 ");
  pn.hidden = !pt.length;
  qWrap.querySelectorAll("button,input").forEach(function (x) {
    var minus = (x.getAttribute("aria-label") || "").indexOf("Less ") === 0;
    if (past) x.disabled = true;
    else if (!minus) x.disabled = false;
  });
  var nreq = reqOf(defs).filter(function (q) {
      return q.type !== "limit";
    }),
    n = nreq.filter(function (q) {
      return metQ(q, e);
    }).length,
    lb = reqOf(defs).filter(function (q) {
      return overQ(q, e);
    }).length;
  document.querySelectorAll("#xpbar i").forEach(function (x, i) {
    x.classList.toggle("on", i < n);
  });
  document.getElementById("xpText").textContent =
    (nreq.length ? "Today: " + n + " of " + nreq.length + " done" : "Nothing required today") +
    (lb ? " \u00b7 " + lb + " limit" + (lb === 1 ? "" : "s") + " broken" : "");
  var cl = document.getElementById("cleared");
  var isGold = gold(e),
    isOk = ok(e),
    isLim = limBroken(e);
  if (off) {
    cl.textContent = isOk ? "All done today!" : "";
    cl.className = isOk ? "cleared" : "";
  } else if (isOk) {
    cl.textContent = isGold ? "Gold day!" : "Day cleared!";
    cl.className =
      "cleared" +
      (isGold ? " gold" : "") +
      (fromClick && (lastCleared === false || (isGold && !lastEval.gold)) ? " pop" : "");
  } else if (isLim) {
    cl.textContent = "Limit broken: day failed";
    cl.className = "failtxt";
  } else {
    cl.textContent = "";
    cl.className = "";
  }
  lastCleared = isOk;
  var xp = xpNet(),
    lv = level(xp);
  document.getElementById("lvlNum").textContent = "Lv " + lv.l;
  document.getElementById("hudLine").innerHTML = off
    ? '<span class="hl-r">' +
      esc(document.getElementById("rankName").textContent) +
      "</span><span>Casual</span><span>Lv <b>" +
      lv.l +
      '</b></span><i class="hl-c" aria-hidden="true"></i>'
    : '<span class="hl-r">' +
      esc(document.getElementById("rankName").textContent) +
      "</span><span>Streak <b>" +
      st.streak +
      "</b></span><span>Lv <b>" +
      lv.l +
      '</b></span><i class="hl-c" aria-hidden="true"></i>';
  document.getElementById("lvlText").textContent = lv.cur + " / " + lv.need + " XP";
  document.getElementById("xpFill").style.width = Math.round((lv.cur / lv.need) * 100) + "%";
  if (fromClick && !past && lastEval.set) {
    if (off) {
      if (n > lastEval.n) sfx("base");
    } else if (lv.l > lastEval.lvl) {
      sfx("level");
      toast.innerHTML =
        '<div class="ach px"><div class="slot">' +
        svg("trophy") +
        '</div><div><div class="t1">Level up!</div><div class="t2">Level ' +
        lv.l +
        '</div><div class="t3">' +
        xp +
        " XP total</div></div></div>";
      requestAnimationFrame(function () {
        toast.classList.add("show");
      });
      setTimeout(function () {
        toast.classList.remove("show");
      }, 4000);
    } else if (isGold && !lastEval.gold) sfx("gold");
    else if (isOk && !lastEval.ok) sfx("clear");
    else if (isLim && !lastEval.lim) sfx("fail");
    else if (n > lastEval.n) sfx("base");
  }
  if (!past) lastEval = { set: true, n: n, ok: isOk, gold: isGold, lim: isLim, lvl: lv.l };
  if (!past) renderBadges(st);
}
function elapsed() {
  var now = new Date(),
    t;
  function u(n, w) {
    return n + " " + w + (n === 1 ? "" : "s");
  }
  if (now < START_AT) {
    var s = Math.floor((START_AT - now) / 1000),
      dd = Math.floor(s / 86400);
    t =
      "Starts in " +
      (dd ? u(dd, "day") + ", " : "") +
      u(Math.floor((s % 86400) / 3600), "hour") +
      ", " +
      u(Math.floor((s % 3600) / 60), "minute");
  } else {
    var m = (now.getFullYear() - START_AT.getFullYear()) * 12 + now.getMonth() - START_AT.getMonth();
    var a = new Date(START_AT);
    a.setMonth(a.getMonth() + m);
    if (a > now) {
      m--;
      a = new Date(START_AT);
      a.setMonth(a.getMonth() + m);
    }
    var r = Math.floor((now - a) / 60000),
      D = Math.floor(r / 1440),
      H = Math.floor((r % 1440) / 60),
      M = r % 60;
    t = "In effect for " + (m ? u(m, "month") + ", " : "") + u(D, "day") + ", " + u(H, "hour") + ", " + u(M, "minute");
  }
  document.getElementById("elapsed").textContent = t;
  var tf = document.getElementById("tlFrom");
  if (tf)
    tf.textContent =
      (new Date() < START_AT ? "Starting " : "Since ") +
      START_AT.toLocaleString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
      });
}
var R = new Date(START_AT),
  n0 = new Date();
do {
  R.setDate(R.getDate() + 90);
} while (R <= n0);
var rv = document.getElementById("review");
if (rv)
  rv.textContent = R.toLocaleDateString("en-CA", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "America/Toronto",
  });
