/* ---- park-it inbox ---- */
import { G } from "../core/g.js";
import { S, dirty } from "../core/00-state.js";
import { cfg, saveCfg } from "../core/config.js";
import { todayKey } from "../core/days.js";
import { locked } from "../core/entries.js";
import { cache } from "../core/storage.js";
import { clone, esc } from "../core/util.js";
import { activeDefs } from "../rules/quests-on-day.js";
import { render } from "../ui/04-render.js";
import { setSync } from "../ui/feedback.js";

export function parkAdd(t) {
  t = (t || "").trim();
  if (!t) return false;
  var c = clone(cfg());
  c.park = (c.park || []).concat([{ id: "p" + Date.now().toString(36), t: t.slice(0, 120), at: todayKey() }]);
  saveCfg(c);
  setSync("Parked: " + t.slice(0, 40));
  renderPark();
  return true;
}
export function renderPark() {
  var el = document.getElementById("parkBox");
  if (!el) return;
  var L = cfg().park || [];
  el.hidden = !L.length;
  if (!L.length) {
    el.innerHTML = "";
    return;
  }
  el.innerHTML =
    '<div class="pk-h">Parked thoughts (' +
    L.length +
    ")</div>" +
    L.map(function (p) {
      return (
        '<div class="pk-r"><span>' +
        esc(p.t) +
        '</span><button type="button" class="stone mini" data-ptodo="' +
        p.id +
        '">To-do</button><button type="button" class="stone mini del" data-px="' +
        p.id +
        '" aria-label="Dismiss">x</button></div>'
      );
    }).join("");
  el.querySelectorAll("[data-px]").forEach(function (b) {
    b.addEventListener("click", function () {
      var c = clone(cfg());
      c.park = (c.park || []).filter(function (p) {
        return p.id !== b.getAttribute("data-px");
      });
      saveCfg(c);
      renderPark();
    });
  });
  el.querySelectorAll("[data-ptodo]").forEach(function (b) {
    b.addEventListener("click", function () {
      if (locked()) return;
      var c = clone(cfg()),
        p = (c.park || []).filter(function (x) {
          return x.id === b.getAttribute("data-ptodo");
        })[0];
      if (!p) return;
      c.park = c.park.filter(function (x) {
        return x !== p;
      });
      c.quests.push({ id: "td" + Date.now().toString(36), type: "todo", label: p.t.slice(0, 60) });
      saveCfg(c);
      var T = todayKey();
      if (S.days[T]) {
        S.days[T] = Object.assign({}, S.days[T], { q: activeDefs(T) });
        dirty[T] = true;
        cache();
      }
      G.qSig = "";
      render();
      setSync("Moved to to-dos");
    });
  });
}
