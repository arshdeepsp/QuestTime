/* ---- quick-action buttons ---- */
document.getElementById("sp5Btn").addEventListener("click", function () {
  start5();
});
document.getElementById("trendsBtn").addEventListener("click", function () {
  go("trends");
});
document.getElementById("toolsBtn").addEventListener("click", function (ev) {
  ev.stopPropagation();
  if (qmenu && qmenu.dataset.tools) {
    closeQMenu();
    return;
  }
  if (locked()) return;
  var it = [["Sprint", openSprintSetup]];
  if (cfg().sparkTools) it.push(["Pick for me", openPick], ["Batch to-dos", openBatch]);
  it.push(
    [
      "Edit quests",
      function () {
        document.getElementById("qEditBtn").click();
      },
    ],
    [focusView ? "Full view" : "Minimal view", toggleFocusView],
  );
  popMenu(this, it);
  qmenu.dataset.tools = "1";
});
document.getElementById("schBtn").addEventListener("click", function () {
  openSchedule();
});
document.getElementById("shareBtn").addEventListener("click", function () {
  shareWeek(this);
});
