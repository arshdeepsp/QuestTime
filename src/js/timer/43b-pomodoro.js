/* ---- pomodoro ----
     A full-screen page (#pomoPage, openPomo/closePomo, body.pm-open) that runs classic pomodoros on one of today's time
     quests: a focus interval (cfg.pomo.w, default 25 min), a short break (b, 5), and a long break (l, 15) every n-th
     (4) pomodoro, optionally starting the next one on its own (auto). The running session is S.pomo (device-local, in
     the session doc with the timer and sprint): {q, label, topic, phase: "work"|"break", start, end, n, done, paused,
     pausedTotal, long, breakDone, w, b, l, every, auto}; n counts finished pomodoros toward the long break. Time progresses by wall clock, so phases finish while the app
     is closed and the tick catches up on return.
     A finished focus interval is logged like a timer stop (session, topic time, quest minutes via spAdd), recorded on the
     day as e.pomo = [{q, s, e, m, ok: true}] (a stopped one logs nothing and is not recorded), and
     written onto today's schedule after the fact (pomoBlock: an ended block {pm: true} in the free parts of its span), so
     the plan shows what happened without ever planning it. Nothing here grants XP or levels of its own; the rewards are
     the quest minutes and the Trends section (progress/trends.js, pomoStats). hasEntry ignores e.pomo. */
import { G } from "../core/g.js";
import { S, dirty } from "../core/00-state.js";
import { cfg, saveCfg } from "../core/config.js";
import { add, atMin, dayWin, todayKey, weekStart } from "../core/days.js";
import { locked } from "../core/entries.js";
import { cache } from "../core/storage.js";
import { clone, esc, fmtD, hm } from "../core/util.js";
import { notifSync } from "../notifications/35d-plan.js";
import { callCheck } from "../notifications/52-taps.js";
import { activeDefs } from "../rules/quests-on-day.js";
import { schAll, schLocked, schNewId, schNorm } from "../schedule/model.js";
import { addTopicTime, defaultTopic, topicName } from "../subjects/33-topics.js";
import { stopTimer } from "./13-focus-timer.js";
import { spAdd, spFmt } from "./43-sprint.js";
import { focusSync } from "./44b-live-notification.js";
import { addSession } from "./sessions.js";
import { tomatoRows } from "./tomato.js";
import { sfx } from "../ui/01-sound.js";
import { render } from "../ui/04-render.js";
import { haptic } from "../ui/45-gestures.js";
import { setSync } from "../ui/feedback.js";
import { pageBack, pageNav, viewHash } from "../ui/routes.js";

export var PM_DEF, PM_ARM_MS, pmPg, pmPill, pmArm, pmSig, pmArtCache, pmBgCache, pmTitle0;

export function tomatoSvg(cls, pal) {
  var P = pal || { R: "#D7322A", D: "#9E1F18", H: "#F26B5E", G: "#3E8A2C", L: "#7BD35A" },
    r = "";
  tomatoRows().forEach(function (row, y) {
    for (var x = 0; x < row.length; x++) {
      var ch = row[x];
      if (ch !== ".") r += '<rect x="' + x + '" y="' + y + '" width="1" height="1" fill="' + P[ch] + '"/>';
    }
  });
  return (
    '<svg viewBox="0 0 10 11" class="' +
    (cls || "tomato") +
    '" aria-hidden="true" shape-rendering="crispEdges">' +
    r +
    "</svg>"
  );
}
export function tomatoDim() {
  return tomatoSvg("tomato dim", { R: "#8E8277", D: "#6F6459", H: "#A89A8C", G: "#7E8A74", L: "#9BAA8E" });
}
/* The big timer tomato: grey, with the red one revealed from the bottom up as pc (0–100) grows. */
export function tomatoFill(pc) {
  var hgt = (Math.max(0, Math.min(100, pc)) / 100) * 11;
  return (
    '<svg viewBox="0 0 10 11" class="pm-big" aria-hidden="true" shape-rendering="crispEdges"><defs><clipPath id="pmClip"><rect x="0" y="' +
    (11 - hgt).toFixed(2) +
    '" width="10" height="' +
    hgt.toFixed(2) +
    '"/></clipPath></defs><g>' +
    tomatoDim().replace(/^<svg[^>]*>|<\/svg>$/g, "") +
    '</g><g clip-path="url(#pmClip)">' +
    tomatoSvg("").replace(/^<svg[^>]*>|<\/svg>$/g, "") +
    "</g></svg>"
  );
}
/* Backdrop tile: a 48 × 48 field with scattered tomatoes and leaves, drawn 4× as the page background. */
export function tomatoField() {
  var o = "",
    put = function (x, y, scale, dim) {
      var P = dim
        ? { R: "#B9433B", D: "#8E2E27", H: "#CF6A61", G: "#4F7A32", L: "#6FA64E" }
        : { R: "#D7322A", D: "#9E1F18", H: "#F26B5E", G: "#3E8A2C", L: "#7BD35A" };
      tomatoRows().forEach(function (row, yy) {
        for (var xx = 0; xx < row.length; xx++) {
          var ch = row[xx];
          if (ch !== ".")
            o +=
              '<rect x="' +
              (x + xx * scale) +
              '" y="' +
              (y + yy * scale) +
              '" width="' +
              scale +
              '" height="' +
              scale +
              '" fill="' +
              P[ch] +
              '"/>';
        }
      });
    };
  o += '<rect width="48" height="48" fill="#6B3C32"/>';
  [
    [3, 5],
    [19, 29],
    [36, 12],
    [8, 38],
    [30, 41],
    [41, 32],
  ].forEach(function (p) {
    o += '<rect x="' + p[0] + '" y="' + p[1] + '" width="3" height="1" fill="#7A4A3E"/>';
  });
  put(4, 6, 1, false);
  put(28, 26, 1, false);
  put(36, 2, 1, true);
  put(10, 32, 1, true);
  return (
    'url("data:image/svg+xml,' +
    encodeURIComponent(
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" shape-rendering="crispEdges">' + o + "</svg>",
    ) +
    '")'
  );
}
/* Art for the live notification (FocusNotify's grow = {from, dur, art}): n + 1 frames of a 24 × 36 PNG, the tomato
     drawn at 2× and revealed in red from the bottom as the stages pass (full = every frame whole, for a break). The native
     side picks frame floor(p × n) and re-posts at each boundary, which is also what moves its progress bar, so one frame
     per minute keeps the bar moving. Base64 without the data: prefix, like focusArt. */
export function tomatoArt(n, full) {
  var key = n + (full ? "f" : "");
  if (pmArtCache[key]) return pmArtCache[key];
  var out = [],
    P = { R: "#D7322A", D: "#9E1F18", H: "#F26B5E", G: "#3E8A2C", L: "#7BD35A" },
    Q = { R: "#8E8277", D: "#6F6459", H: "#A89A8C", G: "#7E8A74", L: "#9BAA8E" };
  try {
    for (var s = 0; s <= n; s++) {
      var cv = document.createElement("canvas"),
        W = 24,
        H = 36;
      cv.width = W;
      cv.height = H;
      var c = cv.getContext("2d"),
        x0 = 2,
        y0 = 7,
        cut = full ? 0 : 11 - Math.round((s / n) * 11);
      tomatoRows().forEach(function (row, y) {
        for (var x = 0; x < row.length; x++) {
          var ch = row[x];
          if (ch === ".") continue;
          c.fillStyle = (y >= cut ? P : Q)[ch];
          c.fillRect(x0 + x * 2, y0 + y * 2, 2, 2);
        }
      });
      out.push(cv.toDataURL("image/png").split(",")[1] || "");
    }
  } catch (x) {
    out = [];
  }
  return (pmArtCache[key] = out);
}
/* Background for the live notification while a pomodoro runs: the page's tomato field (soil with scattered tomatoes)
     at the sizes FocusNotify's bg takes, 96 × 54 (big) and 120 × 16 (small); dark, so the text is drawn light. */
export function pomoBg() {
  if (pmBgCache) return pmBgCache;
  var P = { R: "#D7322A", D: "#9E1F18", H: "#F26B5E", G: "#3E8A2C", L: "#7BD35A" },
    Q = { R: "#B9433B", D: "#8E2E27", H: "#CF6A61", G: "#4F7A32", L: "#6FA64E" };
  function field(W, H, spots) {
    var cv = document.createElement("canvas");
    cv.width = W;
    cv.height = H;
    var c = cv.getContext("2d");
    c.fillStyle = "#6B3C32";
    c.fillRect(0, 0, W, H);
    c.fillStyle = "#7A4A3E";
    for (var i = 0; i < (W * H) / 90; i++) c.fillRect((i * 37) % W, (i * 53 + 7) % H, 3, 1);
    spots.forEach(function (sp) {
      tomatoRows().forEach(function (row, y) {
        for (var x = 0; x < row.length; x++) {
          var ch = row[x];
          if (ch === ".") continue;
          c.fillStyle = (sp[2] ? Q : P)[ch];
          c.fillRect(sp[0] + x, sp[1] + y, 1, 1);
        }
      });
    });
    return cv.toDataURL("image/png").split(",")[1] || "";
  }
  try {
    pmBgCache = {
      dark: true,
      big: field(96, 54, [
        [4, 6],
        [28, 30],
        [50, 3, 1],
        [72, 38],
        [84, 14, 1],
        [12, 40, 1],
      ]),
      small: field(120, 16, [
        [6, 3],
        [40, 2, 1],
        [74, 3],
        [104, 2, 1],
      ]),
    };
  } catch (x) {
    pmBgCache = null;
  }
  return pmBgCache;
}
export function pomoGrow(from, mins, full) {
  var n = Math.max(2, Math.min(30, Math.round(mins)));
  return mins > 0 ? { from: Math.round(from), dur: Math.round(mins * 60000), art: tomatoArt(n, !!full) } : null;
}
export function pmCfg() {
  return Object.assign({}, PM_DEF, cfg().pomo || {});
}
/* The lengths and the long-break cadence are locked while a set is under way: a pomodoro running (except the long break
     that closes a set), or today's count not at a set boundary (pomoDone % every), since a new session continues the set. */
export function pmLocked() {
  var p = S.pomo,
    c = pmCfg();
  if (p && !(p.phase === "break" && p.long)) return true;
  return !!(c.every && pomoDone(todayKey()) % c.every);
}
export function pmSet(k, v) {
  if (k !== "auto" && pmLocked()) return;
  var c = clone(cfg());
  c.pomo = Object.assign({}, PM_DEF, c.pomo || {});
  c.pomo[k] = v;
  saveCfg(c);
}
export function pmOpen() {
  return !!pmPg && !pmPg.hidden;
}
export function pmDefs() {
  return activeDefs(todayKey()).filter(function (q) {
    return q.type === "time" && !q.ign;
  });
}
export function pmLabel(id) {
  var q = pmDefs()
    .concat(cfg().quests)
    .filter(function (x) {
      return x.id === id;
    })[0];
  return q ? q.label : "Quest";
}
/* Finished pomodoros on day k: {q, s, e, m, ok: true}. Only finished ones are stored; entries with ok false (an older
     build recorded stops) are ignored everywhere. */
export function pomoOf(k) {
  return ((S.days[k] || {}).pomo || []).filter(function (p) {
    return p.ok;
  });
}
export function pomoDone(k) {
  return pomoOf(k).length;
}
export function pomoRecord(T, rec) {
  var e = Object.assign({}, S.days[T] || {});
  e.pomo = (e.pomo || []).concat([rec]);
  S.days[T] = e;
  dirty[T] = true;
  cache();
}
/* A posteriori schedule record: the finished interval becomes an ended block (pm) in whatever part of its span is free on
     today's timeline. Planned blocks already there (any quest, busy times) are left alone; a locked day keeps its copy. */
export function pomoBlock(T, s, e, qid) {
  if (schLocked(T)) return 0;
  var m0 = atMin(T, 0),
    w = dayWin(T),
    f = Math.max(w.s, Math.round((s - m0) / 60000)),
    t = Math.min(w.e, Math.round((e - m0) / 60000));
  if (t - f < 5) return 0;
  var parts = [[f, t]];
  schAll(T).forEach(function (b) {
    var nx = [];
    parts.forEach(function (p) {
      if (b.t <= p[0] || b.f >= p[1]) nx.push(p);
      else {
        if (b.f > p[0]) nx.push([p[0], b.f]);
        if (b.t < p[1]) nx.push([b.t, p[1]]);
      }
    });
    parts = nx;
  });
  parts = parts.filter(function (p) {
    return p[1] - p[0] >= 5;
  });
  if (!parts.length) return 0;
  var ent = Object.assign({}, S.days[T] || {}),
    L = schNorm(ent.sched).slice();
  parts.forEach(function (p) {
    L.push({ id: schNewId(), q: qid, f: p[0], t: p[1], pm: true });
  });
  L.sort(function (a, b) {
    return a.f - b.f;
  });
  ent.sched = L;
  S.days[T] = ent;
  dirty[T] = true;
  cache();
  return parts.length;
}
export function pmSave() {
  cache();
  notifSync();
  setTimeout(function () {
    focusSync(!S.pomo);
  }, 0);
}
export function pmArmed() {
  return pmArm && Date.now() - pmArm < PM_ARM_MS;
}
/* Start a focus interval on quest q (a running timer is stopped first; a sprint is left alone). */
export function pomoStart(q) {
  if (locked()) return false;
  if (S.timer) stopTimer();
  var c = pmCfg(),
    now = Date.now(),
    prev = S.pomo;
  /* A fresh session continues today's set, so the long break comes after the day's 4th, not the session's. */
  S.pomo = {
    q: q.id,
    label: q.label,
    topic: defaultTopic(q),
    phase: "work",
    start: now,
    end: now + c.w * 60000,
    n: c.every ? (prev ? prev.n : pomoDone(todayKey())) % c.every : prev ? prev.n : 0,
    paused: null,
    pausedTotal: 0,
    ints: 0,
    w: c.w,
    b: c.b,
    l: c.l,
    every: c.every,
    auto: !!c.auto,
  };
  pmArm = 0;
  callCheck();
  pmSave();
  /* A new set starting gets the squish; every later start in the set is one beep (back to work). */
  sfx(S.pomo.n === 0 && (c.every || !prev) ? "squish" : "beep1");
  return true;
}
/* The focus interval ran to its end: log it, record it, put it on the schedule and start the break. */
export function pomoFinish() {
  var p = S.pomo,
    T = todayKey();
  if (!p || p.phase !== "work") return;
  var s = p.end - p.w * 60000;
  addSession(T, p.q, s, p.end, true);
  if (p.topic) addTopicTime(T, p.topic, p.w);
  spAdd(p.q, p.w);
  var rec = { q: p.q, s: s, e: p.end, m: p.w, ok: true };
  if (p.topic) rec.t = p.topic;
  if (p.ints) rec.i = p.ints;
  pomoRecord(T, rec);
  pomoBlock(T, s, p.end, p.q);
  p.n++;
  p.long = !!(p.every && p.n % p.every === 0);
  p.phase = "break";
  p.bstart = p.end;
  p.bend = p.end + (p.long ? p.l : p.b) * 60000;
  p.breakDone = false;
  sfx(p.long ? "beep3" : "beep2");
  try {
    if (navigator.vibrate) navigator.vibrate([150, 80, 150]);
  } catch (x) {}
}
/* Stop early. A pomodoro is all or nothing: a stopped focus interval logs nothing to the quest (that is the point of cutting
     work into pomodoros) and isn't stored or shown anywhere; during a break it just ends the session. */
export function pomoStop() {
  var p = S.pomo;
  if (!p) return;
  if (p.phase === "work") {
    var m = Math.floor(((p.paused || Date.now()) - p.start - (p.pausedTotal || 0)) / 60000);
    setSync("Pomodoro stopped at " + hm(m) + ". Nothing logged: only a finished pomodoro counts.");
  }
  S.pomo = null;
  pmArm = 0;
  pmSave();
  render();
}
/* End the set early: a set is all or nothing too. Every pomodoro finished in the current (unfinished) set is taken back
     — its minutes off the quest, its session, its topic time and its schedule block — and its record removed, as if
     it had never run; a running pomodoro is voided with it. Nothing to take back at a set boundary. */
export function pomoSetSize() {
  var c = pmCfg();
  return c.every ? pomoDone(todayKey()) % c.every : 0;
}
export function pomoEndSet() {
  var T = todayKey(),
    n = pomoSetSize(),
    e = Object.assign({}, S.days[T] || {}),
    all = (e.pomo || []).slice(),
    keep = all.filter(function (r) {
      return !r.ok;
    }),
    done = all.filter(function (r) {
      return r.ok;
    }),
    gone = done.slice(done.length - n),
    sess = (e.sess || []).slice(),
    tt = Object.assign({}, e.tt || {}),
    sched = schNorm(e.sched).slice(),
    m0 = atMin(T, 0);
  gone.forEach(function (r) {
    e[r.q] = Math.max(0, (e[r.q] | 0) - r.m);
    sess = sess.filter(function (z) {
      return !(z.id === r.q && z.s === r.s && z.e === r.e);
    });
    if (r.t && tt[r.t]) {
      tt[r.t] = Math.max(0, tt[r.t] - r.m);
      if (!tt[r.t]) delete tt[r.t];
    }
    var f = Math.round((r.s - m0) / 60000),
      t = Math.round((r.e - m0) / 60000);
    sched = sched.filter(function (b) {
      return !(b.pm && b.q === r.q && b.f >= f - 1 && b.t <= t + 1);
    });
  });
  if (n) {
    e.pomo = keep.concat(done.slice(0, done.length - n));
    if (!e.pomo.length) delete e.pomo;
    if (sess.length) e.sess = sess;
    else delete e.sess;
    if (Object.keys(tt).length) e.tt = tt;
    else delete e.tt;
    if (sched.length) e.sched = sched;
    else delete e.sched;
    S.days[T] = e;
    dirty[T] = true;
    cache();
  }
  S.pomo = null;
  pmArm = 0;
  pmSave();
  render();
  setSync(n ? "Set ended early: " + n + " pomodoro" + (n === 1 ? "" : "s") + " taken back." : "Set ended.");
}
export function pomoSkipBreak() {
  var p = S.pomo;
  if (!p || p.phase !== "break") return;
  p.breakDone = true;
  p.bend = Date.now();
  pmSave();
}
export function pomoNext() {
  var p = S.pomo;
  if (!p || p.phase !== "break") return;
  var q = pmDefs().filter(function (x) {
    return x.id === p.q;
  })[0];
  if (!q) {
    S.pomo = null;
    pmSave();
    setSync(p.label + " isn’t on today’s list any more.");
    return;
  }
  pomoStart(q);
}
export function pomoPause() {
  var p = S.pomo;
  if (!p || p.phase !== "work") return;
  if (p.paused) {
    var d = Date.now() - p.paused;
    p.end += d;
    p.pausedTotal = (p.pausedTotal || 0) + d;
    p.paused = null;
  } else p.paused = Date.now();
  pmSave();
}
export function pomoTick() {
  var p = S.pomo;
  if (p) {
    var now = Date.now(),
      ch = false;
    if (p.phase === "work" && !p.paused && now >= p.end) {
      pomoFinish();
      ch = true;
    }
    if (p.phase === "break" && !p.breakDone && now >= p.bend) {
      p.breakDone = true;
      ch = true;
      sfx("beep1");
      try {
        if (navigator.vibrate) navigator.vibrate([100, 60, 100]);
      } catch (x) {}
      if (p.auto) {
        pomoNext();
        ch = false;
      }
    }
    if (ch) pmSave();
  }
  pmPillSync();
  pmTitleSync();
  if (pmOpen()) pmDraw();
}
/* The browser tab shows the countdown while a pomodoro runs ("24:59 · QuestTime", "Break 4:30 · QuestTime"). */
export function pmTitleSync() {
  var p = S.pomo,
    t = p
      ? p.phase === "work"
        ? (p.paused ? "Paused " : "") + spFmt(p.end - (p.paused || Date.now()))
        : p.breakDone
          ? "Break over"
          : "Break " + spFmt(p.bend - Date.now())
      : "";
  var want = t ? t + " \u00b7 " + pmTitle0 : pmTitle0;
  if (document.title !== want) document.title = want;
}
export function pmPillSync() {
  var p = S.pomo;
  if (!p || pmOpen()) {
    pmPill.hidden = true;
    return;
  }
  pmPill.hidden = false;
  pmPill.innerHTML =
    tomatoSvg("tomato") +
    (p.phase === "work"
      ? (p.paused ? "Paused · " : "") + spFmt(p.end - (p.paused || Date.now()))
      : p.breakDone
        ? "Break over"
        : "Break " + spFmt(p.bend - Date.now()));
}
/* Weekly figures for the header and the page. */
export function pomoWeek(T) {
  var ws = weekStart(T),
    n = 0;
  for (var d = ws; d <= T; d = add(d, 1)) n += pomoDone(d);
  return n;
}
export function openPomo() {
  if (locked()) return;
  if (!pmPg) {
    pmPg = document.createElement("div");
    pmPg.id = "pomoPage";
    pmPg.className = "pmpage";
    pmPg.setAttribute("role", "dialog");
    pmPg.setAttribute("aria-modal", "true");
    pmPg.setAttribute("aria-labelledby", "pmTitle");
    pmPg.innerHTML =
      '<div class="pm-hd"><div class="pm-hdt"><h2 id="pmTitle">Pomodoro</h2><p class="pm-sum" id="pmSum"></p></div><button type="button" class="stone save" id="pmOk">Done</button></div><div class="pm-scroll" id="pmScroll"><div class="pm-body" id="pmBody"></div></div><div class="pm-ft" id="pmFt"></div>';
    pmPg.querySelector("#pmScroll").style.backgroundImage = tomatoField();
    document.body.appendChild(pmPg);
    pmPg.querySelector("#pmOk").addEventListener("click", closePomo);
    pmPg.addEventListener("click", pmClick);
    pmPg.addEventListener("change", pmChange);
  }
  pmPg.hidden = false;
  document.body.classList.add("pm-open");
  pmSig = "";
  pmPill.hidden = true;
  pmDraw();
  pageNav("#pomodoro");
}
export function closePomo() {
  if (!pmPg) return;
  pmPg.hidden = true;
  document.body.classList.remove("pm-open");
  pmPillSync();
  render();
  if (location.hash === "#pomodoro") pageBack(viewHash());
}
export function pmClick(ev) {
  var b = ev.target.closest("[data-pm]");
  if (!b) return;
  var a = b.getAttribute("data-pm"),
    p = S.pomo;
  if (a === "start") {
    var id = G.pmQ || (pmDefs()[0] || {}).id,
      q = pmDefs().filter(function (x) {
        return x.id === id;
      })[0];
    if (!q) {
      setSync("Pomodoros need a Time quest on today’s list.");
      return;
    }
    if (p && p.phase === "break") {
      p.q = q.id;
      p.label = q.label;
    }
    pomoStart(q);
    haptic("medium", true);
  } else if (a === "q") {
    G.pmQ = b.getAttribute("data-q");
    if (p && p.phase === "break") {
      var q2 = pmDefs().filter(function (x) {
        return x.id === G.pmQ;
      })[0];
      if (q2) {
        p.q = q2.id;
        p.label = q2.label;
        pmSave();
      }
    }
    haptic("light");
  } else if (a === "int") {
    /* Interruption tally (Cirillo's tick marks): counted, never a reason to stop. */
    if (p && p.phase === "work") {
      p.ints = (p.ints | 0) + 1;
      pmSave();
    }
    haptic("light");
  } else if (a === "pause") pomoPause();
  else if (a === "stop") {
    if (!pmArmed()) {
      pmArm = Date.now();
      haptic("light");
    } else pomoStop();
  } else if (a === "endset") {
    if (!pmArmed()) {
      pmArm = Date.now();
      haptic("light");
    } else pomoEndSet();
  } else if (a === "skip") pomoSkipBreak();
  else if (a === "end") pomoStop();
  else if (a === "auto") pmSet("auto", !pmCfg().auto);
  pmSig = "";
  pmDraw();
}
export function pmChange(ev) {
  var s = ev.target.closest("select[data-pk]");
  if (!s) return;
  pmSet(s.getAttribute("data-pk"), +s.value);
  pmSig = "";
  pmDraw();
}
export function pmSel(k, vals, cur, unit, dis) {
  return (
    '<select data-pk="' +
    k +
    '" aria-label="' +
    k +
    '"' +
    (dis ? " disabled" : "") +
    ">" +
    vals
      .map(function (v) {
        return (
          '<option value="' +
          v +
          '"' +
          (v === cur ? " selected" : "") +
          ">" +
          (unit === "n" ? (v ? "every " + v : "never") : v + " min") +
          "</option>"
        );
      })
      .join("") +
    "</select>"
  );
}
export function pmDraw() {
  if (!pmOpen()) return;
  var p = S.pomo,
    T = todayKey(),
    now = Date.now(),
    c = pmCfg(),
    defs = pmDefs(),
    today = pomoDone(T),
    week = pomoWeek(T),
    e = S.days[T] || {};
  if (
    !G.pmQ ||
    !defs.some(function (x) {
      return x.id === G.pmQ;
    })
  )
    G.pmQ = p ? p.q : defs[0] ? defs[0].id : null;
  var cur = p ? p.q : G.pmQ,
    kick,
    big,
    time,
    sub = "";
  if (p && p.phase === "work") {
    var left = p.end - (p.paused || now),
      pc = 100 - (left / (p.w * 60000)) * 100;
    kick = (p.paused ? "Paused · " : "Focus · ") + "pomodoro " + (p.n + 1) + (p.every ? " of " + p.every : "");
    big = tomatoFill(pc);
    time = spFmt(left);
    sub = esc(p.label) + (p.topic && topicName(p.topic) ? " · " + esc(topicName(p.topic)) : "");
  } else if (p && p.phase === "break") {
    kick = p.breakDone ? "Break over" : p.long ? "Long break" : "Short break";
    big = tomatoFill(100);
    time = p.breakDone ? "Ready" : spFmt(p.bend - now);
    sub = p.breakDone
      ? "Next: " + esc(pmLabel(cur))
      : p.long
        ? "Stand up, walk, drink water."
        : "Eyes off the screen for a bit.";
  } else {
    kick = today ? today + " today" : "Ready";
    big = tomatoFill(0);
    time = c.w + ":00";
    sub = defs.length ? "Pick a quest and start" : "No Time quest on today’s list";
  }
  var lk = pmLocked(),
    wipeN = pomoSetSize() + (p && p.phase === "work" ? 1 : 0),
    tally = "";
  for (var i = 0; i < Math.max(c.every || 4, today); i++) tally += i < today ? tomatoSvg("tomato") : tomatoDim();
  var log = pomoOf(T)
    .slice()
    .reverse()
    .slice(0, 12)
    .map(function (r) {
      var d = new Date(r.s);
      return (
        '<li class="ok">' +
        tomatoSvg("tomato") +
        "<span>" +
        String(d.getHours()).padStart(2, "0") +
        ":" +
        String(d.getMinutes()).padStart(2, "0") +
        " · " +
        esc(pmLabel(r.q)) +
        "</span><em>" +
        hm(r.m) +
        (r.i ? " \u00b7 " + r.i + " interrupt" + (r.i === 1 ? "" : "s") : "") +
        "</em></li>"
      );
    })
    .join("");
  var h =
    '<div class="pm-card' +
    (p ? " live " + p.phase : "") +
    '"><div class="pm-k">' +
    kick +
    '</div><div class="pm-art">' +
    big +
    '</div><div class="pm-time">' +
    time +
    '</div><div class="pm-sub">' +
    sub +
    '</div><div class="pm-tally" aria-label="' +
    today +
    ' pomodoros today">' +
    tally +
    "</div></div>" +
    (!p || p.phase === "break"
      ? '<div class="pm-pick"><div class="sh2">' +
        (p ? "Next pomodoro on" : "Quest") +
        '</div><div class="pm-qs">' +
        (defs.length
          ? defs
              .map(function (q) {
                return (
                  '<button type="button" class="stone mini pm-q' +
                  (q.id === cur ? " on" : "") +
                  '" data-pm="q" data-q="' +
                  q.id +
                  '" aria-pressed="' +
                  (q.id === cur) +
                  '">' +
                  esc(q.label) +
                  " <small>" +
                  hm(e[q.id] | 0) +
                  "</small></button>"
                );
              })
              .join("")
          : '<p class="help">Add a Time quest to run pomodoros on it.</p>') +
        "</div></div>"
      : "") +
    '<details class="pm-set"' +
    (p ? "" : " open") +
    "><summary>Set up · " +
    c.w +
    "/" +
    c.b +
    (c.every ? " · long " + c.l + " every " + c.every : "") +
    (c.auto ? " · auto" : "") +
    '</summary><div class="pm-rows"><label>Focus' +
    pmSel("w", [15, 20, 25, 30, 45, 50], c.w, null, lk) +
    "</label><label>Short break" +
    pmSel("b", [3, 5, 10, 15], c.b, null, lk) +
    "</label><label>Long break" +
    pmSel("l", [10, 15, 20, 30, 45, 60], c.l, null, lk) +
    "</label><label>Long break" +
    pmSel("every", [0, 2, 3, 4, 5], c.every, "n", lk) +
    "</label></div>" +
    (lk
      ? '<p class="help pm-lock">Locked until this set ends' +
        (c.every ? " \u00b7 " + (c.every - (pomoDone(T) % c.every)) + " of " + c.every + " to go" : "") +
        '</p><div class="pm-row"><span>End the set early? Everything in it is taken back: ' +
        wipeN +
        " pomodoro" +
        (wipeN === 1 ? "" : "s") +
        '.</span><button type="button" class="stone del mini" data-pm="endset">' +
        (pmArmed() ? "Wipe set?" : "End set") +
        "</button></div>"
      : "") +
    '<div class="pm-row"><span>Start the next pomodoro when the break ends</span><button type="button" class="sw" role="switch" aria-checked="' +
    !!c.auto +
    '" aria-label="Auto-start next pomodoro" data-pm="auto"><span></span></button></div><p class="help">Lengths are set for a whole set of pomodoros. All or nothing: stop early and nothing is logged.</p></details>' +
    '<div class="pm-log"><div class="sh2">Today</div>' +
    (log
      ? '<ul class="pm-list">' + log + "</ul>"
      : '<p class="help">Nothing yet. Finished pomodoros show up here and on today’s schedule.</p>') +
    "</div>";
  var ft;
  if (p && p.phase === "work")
    ft =
      '<div class="pm-acts"><button type="button" class="stone" data-pm="int" aria-label="Count an interruption">+ Interrupted' +
      (p.ints ? " (" + p.ints + ")" : "") +
      '</button><button type="button" class="stone" data-pm="pause">' +
      (p.paused ? "Resume" : "Pause") +
      '</button><button type="button" class="stone del" data-pm="stop">' +
      (pmArmed() ? "Stop? Nothing logged" : "Stop") +
      "</button></div>";
  else if (p && p.phase === "break")
    ft =
      '<div class="pm-acts"><button type="button" class="stone save" data-pm="start"' +
      (p.breakDone ? "" : " hidden") +
      ">Start pomodoro " +
      ((p.every ? p.n % p.every : p.n) + 1) +
      '</button><button type="button" class="stone" data-pm="skip"' +
      (p.breakDone ? " hidden" : "") +
      '>Skip break</button><button type="button" class="stone del" data-pm="end">End session</button></div>';
  else
    ft =
      '<div class="pm-acts"><button type="button" class="stone save" data-pm="start"' +
      (defs.length ? "" : " disabled") +
      ">Start " +
      c.w +
      "-min pomodoro</button></div>";
  var sum = (today ? today + " today" : "None today") + " · " + week + " this week";
  var sig = [h, ft, sum].join("|");
  if (sig === pmSig) return;
  /* Set up stays as the user left it across redraws, but folds when a pomodoro starts and opens again when idle. */
  var set = pmPg.querySelector(".pm-set"),
    ph = p ? p.phase : "idle",
    wasOpen = set && ph === G.pmPhase ? set.open : null;
  G.pmPhase = ph;
  pmSig = sig;
  pmPg.querySelector("#pmSum").textContent = sum;
  pmPg.querySelector("#pmBody").innerHTML = h;
  pmPg.querySelector("#pmFt").innerHTML = ft;
  if (wasOpen !== null) pmPg.querySelector(".pm-set").open = wasOpen;
}
/* Pomodoro figures for Trends (progress/trends.js): counts, streaks and the 14-day garden. */
export function pomoStats(T) {
  var ws0 = weekStart(T),
    nIn = 0,
    thisW = 0,
    lastW = 0,
    bestDay = 0,
    bestDayK = null,
    total = 0,
    minutes = 0,
    chain = 0,
    ints30 = 0,
    n30 = 0,
    days14 = [],
    dayRun = 0;
  for (var d = ws0; d <= T; d = add(d, 1)) {
    nIn++;
    thisW += pomoDone(d);
    lastW += pomoDone(add(d, -7));
  }
  Object.keys(S.days).forEach(function (k) {
    if (k > T) return;
    var L = pomoOf(k),
      n = 0,
      run = 0,
      lastEnd = 0;
    L.forEach(function (r) {
      if (k >= add(T, -29)) {
        n30++;
        ints30 += r.i | 0;
      }
      n++;
      total++;
      minutes += r.m | 0;
      /* back to back: the next one started within a long break of this one ending */
      run = run && r.s - lastEnd <= 65 * 60000 ? run + 1 : 1;
      lastEnd = r.e;
      if (run > chain) chain = run;
    });
    if (n > bestDay) {
      bestDay = n;
      bestDayK = k;
    }
  });
  for (var i = 13; i >= 0; i--) days14.push(pomoDone(add(T, -i)));
  /* Days in a row with at least one finished pomodoro, counted back from today (or from yesterday while today has none). */
  for (var k2 = pomoDone(T) ? T : add(T, -1); pomoDone(k2) > 0 && dayRun < 1000; k2 = add(k2, -1)) dayRun++;
  return {
    thisW: thisW,
    lastW: lastW,
    nIn: nIn,
    bestDay: bestDay,
    bestDayK: bestDayK,
    total: total,
    minutes: minutes,
    chain: chain,
    ints30: ints30,
    n30: n30,
    days14: days14,
    dayRun: dayRun,
  };
}
/* Trends section: a tomato garden (one tomato per finished pomodoro, by day, two weeks), the week's count against last
     week, and records — milestones rather than XP. */
export function pomoTrendsHtml(T) {
  var s = pomoStats(T),
    dW = s.thisW - s.lastW,
    mx = Math.max(1, Math.max.apply(null, s.days14)),
    labs = [];
  for (var i = 13; i >= 0; i--)
    labs.push(new Date(atMin(add(T, -i), 720)).toLocaleDateString("en-CA", { weekday: "narrow" }));
  var next = [10, 25, 50, 100, 250, 500, 1000].filter(function (m) {
    return m > s.total;
  })[0];
  function tile(col, label, big, sub, cls) {
    return (
      '<div class="ttile pm-tile" style="--tc:' +
      col +
      '"><div class="tt-i">' +
      tomatoSvg("tomato") +
      '</div><div class="tt-b"><div class="tt-l">' +
      label +
      '</div><div class="tt-v">' +
      big +
      "</div>" +
      (sub ? '<div class="tt-s ' + (cls || "") + '">' + sub + "</div>" : "") +
      "</div></div>"
    );
  }
  var garden =
    '<div class="pm-garden" role="img" aria-label="Pomodoros per day, last 14 days">' +
    s.days14
      .map(function (n, i) {
        var col = "";
        for (var j = 0; j < Math.min(n, 12); j++) col += tomatoSvg("tomato");
        return (
          '<div class="pm-gcol' +
          (i === 13 ? " today" : "") +
          '"><div class="pm-gstack" style="--n:' +
          Math.min(n, 12) +
          ";--mx:" +
          Math.min(mx, 12) +
          '">' +
          col +
          '</div><span class="pm-gn">' +
          (n || "") +
          '</span><span class="pm-gl">' +
          labs[i] +
          "</span></div>"
        );
      })
      .join("") +
    "</div>";
  return (
    '<div class="tsec"><div class="tsec-h">Pomodoro</div><div class="tgrid">' +
    tile(
      "#C0392B",
      "This week",
      s.thisW,
      s.lastW || s.thisW
        ? dW === 0
          ? "Same as last week"
          : (dW > 0 ? "▲ " + dW : "▼ " + -dW) + " vs last week"
        : "Run one to start the count",
      dW > 0 ? "up" : dW < 0 ? "dn" : "",
    ) +
    tile(
      "#B8860B",
      "Days in a row",
      s.dayRun,
      s.dayRun ? (pomoDone(T) ? "including today" : "today still open") : "a day with one pomodoro counts",
    ) +
    tile("#16A085", "Best day", s.bestDay || "—", s.bestDayK ? fmtD(s.bestDayK) : "") +
    tile("#8A3A9E", "Longest chain", s.chain || "—", s.chain ? "finished back to back" : "") +
    tile(
      "#2C6FB0",
      "Interruptions",
      s.n30 ? (Math.round((s.ints30 / s.n30) * 10) / 10).toString() : "—",
      s.n30 ? "per pomodoro, 30 days" : "tap + Interrupted while one runs",
    ) +
    tile(
      "#3C8527",
      "Harvest",
      s.total,
      s.total ? hm(s.minutes) + " of focus" + (next ? " · " + (next - s.total) + " more to " + next : "") : "all time",
    ) +
    '</div><div class="trcard pm-gcard"><div class="sh2">Tomato garden, last 14 days</div>' +
    (s.days14.some(function (n) {
      return n > 0;
    })
      ? garden
      : '<p class="help light">Each finished pomodoro plants a tomato here.</p>') +
    "</div></div>"
  );
}

/* Runs once at startup, in file-number order (main.js). */
export function init() {
  PM_DEF = { w: 25, b: 5, l: 15, every: 4, auto: false };
  /* The page redraws every second while a pomodoro runs, so Stop's "Stop? Not counted" arming lives outside the markup
     (pmArm = when it was armed, good for PM_ARM_MS), like the sprint's. */
  pmArm = 0;
  PM_ARM_MS = 4000;
  pmSig = "";
  pmArtCache = {};
  pmBgCache = null;
  G.pmQ = null;
  G.pmPhase = null;
  pmTitle0 = document.title;
  pmPill = document.getElementById("pmPill");
  pmPill.addEventListener("click", openPomo);
  setInterval(pomoTick, 1000);
  /* A pomodoro that ended while the app was dead is finished by the first tick, which logs, renders and writes the
     schedule — all of which need modules that init after this one, so the catch-up waits for every init to run. */
  if (S.pomo) {
    pmPillSync();
    setTimeout(pomoTick, 0);
  }
}
