/* ---- quick-action buttons ---- */
import { G } from "../core/g.js";
import { cfg } from "../core/config.js";
import { locked } from "../core/entries.js";
import { shareWeek } from "../progress/share-week.js";
import { closeQMenu } from "../quests/11-row-menu.js";
import { openSchedule } from "../schedule/page.js";
import { openSprintSetup } from "../timer/43-sprint.js";
import { openBatch, openPick, start5 } from "../tools/28-spark-tools.js";
import { go } from "./44-navigation.js";
import { toggleFocusView } from "./48-declutter.js";
import { popMenu } from "./menus.js";

/* Runs once at startup, in file-number order (main.js). */
export function init() {
  document.getElementById("sp5Btn").addEventListener("click", function () {
    start5();
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
    var it = [["Sprint", openSprintSetup]];
    if (cfg().sparkTools) it.push(["Pick for me", openPick], ["Batch to-dos", openBatch]);
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
  document.getElementById("schBtn").addEventListener("click", function () {
    openSchedule();
  });
  document.getElementById("shareBtn").addEventListener("click", function () {
    shareWeek(this);
  });
}
