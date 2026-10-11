/* ---- quest row menu ---- */
import { G } from "../core/g.js";
import { DAYF, S, dirty } from "../core/00-state.js";
import { cfg, saveCfg } from "../core/config.js";
import { add, nextMonday, parse, todayKey, wkEndDay, wkS } from "../core/days.js";
import { locked } from "../core/entries.js";
import { cache, flush } from "../core/storage.js";
import { clone, fmtD } from "../core/util.js";
import { markCompleteManual } from "./35c-finish-lines.js";
import { openMgr } from "./38-quest-editor.js";
import { openDetails } from "./47-phone-rows.js";
import { easeInfo, guardEasing } from "../rules/easing.js";
import { ignoredOn, rewardsOff, setIgnore } from "../rules/modes.js";
import { activeDefs } from "../rules/quests-on-day.js";
import { start5 } from "../tools/28-spark-tools.js";
import { render } from "../ui/04-render.js";
import { setSync } from "../ui/feedback.js";
import { popMenu } from "../ui/menus.js";

export function closeQMenu() {
  if (G.qmenu) {
    G.qmenu.remove();
    G.qmenu = null;
  }
}
export function pauseQuest(q) {
  var T = todayKey(),
    c6 = clone(cfg()),
    oldQ = clone(c6.quests),
    qs = c6.quests,
    t = qs.filter(function (x) {
      return x.id === q.id;
    })[0];
  if (!t) return;
  var inf0 = easeInfo();
  t.pausedFrom = inf0.setup || rewardsOff() ? T : add(T, 1);
  t.pausedUntil = nextMonday(T);
  if (t.pausedFrom >= t.pausedUntil) {
    setSync("Pausing starts tomorrow, which is already next week. Nothing left to pause this week.");
    return;
  }
  var g = guardEasing(c6, oldQ, [q.id]);
  if (!g.ok) {
    setSync(g.msg);
    return;
  }
  saveCfg(c6);
  if (g.eased) {
    G.qSig = "";
    render();
    setSync(q.label + " will be paused from tomorrow through " + DAYF[wkEndDay()] + ".");
    return;
  }
  if (S.days[T]) {
    S.days[T] = Object.assign({}, S.days[T], { q: activeDefs(T) });
    dirty[T] = true;
    cache();
    clearTimeout(G.timer);
    G.timer = setTimeout(flush, 300);
  }
  G.qSig = "";
  render();
  setSync(
    q.label +
      " paused through " +
      DAYF[wkEndDay()] +
      ", " +
      fmtD(add(t.pausedUntil, -1)) +
      ". It's back on " +
      DAYF[wkS()] +
      ".",
  );
}
export function deleteTodo(q) {
  var c = clone(cfg());
  c.quests = c.quests.filter(function (x) {
    return x.id !== q.id;
  });
  saveCfg(c);
  var T = todayKey();
  if (S.days[T]) {
    var e = Object.assign({}, S.days[T]);
    delete e[q.id];
    e.q = activeDefs(T);
    S.days[T] = e;
    dirty[T] = true;
    cache();
    clearTimeout(G.timer);
    G.timer = setTimeout(flush, 300);
  }
  G.qSig = "";
  render();
  setSync("To-do deleted");
}
export function openQMenu(q, btn) {
  closeQMenu();
  if (locked()) return;
  var items =
    q.type === "todo"
      ? [
          [
            "View details",
            function () {
              openDetails(q);
            },
          ],
          [
            "Delete to-do",
            function () {
              deleteTodo(q);
            },
          ],
        ]
      : [
          [
            "Edit quests",
            function () {
              openMgr();
            },
          ],
        ];
  var sun = parse(todayKey()).getDay() === wkEndDay();
  if (q.type !== "todo" && (!sun || easeInfo().setup))
    items.unshift([
      sun ? "Pause for today" : "Pause until " + DAYF[wkEndDay()],
      function () {
        pauseQuest(q);
      },
    ]);
  if (q.type === "time" && !(S.timer && S.timer.id === q.id))
    items.unshift([
      "Just 5 minutes on this",
      function () {
        start5(q);
      },
    ]);
  if (q.type !== "todo")
    items.unshift([
      "View details",
      function () {
        openDetails(q);
      },
    ]);
  if (rewardsOff()) {
    var ig0 = ignoredOn(q.id, todayKey());
    items.unshift([
      ig0 ? "Add back to the list" : "Ignore",
      function () {
        setIgnore(q.id, !ig0);
      },
    ]);
  }
  if (q.type !== "todo") {
    var cq0 = cfg().quests.filter(function (z) {
      return z.id === q.id;
    })[0];
    if (cq0 && !cq0.completed)
      items.splice(items.length, 0, [
        "Mark complete",
        function () {
          markCompleteManual(q);
        },
      ]);
  }
  popMenu(btn, items);
}

/* Runs once at startup, in file-number order (main.js). */
export function init() {
  G.qmenu = null;
  document.addEventListener("click", function (e) {
    if (G.qmenu && !G.qmenu.contains(e.target)) closeQMenu();
  });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") closeQMenu();
  });
}
