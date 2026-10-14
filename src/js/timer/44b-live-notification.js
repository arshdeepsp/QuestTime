/* ---- keep-awake and the live timer notification (FocusNotify plugin) ---- */
import { G } from "../core/g.js";
import { S } from "../core/00-state.js";
import { cfg } from "../core/config.js";
import { todayKey } from "../core/days.js";
import { LN, capPlugin } from "../core/native.js";
import { hmL } from "../core/util.js";
import { ensureChannels, nf } from "../notifications/35d-plan.js";
import { drawPlant, grng } from "../progress/41-grove.js";
import { limOf, planOf } from "../rules/day-rules.js";
import { activeDefs } from "../rules/quests-on-day.js";
import { schLen } from "../schedule/model.js";
import { topicName } from "../subjects/33-topics.js";
import { spLabel } from "./43-sprint.js";
import { pomoBg, pomoGrow } from "./43b-pomodoro.js";

export var wakeOn, wakeLockObj, focusArtCache, focusBgCache;

export function focusActive() {
  return !!(S.timer || S.pomo || (S.sprint && S.sprint.phase !== "done"));
}
export function focusArt() {
  if (focusArtCache) return focusArtCache;
  var out = [];
  try {
    for (var s = 0; s < 7; s++) {
      var cv = document.createElement("canvas"),
        W = 24,
        H = 36;
      cv.width = W;
      cv.height = H;
      var c = cv.getContext("2d");
      c.fillStyle = "#6A4A31";
      c.fillRect(0, H - 2, W, 2);
      c.fillStyle = "#5E9E3A";
      c.fillRect(0, H - 3, W, 1);
      drawPlant(c, 1, 12, H - 3, s, grng("focus-sapling"), 0);
      out.push(cv.toDataURL("image/png").split(",")[1] || "");
    }
  } catch (x) {
    out = [];
  }
  return (focusArtCache = out);
}
export function focusBg() {
  var h = new Date().getHours(),
    night = h < 7 || h >= 19,
    key = night ? "n" : "d";
  if (focusBgCache[key]) return focusBgCache[key];
  var out = { dark: night };
  function scene(W, H, seed) {
    var cv = document.createElement("canvas");
    cv.width = W;
    cv.height = H;
    var c = cv.getContext("2d"),
      r = grng(seed + key),
      sky = night ? ["#0E1430", "#16204A", "#22306A", "#2C3E66"] : ["#4F95D6", "#62A6E2", "#7BB8EA", "#9CCDF2"],
      hill = night ? "#1B3A2A" : "#3E8A2C",
      hill2 = night ? "#24492F" : "#56A63A";
    for (var y = 0; y < H; y++) {
      c.fillStyle = sky[Math.min(sky.length - 1, Math.floor((y / H) * sky.length))];
      c.fillRect(0, y, W, 1);
    }
    if (night) {
      for (var i = 0; i < (W * H) / 160; i++) {
        c.fillStyle = r() < 0.3 ? "#FFF6C2" : "#8E9CC8";
        c.fillRect(Math.floor(r() * W), Math.floor(r() * (H * 0.45)), 1, 1);
      }
      c.fillStyle = "#F2EBC9";
      c.fillRect(W - 12, 2, 4, 4);
      c.fillStyle = sky[0];
      c.fillRect(W - 11, 2, 2, 2);
    } else {
      c.fillStyle = "#FFE066";
      c.fillRect(W - 12, 2, 4, 4);
      c.fillStyle = "#FFFFFF";
      for (var k = 0; k < 2; k++) {
        var cx = Math.floor(r() * (W - 20)),
          cy = 2 + Math.floor(r() * Math.max(1, H * 0.25));
        c.fillRect(cx, cy, 6, 1);
        c.fillRect(cx + 1, cy - 1, 3, 1);
      }
    }
    var base = H - 3;
    for (var x = 0; x < W; x++) {
      var hh = Math.round(2 + Math.sin(x / 9) * 1.2 + Math.sin(x / 23 + 1) * 1.6);
      c.fillStyle = hill2;
      c.fillRect(x, base - hh - 2, 1, hh + 2);
      var h2 = Math.round(1 + Math.sin(x / 5) * 1);
      c.fillStyle = hill;
      c.fillRect(x, base - h2, 1, h2 + 1);
    }
    c.fillStyle = night ? "#2F6B22" : "#5E9E3A";
    c.fillRect(0, H - 3, W, 1);
    c.fillStyle = night ? "#4A3322" : "#79553A";
    c.fillRect(0, H - 2, W, 2);
    return cv.toDataURL("image/png").split(",")[1] || "";
  }
  try {
    out.big = scene(96, 54, "bgB");
    out.small = scene(120, 16, "bgS");
  } catch (x) {
    return null;
  }
  return (focusBgCache[key] = out);
}
export function timerGoal(q) {
  var e = S.days[todayKey()] || {};
  if (q.roll) return schLen(q);
  var pl = planOf(q, e);
  return cfg().showPlan && pl > q.min ? pl : q.min;
}
export function growFor(from, mins) {
  return mins > 0 ? { from: Math.round(from), dur: Math.round(mins * 60000), art: focusArt() } : null;
}
export function focusOff() {
  var FN = capPlugin("FocusNotify");
  if (FN && FN.hide) FN.hide().catch(function () {});
  var ln = LN();
  if (ln && ln.cancel) ln.cancel({ notifications: [{ id: 900 }] }).catch(function () {});
}
export function focusSync(force) {
  var want = focusActive() && cfg().keepAwake !== false && document.visibilityState === "visible";
  if (want !== wakeOn) {
    wakeOn = want;
    var KA = capPlugin("KeepAwake");
    if (KA) {
      (want ? KA.keepAwake() : KA.allowSleep()).catch(function () {});
    } else if (navigator.wakeLock) {
      if (want)
        navigator.wakeLock
          .request("screen")
          .then(function (l) {
            wakeLockObj = l;
          })
          .catch(function () {
            wakeOn = false;
          });
      else if (wakeLockObj) {
        wakeLockObj.release().catch(function () {});
        wakeLockObj = null;
      }
    }
  }
  var n = nf(),
    t = null,
    b = null,
    when = null,
    down = false,
    chrono = false,
    next = null,
    grow = null;
  if (n.on && n.timer) {
    if (S.timer) {
      var c5 = S.timer.commit && !S.timer.c5;
      t = (c5 ? "Just 5 minutes: " : "Focusing: ") + S.timer.label;
      b = S.timer.first
        ? "First: " + S.timer.first
        : S.timer.topic && topicName(S.timer.topic)
          ? "Topic: " + topicName(S.timer.topic)
          : "Tap to return";
      chrono = true;
      down = !!c5;
      when = c5 ? S.timer.start + S.timer.commit * 60000 : S.timer.start;
      var gq = activeDefs(todayKey()).filter(function (x) {
          return x.id === S.timer.id;
        })[0],
        full =
          gq && gq.type === "time"
            ? growFor(S.timer.start - ((S.days[todayKey()] || {})[gq.id] | 0) * 60000, timerGoal(gq))
            : null;
      grow = c5 ? growFor(S.timer.start, S.timer.commit) : full;
      var lm = limOf(gq),
        capAt = lm ? S.timer.start + Math.max(0, lm - ((S.days[todayKey()] || {})[gq.id] | 0)) * 60000 : 0,
        capN = lm
          ? {
              title: "Time\u2019s up: " + S.timer.label,
              body: "Daily limit of " + hmL(lm) + " reached. Stopped and logged.",
              chrono: false,
            }
          : null;
      if (c5)
        next = lm
          ? {
              title: "Focusing: " + S.timer.label,
              body: "Stops at the daily limit",
              when: Math.round(capAt),
              countdown: true,
              chrono: true,
              grow: full,
              next: capN,
            }
          : {
              title: "Focusing: " + S.timer.label,
              body: "5 minutes done. Keep going or stop to log it.",
              when: Math.round(S.timer.start),
              countdown: false,
              chrono: true,
              grow: full,
            };
      else if (lm) {
        down = true;
        when = capAt;
        b = (b === "Tap to return" ? "" : b + " \u00b7 ") + "Stops at the daily limit";
        next = capN;
      }
    } else if (S.sprint && S.sprint.phase === "focus") {
      var sp = S.sprint;
      t = "Sprint: " + spLabel(sp.cur);
      if (sp.paused) b = "Paused";
      else {
        b = "Block " + sp.block + (sp.rounds ? " of " + sp.rounds : "");
        chrono = true;
        down = true;
        when = sp.end;
        grow = growFor(sp.end - (sp.blen || sp.len) * 60000, sp.blen || sp.len);
        var last = sp.rounds && sp.block >= sp.rounds,
          lb = sp.longEvery && sp.block % sp.longEvery === 0,
          bend = sp.end + (lb ? 30 : 15) * 60000;
        next = last
          ? { title: "Sprint complete", body: "Open the app to see your summary.", chrono: false }
          : {
              title: lb ? "Long break" : "Decision break",
              body: "Next block when this reaches zero",
              when: Math.round(bend),
              countdown: true,
              chrono: true,
              next: { title: "Break over", body: "Start your next block", chrono: false },
            };
      }
    } else if (S.pomo && S.pomo.phase === "work") {
      var pm = S.pomo;
      t = "Pomodoro: " + pm.label;
      if (pm.paused) b = "Paused";
      else {
        b = "Pomodoro " + (pm.n + 1) + (pm.every ? " of " + pm.every : "");
        chrono = true;
        down = true;
        when = pm.end;
        /* A tomato that fills over the pomodoro, one frame a minute so the progress bar keeps moving; the break shows the
           whole tomato with the bar counting the break down. */
        grow = pomoGrow(pm.end - pm.w * 60000, pm.w);
        var pmL = !!(pm.every && (pm.n + 1) % pm.every === 0),
          pmB = pmL ? pm.l : pm.b;
        next = {
          title: pmL ? "Long break" : "Short break",
          body: pm.auto ? "Next pomodoro when this reaches zero" : "Tap to start the next one when this reaches zero",
          when: Math.round(pm.end + pmB * 60000),
          countdown: true,
          chrono: true,
          grow: pomoGrow(pm.end, pmB, true),
          next: {
            title: "Break over",
            body: pm.auto ? "Next pomodoro running" : "Start your next pomodoro",
            chrono: false,
          },
        };
      }
    } else if (S.pomo && S.pomo.phase === "break") {
      t = S.pomo.long ? "Long break" : "Short break";
      if (S.pomo.breakDone) b = "Break over \u2014 start your next pomodoro";
      else {
        b = "Pomodoro " + (S.pomo.n + 1) + " when this reaches zero";
        chrono = true;
        down = true;
        when = S.pomo.bend;
        grow = pomoGrow(S.pomo.bstart, (S.pomo.bend - S.pomo.bstart) / 60000, true);
        next = { title: "Break over", body: "Start your next pomodoro", chrono: false };
      }
    } else if (S.sprint && S.sprint.phase === "break") {
      t = S.sprint.long ? "Long break" : "Decision break";
      if (S.sprint.breakDone) b = "Break over \u2014 start your next block";
      else {
        b = "Next block when this reaches zero";
        chrono = true;
        down = true;
        when = S.sprint.bend;
        next = { title: "Break over", body: "Start your next block", chrono: false };
      }
    }
  }
  /* A pomodoro gets the tomato field behind it instead of the sky. */
  var bgOf = S.pomo ? pomoBg : focusBg,
    sig = t ? [t, b, when, down, grow ? grow.from + "/" + grow.dur : "", !!S.pomo, (bgOf() || {}).dark].join("|") : "";
  if (sig === G.ongoingSig && force !== true) return;
  G.ongoingSig = sig;
  if (!t) {
    focusOff();
    return;
  }
  function legacy() {
    var ln = LN();
    if (!ln) return;
    ln.cancel({ notifications: [{ id: 900 }] })
      .catch(function () {})
      .then(function () {
        if (!t) return;
        return ensureChannels().then(function () {
          return ln.schedule({
            notifications: [
              {
                id: 900,
                title: t,
                body: b,
                ongoing: true,
                autoCancel: false,
                channelId: "pc_focus",
                schedule: { at: new Date(Date.now() + 400) },
              },
            ],
          });
        });
      })
      .catch(function () {});
  }
  var FN = capPlugin("FocusNotify");
  if (FN && FN.show) {
    var bg = bgOf();
    (function addBg(o) {
      if (o) {
        o.bg = bg;
        addBg(o.next);
      }
    })(next);
    FN.show({
      title: t,
      body: b,
      when: when == null ? null : Math.round(when),
      countdown: down,
      chrono: chrono,
      next: next,
      grow: grow,
      bg: bg,
    }).catch(legacy);
    return;
  }
  legacy();
}

/* Runs once at startup, in file-number order (main.js). */
export function init() {
  wakeOn = false;
  wakeLockObj = null;
  G.ongoingSig = "";
  /* Growing sapling in the live notification: grow = {from, dur, art}. The native side picks the stage from (now - from) / dur and re-posts itself at each stage via an alarm. */
  focusArtCache = null;
  /* Pixel scene behind the live notification: day sky with clouds, or night sky with stars, over grass. dark = light text. */
  focusBgCache = {};
  setInterval(focusSync, 3000);
  if (!focusActive())
    setTimeout(function () {
      focusSync(true);
    }, 400);
  document.addEventListener("visibilitychange", function () {
    wakeOn = false;
    focusSync();
  });
}
