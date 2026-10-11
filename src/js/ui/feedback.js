/* ---- status line, toasts and the locks-soon note ---- */
import { G } from "../core/g.js";
import { LOCK_SOON } from "../core/49b-boot.js";
import { dayEnd } from "../core/days.js";
import { ro } from "../core/entries.js";
import { esc, svg } from "../core/util.js";
import { TOAST_HOLD, bootAt, toast, userActed } from "../progress/03-badges.js";

export function setSync(t) {
  var el = document.getElementById("sync");
  el.textContent = t;
  clearTimeout(G.syncT);
  if (t)
    G.syncT = setTimeout(function () {
      if (el.textContent === t) el.textContent = "";
    }, 6000);
}
export function showToast(a) {
  if (!userActed && Date.now() - bootAt < TOAST_HOLD) {
    G.toastQ = a;
    return;
  }
  toast.innerHTML =
    '<div class="ach px"><div class="slot">' +
    svg(a.icon) +
    '</div><div><div class="t1">' +
    esc(a.kicker || "Badge earned!") +
    '</div><div class="t2"></div><div class="t3"></div></div></div>';
  toast.querySelector(".t2").textContent = a.title;
  toast.querySelector(".t3").textContent = a.desc || "";
  requestAnimationFrame(function () {
    toast.classList.add("show");
  });
  setTimeout(function () {
    toast.classList.remove("show");
  }, 5000);
}
export function lockIn() {
  var el = document.getElementById("lockIn");
  if (ro()) {
    el.textContent = "Locked";
    return;
  }
  var n = new Date(),
    DE = dayEnd(),
    sd = new Date(n.getTime() - DE * 3600000),
    m = new Date(sd.getFullYear(), sd.getMonth(), sd.getDate() + 1, DE) - n,
    h = Math.floor(m / 3600000),
    mm = Math.floor((m % 3600000) / 60000);
  el.textContent = m <= LOCK_SOON * 60000 ? "Locks in " + (h ? h + "h " : "") + mm + "m" : "";
}
