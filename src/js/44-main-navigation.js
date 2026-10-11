/* ---- main navigation ---- */
var VIEWS = ["today", "subjects", "rules", "achievements", "trends", "settings"],
  curView = "today";
(function () {
  var sb = document.getElementById("settingsBody"),
    sp = document.getElementById("setPage");
  if (sb && sp) sp.appendChild(sb);
})();
function go(v, noHash) {
  if ((v === "grove" || v === "achievements") && rewardsOff()) v = "today";
  if (v === "grove") {
    openGrove(false);
    return;
  }
  if (VIEWS.indexOf(v) < 0) v = "today";
  var prevView = curView;
  curView = v;
  document.querySelectorAll("[data-view]").forEach(function (el) {
    el.hidden = el.getAttribute("data-view") !== v;
  });
  document.querySelectorAll("#mainnav [data-go]").forEach(function (b) {
    var on = b.getAttribute("data-go") === v;
    b.classList.toggle("on", on);
    if (on) b.setAttribute("aria-current", "page");
    else b.removeAttribute("aria-current");
  });
  document.body.setAttribute("data-cur", v);
  var vt = document.getElementById("viewTitle");
  if (vt)
    vt.textContent =
      {
        today: "Today",
        subjects: "Subjects",
        rules: "Rules",
        achievements: "Badges",
        trends: "Trends",
        settings: "Settings",
      }[v] || "";
  var sb = document.getElementById("setBtn");
  if (sb) sb.classList.toggle("on", v === "settings");
  var tb = document.getElementById("trendsBtn");
  if (tb) tb.classList.toggle("on", v === "trends");
  if (v === "settings") {
    if (prevView !== "settings") setTab = null;
    renderSettings();
  }
  if (v === "subjects") renderSubjects();
  if (v === "today" || v === "achievements") render();
  if (v === "trends") renderTrends();

  if (!noHash && location.hash !== "#" + v) {
    try {
      history.pushState(null, "", "#" + v);
    } catch (x) {
      location.hash = v;
    }
  }
  window.scrollTo(0, 0);
}
document.querySelectorAll("#mainnav [data-go]").forEach(function (b) {
  b.addEventListener("click", function () {
    go(b.getAttribute("data-go"));
  });
});
window.addEventListener("popstate", function () {
  go((location.hash || "#today").slice(1), true);
});
window.addEventListener("hashchange", function () {
  go((location.hash || "#today").slice(1), true);
});
/* ---- native app glue: files, back button, keep awake, ongoing focus notice ---- */
function capPlugin(n) {
  try {
    if (!nativeApp()) return null;
    var C = window.Capacitor;
    return (C.Plugins && C.Plugins[n]) || (C.registerPlugin ? C.registerPlugin(n) : null);
  } catch (x) {
    return null;
  }
}
function toB64(data) {
  return new Promise(function (res, rej) {
    if (typeof data === "string") {
      try {
        res(btoa(unescape(encodeURIComponent(data))));
      } catch (e) {
        rej(e);
      }
      return;
    }
    var fr = new FileReader();
    fr.onload = function () {
      res(String(fr.result).split(",")[1] || "");
    };
    fr.onerror = rej;
    fr.readAsDataURL(data instanceof Blob ? data : new Blob([data]));
  });
}
if (nativeApp()) {
  var FS = capPlugin("Filesystem"),
    SH = capPlugin("Share");
  if (FS && SH)
    dl = {
      save: function (o) {
        return toB64(o.data)
          .then(function (b64) {
            return FS.writeFile({ path: o.filename, data: b64, directory: "CACHE" });
          })
          .then(function (r) {
            return SH.share({ title: o.filename, files: [r.uri] });
          })
          .catch(function (e) {
            var m = String((e && e.message) || e || "");
            if (/cancel/i.test(m)) throw { code: "declined" };
            throw e;
          });
      },
    };
}
(function () {
  var AP = capPlugin("App");
  if (!AP || !AP.addListener) return;
  AP.addListener("backButton", function () {
    if (typeof authOpen === "function" && authOpen()) {
      if (!auGate) closeAuth();
      else if (AP.minimizeApp) AP.minimizeApp();
      return;
    }
    var qm = document.querySelector(".qmenu");
    if (qm) {
      closeQMenu();
      return;
    }
    if (!document.getElementById("gModal").hidden) {
      closeG();
      return;
    }
    if (!document.getElementById("nqModal").hidden) {
      var nb = document.querySelector("#nqModal .drawer-h .stone");
      if (nb) nb.click();
      return;
    }
    if (typeof hpOpen === "function" && hpOpen()) {
      closeHelp();
      return;
    }
    if (typeof schOpen === "function" && schOpen()) {
      closeSchedule();
      return;
    }
    if (groveOpen) {
      closeGrove();
      return;
    }
    if (S.sprint && !spEl.hidden) {
      spHide();
      return;
    }
    if (!document.getElementById("mgrSheet").hidden) {
      closeMgr();
      return;
    }
    if (curView === "settings" && setTab) {
      setTab = null;
      renderSettings();
      return;
    }
    if (curView !== "today") {
      go("today");
      return;
    }
    if (AP.minimizeApp) AP.minimizeApp();
    else if (AP.exitApp) AP.exitApp();
  });
})();
var wakeOn = false,
  wakeLockObj = null,
  ongoingSig = "";
function focusActive() {
  return !!(S.timer || (S.sprint && S.sprint.phase !== "done"));
}
/* Growing sapling in the live notification: grow = {from, dur, art}. The native side picks the stage from (now - from) / dur and re-posts itself at each stage via an alarm. */
var focusArtCache = null;
function focusArt() {
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
/* Pixel scene behind the live notification: day sky with clouds, or night sky with stars, over grass. dark = light text. */
var focusBgCache = {};
function focusBg() {
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
function timerGoal(q) {
  var e = S.days[todayKey()] || {};
  if (q.roll) return schLen(q);
  var pl = planOf(q, e);
  return cfg().showPlan && pl > q.min ? pl : q.min;
}
function growFor(from, mins) {
  return mins > 0 ? { from: Math.round(from), dur: Math.round(mins * 60000), art: focusArt() } : null;
}
function focusOff() {
  var FN = capPlugin("FocusNotify");
  if (FN && FN.hide) FN.hide().catch(function () {});
  var ln = LN();
  if (ln && ln.cancel) ln.cancel({ notifications: [{ id: 900 }] }).catch(function () {});
}
function focusSync(force) {
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
  var sig = t ? [t, b, when, down, grow ? grow.from + "/" + grow.dur : "", (focusBg() || {}).dark].join("|") : "";
  if (sig === ongoingSig && force !== true) return;
  ongoingSig = sig;
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
    var bg = focusBg();
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
setInterval(focusSync, 3000);
if (!focusActive())
  setTimeout(function () {
    focusSync(true);
  }, 400);
document.addEventListener("visibilitychange", function () {
  wakeOn = false;
  focusSync();
});
