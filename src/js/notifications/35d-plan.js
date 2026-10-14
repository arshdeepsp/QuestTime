/* ---- local notifications: what to schedule (nfPlan) and keeping the device in step (notifSync) ---- */
import { G } from "../core/g.js";
import { DAYF, S } from "../core/00-state.js";
import { cfg } from "../core/config.js";
import { add, atMin, dayMidMin, dayWin, parse, todayKey, weekStart } from "../core/days.js";
import { LN, capPlugin } from "../core/native.js";
import { esc, hm, hmL } from "../core/util.js";
import { openTodos } from "../quests/50b-todo-review.js";
import { midDay, midNeed, perEnd, periodList, rollSum, weekTarget } from "../rules/26-periods.js";
import { compute } from "../rules/compute.js";
import { limOf, metQ, ok, planOf } from "../rules/day-rules.js";
import { rewardsOff } from "../rules/modes.js";
import { activeDefs, reqOf } from "../rules/quests-on-day.js";
import { vowDefs, vowNid, vowPending } from "../rules/vow.js";
import { resumeSync, schNotifs } from "../schedule/resume.js";
import { allTopics, topicStats } from "../subjects/33-topics.js";
import { timerMin } from "../timer/13-focus-timer.js";
import { spLabel } from "../timer/43-sprint.js";
import { pomoAhead } from "../timer/43b-pomodoro.js";
import { lastSt } from "../ui/04-render.js";
import { setSync } from "../ui/feedback.js";

export var NF_DEF, nfT, chReady;

export function nf() {
  return Object.assign({}, NF_DEF, cfg().nf || {});
}
export function atTime(k, hhmm) {
  var p = parse(k),
    a = hhmm.split(":");
  p.setHours(+a[0], +a[1], 0, 0);
  return p;
}
export function nfPlan() {
  var n = nf(),
    now = Date.now(),
    out = [],
    T = todayKey(),
    e = S.days[T] || {},
    st = lastSt || compute();
  if (!n.on) return out;
  function push(id, title, body, at, extra, ch, act) {
    var t = at instanceof Date ? at.getTime() : at;
    if (t > now + 5000) {
      var o = {
        id: id,
        title: title,
        body: body,
        channelId: ch || "pc_alerts2",
        extra: Object.assign({ at: t }, extra || {}),
        schedule: { at: new Date(t), allowWhileIdle: true },
      };
      if (act) o.actionTypeId = act;
      out.push(o);
    }
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
  var pm = S.pomo;
  if (n.timer && pm) {
    /* The phases ahead on the wall clock (pomoAhead): the running interval's end (1201) and break over (1202 during the
       break, 1203 pre-scheduled at focus end), then with auto-start three more pomodoros (1204/1205, 1206/1207,
       1208/1209: done, break over), so a phone that sleeps through a break still hears the next ones. */
    var ahead = pomoAhead(pm, 3),
      kk = 0;
    ahead.forEach(function (ph, pi) {
      if (ph.kind === "start") return;
      var id,
        k = kk;
      if (ph.kind === "done") id = k === 0 ? 1201 : 1204 + 2 * (k - 1);
      else {
        id = k === 0 ? (pm.phase === "break" ? 1202 : 1203) : 1205 + 2 * (k - 1);
        kk++;
      }
      if (id > 1209) return;
      /* the break that follows this "done" decides whether anything auto-starts after it */
      var nb = ahead[pi + 1] || {};
      if (ph.kind === "done")
        push(
          id,
          "Pomodoro done — take your break",
          pm.label +
            " logged. " +
            (ph.long ? pm.l : pm.b) +
            "-minute " +
            (ph.long ? "long " : "") +
            "break starts now.",
          ph.at,
          null,
          ph.long ? "pc_beep3" : "pc_beep2",
          nb.cont ? "pc_pomo_auto" : "pc_pomo_done",
        );
      else
        push(
          id,
          ph.long && !ph.cont ? "Set done" : "Break over",
          ph.cont
            ? "The next pomodoro has started."
            : ph.long
              ? "Tap to start a new set."
              : "Tap to start your next pomodoro.",
          ph.at,
          null,
          "pc_beep1",
          ph.cont ? null : "pc_pomo_brk",
        );
    });
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
  /* Morning promise: 15 min after waking, then every 5 min for 15 more, as ongoing notifications (they can't be
       swiped away) until the rules are ticked; notifSync clears the delivered ones then (vowClear). */
  for (var vi = 0; vi < 7; vi++) {
    var vk = add(T, vi),
      vd = vowDefs(vk);
    if (!vd.length || (vi === 0 && !vowPending(vd, e))) continue;
    var va = atMin(vk, dayWin(vk).s + 15);
    for (var vr = 0; vr < 4; vr++) {
      var vb = out.length;
      push(
        vowNid(vk, vr),
        vr ? "Your rules are waiting" : "Morning promise",
        "Read your " +
          (vd.length === 1 ? "rule" : vd.length + " rules") +
          " and promise to keep " +
          (vd.length === 1 ? "it" : "them") +
          ". Today\u2019s quests show up after.",
        va + vr * 5 * 60000,
      );
      if (out.length > vb) {
        out[vb].ongoing = true;
        out[vb].autoCancel = false;
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
/* Every reminder this app has pending or showing, gone (leaving an account: sync/54-account.js reloadApp). Settles
     within 3 s whatever the plugin does, so a sign-out never hangs on it. */
export function notifClearAll() {
  var ln = LN();
  if (!ln) return Promise.resolve();
  G.nfSig = "";
  var work = Promise.resolve(ln.getPending ? ln.getPending() : { notifications: [] })
    .then(function (r) {
      var ours = ((r && r.notifications) || [])
        .filter(function (x) {
          return x.id >= 900 && x.id < 5000;
        })
        .map(function (x) {
          return { id: x.id };
        });
      return ours.length ? ln.cancel({ notifications: ours }) : null;
    })
    .then(function () {
      return ln.removeAllDeliveredNotifications ? ln.removeAllDeliveredNotifications() : null;
    })
    .catch(function () {});
  return Promise.race([
    work,
    new Promise(function (res) {
      setTimeout(res, 3000);
    }),
  ]);
}
/* Clears delivered promise reminders that are no longer due: other days', and today's once the rules are ticked. */
export function vowClear(ln) {
  if (!ln.removeDeliveredNotifications) return;
  var T = todayKey(),
    keep = vowPending(activeDefs(T), S.days[T] || {}),
    ids = [];
  for (var i = 2700; i < 2770; i++) if (!keep || i < vowNid(T, 0) || i > vowNid(T, 3)) ids.push({ id: i });
  var sig = keep ? T : "";
  if (sig === G.vowClr) return;
  G.vowClr = sig;
  Promise.resolve(ln.removeDeliveredNotifications({ notifications: ids })).catch(function () {});
}
export function notifSync() {
  clearTimeout(nfT);
  nfT = setTimeout(function () {
    var ln = LN();
    if (!ln) return;
    resumeSync(ln);
    vowClear(ln);
    var plan = nfPlan(),
      sig = JSON.stringify(
        plan.map(function (x) {
          return [
            x.id,
            Math.round(x.schedule.at.getTime() / 60000),
            x.title,
            x.body,
            JSON.stringify(x.extra || {}),
            x.channelId || "",
            x.actionTypeId || "",
          ];
        }),
      );
    if (sig === G.nfSig) return;
    G.nfSig = sig;
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
export function notifEnable(on, cb) {
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
export function ensureChannels() {
  var ln = LN();
  if (!ln || !ln.createChannel) return Promise.resolve();
  if (chReady) return chReady;
  /* Action buttons on the pomodoro notifications (actionTypeId): a tap carries actionId "next" (skip the break / start
     the next one) or "end" (end the session) into notifAction. With auto-start on, the done notification only offers End. */
  var acts = ln.registerActionTypes
    ? ln
        .registerActionTypes({
          types: [
            {
              id: "pc_pomo_done",
              actions: [
                { id: "next", title: "Skip break" },
                { id: "end", title: "End session" },
              ],
            },
            {
              id: "pc_pomo_brk",
              actions: [
                { id: "next", title: "Start next" },
                { id: "end", title: "End session" },
              ],
            },
            { id: "pc_pomo_auto", actions: [{ id: "end", title: "End session" }] },
          ],
        })
        .catch(function () {})
    : Promise.resolve();
  chReady = Promise.all([
    acts,
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
      id: "pc_beep1",
      name: "Back to work",
      description: "A pomodoro break ended \u2014 one beep",
      importance: 5,
      visibility: 1,
      vibration: true,
      lights: true,
      sound: "pc_beep1.wav",
    }),
    ln.createChannel({
      id: "pc_beep2",
      name: "Short break",
      description: "A pomodoro ran to the end \u2014 two beeps",
      importance: 5,
      visibility: 1,
      vibration: true,
      lights: true,
      sound: "pc_beep2.wav",
    }),
    ln.createChannel({
      id: "pc_beep3",
      name: "Long break",
      description: "A set of pomodoros ran to the end \u2014 three beeps",
      importance: 5,
      visibility: 1,
      vibration: true,
      lights: true,
      sound: "pc_beep3.wav",
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
export function notifDiag(el) {
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
      '</div><p class="help">If permission and exact timing are both granted and alerts still arrive late, Android\u2019s battery saver is holding them. Set Android Settings \u203a Apps \u203a QuestTime \u203a Battery to <b>Unrestricted</b>. On Samsung, also remove it from <b>Sleeping apps</b>.</p><div class="edrow"><button type="button" class="stone mini" id="nfT60">Test in 1 minute</button><span class="pz" id="nfT60s"></span></div><div class="edrow"><button type="button" class="stone mini" id="nfLive">Test live timer</button><span class="pz" id="nfLiveS"></span></div>';
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
            G.ongoingSig = "";
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
export function notifTest() {
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
            title: "QuestTime",
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

/* Runs once at startup, in file-number order (main.js). */
export function init() {
  G.LNp = null;
  NF_DEF = {
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
  nfT = 0;
  G.nfSig = "";
  document.addEventListener("visibilitychange", function () {
    if (document.visibilityState === "visible") notifSync();
  });
  chReady = null;
}
