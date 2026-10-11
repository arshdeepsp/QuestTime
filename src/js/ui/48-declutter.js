/* ---- today-page declutter ---- */
import { G } from "../core/g.js";
import { S } from "../core/00-state.js";
import { cfg, uiGet, uiSet } from "../core/config.js";
import { locked } from "../core/entries.js";
import { closeG, openG } from "./18-modal.js";
import { curView, go } from "./44-navigation.js";
import { haptic } from "./45-gestures.js";
import { measureBars } from "./46-phone-bars.js";
import { setSync } from "./feedback.js";

export function hideOpts() {
  return [
    ["req", "Quest descriptions"],
    ["grip", "Drag handles"],
    ["chip", "Subject chips"],
    ["heat", "Momentum meter"],
    ["note", "Next-rank hint"],
    ["todo", "To-do box"],
    ["prog", "Progress bar"],
  ];
}
export function applyHide() {
  if (S.timer && !G.focusView) G.focusView = true;
  var h = cfg().hide || {},
    b = document.body;
  hideOpts().forEach(function (o) {
    b.classList.toggle("hide-" + o[0], !!h[o[0]]);
  });
  b.classList.toggle("focusview", G.focusView);
  if (typeof measureBars === "function") setTimeout(measureBars, 0);
  if (G.focusView && typeof curView !== "undefined" && curView !== "today" && typeof go === "function")
    setTimeout(function () {
      go("today");
    }, 0);
  var fb = document.getElementById("focusBtn");
  if (fb) {
    fb.setAttribute("aria-pressed", G.focusView);
    fb.textContent = G.focusView ? (window.innerWidth <= 720 ? "All" : "Show all") : "Minimal";
  }
}
export function openAddSheet() {
  if (locked()) return;
  openG("Add", function (b) {
    b.innerHTML =
      '<div class="addsheet"><button type="button" class="addopt" id="aoQuest"><b>Quest</b><span>Something you do regularly: daily habit, timed work, target, limit\u2026</span></button><div class="addopt td"><b>To-do</b><span>A one-off task. Gone once it\u2019s done.</span><div class="edrow"><input id="aoTd" maxlength="60" placeholder="e.g. Email advisor"><button type="button" class="stone save" id="aoTdAdd">Add</button></div><p class="cmsg2" id="aoMsg"></p></div></div>';
    b.querySelector("#aoQuest").addEventListener("click", function () {
      closeG();
      setTimeout(function () {
        document.getElementById("nqBtn").click();
      }, 0);
    });
    var inp = b.querySelector("#aoTd");
    function addT() {
      var v = inp.value.trim();
      if (!v) return;
      var tn = document.getElementById("tdNew");
      tn.value = v;
      document.getElementById("tdAdd").click();
      inp.value = "";
      b.querySelector("#aoMsg").textContent = "Added: " + v + ". Add another or close.";
      inp.focus();
    }
    b.querySelector("#aoTdAdd").addEventListener("click", addT);
    inp.addEventListener("keydown", function (ev) {
      if (ev.key === "Enter") addT();
    });
  });
}
export function toggleFocusView() {
  if (S.timer && G.focusView) {
    setSync("Stop the timer to leave Minimal view.");
    return;
  }
  G.focusView = !G.focusView;
  uiSet("focus", G.focusView);
  applyHide();
  haptic("light");
}

/* Runs once at startup, in file-number order (main.js). */
export function init() {
  G.focusView = !!uiGet("focus");
  document.getElementById("hdrEdit").addEventListener("click", function () {
    document.getElementById("qEditBtn").click();
  });
  document.getElementById("fabAdd").addEventListener("click", openAddSheet);
  document.getElementById("hdrAdd").addEventListener("click", openAddSheet);
  document.getElementById("tdToggle").addEventListener("click", function () {
    var on = !document.body.classList.contains("tdopen");
    document.body.classList.toggle("tdopen", on);
    if (on)
      setTimeout(function () {
        var i = document.getElementById("tdNew");
        if (i) i.focus();
      }, 50);
  });
  document.getElementById("focusBtn").addEventListener("click", toggleFocusView);
}
