/* ---- sprint / marathon mode ---- */
import { G } from "../core/g.js";
import { MAXM, S, dirty } from "../core/00-state.js";
import { cfg } from "../core/config.js";
import { todayKey } from "../core/days.js";
import { locked } from "../core/entries.js";
import { cache, flush } from "../core/storage.js";
import { esc, hm } from "../core/util.js";
import { notifSync } from "../notifications/35d-plan.js";
import { callCheck } from "../notifications/52-taps.js";
import { planOf } from "../rules/day-rules.js";
import { activeDefs } from "../rules/quests-on-day.js";
import { STYLES } from "../settings/27-work-styles.js";
import { addTopicTime, topicName, topicSelect } from "../subjects/33-topics.js";
import { stopTimer } from "./13-focus-timer.js";
import { focusSync } from "./44b-live-notification.js";
import { addSession } from "./sessions.js";
import { parkAdd } from "../tools/park-it.js";
import { sfx } from "../ui/01-sound.js";
import { render } from "../ui/04-render.js";
import { closeG, openG } from "../ui/18-modal.js";
import { setSync } from "../ui/feedback.js";

export var spEl, spBody, spPill, spMin, SP_BREAK, SP_LONG, spArm, SP_ARM_MS;

export function spDefs() {
  return activeDefs(todayKey()).filter(function (q) {
    return q.type === "time";
  });
}
export function spTarget(q, e) {
  return cfg().showPlan ? planOf(q, e) : q.min;
}
export function spSuggest(ids, lastId) {
  var T = todayKey(),
    e = S.days[T] || {},
    defs = spDefs().filter(function (q) {
      return ids.indexOf(q.id) >= 0;
    }),
    pool = defs.filter(function (q) {
      return defs.length < 2 || q.id !== lastId;
    });
  if (!pool.length) pool = defs;
  pool.sort(function (a, b) {
    var da = spTarget(a, e) - (e[a.id] | 0),
      db = spTarget(b, e) - (e[b.id] | 0);
    if (da !== db) return db - da;
    return (e[a.id] | 0) - (e[b.id] | 0);
  });
  return pool[0] ? pool[0].id : null;
}
export function spLabel(id) {
  var q = spDefs()
    .concat(cfg().quests)
    .filter(function (x) {
      return x.id === id;
    })[0];
  return q ? q.label : "Quest";
}
export function spAdd(id, m) {
  if (m < 1) return 0;
  var T = todayKey();
  var e = Object.assign({}, S.days[T] || {});
  e.q = activeDefs(T);
  if (
    !e.q.some(function (x) {
      return x.id === id;
    })
  )
    return 0;
  e[id] = Math.min(MAXM, (e[id] | 0) + m);
  S.days[T] = e;
  dirty[T] = true;
  cache();
  clearTimeout(G.timer);
  G.timer = setTimeout(flush, 300);
  render(true);
  return m;
}
export function spFmt(ms) {
  ms = Math.max(0, ms);
  var s = Math.ceil(ms / 1000),
    h = Math.floor(s / 3600),
    m = Math.floor((s % 3600) / 60),
    x = s % 60;
  return (h ? h + ":" + String(m).padStart(2, "0") : m) + ":" + String(x).padStart(2, "0");
}
export function spSave() {
  cache();
  notifSync();
  setTimeout(function () {
    if (typeof focusSync === "function") focusSync(!S.sprint || S.sprint.phase === "done");
  }, 0);
}
export function openSprintSetup() {
  if (locked()) {
    setSync("This day is locked.");
    return;
  }
  if (S.sprint) {
    spShow();
    return;
  }
  var defs = spDefs();
  if (!defs.length) {
    setSync("Sprints need at least one Time quest today.");
    return;
  }
  var e = S.days[todayKey()] || {},
    sel = defs.map(function (q) {
      return q.id;
    });
  openG("Start a sprint", function (b) {
    function draw(msg) {
      var sug = spSuggest(sel, null);
      b.innerHTML =
        '<div class="ed"><p class="help">Focus blocks on your time quests, with a 15-minute decision break between each. Minutes are logged automatically.</p><p class="sh2">Quests to rotate</p><div class="sp-q">' +
        defs
          .map(function (q) {
            var on = sel.indexOf(q.id) >= 0;
            return (
              '<button type="button" class="stone mini' +
              (on ? " on" : "") +
              '" data-sq="' +
              q.id +
              '" aria-pressed="' +
              on +
              '">' +
              esc(q.label) +
              " <small>" +
              hm(e[q.id] | 0) +
              "/" +
              hm(spTarget(q, e)) +
              "</small></button>"
            );
          })
          .join("") +
        "</div>" +
        '<div class="edrow"><label>Block length<select id="spLen">' +
        [25, 45, 50, 60, 90, 105, 120]
          .map(function (v) {
            return (
              '<option value="' +
              v +
              '"' +
              (v === (S.spLen || (STYLES[cfg().style] || {}).len || 105) ? " selected" : "") +
              ">" +
              hm(v) +
              "</option>"
            );
          })
          .join("") +
        '</select></label><label>Blocks<select id="spRounds">' +
        [
          [2, "2"],
          [3, "3"],
          [4, "4"],
          [6, "6 (marathon)"],
          [8, "8 (marathon)"],
          [0, "Until I stop"],
        ]
          .map(function (o) {
            return (
              '<option value="' +
              o[0] +
              '"' +
              (o[0] === (S.spRounds == null ? 3 : S.spRounds) ? " selected" : "") +
              ">" +
              o[1] +
              "</option>"
            );
          })
          .join("") +
        "</select></label></div>" +
        '<div class="edrow"><button type="button" class="stone mini' +
        (S.spLongOn !== false ? " on" : "") +
        '" id="spLong" aria-pressed="' +
        (S.spLongOn !== false) +
        '">30-min break every 4 blocks</button></div>' +
        topicSelect("spTopic", "") +
        '<p class="help">First up: <b>' +
        (sug ? esc(spLabel(sug)) : "pick a quest") +
        '</b> (furthest behind). Breaks are 15 minutes and can\u2019t be skipped.</p><p class="cmsg2">' +
        esc(msg || "") +
        '</p><div class="edrow end"><button type="button" class="stone" id="spCancel">Cancel</button><button type="button" class="stone save" id="spGo"' +
        (sel.length ? "" : " disabled") +
        ">Start first block</button></div></div>";
      b.querySelectorAll("[data-sq]").forEach(function (x) {
        x.addEventListener("click", function () {
          var id = x.getAttribute("data-sq"),
            i = sel.indexOf(id);
          if (i >= 0) sel.splice(i, 1);
          else sel.push(id);
          draw();
        });
      });
      b.querySelector("#spLong").addEventListener("click", function () {
        S.spLongOn = S.spLongOn === false;
        draw();
      });
      b.querySelector("#spLen").addEventListener("change", function () {
        S.spLen = +this.value;
      });
      b.querySelector("#spRounds").addEventListener("change", function () {
        S.spRounds = +this.value;
      });
      b.querySelector("#spCancel").addEventListener("click", closeG);
      b.querySelector("#spGo").addEventListener("click", function () {
        if (!sel.length) {
          draw("Pick at least one quest.");
          return;
        }
        var lenC = +b.querySelector("#spLen").value,
          roundsC = +b.querySelector("#spRounds").value,
          tselC = b.querySelector("#spTopic"),
          topicC = tselC ? tselC.value || null : null;
        closeG();
        (function (fstep) {
          if (S.timer) stopTimer();
          var len = lenC,
            rounds = roundsC,
            now = Date.now(),
            first = spSuggest(sel, null);
          S.spLen = len;
          S.spRounds = rounds;
          S.sprint = {
            firstStep: fstep || null,
            topic: topicC,
            ids: sel.slice(),
            len: len,
            rounds: rounds,
            longEvery: S.spLongOn === false ? 0 : 4,
            phase: "focus",
            cur: first,
            block: 1,
            start: now,
            end: now + len * 60000,
            paused: null,
            log: {},
            next: null,
          };
          spSave();
          spMin = false;
          spShow();
          sfx("base");
          callCheck();
        })("");
      });
    }
    draw();
  });
}
export function spShow() {
  if (!S.sprint) return;
  spMin = false;
  spEl.hidden = false;
  spPill.hidden = true;
  spRender();
}
export function spHide() {
  spMin = true;
  spEl.hidden = true;
  spPill.hidden = !S.sprint;
  spRender();
}
export function spFinish(logPartial) {
  var sp = S.sprint;
  if (!sp) return;
  if (logPartial && sp.phase === "focus") {
    var el = (sp.paused || Date.now()) - sp.start - (sp.pausedTotal || 0),
      m = Math.floor(el / 60000);
    if (m > 0) {
      if (sp.topic) addTopicTime(todayKey(), sp.topic, m);
      var got = spAdd(sp.cur, m);
      sp.log[sp.cur] = (sp.log[sp.cur] || 0) + got;
    }
  }
  sp.phase = "done";
  spSave();
  spShow();
}
export function spTick() {
  var sp = S.sprint;
  if (!sp) {
    spEl.hidden = true;
    spPill.hidden = true;
    return;
  }
  var now = Date.now(),
    changed = false;
  if (sp.phase === "focus" && !sp.paused && now >= sp.end) {
    var blk = sp.blen || sp.len;
    addSession(todayKey(), sp.cur, sp.end - blk * 60000, sp.end);
    if (sp.topic) addTopicTime(todayKey(), sp.topic, blk);
    var got = spAdd(sp.cur, blk);
    sp.blen = 0;
    sp.log[sp.cur] = (sp.log[sp.cur] || 0) + got;
    var last = sp.rounds && sp.block >= sp.rounds;
    if (last) {
      sp.phase = "done";
    } else {
      var lb = sp.longEvery && sp.block % sp.longEvery === 0;
      sp.phase = "break";
      sp.bstart = sp.end;
      sp.bend = sp.end + (lb ? SP_LONG : SP_BREAK) * 60000;
      sp.long = !!lb;
      sp.prev = sp.cur;
      sp.next = spSuggest(sp.ids, sp.cur);
    }
    changed = true;
    sfx("chime");
    try {
      if (navigator.vibrate) navigator.vibrate([150, 80, 150]);
    } catch (x) {}
    if (spMin) spShow();
  }
  if (sp.phase === "break" && !sp.breakDone && now >= sp.bend) {
    sp.breakDone = true;
    changed = true;
    sfx("chime");
    try {
      if (navigator.vibrate) navigator.vibrate([100, 60, 100]);
    } catch (x) {}
    if (spMin) spShow();
  }
  if (changed) {
    spSave();
    notifSync();
  }
  spRender();
}
export function spArmed() {
  return spArm && Date.now() - spArm < SP_ARM_MS;
}
export function spRender() {
  var sp = S.sprint;
  if (!sp) return;
  var now = Date.now(),
    T = todayKey(),
    e = S.days[T] || {};
  var pillTxt =
    sp.phase === "focus"
      ? (sp.paused ? "Paused \u00b7 " : "\u25cf ") + spLabel(sp.cur) + " " + spFmt(sp.end - (sp.paused || now))
      : sp.phase === "break"
        ? sp.breakDone
          ? "Break over \u00b7 start next"
          : "Break " + spFmt(sp.bend - now)
        : "Sprint done";
  spPill.textContent = pillTxt;
  if (spEl.hidden) return;
  var h = "";
  if (sp.phase === "focus") {
    var tot = sp.len * 60000,
      left = sp.end - (sp.paused || now),
      pc = Math.max(0, Math.min(100, 100 - (left / tot) * 100));
    h =
      '<div class="sp-k">Focus \u00b7 block ' +
      sp.block +
      (sp.rounds ? " of " + sp.rounds : "") +
      '</div><div class="sp-q1">' +
      esc(spLabel(sp.cur)) +
      (sp.topic ? '<small class="sp-tp">' + esc(topicName(sp.topic)) + "</small>" : "") +
      (sp.firstStep && sp.block === 1 && !sp.extended
        ? '<small class="sp-tp">First step: ' + esc(sp.firstStep) + "</small>"
        : "") +
      '</div><div class="sp-time">' +
      spFmt(left) +
      '</div><div class="sp-bar"><i style="width:' +
      pc.toFixed(1) +
      '%"></i></div>' +
      spParkHtml() +
      '<div class="edrow end"><button type="button" class="stone" id="spMinB">Minimize</button><button type="button" class="stone" id="spPause">' +
      (sp.paused ? "Resume" : "Pause") +
      '</button><button type="button" class="stone del" id="spStop">' +
      (spArmed() ? "Confirm stop" : "Stop sprint") +
      "</button></div>";
  } else if (sp.phase === "break") {
    var defs = spDefs().filter(function (q) {
      return sp.ids.indexOf(q.id) >= 0;
    });
    var canExt = !sp.extended && now < sp.bstart + 5 * 60000;
    h =
      '<div class="sp-k">' +
      (sp.long ? "Long break" : "Decision break") +
      " \u00b7 next: block " +
      (sp.block + 1) +
      (sp.rounds ? " of " + sp.rounds : "") +
      '</div><div class="sp-time' +
      (sp.breakDone ? " ok" : "") +
      '">' +
      (sp.breakDone ? "Ready" : spFmt(sp.bend - now)) +
      '</div><p class="help">Stand up, stretch, decide what\u2019s next. Suggested: the quest furthest behind.</p>' +
      (canExt
        ? '<div class="edrow"><button type="button" class="stone save" id="spFlow">In flow? +30 min on ' +
          esc(spLabel(sp.prev)) +
          "</button></div>"
        : "") +
      spParkHtml() +
      '<div class="sp-list">' +
      defs
        .map(function (q) {
          var d = e[q.id] | 0,
            t = spTarget(q, e),
            pc = Math.min(100, Math.round((d / Math.max(1, t)) * 100)),
            on = sp.next === q.id;
          return (
            '<button type="button" class="sp-opt' +
            (on ? " on" : "") +
            '" data-sn="' +
            q.id +
            '" role="radio" aria-checked="' +
            on +
            '"><span class="sp-n">' +
            esc(q.label) +
            (q.id === sp.prev ? " <em>just did</em>" : "") +
            '</span><span class="sp-v">' +
            hm(d) +
            " / " +
            hm(t) +
            '</span><span class="sp-pb"><i style="width:' +
            pc +
            '%"></i></span></button>'
          );
        })
        .join("") +
      "</div>" +
      topicSelect("spNextTopic", sp.nextTopic || "") +
      '<div class="edrow end"><button type="button" class="stone" id="spMinB">Minimize</button><button type="button" class="stone del" id="spStop">' +
      (spArmed() ? "Confirm end" : "End sprint") +
      '</button><button type="button" class="stone save" id="spNext"' +
      (sp.breakDone && sp.next ? "" : " disabled") +
      ">" +
      (sp.breakDone ? "Start block" : "Start in " + spFmt(sp.bend - now)) +
      "</button></div>";
  } else {
    var ids = Object.keys(sp.log),
      total = ids.reduce(function (a, k) {
        return a + sp.log[k];
      }, 0);
    h =
      '<div class="sp-k">Sprint complete</div><div class="sp-time ok">' +
      hm(total) +
      '</div><p class="help">Logged to today\u2019s quests:</p><div class="sp-list">' +
      (ids.length
        ? ids
            .map(function (k) {
              return (
                '<div class="sp-opt"><span class="sp-n">' +
                esc(spLabel(k)) +
                '</span><span class="sp-v">+' +
                hm(sp.log[k]) +
                "</span></div>"
              );
            })
            .join("")
        : '<p class="help">Nothing was logged.</p>') +
      '</div><div class="edrow end"><button type="button" class="stone save" id="spDone">Close</button></div>';
  }
  if (spBody.getAttribute("data-sig") !== h) {
    var pi = spBody.querySelector("#parkIn"),
      pv = pi ? pi.value : "",
      pf = pi && document.activeElement === pi;
    spBody.innerHTML = h;
    spBody.setAttribute("data-sig", h);
    spWire();
    var ni = spBody.querySelector("#parkIn");
    if (ni) {
      ni.value = pv;
      if (pf) {
        ni.focus();
        ni.setSelectionRange(pv.length, pv.length);
      }
    }
  }
}
export function spParkHtml() {
  var L = cfg().park || [];
  return (
    '<div class="park"><div class="edrow"><input id="parkIn" maxlength="120" placeholder="Park a stray thought (Enter)"><button type="button" class="stone" id="parkAdd">Park</button></div>' +
    (L.length ? '<div class="park-n">' + L.length + " parked</div>" : "") +
    "</div>"
  );
}
export function spWirePark() {
  var i = spBody.querySelector("#parkIn"),
    b = spBody.querySelector("#parkAdd");
  if (!i) return;
  function go_() {
    if (parkAdd(i.value)) {
      i.value = "";
      spBody.setAttribute("data-sig", "");
      spRender();
      var j = spBody.querySelector("#parkIn");
      if (j) j.focus();
    }
  }
  b.addEventListener("click", go_);
  i.addEventListener("keydown", function (e) {
    if (e.key === "Enter") go_();
  });
}
export function spWire() {
  var sp = S.sprint,
    g = function (id) {
      return spBody.querySelector("#" + id);
    };
  if (g("spMinB")) g("spMinB").addEventListener("click", spHide);
  if (g("spPause"))
    g("spPause").addEventListener("click", function () {
      if (sp.paused) {
        var d = Date.now() - sp.paused;
        sp.end += d;
        sp.pausedTotal = (sp.pausedTotal || 0) + d;
        sp.paused = null;
      } else sp.paused = Date.now();
      spSave();
      spRender();
    });
  if (g("spStop"))
    g("spStop").addEventListener("click", function () {
      if (!spArmed()) {
        spArm = Date.now();
        spRender();
        return;
      }
      spArm = 0;
      spFinish(true);
    });
  spBody.querySelectorAll("[data-sn]").forEach(function (x) {
    x.addEventListener("click", function () {
      sp.next = x.getAttribute("data-sn");
      spSave();
      spRender();
    });
  });
  if (g("spFlow"))
    g("spFlow").addEventListener("click", function () {
      var now = Date.now();
      sp.phase = "focus";
      sp.cur = sp.prev;
      sp.start = now;
      sp.end = now + 30 * 60000;
      sp.blen = 30;
      sp.extended = true;
      sp.paused = null;
      sp.pausedTotal = 0;
      sp.breakDone = false;
      spSave();
      sfx("base");
      spRender();
    });
  spWirePark();
  var ntp = g("spNextTopic");
  if (ntp)
    ntp.addEventListener("change", function () {
      sp.nextTopic = this.value || null;
      spSave();
    });
  if (g("spNext"))
    g("spNext").addEventListener("click", function () {
      if (!sp.breakDone || !sp.next) return;
      var now = Date.now();
      sp.extended = false;
      sp.phase = "focus";
      sp.cur = sp.next;
      sp.topic = sp.nextTopic || null;
      sp.nextTopic = null;
      sp.block++;
      sp.start = now;
      sp.end = now + sp.len * 60000;
      sp.paused = null;
      sp.pausedTotal = 0;
      sp.breakDone = false;
      sp.next = null;
      spSave();
      sfx("base");
      spRender();
    });
  if (g("spDone"))
    g("spDone").addEventListener("click", function () {
      S.sprint = null;
      spSave();
      spEl.hidden = true;
      spPill.hidden = true;
      setSync("Sprint saved to today\u2019s quests");
    });
}

/* Runs once at startup, in file-number order (main.js). */
export function init() {
  spEl = document.getElementById("sprint");
  spBody = document.getElementById("spBody");
  spPill = document.getElementById("spPill");
  spMin = false;
  SP_BREAK = 15;
  SP_LONG = 30;
  /* The panel is rebuilt every second (the countdown is in its markup), so the Stop button's "Confirm" arming lives outside the render: spArm = when it was armed, good for SP_ARM_MS. */
  spArm = 0;
  SP_ARM_MS = 4000;
  document.getElementById("spBtn").addEventListener("click", openSprintSetup);
  spPill.addEventListener("click", spShow);
  setInterval(spTick, 1000);
  if (S.sprint) {
    spMin = true;
    spPill.hidden = false;
    /* A block that ended while the app was dead is logged by the first tick (spAdd renders), so it waits for every init. */
    setTimeout(spTick, 0);
  }
}
