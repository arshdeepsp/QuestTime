/* ---- spark tools ---- */
import { S } from "../core/00-state.js";
import { todayKey } from "../core/days.js";
import { commit, entry, locked } from "../core/entries.js";
import { cache } from "../core/storage.js";
import { esc, hm } from "../core/util.js";
import { reqText } from "../quests/02-quest-list.js";
import { toggleTodo } from "../quests/14-todos.js";
import { runBox } from "../quests/47-phone-rows.js";
import { metQ } from "../rules/day-rules.js";
import { activeDefs } from "../rules/quests-on-day.js";
import { allTopics, topicStats } from "../subjects/33-topics.js";
import { qSubjs, qTopicPool, topicById } from "../subjects/35-links.js";
import { toggleTimer } from "../timer/13-focus-timer.js";
import { spFmt } from "../timer/43-sprint.js";
import { closeG, openG } from "../ui/18-modal.js";
import { setSync } from "../ui/feedback.js";

export var lastPick, batchT;

export function pickPool() {
  var T = todayKey(),
    e = S.days[T] || {},
    out = [];
  activeDefs(T).forEach(function (q) {
    if (q.off || q.ign) return;
    if (q.type === "time" && !metQ(q, e)) out.push(q);
    else if ((q.type === "check" || q.type === "todo" || q.type === "weekly") && !e[q.id]) out.push(q);
    else if (q.type === "target" && !metQ(q, e)) out.push(q);
  });
  return out;
}
export function behindTime() {
  var T = todayKey(),
    e = S.days[T] || {},
    L = activeDefs(T).filter(function (q) {
      return q.type === "time" && !q.off && !q.ign;
    });
  if (!L.length) return null;
  var open = L.filter(function (q) {
    return !metQ(q, e);
  });
  return open[0] || L[0];
}
export function allTimeDone() {
  var T = todayKey(),
    e = S.days[T] || {},
    L = activeDefs(T).filter(function (q) {
      return q.type === "time" && !q.off && !q.ign;
    });
  return (
    L.length > 0 &&
    L.every(function (q) {
      return metQ(q, e);
    })
  );
}
export function openBonus5(after) {
  var T = todayKey(),
    e = S.days[T] || {},
    L = activeDefs(T).filter(function (q) {
      return q.type === "time";
    });
  openG("All done today", function (b) {
    b.innerHTML =
      '<p class="mhead good">Every time quest is done today.</p><p class="help">Want a bonus 5 minutes anyway? Pick one, or call it a day.</p><div class="addsheet">' +
      L.map(function (q) {
        return (
          '<button type="button" class="addopt" data-b5="' +
          q.id +
          '"><b>' +
          esc(q.label) +
          "</b><span>" +
          hm(e[q.id] | 0) +
          " logged today</span></button>"
        );
      }).join("") +
      '</div><div class="edrow end"><button type="button" class="stone" id="b5No">Call it a day</button></div>';
    b.querySelector("#b5No").addEventListener("click", closeG);
    b.querySelectorAll("[data-b5]").forEach(function (x) {
      x.addEventListener("click", function () {
        var q = L.filter(function (z) {
          return z.id === x.getAttribute("data-b5");
        })[0];
        closeG();
        if (q) start5(q, after);
      });
    });
  });
}
export function start5(q, after) {
  if (locked()) return;
  if (!q && allTimeDone()) {
    openBonus5(after);
    return;
  }
  q = q || behindTime();
  if (!q) {
    setSync("Add a time quest to use Just 5 minutes.");
    return;
  }
  if (S.timer && S.timer.id === q.id) {
    setSync("Already running.");
    return;
  }
  function go(first) {
    S.noTopicAsk = true;
    toggleTimer(q);
    S.noTopicAsk = false;
    if (S.timer) {
      S.timer.commit = 5;
      if (first) S.timer.first = first;
      cache();
    }
    if (after) after();
    setSync(
      first
        ? "5 minutes on " + q.label + ". First: " + first
        : "Just 5 minutes on " + q.label + ". You can stop after that.",
    );
  }
  go("");
}
export function markDone(q) {
  var T = todayKey();
  if (q.type === "todo") {
    toggleTodo(q);
    return;
  }
  var e = entry();
  e[q.id] = true;
  commit();
}
export function openPick() {
  if (locked()) return;
  openG("Pick for me", function (b) {
    function roll() {
      var P = pickPool();
      if (
        !P.length &&
        allTopics().some(function (o) {
          return topicStats(o.t).due;
        })
      )
        P = [];
      if (
        !P.length &&
        !allTopics().some(function (o) {
          return topicStats(o.t).due;
        })
      ) {
        b.innerHTML =
          '<p class="mhead good">Nothing left to pick. Everything is done!</p><div class="edrow end"><button type="button" class="stone" id="pkC">Close</button></div>';
        b.querySelector("#pkC").addEventListener("click", closeG);
        return;
      }
      var dueT = allTopics().filter(function (o) {
        return topicStats(o.t).due;
      });
      if (dueT.length && (!P.length || Math.random() < 0.35)) {
        var o = dueT[Math.floor(Math.random() * dueT.length)];
        lastPick = o.t.id;
        b.innerHTML =
          '<p class="help">Due for review (not touched in 14+ days)</p><p class="mhead">' +
          esc(o.t.name) +
          '</p><p class="help">' +
          esc(o.sname) +
          '</p><div class="edrow end"><button type="button" class="stone" id="pkAgain">Another</button><button type="button" class="stone save" id="pkGo">Review for 5 minutes</button></div>';
        b.querySelector("#pkAgain").addEventListener("click", roll);
        b.querySelector("#pkGo").addEventListener("click", function () {
          closeG();
          var TQ = activeDefs(todayKey()).filter(function (q) {
              return q.type === "time" && !q.off && !q.ign;
            }),
            sid = (topicById(o.t.id) || {}).s,
            fq =
              TQ.filter(function (q) {
                return qTopicPool(q).indexOf(o.t.id) >= 0;
              })[0] ||
              (sid
                ? TQ.filter(function (q) {
                    return qSubjs(q).indexOf(sid.id) >= 0;
                  })[0]
                : null) ||
              null;
          start5(fq, function () {
            if (S.timer) {
              S.timer.topic = o.t.id;
              S.timer.tAt = S.timer.start;
              S.timer.tacc = {};
              cache();
              runBox(S.timer.id);
            }
          });
        });
        return;
      }
      var pool =
          P.length > 1
            ? P.filter(function (q) {
                return q.id !== lastPick;
              })
            : P,
        q = pool[Math.floor(Math.random() * pool.length)];
      lastPick = q.id;
      var kind =
        { time: "Time quest", check: "Daily habit", todo: "To-do", weekly: "Weekly goal", target: "Target" }[q.type] ||
        "Quest";
      b.innerHTML =
        '<p class="help">' +
        kind +
        '</p><p class="mhead">' +
        esc(q.label) +
        '</p><p class="help">' +
        esc(reqText(q)) +
        '</p><div class="edrow end"><button type="button" class="stone" id="pkAgain">Another</button>' +
        (q.type === "time"
          ? '<button type="button" class="stone save" id="pkGo">Start 5 minutes</button>'
          : q.type === "target"
            ? '<button type="button" class="stone save" id="pkGo">OK, on it</button>'
            : '<button type="button" class="stone save" id="pkGo">Mark done</button>') +
        "</div>";
      b.querySelector("#pkAgain").addEventListener("click", roll);
      b.querySelector("#pkGo").addEventListener("click", function () {
        closeG();
        if (q.type === "time") start5(q);
        else if (q.type !== "target") markDone(q);
      });
    }
    roll();
  });
}
export function openBatch() {
  if (locked()) return;
  var T = todayKey(),
    start = Date.now(),
    doneN = 0;
  openG(
    "Batch to-dos",
    function (b) {
      function draw() {
        var e = S.days[T] || {},
          L = activeDefs(T).filter(function (q) {
            return q.type === "todo";
          });
        if (!L.length) {
          b.innerHTML =
            '<p class="help">No to-dos today. Add some with the to-do box, then batch them here.</p><div class="edrow end"><button type="button" class="stone" id="btC">Close</button></div>';
          b.querySelector("#btC").addEventListener("click", closeG);
          return;
        }
        b.innerHTML =
          '<p class="help">Knock out small tasks back to back. One timer for the whole batch.</p><div class="sp-time" id="btTime">0:00</div><div class="mlist">' +
          L.map(function (q) {
            var d = !!e[q.id];
            return (
              '<div class="mrow' +
              (d ? " ok" : "") +
              '"><i class="mk"></i><span class="ml">' +
              esc(q.label) +
              '</span><button type="button" class="stone mini' +
              (d ? " on" : "") +
              '" data-bt="' +
              q.id +
              '">' +
              (d ? "Done" : "Mark done") +
              "</button></div>"
            );
          }).join("") +
          '</div><div class="edrow end"><button type="button" class="stone save" id="btEnd">Finish batch</button></div>';
        b.querySelectorAll("[data-bt]").forEach(function (x) {
          x.addEventListener("click", function () {
            var q = L.filter(function (z) {
              return z.id === x.getAttribute("data-bt");
            })[0];
            if (!q) return;
            var was = !!(S.days[T] || {})[q.id];
            toggleTodo(q);
            doneN += was ? -1 : 1;
            draw();
          });
        });
        b.querySelector("#btEnd").addEventListener("click", function () {
          closeG();
        });
        tick();
      }
      function tick() {
        var el = b.querySelector("#btTime");
        if (el) el.textContent = spFmt(Date.now() - start);
      }
      clearInterval(batchT);
      batchT = setInterval(tick, 1000);
      draw();
    },
    function () {
      clearInterval(batchT);
      var m = Math.round((Date.now() - start) / 60000);
      if (doneN > 0)
        setSync(
          "Batch: " +
            doneN +
            " to-do" +
            (doneN === 1 ? "" : "s") +
            " cleared in " +
            (m < 1 ? "under a minute" : hm(m)) +
            ".",
        );
    },
  );
}

/* Runs once at startup, in file-number order (main.js). */
export function init() {
  lastPick = null;
  batchT = 0;
}
