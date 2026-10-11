/* ---- time-of-day sky for scenic themes ---- */
import { skyColors, skyState } from "../progress/42-grove-sky.js";

export var SKYT;

export function updateSky() {
  var fx = document.getElementById("fx");
  if (!fx) return;
  var sun = fx.querySelector(".sun"),
    moon = fx.querySelector(".moon"),
    eff = fx.className.split(" ")[0];
  var aware = SKYT.indexOf(eff) >= 0;
  fx.classList.toggle("skyaware", aware);
  if (!aware) {
    fx.style.removeProperty("background");
    ["top", "left", "right", "clip-path", "display", "opacity", "filter"].forEach(function (p) {
      sun.style.removeProperty(p);
      moon.style.removeProperty(p);
    });
    fx.style.removeProperty("--dim");
    fx.style.removeProperty("--stars");
    return;
  }
  var sk = skyState(new Date()),
    cols = skyColors(sk.alt),
    W = fx.clientWidth || window.innerWidth,
    H = fx.clientHeight || window.innerHeight,
    alt = sk.alt;
  var dim = alt >= 0.25 ? 1 : alt >= 0 ? 0.88 + alt * 0.48 : alt >= -0.2 ? 0.62 + (alt + 0.2) * 1.3 : 0.45;
  var stars = Math.max(0, Math.min(1, (-alt - 0.05) / 0.25));
  fx.style.setProperty("--dim", dim.toFixed(2));
  fx.style.setProperty("--dimc", Math.max(dim, 0.78).toFixed(2));
  fx.style.setProperty("--stars", stars.toFixed(2));
  var gold = alt > -0.15 && alt < 0.25;
  if (eff === "ocean") {
    var hz = alt >= 0.25 ? "#FFF2C9" : alt >= -0.1 ? "#FFD08A" : "#3A4A7A",
      w1 = alt >= 0.25 ? "#3E8EC4" : gold ? "#7A6A8E" : "#1A3550",
      w2 = alt >= 0.25 ? "#123C68" : alt >= -0.2 ? "#163A5E" : "#06142A";
    fx.style.background =
      "linear-gradient(" +
      cols[0] +
      " 0," +
      cols[1] +
      " 100px," +
      hz +
      " 110px," +
      w1 +
      " 112px," +
      w2 +
      " 75%," +
      (alt >= -0.2 ? "#0B2A4A" : "#030B18") +
      " 100%)";
  } else
    fx.style.background =
      "linear-gradient(" + cols[0] + " 0," + cols[1] + " 60%," + (gold ? "#FFC48A" : cols[1]) + " 100%)";
  function place(el, p, size, horizonY, top0) {
    if (p == null) {
      el.style.display = "none";
      return;
    }
    var x = W * (0.06 + 0.84 * p),
      y = horizonY - size / 2 - Math.sin(Math.PI * p) * (horizonY - size / 2 - top0);
    el.style.display = "block";
    el.style.left = Math.round(x - size / 2) + "px";
    el.style.right = "auto";
    el.style.top = Math.round(y) + "px";
    var cut = Math.max(0, Math.round(y + size - horizonY));
    el.style.clipPath = cut > 0 ? "inset(0 0 " + Math.min(size, cut) + "px 0)" : "none";
  }
  var horizon = eff === "ocean" ? 110 : Math.round(H * 0.8),
    top0 = eff === "ocean" ? 6 : 24;
  place(sun, sk.sunP, eff === "ocean" ? 76 : 80, horizon, top0);
  sun.style.filter =
    alt < 0.25
      ? "hue-rotate(-28deg) saturate(1.5) drop-shadow(0 0 24px rgba(255,120,60,.8))"
      : "drop-shadow(0 0 22px rgba(255,224,102,.55))";
  place(moon, sk.moonP != null && sk.illum > 0.05 ? sk.moonP : null, 64, horizon, top0 + 6);
  moon.style.opacity = alt > 0.1 ? ".55" : "1";
}

/* Runs once at startup, in file-number order (main.js). */
export function init() {
  SKYT = ["mountains", "village", "city", "ocean"];
}
