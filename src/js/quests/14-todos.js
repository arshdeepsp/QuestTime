/* ---- to-dos ---- */
import { G } from "../core/g.js";
import { S, dirty } from "../core/00-state.js";
import { cfg, saveCfg } from "../core/config.js";
import { todayKey } from "../core/days.js";
import { commit, entry, locked } from "../core/entries.js";
import { cache } from "../core/storage.js";
import { clone } from "../core/util.js";
import { activeDefs } from "../rules/quests-on-day.js";
import { render } from "../ui/04-render.js";
import { setSync } from "../ui/feedback.js";

export function toggleTodo(q) {
  if (locked()) return;
  var T = todayKey(),
    c = clone(cfg()),
    t = c.quests.filter(function (x) {
      return x.id === q.id;
    })[0];
  if (!t) return;
  var e = entry(),
    done = !e[q.id];
  if (done) {
    e[q.id] = true;
    t.doneOn = T;
  } else {
    delete e[q.id];
    delete t.doneOn;
  }
  saveCfg(c);
  e.q = activeDefs(T);
  commit();
  if (done) setSync("To-do done: " + q.label);
}

/* Runs once at startup, in file-number order (main.js). */
export function init() {
  (function () {
    var inp = document.getElementById("tdNew"),
      btn = document.getElementById("tdAdd");
    if (!inp) return;
    function addTd() {
      var l = inp.value.trim();
      if (!l || locked()) return;
      var c = clone(cfg());
      c.quests.push({ id: "td" + Date.now().toString(36), type: "todo", label: l.slice(0, 60), addedOn: todayKey() });
      saveCfg(c);
      inp.value = "";
      var T = todayKey();
      if (S.days[T]) {
        S.days[T] = Object.assign({}, S.days[T], { q: activeDefs(T) });
        dirty[T] = true;
        cache();
      }
      G.qSig = "";
      render();
      setSync("To-do added");
    }
    btn.addEventListener("click", addTd);
    inp.addEventListener("keydown", function (e) {
      if (e.key === "Enter") addTd();
    });
  })();
}
