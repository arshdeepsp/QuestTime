/* ---- applying look-and-feel choices (also when they arrive from another device) ---- */
import { G } from "../core/g.js";
import { S } from "../core/00-state.js";
import { cfg, uiGet } from "../core/config.js";
import { groveInfoSync } from "../progress/42-grove-sky.js";
import { hudSync, sndLabel } from "./04-render.js";
import { applyTheme } from "./08-themes.js";
import { lowBatt } from "./45-gestures.js";
import { applyHide } from "./48-declutter.js";

export function calmSync() {
  var c = cfg().calm || "auto",
    pr = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches,
    on = c === "on" || (c === "auto" && (pr || lowBatt));
  document.body.classList.toggle("calm", !!on);
}
/* store.adopt(id, obj, u): take a remote document as-is (null = removed) without flagging it as a local change. */
/* A settings document from another device: apply its look-and-feel now (theme, reduce animations, sound, Minimal view
     unless a timer forces it, the stats/HUD panels, the list groups, grove info); the caller re-renders. */
export function applyLook() {
  G.sfxOn = uiGet("sfx", true) !== false;
  G.statsOpen = !!uiGet("stats");
  G.hudOpen = !!uiGet("hud");
  G.doneOpen = !!uiGet("done");
  G.offOpen = !!uiGet("off");
  G.ignOpen = !!uiGet("ign");
  if (!S.timer) G.focusView = !!uiGet("focus");
  [sndLabel, hudSync, applyTheme, calmSync, groveInfoSync, applyHide].forEach(function (f) {
    try {
      f();
    } catch (x) {}
  });
  G.qSig = "";
}
