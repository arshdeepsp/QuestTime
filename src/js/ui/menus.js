/* ---- pop-up menus ---- */
import { G } from "../core/g.js";
import { closeQMenu } from "../quests/11-row-menu.js";
import { haptic } from "./45-gestures.js";

/* popMenu(btn, items): items are [label(html), fn] or [label, fn, {arm:"Confirm label"}]; an armed item changes to its arm label on the first tap and only runs on the second (the menu's Cancel or a tap outside drops it). */
export function popMenu(btn, items) {
  closeQMenu();
  items = items.concat([["Cancel", function () {}]]);
  var m = document.createElement("div");
  m.className = "qmenu";
  m.setAttribute("role", "menu");
  m.innerHTML = items
    .map(function (it, i) {
      return '<button type="button" role="menuitem" data-mi="' + i + '">' + it[0] + "</button>";
    })
    .join("");
  document.body.appendChild(m);
  var r = btn.getBoundingClientRect();
  m.style.top = window.scrollY + r.bottom + 6 + "px";
  m.style.left =
    Math.max(
      8,
      Math.min(window.scrollX + r.left, window.scrollX + document.documentElement.clientWidth - m.offsetWidth - 8),
    ) + "px";
  m.querySelectorAll("[data-mi]").forEach(function (b) {
    b.addEventListener("click", function (e) {
      e.stopPropagation();
      var it = items[+b.getAttribute("data-mi")],
        o = it[2];
      if (o && o.arm && !b.classList.contains("armed")) {
        b.classList.add("armed");
        b.textContent = o.arm;
        haptic("light");
        return;
      }
      closeQMenu();
      it[1]();
    });
  });
  G.qmenu = m;
  m.querySelector("button").focus();
}
