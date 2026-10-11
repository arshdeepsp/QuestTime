/* 5a. new deadline */
import { G } from "../core/g.js";
import { S, dirty } from "../core/00-state.js";
import { cfg, saveCfg } from "../core/config.js";
import { todayKey } from "../core/days.js";
import { cache } from "../core/storage.js";
import { clone, num } from "../core/util.js";
import { activeDefs } from "../rules/quests-on-day.js";
import { render } from "../ui/04-render.js";
import { closeG, openG } from "../ui/18-modal.js";
import { setSync } from "../ui/feedback.js";

export function openDeadlineModal() {
  openG("New deadline", function (b) {
    b.innerHTML =
      '<div class="ed"><label>Name<input id="ndT" maxlength="40" placeholder="Thesis draft due"></label><label>Date<input type="date" id="ndD"></label><p class="sh2">Break it down (optional)</p><div class="edrow"><label>Total amount<input type="number" id="ndAmt" min="0" step="any" placeholder="10"></label><label>Unit<input id="ndUnit" maxlength="16" placeholder="pages"></label></div><p class="help">Adds a daily target quest that spreads what\u2019s left evenly over the days remaining, and adjusts as you go.</p><p class="cmsg2" id="ndMsg"></p><div class="edrow end"><button type="button" class="stone" id="ndNo">Cancel</button><button type="button" class="stone save" id="ndGo">Add deadline</button></div></div>';
    b.querySelector("#ndNo").addEventListener("click", closeG);
    b.querySelector("#ndGo").addEventListener("click", function () {
      var t = b.querySelector("#ndT").value.trim(),
        d = b.querySelector("#ndD").value;
      if (!t || !d) {
        b.querySelector("#ndMsg").textContent = "Add a name and a date.";
        return;
      }
      var amt = num(b.querySelector("#ndAmt").value),
        un = b.querySelector("#ndUnit").value.trim(),
        T2 = todayKey();
      if (amt > 0 && d < T2) {
        b.querySelector("#ndMsg").textContent = "Pick a date from today on to break it down.";
        return;
      }
      var c = clone(cfg()),
        did = "d" + Date.now().toString(36);
      c.deadlines = (c.deadlines || []).concat([{ id: did, title: t, date: d }]);
      if (amt > 0)
        c.quests.push({
          id: "q" + Date.now().toString(36),
          type: "target",
          label: t,
          ul: un,
          step: 1,
          min: 1,
          dl: { id: did, total: amt, from: T2, due: d },
        });
      saveCfg(c);
      if (amt > 0 && S.days[T2]) {
        S.days[T2] = Object.assign({}, S.days[T2], { q: activeDefs(T2) });
        dirty[T2] = true;
        cache();
      }
      G.qSig = "";
      closeG();
      render();
      setSync(amt > 0 ? "Deadline added with a daily target" : "Deadline added");
    });
  });
}
