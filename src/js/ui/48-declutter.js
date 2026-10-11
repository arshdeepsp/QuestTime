/* ---- today-page declutter ---- */
function hideOpts() {
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
var focusView = !!uiGet("focus");
function applyHide() {
  if (S.timer && !focusView) focusView = true;
  var h = cfg().hide || {},
    b = document.body;
  hideOpts().forEach(function (o) {
    b.classList.toggle("hide-" + o[0], !!h[o[0]]);
  });
  b.classList.toggle("focusview", focusView);
  if (typeof measureBars === "function") setTimeout(measureBars, 0);
  if (focusView && typeof curView !== "undefined" && curView !== "today" && typeof go === "function")
    setTimeout(function () {
      go("today");
    }, 0);
  var fb = document.getElementById("focusBtn");
  if (fb) {
    fb.setAttribute("aria-pressed", focusView);
    fb.textContent = focusView ? (window.innerWidth <= 720 ? "All" : "Show all") : "Minimal";
  }
}
document.getElementById("hdrEdit").addEventListener("click", function () {
  document.getElementById("qEditBtn").click();
});
function openAddSheet() {
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
function toggleFocusView() {
  if (S.timer && focusView) {
    setSync("Stop the timer to leave Minimal view.");
    return;
  }
  focusView = !focusView;
  uiSet("focus", focusView);
  applyHide();
  haptic("light");
}
document.getElementById("focusBtn").addEventListener("click", toggleFocusView);
