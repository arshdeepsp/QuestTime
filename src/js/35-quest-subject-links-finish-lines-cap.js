/* ---- quest <-> subject links, finish lines, cap ---- */
var LV = ["", "Novice", "Beginner", "Intermediate", "Advanced", "Expert"];
function subjById(id) {
  return subjList().filter(function (s) {
    return s.id === id;
  })[0];
}
function qSubjs(q) {
  var L = q && q.subjs && q.subjs.length ? q.subjs.slice() : q && q.subj ? [q.subj] : [];
  return L.filter(function (id) {
    return subjById(id);
  });
}
function setSubjs(q, L) {
  L = (L || []).filter(function (x, i, a) {
    return x && a.indexOf(x) === i;
  });
  if (L.length) {
    q.subjs = L;
    q.subj = L[0];
  } else {
    delete q.subjs;
    delete q.subj;
    delete q.topics;
    if (q.fin && q.fin.t !== "total") delete q.fin;
  }
}
function topicById(tid) {
  var r = null;
  subjList().some(function (s) {
    return (s.topics || []).some(function (t) {
      if (t.id === tid) {
        r = { s: s, t: t };
        return true;
      }
      return false;
    });
  });
  return r;
}
function qTopics(q) {
  return ((q && q.topics) || []).filter(function (t, i, a) {
    return topicById(t) && a.indexOf(t) === i;
  });
}
function qTopicPool(q) {
  var L = qTopics(q),
    out = L.slice();
  qSubjs(q).forEach(function (sid) {
    if (
      L.some(function (t) {
        return topicById(t).s.id === sid;
      })
    )
      return;
    (subjById(sid).topics || []).forEach(function (t) {
      out.push(t.id);
    });
  });
  return out;
}
function setLinks(q, L, SL) {
  L = L.filter(function (x, i, a) {
    return a.indexOf(x) === i;
  });
  if (L.length) q.topics = L;
  else delete q.topics;
  setSubjs(q, SL);
  if (q.fin && q.fin.t === "topic" && !qTopics(q).length) delete q.fin;
}
function linkTopic(q, tid) {
  var o = topicById(tid);
  if (!o) return;
  var L = qTopics(q),
    SL = qSubjs(q),
    k = L.indexOf(tid),
    sid = o.s.id;
  if (k >= 0) L.splice(k, 1);
  else L.push(tid);
  var has = L.some(function (x) {
    return topicById(x).s.id === sid;
  });
  if (has && SL.indexOf(sid) < 0) SL.push(sid);
  if (!has)
    SL = SL.filter(function (x) {
      return x !== sid;
    });
  setLinks(q, L, SL);
}
function subjFull(q, sid) {
  var sj = subjById(sid),
    T = (sj && sj.topics) || [],
    L = qTopics(q);
  return T.length
    ? T.every(function (t) {
        return L.indexOf(t.id) >= 0;
      })
    : qSubjs(q).indexOf(sid) >= 0;
}
function linkSubj(q, sid) {
  var sj = subjById(sid);
  if (!sj) return;
  var L = qTopics(q),
    SL = qSubjs(q),
    ids = (sj.topics || []).map(function (t) {
      return t.id;
    });
  if (subjFull(q, sid)) {
    L = L.filter(function (x) {
      return ids.indexOf(x) < 0;
    });
    SL = SL.filter(function (x) {
      return x !== sid;
    });
  } else {
    L = L.concat(ids);
    if (SL.indexOf(sid) < 0) SL.push(sid);
  }
  setLinks(q, L, SL);
}
function topicPick(attr, q) {
  var SJ = subjList();
  if (!SJ.length) return "";
  var L = qTopics(q),
    SL = qSubjs(q);
  return (
    '<div class="tppick" role="group" aria-label="Feeds topics">' +
    SJ.map(function (sj) {
      var T = sj.topics || [],
        full = subjFull(q, sj.id);
      return (
        '<div class="tpg" data-sid="' +
        sj.id +
        '"><div class="tpg-h"><span class="tpg-n">' +
        esc(sj.name) +
        "</span>" +
        (T.length
          ? '<button type="button" class="lnk" ' +
            attr +
            ' data-lsj="' +
            sj.id +
            '">' +
            (full ? "None" : "All") +
            "</button>"
          : "") +
        '</div><div class="sjpick">' +
        (T.length
          ? T.map(function (t) {
              var on = L.indexOf(t.id) >= 0;
              return (
                '<button type="button" class="stone mini' +
                (on ? " on" : "") +
                '" ' +
                attr +
                ' data-ltp="' +
                t.id +
                '" aria-pressed="' +
                on +
                '">' +
                esc(t.name) +
                " <small>" +
                (t.p || 0) +
                "/5</small></button>"
              );
            }).join("")
          : '<button type="button" class="stone mini' +
            (full ? " on" : "") +
            '" ' +
            attr +
            ' data-lsj="' +
            sj.id +
            '" aria-pressed="' +
            full +
            '">Whole subject</button><span class="tpg-e">No topics yet</span>') +
        "</div></div>"
      );
    }).join("") +
    "</div>"
  );
}
function wireTopicPick(root, getQ, redraw) {
  root.querySelectorAll("[data-ltp]").forEach(function (x) {
    x.addEventListener("click", function () {
      linkTopic(getQ(x), x.getAttribute("data-ltp"));
      redraw();
    });
  });
  root.querySelectorAll("[data-lsj]").forEach(function (x) {
    x.addEventListener("click", function () {
      linkSubj(getQ(x), x.getAttribute("data-lsj"));
      redraw();
    });
  });
}
/* Floating list of what a quest feeds (the "…" box on its row): each topic with its level, or the subject itself when it has no topics; tapping one opens that subject. */
function openSubjPick(q, btn) {
  var pool = qTopicPool(q),
    items = [];
  pool.forEach(function (tid) {
    var x = topicById(tid);
    if (!x) return;
    items.push([
      esc(x.s.name) +
        " \u203a " +
        esc(x.t.name) +
        " \u00b7 " +
        (x.t.p || 0) +
        "/5" +
        (topicStats(x.t).due ? ' <i class="rdot"></i>' : ""),
      function () {
        jumpSubj(x.s.id);
      },
    ]);
  });
  qSubjs(q).forEach(function (sid) {
    var sj = subjById(sid);
    if (
      sj &&
      !pool.some(function (tid) {
        var x = topicById(tid);
        return x && x.s.id === sid;
      })
    )
      items.push([
        esc(sj.name) + " \u00b7 No topics yet",
        function () {
          jumpSubj(sid);
        },
      ]);
  });
  if (!items.length) return;
  if (btn) popMenu(btn, items);
  else items[0][1]();
}
function jumpSubj(id) {
  go("subjects");
  setTimeout(function () {
    var c = document.querySelector('.sjsec[data-sid="' + id + '"]');
    if (c && c.classList.contains("fold")) sjFold(id);
    if (c) {
      c.scrollIntoView({ block: "center" });
      c.classList.add("flash");
      setTimeout(function () {
        c.classList.remove("flash");
      }, 1500);
    }
  }, 50);
}
function subjMinutes(sid) {
  var t = 0;
  Object.keys(S.days).forEach(function (d) {
    var e = S.days[d];
    if (!e) return;
    defsOf(e).forEach(function (q) {
      if (q.type === "time" && qSubjs(q).indexOf(sid) >= 0) t += e[q.id] | 0;
    });
  });
  return t;
}
function capOf() {
  return cfg().cap || 10;
}
var WDN = ["Sundays", "Mondays", "Tuesdays", "Wednesdays", "Thursdays", "Fridays", "Saturdays"],
  WDS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
function countsOnDay(q) {
  return q && q.type !== "todo" && q.type !== "weekly" && !q.completed && !q.opt;
}
function dayLoad(L) {
  var c = [0, 0, 0, 0, 0, 0, 0];
  (L || cfg().quests).forEach(function (q) {
    if (!countsOnDay(q)) return;
    var d = q.days && q.days.length ? q.days : [0, 1, 2, 3, 4, 5, 6];
    d.forEach(function (w) {
      c[w]++;
    });
  });
  return c;
}
function overDays(L, cap) {
  var c = dayLoad(L),
    k = cap || capOf(),
    out = [];
  c.forEach(function (n, w) {
    if (n > k) out.push({ w: w, n: n });
  });
  return out;
}
function busiest(L) {
  var c = dayLoad(L),
    m = 0,
    w = 1;
  c.forEach(function (n, i) {
    if (n > m) {
      m = n;
      w = i;
    }
  });
  return { w: w, n: m };
}
function overMsg(ov, cap) {
  return (
    ov
      .map(function (o) {
        return WDN[o.w] + " would have " + o.n;
      })
      .join(", ") +
    " quests (limit " +
    (cap || capOf()) +
    " per day). Untick some days, make one optional, or complete one first."
  );
}
function wouldExceed(newQ) {
  var L = cfg().quests.concat([newQ]);
  return overDays(L);
}
function finishMet(q) {
  var f = q.fin;
  if (q.dl) {
    var s = 0,
      T = todayKey();
    for (var d = q.dl.from; d <= T; d = add(d, 1)) s += +(S.days[d] || {})[q.id] || 0;
    if (s >= q.dl.total) return "target met";
    if (T > q.dl.due) return "deadline passed";
    return null;
  }
  if (!f) return null;
  if (f.t === "total" && q.total && projSum(q.id) >= q.total) return "project total reached";
  if (f.t === "topic") {
    var TL = qTopicPool(q).map(function (x) {
      return topicById(x).t;
    });
    if (
      TL.length &&
      TL.every(function (t) {
        return (t.p || 0) >= (f.lvl || 4);
      })
    )
      return (TL.length === 1 ? TL[0].name : "All its topics") + " reached " + LV[f.lvl || 4];
  }
  if (f.t === "subject") {
    var SJ2 = qSubjs(q)
      .map(subjById)
      .filter(function (s) {
        return s && (s.topics || []).length;
      });
    if (
      SJ2.length &&
      SJ2.every(function (s) {
        return Math.round(avgProf(s)) >= (f.lvl || 4);
      })
    )
      return (SJ2.length === 1 ? SJ2[0].name : "All its subjects") + " reached " + LV[f.lvl || 4];
  }
  return null;
}
function completeQuest(id, how, silent) {
  var c = clone(cfg()),
    q = c.quests.filter(function (x) {
      return x.id === id;
    })[0];
  if (!q || q.completed) return;
  q.completed = { on: todayKey(), how: how };
  saveCfg(c);
  qSig = "";
  if (!silent && how !== "archived") {
    sfx("level");
    showToast({ icon: "trophy", kicker: "Quest complete!", title: q.label, desc: how !== "manual" ? how : "" });
    setSync(
      "Quest complete: " + q.label + "." + (rewardsOff() ? "" : " It moves to Badges \u203a Completed from tomorrow."),
    );
  }
}
var finChecking = false;
function checkFinish() {
  if (finChecking || locked()) return;
  finChecking = true;
  try {
    cfg().quests.forEach(function (q) {
      if (q.completed || q.type === "todo") return;
      var m = finishMet(q);
      if (m) completeQuest(q.id, m);
    });
  } finally {
    finChecking = false;
  }
}
function completionXP(upto) {
  return cfg().quests.reduce(function (a, q) {
    return (
      a +
      (q.completed && (!upto || q.completed.on <= upto)
        ? q.completed.how === "archived"
          ? 0
          : q.completed.how === "manual"
            ? 25
            : 100
        : 0)
    );
  }, 0);
}
function markCompleteManual(q) {
  var met = finishMet(q);
  if (met) {
    completeQuest(q.id, met);
    render();
    return;
  }
  openG("Mark quest complete?", function (b) {
    var inf = easeInfo();
    b.innerHTML =
      '<p class="mhead">Finish \u201c' +
      esc(q.label) +
      '\u201d?</p><p class="help">It stays on today\u2019s list, then moves to Badges \u203a Completed from tomorrow. Its history is kept.</p>' +
      '<div class="edrow end"><button type="button" class="stone" id="mcNo">Cancel</button><button type="button" class="stone save" id="mcGo">Mark complete</button></div>';
    b.querySelector("#mcNo").addEventListener("click", closeG);
    b.querySelector("#mcGo").addEventListener("click", function () {
      var c = clone(cfg()),
        old = clone(c.quests),
        g = guardEasing(c, old, inf.setup ? [] : [q.id]);
      if (!g.ok) {
        b.querySelector(".help").textContent = g.msg;
        return;
      }
      var t = c.quests.filter(function (x) {
        return x.id === q.id;
      })[0];
      t.completed = { on: todayKey(), how: "manual" };
      saveCfg(c);
      qSig = "";
      closeG();
      sfx("level");
      showToast({ icon: "trophy", kicker: "Quest complete!", title: q.label, desc: "" });
      render();
    });
  });
}
function renderShelf() {
  var el = document.getElementById("shelf");
  if (!el) return;
  var L = cfg().quests.filter(function (q) {
    return q.completed;
  });
  el.hidden = !L.length;
  if (!L.length) {
    el.innerHTML = "";
    return;
  }
  el.innerHTML =
    '<h3 class="ach-sub">Completed quests</h3><div class="shelf">' +
    L.slice()
      .sort(function (a, b) {
        return a.completed.on < b.completed.on ? 1 : -1;
      })
      .map(function (q) {
        var ar = q.completed.how === "archived";
        return (
          '<div class="shelf-r' +
          (ar ? " ar" : "") +
          '"><span class="ml">' +
          (ar ? "" : "\u2713 ") +
          esc(q.label) +
          '</span><span class="mv">' +
          (ar ? "Archived" : "Done") +
          " " +
          fmtD(q.completed.on) +
          (ar || q.completed.how === "manual" ? "" : " \u00b7 " + esc(q.completed.how)) +
          "</span>" +
          (ar ? '<button type="button" class="stone mini" data-restore="' + q.id + '">Restore</button>' : "") +
          "</div>"
        );
      })
      .join("") +
    "</div>";
  el.querySelectorAll("[data-restore]").forEach(function (x) {
    x.addEventListener("click", function () {
      var c = clone(cfg()),
        q = c.quests.filter(function (z) {
          return z.id === x.getAttribute("data-restore");
        })[0];
      if (!q) return;
      var tq = clone(q);
      delete tq.completed;
      var ov0 = overDays(
        c.quests
          .filter(function (z) {
            return z !== q;
          })
          .concat([tq]),
      );
      if (ov0.length) {
        setSync(overMsg(ov0));
        return;
      }
      delete q.completed;
      saveCfg(c);
      qSig = "";
      render();
      renderShelf();
      setSync(q.label + " restored");
    });
  });
}
/* ---- notifications (native app via Capacitor; inert in the browser) ---- */
function nativeApp() {
  try {
    return !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());
  } catch (x) {
    return false;
  }
}
var LNp = null;
function LN() {
  if (LNp) return LNp;
  try {
    if (!nativeApp()) return null;
    LNp =
      (window.Capacitor.Plugins && window.Capacitor.Plugins.LocalNotifications) ||
      (window.Capacitor.registerPlugin ? window.Capacitor.registerPlugin("LocalNotifications") : null);
  } catch (x) {
    LNp = null;
  }
  return LNp;
}
var NF_DEF = {
  on: false,
  timer: true,
  sched: true,
  checkin: true,
  checkinAt: "19:00",
  todos: true,
  risk: true,
  dl: true,
  review: true,
  pace: true,
};
function nf() {
  return Object.assign({}, NF_DEF, cfg().nf || {});
}
function atTime(k, hhmm) {
  var p = parse(k),
    a = hhmm.split(":");
  p.setHours(+a[0], +a[1], 0, 0);
  return p;
}
function nfPlan() {
  var n = nf(),
    now = Date.now(),
    out = [],
    T = todayKey(),
    e = S.days[T] || {},
    st = lastSt || compute();
  if (!n.on) return out;
  function push(id, title, body, at, extra, ch) {
    var t = at instanceof Date ? at.getTime() : at;
    if (t > now + 5000)
      out.push({
        id: id,
        title: title,
        body: body,
        channelId: ch || "pc_alerts2",
        extra: Object.assign({ at: t }, extra || {}),
        schedule: { at: new Date(t), allowWhileIdle: true },
      });
  }
  if (n.timer && S.timer) {
    var q = activeDefs(T).filter(function (x) {
      return x.id === S.timer.id;
    })[0];
    if (q && q.type === "time") {
      var lg = e[q.id] | 0,
        mn = timerMin(q);
      if (!S.timer.minHit && lg < mn)
        push(
          1001,
          q.roll ? "Today\u2019s share done \u2714" : "Minimum reached \u2714",
          q.label + ": " + hmL(mn) + (q.roll ? " today" : "") + " done. Keep going or stop the timer to log it.",
          S.timer.start + (mn - lg) * 60000,
        );
      var pl = planOf(q, e);
      if (cfg().showPlan && !q.roll && pl > q.min && !S.timer.planHit && lg < pl)
        push(1002, "Plan reached \u2605", q.label + ": " + hm(pl) + " done.", S.timer.start + (pl - lg) * 60000);
      if (S.timer.commit && !S.timer.c5)
        push(1003, "5 minutes in!", "Keep going, or stop guilt-free.", S.timer.start + S.timer.commit * 60000);
      var lm = limOf(q);
      if (lm && lg < lm && S.timer.day === T)
        push(
          1004,
          "Time\u2019s up \u23f9",
          q.label + ": daily limit of " + hmL(lm) + " reached. Timer stopped and logged.",
          S.timer.start + (lm - lg) * 60000,
          { q: q.id },
          "pc_stop",
        );
    }
  }
  var sp = S.sprint;
  if (n.timer && sp) {
    if (sp.phase === "focus" && !sp.paused)
      push(
        1101,
        "Block done \u2014 take your break",
        spLabel(sp.cur) + " logged. 15-minute decision break starts now.",
        sp.end,
      );
    if (sp.phase === "break" && !sp.breakDone)
      push(1102, "Break over", "Pick your next quest and start the block.", sp.bend);
    if (sp.phase === "focus" && !sp.paused && !(sp.rounds && sp.block >= sp.rounds))
      push(
        1103,
        "Break over",
        "Pick your next quest and start the block.",
        sp.end + (sp.longEvery && sp.block % sp.longEvery === 0 ? 30 : 15) * 60000,
      );
  }
  for (var i = 0; i < 7; i++) {
    var k = add(T, i),
      today = i === 0;
    if (n.checkin) {
      var left = today
        ? reqOf(activeDefs(T)).filter(function (q) {
            return q.type !== "limit" && !metQ(q, e);
          }).length
        : null;
      if (!today || left > 0)
        push(
          2000 + i,
          "Evening check-in",
          today
            ? left + " quest" + (left === 1 ? "" : "s") + " left today. Still time."
            : "How\u2019s today going? Open your quests.",
          atTime(k, n.checkinAt),
        );
    }
    if (today && n.todos) {
      var otd = openTodos().length;
      if (otd) {
        push(
          2400,
          "To-dos still open",
          otd + " to-do" + (otd === 1 ? "" : "s") + " not done today. Keep or clear them?",
          atMin(k, dayWin(k).e) - 30 * 60000,
        );
      }
    }
  }
  if (n.risk && !rewardsOff() && st.miss === 1 && !ok(e))
    push(
      2200,
      "Streak at risk",
      "Your last required day was missed. Clear today to keep your " + st.streak + "-day streak.",
      atTime(T, "12:00"),
    );
  if (n.pace) {
    var tq = activeDefs(T).filter(function (q) {
      return q.type === "time" && !q.opt;
    });

    var midAt = atMin(T, dayMidMin(T));
    var dq = tq.filter(function (q) {
        return !q.roll && q.min > 0;
      }),
      dDone = 0,
      dNeed = 0;
    dq.forEach(function (q) {
      dDone += e[q.id] | 0;
      dNeed += q.min;
    });
    if (dNeed && dDone < dNeed / 2)
      push(
        2500,
        "Halfway through the day",
        hm(dDone) + " of " + hm(dNeed) + " done across your daily time quests.",
        midAt,
      );
    /* 2600: 09:00 on the next checkpoint (halfway, or the period's last day) that a total is still short for. */
    var cp = null;
    (rewardsOff() ? [] : periodList(T)).forEach(function (q) {
      var md = midDay(q, T),
        pe = perEnd(q, T),
        s = rollSum(q.id, T, q),
        half = !!md && md >= T && md !== pe && s < midNeed(q, T),
        d = half ? md : pe,
        nd = half ? midNeed(q, T) : weekTarget(q, T);
      if (!nd || s >= nd) return;
      if (!cp || d < cp.d) cp = { d: d, L: [], h: 0, f: 0 };
      if (d === cp.d) {
        cp.L.push(q.label + " " + hm(s) + " of " + hm(nd));
        if (half) cp.h++;
        else cp.f++;
      }
    });
    if (cp) {
      var cpw = cp.d === T ? "today" : DAYF[parse(cp.d).getDay()];
      push(
        2600,
        (cp.f ? (cp.h ? "Checkpoint " : "Total due ") : "Halfway checkpoint ") + cpw,
        (cp.f
          ? cp.h
            ? "By tonight you need: "
            : "By tonight you need the full total: "
          : "By tonight you need a third: ") +
          cp.L.join(", ") +
          ". Miss it and the " +
          (cp.f && !cp.h ? "whole period is" : "days so far are") +
          " lost.",
        atTime(cp.d, "09:00"),
      );
    }
  }
  if (n.sched) schNotifs(T, e, push);
  if (n.dl)
    (cfg().deadlines || []).forEach(function (d, i) {
      var dk = add(d.date, -1);
      if (dk >= T)
        push(
          3000 + i,
          "Tomorrow: " + d.title,
          "Your deadline is tomorrow. Plan today\u2019s work around it.",
          atTime(dk, "18:00"),
          { dl: d.id },
        );
    });
  if (n.review) {
    var due = allTopics().filter(function (o) {
      return topicStats(o.t).due;
    }).length;
    if (due) {
      var sun = add(weekStart(T), 6);
      push(
        4001,
        "Topics due for review",
        due + " topic" + (due === 1 ? "" : "s") + " untouched for 2+ weeks. Pick for me can suggest one.",
        atTime(sun >= T ? sun : add(sun, 7), "10:00"),
      );
    }
  }
  return out;
}
var nfT = 0,
  nfSig = "";
function notifSync() {
  clearTimeout(nfT);
  nfT = setTimeout(function () {
    var ln = LN();
    if (!ln) return;
    resumeSync(ln);
    var plan = nfPlan(),
      sig = JSON.stringify(
        plan.map(function (x) {
          return [x.id, Math.round(x.schedule.at.getTime() / 60000), x.title, x.body, JSON.stringify(x.extra || {})];
        }),
      );
    if (sig === nfSig) return;
    nfSig = sig;
    Promise.resolve(ln.getPending ? ln.getPending() : { notifications: [] })
      .then(function (r) {
        var ours = ((r && r.notifications) || [])
          .filter(function (x) {
            return x.id >= 1000 && x.id < 5000;
          })
          .map(function (x) {
            return { id: x.id };
          });
        return ours.length ? ln.cancel({ notifications: ours }) : null;
      })
      .then(function () {
        return ensureChannels();
      })
      .then(function () {
        return plan.length ? ln.schedule({ notifications: plan }) : null;
      })
      .catch(function (err) {
        console.warn("notif", err);
      });
  }, 800);
}
document.addEventListener("visibilitychange", function () {
  if (document.visibilityState === "visible") notifSync();
});
function notifEnable(on, cb) {
  var ln = LN();
  if (!on || !ln) {
    cb(on && !ln ? "app" : null);
    return;
  }
  Promise.resolve(ln.requestPermissions ? ln.requestPermissions() : { display: "granted" })
    .then(function (r) {
      cb(r && r.display === "granted" ? null : "denied");
    })
    .catch(function () {
      cb("denied");
    });
}
var chReady = null;
function ensureChannels() {
  var ln = LN();
  if (!ln || !ln.createChannel) return Promise.resolve();
  if (chReady) return chReady;
  chReady = Promise.all([
    ln.createChannel({
      id: "pc_alerts2",
      name: "Alerts and reminders",
      description: "Timer, sprint, check-in and deadline alerts",
      importance: 5,
      visibility: 1,
      vibration: true,
      lights: true,
      sound: "pc_chime.wav",
    }),
    ln.createChannel({
      id: "pc_stop",
      name: "Time\u2019s up",
      description: "A quest\u2019s daily limit was reached",
      importance: 5,
      visibility: 1,
      vibration: true,
      lights: true,
      sound: "pc_stop.wav",
    }),
    ln.createChannel({
      id: "pc_focus",
      name: "Focus in progress",
      description: "Shows while a timer or sprint runs",
      importance: 2,
      visibility: 1,
      vibration: false,
    }),
  ]).catch(function () {});
  return chReady;
}
function notifDiag(el) {
  var ln = LN();
  if (!el || !ln) return;
  el.innerHTML = '<p class="help">Checking\u2026</p>';
  Promise.all([
    ln.checkPermissions
      ? ln.checkPermissions().catch(function () {
          return {};
        })
      : {},
    ln.checkExactNotificationSetting
      ? ln.checkExactNotificationSetting().catch(function () {
          return {};
        })
      : {},
    ln.getPending
      ? ln.getPending().catch(function () {
          return { notifications: [] };
        })
      : { notifications: [] },
  ]).then(function (r) {
    var perm = (r[0] || {}).display || "unknown",
      ex = (r[1] || {}).exact_alarm || "unknown",
      pend = ((r[2] || {}).notifications || []).filter(function (n) {
        return n.id !== 900;
      }),
      next = pend
        .map(function (n) {
          var at = n.schedule && n.schedule.at ? new Date(n.schedule.at) : null;
          return { t: n.title, at: at };
        })
        .filter(function (x) {
          return x.at;
        })
        .sort(function (a, b) {
          return a.at - b.at;
        })
        .slice(0, 3);
    function row(k, v, ok) {
      return '<div class="dg-r"><span>' + k + '</span><b class="' + (ok ? "okc" : "warnc") + '">' + v + "</b></div>";
    }
    el.innerHTML =
      '<div class="diag">' +
      row("Permission", perm, perm === "granted") +
      row("Exact timing", ex, ex === "granted") +
      row("Scheduled", pend.length + " alert" + (pend.length === 1 ? "" : "s"), pend.length > 0) +
      (next.length
        ? '<div class="dg-n">Next: ' +
          next
            .map(function (x) {
              return (
                esc(x.t) + " at " + x.at.toLocaleString([], { weekday: "short", hour: "numeric", minute: "2-digit" })
              );
            })
            .join("; ") +
          "</div>"
        : "") +
      '</div><p class="help">If permission and exact timing are both granted and alerts still arrive late, Android\u2019s battery saver is holding them. Set Android Settings \u203a Apps \u203a ProductivityCraft \u203a Battery to <b>Unrestricted</b>. On Samsung, also remove it from <b>Sleeping apps</b>.</p><div class="edrow"><button type="button" class="stone mini" id="nfT60">Test in 1 minute</button><span class="pz" id="nfT60s"></span></div><div class="edrow"><button type="button" class="stone mini" id="nfLive">Test live timer</button><span class="pz" id="nfLiveS"></span></div>';
    el.querySelector("#nfLive").addEventListener("click", function () {
      var FN = capPlugin("FocusNotify"),
        out = el.querySelector("#nfLiveS");
      if (!FN || !FN.show) {
        out.textContent = "Live timer plugin not found.";
        return;
      }
      FN.show({
        title: "Live timer test",
        body: "Pull down to expand. It disappears in 20 seconds.",
        when: Math.round(Date.now() + 20000),
        countdown: true,
        chrono: true,
      })
        .then(function (r) {
          var msg =
            r && r.custom
              ? "Big clock layout applied (plugin v" +
                (r.version || 1) +
                ")" +
                (r.when ? ", timer received" : ", but the timer time was NOT received")
              : "Big clock layout NOT applied (plugin v" +
                ((r && r.version) || 1) +
                ")" +
                (r && r.error ? ": " + r.error : "");
          out.textContent = msg;
          alert(msg);
          setTimeout(function () {
            if (!S.timer && !S.sprint) FN.hide().catch(function () {});
            ongoingSig = "";
          }, 20000);
        })
        .catch(function (e) {
          out.textContent = "Live timer failed: " + ((e && e.message) || e);
        });
    });
    el.querySelector("#nfT60").addEventListener("click", function () {
      var at = new Date(Date.now() + 60000);
      ensureChannels()
        .then(function () {
          return ln.schedule({
            notifications: [
              {
                id: 4998,
                title: "Timing test",
                body:
                  "Scheduled for " +
                  at.toLocaleTimeString([], { hour: "numeric", minute: "2-digit", second: "2-digit" }) +
                  ". Compare with the time it arrived.",
                channelId: "pc_alerts2",
                schedule: { at: at, allowWhileIdle: true },
              },
            ],
          });
        })
        .then(function () {
          el.querySelector("#nfT60s").textContent =
            "Lock the phone now. Due at " +
            at.toLocaleTimeString([], { hour: "numeric", minute: "2-digit", second: "2-digit" });
        });
    });
  });
}
function notifTest() {
  var ln = LN();
  if (!ln) {
    setSync("Notifications work in the Android app build.");
    return;
  }
  ensureChannels()
    .then(function () {
      return ln.schedule({
        notifications: [
          {
            id: 4999,
            title: "ProductivityCraft",
            body: "Notifications are working.",
            channelId: "pc_alerts2",
            schedule: { at: new Date(Date.now() + 3000), allowWhileIdle: true },
          },
        ],
      });
    })
    .then(function () {
      setSync("Test notification in 3 seconds.");
    });
}
