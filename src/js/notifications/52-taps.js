/* ---- notification taps ----
     Every notification opens the app to its own prompt (notifAction). Local notifications arrive through
     localNotificationActionPerformed (quests/50b-todo-review.js); the live timer (901) is read from the native
     FocusNotify.takeTap() when the app opens or comes back to the front. */
import { CALL_CAP, CALL_MIN, CALL_XP, DAYF, S, dirty } from "../core/00-state.js";
import { cfg } from "../core/config.js";
import { add, parse, todayKey } from "../core/days.js";
import { locked } from "../core/entries.js";
import { capPlugin } from "../core/native.js";
import { cache } from "../core/storage.js";
import { esc, hm, num, svg } from "../core/util.js";
import { toast } from "../progress/03-badges.js";
import { reviewTodos } from "../quests/50b-todo-review.js";
import { cfgQ, midDay, midNeed, perEnd, periodList, rollNeed, rollSum, weekTarget } from "../rules/26-periods.js";
import { compute } from "../rules/compute.js";
import { metQ } from "../rules/day-rules.js";
import { rewardsOff } from "../rules/modes.js";
import { dayDefMap } from "../rules/past-days.js";
import { activeDefs, reqOf } from "../rules/quests-on-day.js";
import { openSchedule } from "../schedule/page.js";
import { schTap } from "../schedule/resume.js";
import { allTopics, topicStats } from "../subjects/33-topics.js";
import { timerCap, toggleTimer } from "../timer/13-focus-timer.js";
import { spShow } from "../timer/43-sprint.js";
import { openPomo, pomoNext, pomoStop } from "../timer/43b-pomodoro.js";
import { timerGoal } from "../timer/44b-live-notification.js";
import { openPick, start5 } from "../tools/28-spark-tools.js";
import { sfx } from "../ui/01-sound.js";
import { lastSt, render } from "../ui/04-render.js";
import { closeG, gEl, openG, qList } from "../ui/18-modal.js";
import { go } from "../ui/44-navigation.js";
import { setSync } from "../ui/feedback.js";

export var CALL_IDS;

export function callLeft() {
  return S.call ? S.call.until - Date.now() : 0;
}
export function callBadge() {
  var ms = callLeft();
  if (ms <= 0 || rewardsOff()) return "";
  var s = Math.ceil(ms / 1000);
  return (
    '<p class="nfxp">\u26a1 Start within ' +
    Math.floor(s / 60) +
    ":" +
    String(s % 60).padStart(2, "0") +
    " to answer the call: +" +
    CALL_XP +
    " XP</p>"
  );
}
export function callCheck() {
  var c = S.call;
  S.call = null;
  if (!c || Date.now() > c.until || locked()) return;
  var T = todayKey(),
    e = Object.assign({}, S.days[T] || {});
  if ((e.calls | 0) >= CALL_CAP) return;
  if (!e.q) e.q = activeDefs(T);
  e.calls = (e.calls | 0) + 1;
  S.days[T] = e;
  dirty[T] = true;
  cache();
  if (rewardsOff()) {
    setTimeout(render, 50);
    return;
  }
  setTimeout(function () {
    sfx("level");
    toast.innerHTML =
      '<div class="ach px"><div class="slot">' +
      svg("flame") +
      '</div><div><div class="t1">Answered the call!</div><div class="t2">+' +
      CALL_XP +
      ' XP</div><div class="t3">Started within ' +
      CALL_MIN +
      " minutes of a reminder</div></div></div>";
    requestAnimationFrame(function () {
      toast.classList.add("show");
    });
    setTimeout(function () {
      toast.classList.remove("show");
    }, 4000);
    render();
  }, 50);
}
export function nfCall(title, icon, head, body, btns) {
  if (!gEl.hidden) closeG();
  sfx("chime");
  var starts = btns.some(function (x) {
    return x[3];
  });
  openG(title, function (b) {
    b.innerHTML =
      '<div class="nfcall"><div class="slot">' +
      svg(icon) +
      '</div><div class="nfc-t"><p class="mhead">' +
      head +
      "</p>" +
      (starts ? callBadge() : "") +
      (body || "") +
      '</div></div><div class="edrow end">' +
      btns
        .map(function (x, i) {
          return (
            '<button type="button" class="stone' +
            (x[2] ? " " + x[2] : "") +
            '" data-nb="' +
            i +
            '">' +
            x[0] +
            "</button>"
          );
        })
        .join("") +
      "</div>";
    b.querySelectorAll("[data-nb]").forEach(function (x) {
      x.addEventListener("click", function () {
        var f = btns[+x.getAttribute("data-nb")][1];
        closeG();
        if (f) setTimeout(f, 0);
      });
    });
    var sv = b.querySelector(".edrow .save");
    if (sv)
      setTimeout(function () {
        sv.focus();
      }, 0);
  });
}
export function nfBar(label, done, goal) {
  var pc = goal ? Math.min(100, Math.round((done / goal) * 100)) : 0;
  return (
    '<div class="nfrow"><span>' +
    esc(label) +
    "</span><b>" +
    hm(done) +
    " / " +
    hm(goal) +
    '</b><div class="nfbar"><i style="width:' +
    pc +
    '%"></i></div></div>'
  );
}
export function nfOpen() {
  var T = todayKey(),
    e = S.days[T] || {};
  return reqOf(activeDefs(T)).filter(function (q) {
    return q.type !== "limit" && !metQ(q, e);
  });
}
export function nfGo() {
  go("today");
  if (!gEl.hidden) closeG();
}
export function nfJust5(q) {
  return q
    ? [
        "Just 5 on " + esc(q.label),
        function () {
          start5(q);
        },
        "save",
        1,
      ]
    : null;
}
export function nfBehind() {
  var T = todayKey(),
    e = S.days[T] || {},
    best = null,
    gap = 0;
  activeDefs(T).forEach(function (q) {
    if (q.type !== "time" || q.off || q.ign || metQ(q, e)) return;
    var g = q.roll ? rollNeed(q, T) - rollSum(q.id, T) : q.min - (e[q.id] | 0);
    if (!best || g > gap) {
      best = q;
      gap = g;
    }
  });
  return best;
}
export function nfTimer(kind) {
  var T = todayKey(),
    t = S.timer;
  if (!t) {
    nfGo();
    setSync("That timer has already stopped.");
    return;
  }
  go("today");
  var q = activeDefs(T).filter(function (x) {
    return x.id === t.id;
  })[0];
  if (!q) {
    nfGo();
    return;
  }
  var e = S.days[T] || {},
    mins = Math.floor((Date.now() - t.start) / 60000),
    tot = (e[q.id] | 0) + mins,
    goal = timerGoal(q);
  var head =
    {
      min: q.roll ? "Today\u2019s share done!" : "Minimum cleared!",
      plan: "Plan reached: gold pace!",
      five: "5 minutes in. You started, and that’s the hard part.",
      live: "Welcome back. Still going.",
    }[kind] || "Still going.";
  var icon = { min: "trophy", plan: "star", five: "flame", live: "sprout" }[kind] || "sprout";
  var body =
    '<p class="help">' +
    esc(q.label) +
    ": " +
    hm(mins) +
    " this session.</p>" +
    nfBar("Toward today’s goal", tot, goal) +
    (kind === "min" && !q.roll ? '<p class="help">Every minute from here grows your tree toward your plan.</p>' : "");
  nfCall(t.label, icon, head, body, [
    [
      "Stop &amp; log",
      function () {
        if (S.timer && S.timer.id === q.id) toggleTimer(q);
      },
      "del",
    ],
    ["Keep going", null, "save"],
  ]);
}
export function nfSprint() {
  if (S.sprint) {
    go("today");
    if (!gEl.hidden) closeG();
    spShow();
  } else nfGo();
}
/* act = the notification's action button: "next" skips what's left of the break and starts the next pomodoro, "end" ends
     the session; a plain tap (or "tap", the default) just opens the page. */
export function nfPomo(act) {
  go("today");
  if (!gEl.hidden) closeG();
  if (act === "next" && S.pomo && S.pomo.phase === "break") pomoNext();
  else if (act === "end" && S.pomo) pomoStop();
  openPomo();
}
export function nfQuestsLeft(title, icon, head, extra) {
  var T = todayKey(),
    e = S.days[T] || {},
    L = nfOpen(),
    q = nfBehind();
  if (!L.length) {
    nfCall(title, "star", "Every required quest is done. Day cleared!", "", [["Nice", null, "save"]]);
    return;
  }
  nfCall(
    title,
    icon,
    head || L.length + " quest" + (L.length === 1 ? "" : "s") + " left. Still time.",
    (extra || "") + qList(e, L),
    [nfJust5(q), ["Schedule", openSchedule], ["Later"]].filter(Boolean),
  );
}
export function notifAction(id, x, act) {
  x = x || {};
  var now = Date.now();
  S.call =
    CALL_IDS(id) && x.at && now >= x.at - 60000 && now <= x.at + CALL_MIN * 60000
      ? { id: id, until: x.at + CALL_MIN * 60000 }
      : null;
  if (locked() && id !== 2400) {
    nfGo();
    return;
  }
  if (id === 901) return S.sprint && S.sprint.phase !== "done" ? nfSprint() : nfTimer("live");
  if (id === 1004) {
    timerCap();
    go("today");
    var cq = cfgQ(x.q);
    setSync("Daily limit reached" + (cq ? " for " + cq.label : "") + ". Timer stopped and logged.");
    return;
  }
  if (id === 1001) return nfTimer("min");
  if (id === 1002) return nfTimer("plan");
  if (id === 1003) return nfTimer("five");
  if (id >= 1101 && id <= 1103) return nfSprint();
  if (id >= 1201 && id <= 1203) return nfPomo(act);
  if (id >= 2000 && id < 2100) return nfQuestsLeft("Evening check-in", "note");
  if (id === 2200 && rewardsOff()) {
    nfGo();
    return;
  }
  if (id === 2200) {
    var st = lastSt || compute();
    return nfQuestsLeft(
      "Streak at risk",
      "flame",
      "Your " + st.streak + "-day streak is on the line.",
      '<p class="help">Your last required day was missed. Clear today to keep it.</p>',
    );
  }
  if (id >= 2700 && id < 2770) {
    go("today");
    return;
  }
  if (id === 2400) {
    go("today");
    return reviewTodos("notif");
  }
  if (id === 2500) {
    var T2 = todayKey(),
      e2 = S.days[T2] || {},
      D2 = activeDefs(T2).filter(function (q) {
        return q.type === "time" && !q.roll && !q.opt;
      });
    return nfCall(
      "Midday check",
      "metronome",
      "Halfway through the day.",
      D2.map(function (q) {
        return nfBar(q.label, e2[q.id] | 0, q.min);
      }).join(""),
      [nfJust5(nfBehind()), ["Schedule", openSchedule], ["Later"]].filter(Boolean),
    );
  }
  if (id === 2600) {
    var T3 = todayKey(),
      W3 = periodList(T3);
    var b3 = W3.filter(function (q) {
      var x = dayDefMap(T3)[q.id];
      return x && !x.off && rollSum(q.id, T3, q) < rollNeed(q, T3);
    })[0];
    var preOf = function (q) {
        var md = midDay(q, T3);
        return md && T3 <= md && md !== perEnd(q, T3) && rollSum(q.id, T3, q) < midNeed(q, T3) ? md : null;
      },
      anyPre = W3.some(preOf);
    return nfCall(
      anyPre ? "Halfway checkpoint" : "Total due",
      "dumbbell",
      "A third of each total is due by its middle work day, all of it by the end of the period.",
      W3.map(function (q) {
        var pe = perEnd(q, T3),
          md = preOf(q),
          pre = !!md;
        return nfBar(
          q.label + (pre ? " (a third by " : " (by ") + DAYF[parse(pre ? md : pe).getDay()].slice(0, 3) + ")",
          rollSum(q.id, T3, q),
          pre ? midNeed(q, T3) : weekTarget(q, T3),
        );
      }).join(""),
      [nfJust5(b3), ["Schedule today", openSchedule], ["Later"]].filter(Boolean),
    );
  }
  if (id >= 3000 && id < 3500) {
    var d = (cfg().deadlines || []).filter(function (z) {
      return z.id === x.dl;
    })[0];
    if (!d) {
      nfGo();
      return;
    }
    var dq = cfg().quests.filter(function (q) {
        return q.dl && q.dl.id === d.id;
      })[0],
      body = "";
    if (dq) {
      var s = 0;
      for (var k = dq.dl.from; k <= todayKey(); k = add(k, 1)) s += +(S.days[k] || {})[dq.id] || 0;
      body =
        '<p class="help">' + num(s) + " of " + num(dq.dl.total) + (dq.ul ? " " + esc(dq.ul) : "") + " done so far.</p>";
    }
    return nfCall("Deadline", "note", "Tomorrow: " + esc(d.title), body, [
      ["Plan today", openSchedule, "save"],
      ["Got it"],
    ]);
  }
  if ((id >= 3500 && id < 4000) || id === 905) {
    schTap(x);
    return;
  }
  if (id === 4001) {
    var due = allTopics().filter(function (o) {
      return topicStats(o.t).due;
    });
    if (!due.length) {
      nfGo();
      return;
    }
    return nfCall(
      "Review time",
      "note",
      due.length + " topic" + (due.length === 1 ? "" : "s") + " untouched for 2+ weeks.",
      '<ul class="ul">' +
        due
          .slice(0, 6)
          .map(function (o) {
            return "<li>" + esc(o.sname) + " › " + esc(o.t.name) + "</li>";
          })
          .join("") +
        "</ul>",
      [
        ["Pick one for me", openPick, "save"],
        [
          "Subjects",
          function () {
            go("subjects");
          },
        ],
        ["Later"],
      ],
    );
  }
  nfGo();
}
export function liveTapPoll() {
  var FN = capPlugin("FocusNotify");
  if (!FN || !FN.takeTap) return;
  FN.takeTap()
    .then(function (r) {
      if (r && r.tap) notifAction(901, {});
    })
    .catch(function () {});
}

/* Runs once at startup, in file-number order (main.js). */
export function init() {
  CALL_IDS = function (id) {
    return (id >= 2000 && id < 2100) || id === 2200 || id === 2500 || id === 2600 || (id >= 3500 && id < 4000);
  };
  setTimeout(liveTapPoll, 700);
  document.addEventListener("visibilitychange", function () {
    if (document.visibilityState === "visible") setTimeout(liveTapPoll, 300);
  });
}
