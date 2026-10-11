/* ---- applying look-and-feel choices (also when they arrive from another device) ---- */
function calmSync() {
  var c = cfg().calm || "auto",
    pr = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches,
    on = c === "on" || (c === "auto" && (pr || lowBatt));
  document.body.classList.toggle("calm", !!on);
}
/* store.adopt(id, obj, u): take a remote document as-is (null = removed) without flagging it as a local change. */
/* A settings document from another device: apply its look-and-feel now (theme, reduce animations, sound, Minimal view
     unless a timer forces it, the stats/HUD panels, the list groups, grove info); the caller re-renders. */
function applyLook() {
  sfxOn = uiGet("sfx", true) !== false;
  statsOpen = !!uiGet("stats");
  hudOpen = !!uiGet("hud");
  doneOpen = !!uiGet("done");
  offOpen = !!uiGet("off");
  ignOpen = !!uiGet("ign");
  if (!S.timer) focusView = !!uiGet("focus");
  [sndLabel, hudSync, applyTheme, calmSync, groveInfoSync, applyHide].forEach(function (f) {
    try {
      f();
    } catch (x) {}
  });
  qSig = "";
}
