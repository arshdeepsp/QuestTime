/* ---- splash: on launch, and on return after SPLASH_AWAY away. A sapling grows while a bar fills; tap skips. ---- */
import { S } from "../core/00-state.js";
import { cfg } from "../core/config.js";
import { drawPlant, grng } from "../progress/41-grove.js";
import { rewardsOff } from "../rules/modes.js";

export var SPLASH_AWAY, splHiddenAt, splT, splQuick;

export function splashOff() {
  if (splQuick) {
    splQuick = false;
    return true;
  }
  try {
    return localStorage.getItem("pc-splash") === "off";
  } catch (x) {
    return false;
  }
}
export function splashStatus() {
  if (S.timer) return "Focusing on " + S.timer.label;
  if (S.sprint) return "Sprint in progress";
  var hl = document.querySelector("#hudLine b"),
    xt = document.getElementById("xpText"),
    q = (cfg().quests || []).length;
  if (!q) return "";
  return (hl && !rewardsOff() ? "Streak " + hl.textContent + " · " : "") + (xt ? xt.textContent : "");
}
export function splashDraw(stage) {
  var cv = document.getElementById("splCv");
  if (!cv) return;
  var c = cv.getContext("2d");
  c.clearRect(0, 0, 24, 36);
  c.fillStyle = "#4A3424";
  c.fillRect(2, 34, 20, 2);
  try {
    drawPlant(c, 1, 12, 33, stage, grng("focus-sapling"), 0);
  } catch (x) {}
}
export function hideSplash() {
  var el = document.getElementById("splash");
  splT.forEach(clearTimeout);
  splT = [];
  if (!el || el.hidden) return;
  el.classList.add("out");
  splT.push(
    setTimeout(function () {
      el.hidden = true;
      el.classList.remove("out", "run");
    }, 200),
  );
}
export function showSplash() {
  var el = document.getElementById("splash");
  if (!el) return;
  if (splashOff()) {
    el.hidden = true;
    return;
  }
  splT.forEach(clearTimeout);
  splT = [];
  var still = false;
  try {
    still = matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch (x) {}
  document.getElementById("splS").textContent = splashStatus();
  el.classList.remove("out", "run");
  el.hidden = false;
  void el.offsetWidth;
  el.classList.toggle("still", still);
  if (still) {
    splashDraw(6);
    splT.push(setTimeout(hideSplash, 700));
    return;
  }
  splashDraw(0);
  el.classList.add("run");
  for (var s = 1; s <= 6; s++)
    (function (s) {
      splT.push(
        setTimeout(function () {
          splashDraw(s);
        }, s * 140),
      );
    })(s);
  splT.push(setTimeout(hideSplash, 1250));
}

/* Runs once at startup, in file-number order (main.js). */
export function init() {
  SPLASH_AWAY = 30 * 60000;
  splHiddenAt = 0;
  splT = [];
  /* pc-quick (sessionStorage, one use) = a refresh the app asked for: no splash. */
  splQuick = false;
  try {
    splQuick = !!sessionStorage.getItem("pc-quick");
    sessionStorage.removeItem("pc-quick");
  } catch (x) {}
  document.getElementById("splash").addEventListener("click", hideSplash);
  document.addEventListener("visibilitychange", function () {
    if (document.visibilityState === "hidden") {
      splHiddenAt = Date.now();
      return;
    }
    if (splHiddenAt && Date.now() - splHiddenAt >= SPLASH_AWAY) showSplash();
    splHiddenAt = 0;
  });
  showSplash();
}
