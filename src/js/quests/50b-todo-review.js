/* ---- to-do lifecycle: done ones vanish after their day, open ones get a keep-or-clear review ---- */
import { G } from "../core/g.js";
import { S, dirty } from "../core/00-state.js";
import { cfg, saveCfg } from "../core/config.js";
import { todayKey } from "../core/days.js";
import { locked } from "../core/entries.js";
import { LN } from "../core/native.js";
import { cache } from "../core/storage.js";
import { clone, esc, fmtD } from "../core/util.js";
import { notifAction } from "../notifications/52-taps.js";
import { ignoredOn } from "../rules/modes.js";
import { activeDefs } from "../rules/quests-on-day.js";
import { render } from "../ui/04-render.js";
import { closeG, openG } from "../ui/18-modal.js";
import { swipeLR } from "../ui/45-gestures.js";
import { setSync } from "../ui/feedback.js";

export var todoReviewOpen;

export function openTodos() {
  var T = todayKey();
  return cfg().quests.filter(function (q) {
    return q.type === "todo" && !q.doneOn && !q.completed && !ignoredOn(q.id, T);
  });
}
export function cleanDoneTodos() {
  var T = todayKey(),
    c = cfg();
  if (
    !(c.quests || []).some(function (q) {
      return q.type === "todo" && ((q.doneOn && q.doneOn < T) || !q.addedOn);
    })
  )
    return;
  var c2 = clone(c);
  c2.quests = c2.quests
    .filter(function (q) {
      return !(q.type === "todo" && q.doneOn && q.doneOn < T);
    })
    .map(function (q) {
      if (q.type === "todo" && !q.addedOn) q.addedOn = T;
      return q;
    });
  saveCfg(c2);
  G.qSig = "";
}
export function reviewTodos(reason) {
  var L = openTodos();
  if (!L.length || todoReviewOpen) return;
  todoReviewOpen = true;
  var drop = {};
  openG(
    "Still need these to-dos?",
    function (b) {
      function draw() {
        b.innerHTML =
          '<p class="help">Keep what you still need; delete the rest.' +
          ("ontouchstart" in window ? " Swipe right to keep, left to delete." : "") +
          '</p><div class="dtl">' +
          L.map(function (q) {
            var d = !!drop[q.id];
            return (
              '<div class="dt-r tdrev"><span>' +
              esc(q.label) +
              (q.due ? " <em>due " + fmtD(q.due) + "</em>" : "") +
              '</span><button type="button" class="stone mini' +
              (d ? " del" : " on") +
              '" data-tdr="' +
              q.id +
              '" aria-pressed="' +
              d +
              '">' +
              (d ? "Delete" : "Keep") +
              "</button></div>"
            );
          }).join("") +
          '</div><div class="edrow end"><button type="button" class="stone del" id="tdrAll">Delete all</button><button type="button" class="stone save" id="tdrGo">Done</button></div>';
        b.querySelectorAll("[data-tdr]").forEach(function (x) {
          x.addEventListener("click", function () {
            var id = x.getAttribute("data-tdr");
            drop[id] = !drop[id];
            draw();
          });
        });
        b.querySelectorAll(".tdrev").forEach(function (row) {
          var id = row.querySelector("[data-tdr]").getAttribute("data-tdr");
          row.classList.toggle("dropq", !!drop[id]);
          swipeLR(
            row,
            function () {
              drop[id] = false;
              draw();
            },
            function () {
              drop[id] = true;
              draw();
            },
          );
        });
        b.querySelector("#tdrAll").addEventListener("click", function () {
          L.forEach(function (q) {
            drop[q.id] = true;
          });
          finish();
        });
        b.querySelector("#tdrGo").addEventListener("click", finish);
      }
      function finish() {
        var ids = Object.keys(drop).filter(function (k) {
          return drop[k];
        });
        if (ids.length) {
          var c = clone(cfg());
          c.quests = c.quests.filter(function (q) {
            return ids.indexOf(q.id) < 0;
          });
          saveCfg(c);
          var T = todayKey();
          if (S.days[T]) {
            S.days[T] = Object.assign({}, S.days[T], { q: activeDefs(T) });
            dirty[T] = true;
            cache();
          }
          G.qSig = "";
          render();
        }
        try {
          localStorage.setItem("pc-todoreview", todayKey());
        } catch (x) {}
        closeG();
        if (ids.length) setSync(ids.length + " to-do" + (ids.length === 1 ? "" : "s") + " deleted");
      }
      draw();
    },
    function () {
      todoReviewOpen = false;
    },
  );
}
/* A full-screen page is up (schedule, help, account page, quest editor, grove): pop-ups wait until it closes. */
export function fullPageOpen() {
  var b = document.body.classList;
  return (
    b.contains("sch-open") ||
    b.contains("hp-open") ||
    b.contains("au-open") ||
    b.contains("mgr-on") ||
    b.contains("grove-on")
  );
}
export function reviewDue() {
  var T = todayKey(),
    last = "";
  try {
    last = localStorage.getItem("pc-todoreview") || "";
  } catch (x) {}
  if (last >= T || locked() || S.timer || fullPageOpen() || (typeof G.groveOpen !== "undefined" && G.groveOpen))
    return false;
  if (
    !openTodos().some(function (q) {
      return (q.addedOn || "") < T;
    })
  )
    return false;
  return document.getElementById("gModal").hidden && document.getElementById("nqModal").hidden;
}
export function maybeReviewTodos() {
  if (reviewDue())
    setTimeout(function () {
      if (reviewDue()) reviewTodos("open");
    }, 600);
}

/* Runs once at startup, in file-number order (main.js). */
export function init() {
  todoReviewOpen = false;
  document.addEventListener("visibilitychange", function () {
    if (document.visibilityState === "visible") {
      maybeReviewTodos();
    }
  });
  (function () {
    var ln = LN();
    if (!ln || !ln.addListener) return;
    try {
      ln.addListener("localNotificationActionPerformed", function (ev) {
        var n = ev && ev.notification;
        if (n)
          setTimeout(function () {
            notifAction(n.id, n.extra || {});
          }, 500);
      });
    } catch (x) {}
  })();
}
