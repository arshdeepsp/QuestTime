/* ---- fit background between app bars on phones ---- */
import { updateSky } from "./09-scenic-sky.js";

export function measureBars() {
  var r = document.documentElement,
    mob = window.innerWidth <= 720,
    tb = document.querySelector(".titlebar"),
    nv = document.getElementById("mainnav");
  var h = mob && tb ? Math.round(tb.getBoundingClientRect().height) : 0,
    n = mob && nv ? Math.round(nv.getBoundingClientRect().height) : 0;
  if (r.style.getPropertyValue("--hdrH") !== h + "px" || r.style.getPropertyValue("--navH") !== n + "px") {
    r.style.setProperty("--hdrH", h + "px");
    r.style.setProperty("--navH", n + "px");
    if (typeof updateSky === "function") updateSky();
  }
}

/* Runs once at startup, in file-number order (main.js). */
export function init() {
  window.addEventListener("resize", measureBars);
  window.addEventListener("orientationchange", function () {
    setTimeout(measureBars, 200);
  });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(measureBars);
  setTimeout(measureBars, 0);
  setTimeout(measureBars, 1500);
}
