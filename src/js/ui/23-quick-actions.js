/* ---- quick-action buttons ----
     The bar above the quest list (#sparkBar, shown with Quick-start tools) has two slots, cfg.quick = [id, id] from QUICK
     (default Just 5 + Schedule; Settings › Add-ons › Quick actions), drawn by renderQuick (from render) with the ids the
     rest of the app expects (#sp5Btn, #schBtn, …), and the ⋮ menu offers whatever isn't in a slot. */
import { G } from "../core/g.js";
import { cfg } from "../core/config.js";
import { locked } from "../core/entries.js";
import { shareWeek } from "../progress/share-week.js";
import { closeQMenu } from "../quests/11-row-menu.js";
import { openSchedule } from "../schedule/page.js";
import { openSprintSetup } from "../timer/43-sprint.js";
import { openPomo } from "../timer/43b-pomodoro.js";
import { openBatch, openPick, start5 } from "../tools/28-spark-tools.js";
import { go } from "./44-navigation.js";
import { toggleFocusView } from "./48-declutter.js";
import { popMenu } from "./menus.js";

export var QUICK, QUICK_DEF;

export function quickSlots() {
  var q = cfg().quick;
  return Array.isArray(q) &&
    q.length === 2 &&
    q[0] !== q[1] &&
    q.every(function (id) {
      return !!QUICK[id];
    })
    ? q
    : QUICK_DEF;
}
/* Draw the two slot buttons (before the ⋮) whenever the chosen pair changes. */
export function renderQuick() {
  if (!QUICK) return;
  var bar = document.getElementById("sparkBar"),
    ids = quickSlots(),
    sig = ids.join(",");
  if (bar.dataset.qk === sig) return;
  bar.dataset.qk = sig;
  bar.querySelectorAll("[data-qk]").forEach(function (b) {
    b.remove();
  });
  var tb = document.getElementById("toolsBtn");
  ids.forEach(function (id) {
    var o = QUICK[id],
      b = document.createElement("button");
    b.type = "button";
    b.className = "stone" + (o.cls ? " " + o.cls : "");
    b.id = o.el;
    b.setAttribute("data-qk", id);
    b.innerHTML = o.html;
    bar.insertBefore(b, tb);
  });
}
export function quickMenu() {
  var ids = quickSlots(),
    c = cfg();
  return Object.keys(QUICK)
    .filter(function (id) {
      return ids.indexOf(id) < 0 && (c.sparkTools || !QUICK[id].spark);
    })
    .map(function (id) {
      return [QUICK[id].name, QUICK[id].go];
    });
}

/* Runs once at startup, in file-number order (main.js). */
export function init() {
  QUICK = {
    j5: {
      name: "Just 5",
      el: "sp5Btn",
      cls: "save",
      html: '&#9654; Just 5<span class="m-hide"> minutes</span>',
      go: function () {
        start5();
      },
    },
    sch: { name: "Schedule", el: "schBtn", html: "&#9719; Schedule", go: openSchedule },
    pomo: { name: "Pomodoro", el: "pmBtn", html: "&#9679; Pomodoro", go: openPomo },
    sprint: { name: "Sprint", el: "sprBtn", html: "&#9654;&#9654; Sprint", go: openSprintSetup },
    pick: { name: "Pick for me", el: "pickBtn", html: "? Pick for me", go: openPick, spark: true },
    batch: { name: "Batch to-dos", el: "batchBtn", html: "&#9776; Batch to-dos", go: openBatch, spark: true },
  };
  QUICK_DEF = ["j5", "sch"];
  renderQuick();
  document.getElementById("sparkBar").addEventListener("click", function (ev) {
    var b = ev.target.closest("[data-qk]");
    if (!b || locked()) return;
    QUICK[b.getAttribute("data-qk")].go();
  });
  document.getElementById("trendsBtn").addEventListener("click", function () {
    go("trends");
  });
  document.getElementById("toolsBtn").addEventListener("click", function (ev) {
    ev.stopPropagation();
    if (G.qmenu && G.qmenu.dataset.tools) {
      closeQMenu();
      return;
    }
    if (locked()) return;
    var it = quickMenu();
    it.push(
      [
        "Edit quests",
        function () {
          document.getElementById("qEditBtn").click();
        },
      ],
      [G.focusView ? "Full view" : "Minimal view", toggleFocusView],
    );
    popMenu(this, it);
    G.qmenu.dataset.tools = "1";
  });
  document.getElementById("shareBtn").addEventListener("click", function () {
    shareWeek(this);
  });
}
