/* ---- pull to refresh (touch) ----
     Pull down from the very top of the page (nothing open on top of it) past PTR_GO px and let go: the app saves, then
     reloads without the splash (appRefresh). Signed in, the reload re-runs the first sync, so it pulls everything from the
     account too. #ptr shows the state; the pull is damped by half. */
import { G } from "../core/g.js";
import { cache } from "../core/storage.js";

export var PTR_GO, ptrEl;

export function appRefresh(note) {
  try {
    cache();
  } catch (x) {}
  try {
    sessionStorage.setItem("pc-quick", "1");
    if (note) sessionStorage.setItem("pc-authnote", note);
  } catch (x) {}
  G.storeHold = true;
  location.reload();
}
export function ptrBlocked() {
  var b = document.body.classList;
  if (
    b.contains("sch-open") ||
    b.contains("hp-open") ||
    b.contains("au-open") ||
    b.contains("mgr-on") ||
    b.contains("grove-on") ||
    b.contains("typing")
  )
    return true;
  if (document.querySelector(".qmenu,.dragging")) return true;
  var g = document.getElementById("gModal"),
    n = document.getElementById("nqModal"),
    sp = document.getElementById("splash");
  return (g && !g.hidden) || (n && !n.hidden) || (sp && !sp.hidden);
}

/* Runs once at startup, in file-number order (main.js). */
export function init() {
  PTR_GO = 64;
  ptrEl = null;
  (function () {
    var y0 = null,
      x0 = 0,
      d = 0,
      on = false;
    function el() {
      if (!ptrEl) {
        ptrEl = document.createElement("div");
        ptrEl.id = "ptr";
        ptrEl.setAttribute("role", "status");
        ptrEl.setAttribute("aria-live", "polite");
        document.body.appendChild(ptrEl);
      }
      return ptrEl;
    }
    function show() {
      var e = el();
      e.hidden = false;
      e.style.transform = "translate(-50%," + (d - 44) + "px)";
      e.classList.toggle("go", d >= PTR_GO);
      e.textContent = d >= PTR_GO ? "↑ Release to refresh" : "↓ Pull to refresh";
    }
    function reset() {
      y0 = null;
      on = false;
      d = 0;
      if (ptrEl) {
        ptrEl.hidden = true;
        ptrEl.classList.remove("go");
      }
    }
    document.addEventListener(
      "touchstart",
      function (e) {
        if (
          e.touches.length !== 1 ||
          ptrBlocked() ||
          (document.scrollingElement || document.documentElement).scrollTop > 0
        ) {
          y0 = null;
          return;
        }
        y0 = e.touches[0].clientY;
        x0 = e.touches[0].clientX;
        on = false;
        d = 0;
      },
      { passive: true },
    );
    document.addEventListener(
      "touchmove",
      function (e) {
        if (y0 == null) return;
        var dy = e.touches[0].clientY - y0,
          dx = Math.abs(e.touches[0].clientX - x0);
        if (!on) {
          if (dy > 12 && dy > dx * 1.5 && !ptrBlocked()) on = true;
          else if (dy < 0 || dx > dy) {
            y0 = null;
            return;
          } else return;
        }
        d = Math.max(0, Math.min(110, dy * 0.5));
        show();
      },
      { passive: true },
    );
    function end() {
      if (on && d >= PTR_GO && !ptrBlocked()) {
        var e = el();
        e.textContent = "Refreshing…";
        e.classList.add("go");
        appRefresh();
        return;
      }
      reset();
    }
    document.addEventListener("touchend", end, { passive: true });
    document.addEventListener("touchcancel", reset, { passive: true });
  })();
}
