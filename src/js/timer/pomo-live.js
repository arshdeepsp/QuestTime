/* ---- a pomodoro running on another device ----
     G.liveRemote = the account's live doc ({pomo, dev, name, sid, gen}) when another device runs a session and this one
     runs none (set by sync/54-account.js on pull and on the checks). The card offers "Continue here" (G.liveTake) on
     Today and on the Pomodoro page; ✕ hides it until that session changes hands or phase (G.liveHide). */
import { G } from "../core/g.js";
import { S } from "../core/00-state.js";
import { esc } from "../core/util.js";
import { tomatoSvg } from "./43b-pomodoro.js";

/* A session's last moment of activity: a running interval's end (or when it was paused), a break's end. One that has
   been idle for LIVE_IDLE (2 h: a device that died mid-break) isn't offered. */
export function liveAlive(p, now) {
  if (!p) return false;
  var t = p.phase === "work" ? p.paused || p.end : p.bend;
  return !!t && (now || Date.now()) - t < 2 * 3600000;
}
export function liveKey(d) {
  var p = d.pomo || {};
  return [d.sid, d.gen, p.phase, p.end, p.bend, p.breakDone ? 1 : 0, p.paused ? 1 : 0].join(":");
}
export function liveClock(ms) {
  var d = new Date(ms);
  return String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0");
}
/* "Focus on Coursework until 14:32", "Short break until 14:37", "Break over", "Set done", "Paused". */
export function liveWhat(p, now) {
  now = now || Date.now();
  if (p.phase === "work") {
    if (p.paused) return "Paused on " + esc(p.label);
    return p.end > now ? "Focus on " + esc(p.label) + " until " + liveClock(p.end) : "Finishing " + esc(p.label);
  }
  if (p.breakDone || p.bend <= now) return p.long ? "Set done" : "Break over";
  return (p.long ? "Long break" : "Short break") + " until " + liveClock(p.bend);
}
export function liveShown() {
  var d = G.liveRemote;
  return !!(d && d.pomo && !S.pomo && liveAlive(d.pomo) && G.liveHide !== liveKey(d));
}
export function liveCardHtml() {
  if (!liveShown()) return "";
  var d = G.liveRemote,
    p = d.pomo;
  return (
    '<div class="livecard" role="status">' +
    tomatoSvg("tomato") +
    '<div class="lc-t"><b>Pomodoro running on your ' +
    esc(d.name || "other device") +
    "</b><span>" +
    liveWhat(p) +
    (p.every
      ? " · pomodoro " + (((p.n || 0) % p.every) + (p.phase === "work" ? 1 : 0) || p.every) + " of " + p.every
      : "") +
    '</span></div><button type="button" class="stone save mini" data-live="take">Continue here</button>' +
    '<button type="button" class="stone mini" data-live="hide" aria-label="Hide">✕</button></div>'
  );
}
/* Today: the card sits above the quest list, like the reset card. */
export function renderLiveCard() {
  var el = document.getElementById("liveCard");
  if (!el) {
    var qw = document.getElementById("questsWrap");
    if (!qw) return;
    el = document.createElement("div");
    el.id = "liveCard";
    qw.parentNode.insertBefore(el, qw);
  }
  var h = liveCardHtml();
  if (el.innerHTML !== h) el.innerHTML = h;
  el.hidden = !h;
}
