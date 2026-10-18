/* ---- mobile quest list: compact rows, details sheet, run view ---- */
import { G } from "../core/g.js";
import { S } from "../core/00-state.js";
import { cfg, uiGet, uiSet } from "../core/config.js";
import { todayKey } from "../core/days.js";
import { locked, ro } from "../core/entries.js";
import { esc, fmtD, hm, num } from "../core/util.js";
import { qEls, qWrap, reqText } from "./02-quest-list.js";
import { openMgr } from "./38-quest-editor.js";
import {
  perEnd,
  perOf,
  perStart,
  perWord,
  perWorkDays,
  logOnly,
  rollNeed,
  rollSum,
  weekFrom,
  weekTarget,
  workDaysIn,
} from "../rules/26-periods.js";
import { metQ, projSum } from "../rules/day-rules.js";
import { rewardsOff } from "../rules/modes.js";
import { qConsist, qStreak, qStreakable } from "../rules/quest-streaks.js";
import { activeDefs, defsOf, lateStart, reqOf, scheduled } from "../rules/quests-on-day.js";
import { switchTopic, topicName } from "../subjects/33-topics.js";
import { LV, qSubjs, qTopicPool, qTopics, subjById, topicById } from "../subjects/35-links.js";
import { fmtT, toggleTimer } from "../timer/13-focus-timer.js";
import { allTimeDone } from "../tools/28-spark-tools.js";
import { closeG, openG } from "../ui/18-modal.js";
import { haptic } from "../ui/45-gestures.js";

export var COLQ, qOpen, FIT_MIN, fitCv, LESS_N;

/* Phone row summary (HTML). A total shows what to do today from the pace figure (rollNeed) as a value over a caption: "1h 29m / to go today", "\u2714 / on pace" or "+40m / ahead of pace"; the period total lives in Details. Off days and tracking-only mode show "10h / of 15h this week". */
export function qSummary(q, e) {
  var v = e[q.id];
  if (q.type === "time") {
    var d = +v || 0;
    if (logOnly(q)) return hm(d);
    if (!q.roll) return hm(d) + " / " + hm(q.min);
    var T = todayKey(),
      rs = rollSum(q.id, T),
      two = function (a, b) {
        return "<b>" + a + "</b> <small>" + b + "</small>";
      };
    if (rewardsOff() || q.off || !scheduled(q, T))
      return two(hm(rs), "of " + hm(weekTarget(q, T)) + " this " + perWord(q));
    var rn = rollNeed(q, T);
    return rs < rn
      ? two(hm(rn - rs), "to go today")
      : rs === rn
        ? two("\u2714", "on pace")
        : two("+" + hm(rs - rn), "ahead of pace");
  }
  if (q.type === "target") return num(v || 0) + " / " + num(q.min) + (q.ul ? " " + q.ul : "");
  if (q.type === "limit")
    return (q.unit === "min" ? hm(+v || 0) : num(v || 0)) + " / " + (q.unit === "min" ? hm(q.max) : num(q.max));
  if (q.type === "wake") return v ? String(v) : "--:--";
  if (q.type === "scale") return v ? v + " / " + (q.scale || 5) : "\u2014";
  return "";
}
export function openDetails(q) {
  var T = todayKey(),
    e = S.days[T] || {},
    cq =
      cfg().quests.filter(function (x) {
        return x.id === q.id;
      })[0] || q,
    sj = qSubjs(q).length ? subjById(qSubjs(q)[0]) : null,
    DN = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
  openG(q.label, function (b) {
    var rows = [];
    function r(k, v) {
      rows.push('<div class="dt-r"><span>' + k + "</span><b>" + v + "</b></div>");
    }
    r("Goal", esc(reqText(q)));
    if (q.type === "time" && q.roll) {
      var rs = rollSum(q.id, T),
        rn = rollNeed(q, T);
      var wt = weekTarget(q, T),
        prd = wt < q.roll;
      var pw = perWord(q),
        PW = pw.charAt(0).toUpperCase() + pw.slice(1);
      if (prd)
        r(
          "This " + pw + "\u2019s target",
          hm(wt) +
            " (started " +
            fmtD(weekFrom(q, T)) +
            ", so " +
            workDaysIn(q, weekFrom(q, T), perEnd(q, T)) +
            " of " +
            perWorkDays(q, T) +
            " work days). Full " +
            hm(q.roll) +
            " from next " +
            pw +
            ".",
        );
      r(
        perOf(q) ? "This period (" + fmtD(perStart(q, T)) + "\u2013" + fmtD(perEnd(q, T)) + ")" : "This week",
        rewardsOff()
          ? hm(rs) + " of " + hm(wt) + " done"
          : hm(rs) +
              " of " +
              hm(wt) +
              " \u00b7 " +
              (rs < rn
                ? hm(rn - rs) + " more today keeps you on pace"
                : rs === rn
                  ? "on pace"
                  : "ahead by " + hm(rs - rn)),
      );
    }

    if (q.total)
      r(
        "Project total",
        (q.type === "time" ? hm(projSum(q.id)) : num(projSum(q.id))) +
          " of " +
          (q.type === "time" ? hm(q.total) : num(q.total)),
      );
    if (q.note) r("Note", esc(q.note));
    r(
      "Days",
      q.days && q.days.length && q.days.length < 7
        ? q.days
            .map(function (d) {
              return DN[d];
            })
            .join(" ")
        : "Every day",
    );
    if (qStreakable(q)) {
      var qs = qStreak(q.id, T),
        qc = qConsist(q.id, T);
      r("In a row", qs + (qs === 1 ? " day" : " days"));
      if (qc.sch) r("Last 30 days", qc.met + " of " + qc.sch + " (" + Math.round((qc.met / qc.sch) * 100) + "%)");
    }
    if (lateStart(q, T))
      r(
        "Counts from",
        q.type === "time" && q.roll ? "next week (added late in the week)" : "tomorrow (added late in the day)",
      );
    else if (q.opt) r("Optional", "Yes");
    var SLd = qSubjs(q),
      TLd = qTopics(q);
    if (SLd.length)
      r(
        TLd.length ? (TLd.length > 1 ? "Topics" : "Topic") : SLd.length > 1 ? "Subjects" : "Subject",
        SLd.map(function (id) {
          var sj = subjById(id),
            tn = TLd.filter(function (t) {
              return topicById(t).s.id === id;
            }).map(function (t) {
              return esc(topicName(t));
            });
          return esc(sj.name) + (tn.length ? " \u203a " + tn.join(", ") : "");
        }).join("; "),
      );
    if (cq.fin)
      r(
        "Done when",
        cq.fin.t === "total"
          ? "Project total reached"
          : (cq.fin.t === "topic" ? "Topic reaches " : "Subject reaches ") + LV[cq.fin.lvl || 4],
      );
    if (q.dl) r("Deadline", num(q.dl.total) + (q.ul ? " " + esc(q.ul) : "") + " by " + fmtD(q.dl.due));
    b.innerHTML =
      '<div class="dtl">' +
      rows.join("") +
      '</div><div class="edrow end"><button type="button" class="stone" id="dtEdit">Edit quests</button><button type="button" class="stone save" id="dtOk">Close</button></div>';
    b.querySelector("#dtOk").addEventListener("click", closeG);
    b.querySelector("#dtEdit").addEventListener("click", function () {
      closeG();
      openMgr();
    });
  });
}
export function mobileList(defs, e, past) {
  var s5 = document.getElementById("sp5Btn");
  if (s5) {
    var done5 = allTimeDone();
    if (s5.dataset.done !== String(done5)) {
      s5.dataset.done = String(done5);
      s5.innerHTML = done5
        ? '&#10003; Bonus 5<span class="m-hide"> minutes</span>'
        : '&#9654; Just 5<span class="m-hide"> minutes</span>';
      s5.classList.toggle("save", !done5);
    }
  }
  var sep = document.getElementById("doneSep");
  if (!sep) {
    sep = document.createElement("button");
    sep.type = "button";
    sep.id = "doneSep";
    sep.className = "donesep";
    sep.addEventListener("click", function () {
      G.doneOpen = !G.doneOpen;
      uiSet("done", G.doneOpen);
      mobileList(defs, S.days[todayKey()] || {}, ro());
    });
  }
  if (sep.parentNode !== qWrap) qWrap.appendChild(sep);
  var osep = document.getElementById("offSep");
  if (!osep) {
    osep = document.createElement("button");
    osep.type = "button";
    osep.id = "offSep";
    osep.className = "donesep offsep";
    osep.addEventListener("click", function () {
      G.offOpen = !G.offOpen;
      uiSet("off", G.offOpen);
      mobileList(defs, S.days[todayKey()] || {}, ro());
    });
  }
  if (osep.parentNode !== qWrap) qWrap.appendChild(osep);
  var isep = document.getElementById("ignSep");
  if (!isep) {
    isep = document.createElement("button");
    isep.type = "button";
    isep.id = "ignSep";
    isep.className = "donesep ignsep";
    isep.addEventListener("click", function () {
      G.ignOpen = !G.ignOpen;
      uiSet("ign", G.ignOpen);
      mobileList(defs, S.days[todayKey()] || {}, ro());
    });
  }
  if (isep.parentNode !== qWrap) qWrap.appendChild(isep);
  var nDone = 0,
    nOff = 0,
    nIgn = 0;
  defs.forEach(function (q) {
    var el = qEls[q.id];
    if (!el) return;
    var row = el.row,
      run = !!(S.timer && S.timer.id === q.id),
      ig = !!q.ign && !run,
      isDone = !ig && !q.off && !q.vow && row.classList.contains("met") && q.type !== "limit" && !run;
    row.classList.toggle("ignq", ig);
    if (ig) nIgn++;
    row.classList.toggle("offq", !ig && !!q.off && !run);
    if (!ig && q.off && !run) nOff++;
    row.classList.toggle("indone", isDone);
    if (isDone) nDone++;
    row.classList.toggle("colq", !!COLQ[q.type]);
    if (COLQ[q.type]) row.classList.toggle("open", !!qOpen[q.id]);
    if (q.type === "weekly") {
      var ws = row.querySelector(".wksub"),
        wkt = row.querySelector(".wk");
      if (!ws) {
        ws = document.createElement("span");
        ws.className = "wksub";
        row.children[3].appendChild(ws);
      }
      ws.textContent = wkt ? wkt.textContent : "";
    }
    var sm = row.querySelector(".qsum");
    if (COLQ[q.type]) {
      if (!sm) {
        sm = document.createElement("button");
        sm.type = "button";
        sm.className = "qsum";
        sm.addEventListener("click", function () {
          qOpen[q.id] = row.classList.toggle("open");
        });
        row.appendChild(sm);
        if (q.type === "time") {
          var pb = document.createElement("button");
          pb.type = "button";
          pb.className = "qplay";
          pb.setAttribute("aria-label", "Start focus timer for " + q.label);
          pb.innerHTML = '<i class="ic"></i>';
          pb.addEventListener("click", function (ev) {
            ev.stopPropagation();
            toggleTimer(q);
          });
          row.insertBefore(pb, sm);
        }
      }
      sm.innerHTML = qSummary(q, e);
      var pb2 = row.querySelector(".qplay");
      if (pb2) pb2.hidden = run || past || isDone || !!q.off || ig;
    }
  });
  var gh = document.getElementById("tdGhost");
  if (!gh) {
    gh = document.createElement("div");
    gh.id = "tdGhost";
    gh.className = "tdghost";
    gh.innerHTML =
      '<input maxlength="60" placeholder="+ Add a to-do" aria-label="New to-do"><button type="button" class="stone">Add</button>';
    var gi = gh.querySelector("input");
    function addG() {
      var v = gi.value.trim();
      if (!v) return;
      var tn = document.getElementById("tdNew");
      tn.value = v;
      document.getElementById("tdAdd").click();
      gi.value = "";
      setTimeout(function () {
        var g2 = document.querySelector("#tdGhost input");
        if (g2) g2.focus();
      }, 60);
    }
    gh.querySelector("button").addEventListener("click", addG);
    gi.addEventListener("keydown", function (ev) {
      if (ev.key === "Enter") addG();
    });
  }
  if (gh.parentNode !== qWrap) qWrap.appendChild(gh);
  gh.hidden = past || locked();
  document.body.classList.toggle("spark-on", !!cfg().sparkTools);
  document.body.classList.toggle("past-view", !!past);
  var wl = document.getElementById("waitList");
  if (!wl) {
    wl = document.createElement("div");
    wl.id = "waitList";
    wl.className = "waitlist";
  }
  if (wl.parentNode !== qWrap) qWrap.appendChild(wl);
  var Tw = todayKey(),
    W = past
      ? []
      : cfg().quests.filter(function (q) {
          return q.startOn && q.startOn > Tw && !q.completed;
        });
  wl.hidden = !W.length;
  wl.innerHTML = W.length
    ? '<span class="wl-h">Starting soon</span>' +
      W.map(function (q) {
        return '<span class="wl-r">' + esc(q.label) + " <em>" + fmtD(q.startOn) + "</em></span>";
      }).join("")
    : "";
  isep.hidden = !nIgn;
  isep.innerHTML = "<span>Ignored (" + nIgn + ')</span><i class="chev"></i>';
  isep.setAttribute("aria-expanded", G.ignOpen);
  qWrap.classList.toggle("ign-open", G.ignOpen);
  osep.hidden = !nOff;
  osep.innerHTML = "<span>Off today (" + nOff + ') \u00b7 time still counts</span><i class="chev"></i>';
  osep.setAttribute("aria-expanded", G.offOpen);
  qWrap.classList.toggle("off-open", G.offOpen);
  sep.hidden = !nDone;
  sep.innerHTML = "<span>Done today (" + nDone + ')</span><i class="chev"></i>';
  sep.setAttribute("aria-expanded", G.doneOpen);
  qWrap.classList.toggle("done-open", G.doneOpen);
  var dc = document.getElementById("qCount"),
    rq = reqOf(defs).filter(function (q) {
      return q.type !== "limit";
    });
  if (dc) {
    dc.textContent =
      rq.filter(function (q) {
        return metQ(q, e);
      }).length +
      "/" +
      rq.length +
      " done";
    dc.hidden = !rq.length;
    if (!dc.dataset.w) {
      dc.dataset.w = 1;
      dc.setAttribute("role", "button");
      dc.tabIndex = 0;
      dc.title = "What counts?";
      dc.addEventListener("click", openCountInfo);
    }
  }
  lessSync();
  fitLabels();
}
/* Show less: a group (the main list, Done today, Off today, Ignored) with more than LESS_N visible rows gets a toggle
   after its rows; folded, it shows the first LESS_N and "Show n more". The choice per group is kept in cfg.ui.less
   ({q, d, o, i}). A running row is never folded away, and while a timer runs the toggles hide. All reads come before
   the writes, so it costs one layout. */
export function lessSync() {
  if (!qWrap) return;
  var rows = Array.prototype.slice.call(qWrap.querySelectorAll(":scope > .q"));
  rows.forEach(function (r) {
    r.classList.remove("qless");
  });
  var LN = LESS_N || 3,
    less = uiGet("less", {}) || {},
    timing = qWrap.classList.contains("timing"),
    G4 = [
      [
        "q",
        function (r) {
          return !r.classList.contains("indone") && !r.classList.contains("offq") && !r.classList.contains("ignq");
        },
      ],
      [
        "d",
        function (r) {
          return r.classList.contains("indone");
        },
      ],
      [
        "o",
        function (r) {
          return r.classList.contains("offq");
        },
      ],
      [
        "i",
        function (r) {
          return r.classList.contains("ignq");
        },
      ],
    ],
    vis = rows.filter(function (r) {
      return r.getClientRects().length > 0;
    }),
    plan = G4.map(function (g) {
      return [g[0], vis.filter(g[1])];
    });
  plan.forEach(function (p) {
    var k = p[0],
      L = p[1],
      b = document.getElementById("qMore-" + k);
    if (!b) {
      b = document.createElement("button");
      b.type = "button";
      b.id = "qMore-" + k;
      b.className = "qmoreb qm-" + k;
      b.addEventListener("click", function () {
        var cur = uiGet("less", {}) || {},
          nx = Object.assign({}, cur);
        if (cur[k]) delete nx[k];
        else nx[k] = 1;
        uiSet("less", nx);
        lessSync();
        fitLabels();
      });
    }
    var many = !timing && L.length > LN,
      on = many && !!less[k];
    b.hidden = !many;
    if (many) {
      var n = L.length - LN;
      b.innerHTML = (on ? "Show " + n + " more" : "Show less") + '<i class="chev"></i>';
      b.setAttribute("aria-expanded", String(!on));
      b.classList.toggle("on", on);
      if (on)
        L.slice(LN).forEach(function (r) {
          if (!r.classList.contains("running")) r.classList.add("qless");
        });
    }
    qWrap.appendChild(b);
  });
}
/* Quest names wrap only between words. When a name's longest word is wider than its column (the pixel font fits ~10
   letters in a phone row), that label's font shrinks just enough for the word to fit, down to FIT_MIN px; only past
   that does overflow-wrap break the word. Words are measured in the DOM (a hidden span with the label's font), not a
   canvas: glyph advances at a fractional size are rounded differently by some font renderers (CI's Chromium broke
   "computational" at a size the canvas said fitted), so each guess is re-measured and stepped down until it fits. */
export function fitLabels() {
  var els = Array.prototype.slice.call(document.querySelectorAll("#quests .q .lbl"));
  if (!els.length) return;
  els.forEach(function (el) {
    if (el.style.fontSize) el.style.fontSize = "";
  });
  var sp = fitCv;
  if (!sp || !sp.isConnected) {
    sp = fitCv = document.createElement("span");
    sp.setAttribute("aria-hidden", "true");
    sp.style.cssText = "position:absolute;left:-9999px;top:0;visibility:hidden;white-space:pre;padding:0;border:0";
    document.body.appendChild(sp);
  }
  var jobs = els.map(function (el) {
    var cs = getComputedStyle(el),
      w =
        el.getBoundingClientRect().width -
        (parseFloat(cs.paddingLeft) || 0) -
        (parseFloat(cs.paddingRight) || 0) -
        (parseFloat(cs.borderLeftWidth) || 0) -
        (parseFloat(cs.borderRightWidth) || 0),
      words = (el.textContent || "").split(/\s+/).filter(Boolean);
    return { el: el, w: w, words: words, cs: cs, fs: parseFloat(cs.fontSize) || 10 };
  });
  var out = jobs.map(function (j) {
    if (!(j.w > 0) || !j.words.length) return 0;
    var cs = j.cs;
    sp.style.fontFamily = cs.fontFamily;
    sp.style.fontWeight = cs.fontWeight;
    sp.style.fontStyle = cs.fontStyle;
    sp.style.letterSpacing = cs.letterSpacing;
    sp.style.textTransform = cs.textTransform;
    function widest(fs) {
      sp.style.fontSize = fs + "px";
      var mx = 0;
      j.words.forEach(function (word) {
        sp.textContent = word;
        mx = Math.max(mx, sp.getBoundingClientRect().width);
      });
      return mx;
    }
    var min = FIT_MIN || 7,
      mx = widest(j.fs);
    if (mx <= j.w) return 0;
    var fs = Math.max(min, Math.floor(((j.fs * j.w) / mx) * 10) / 10);
    while (fs > min && widest(fs) > j.w) fs = Math.max(min, Math.round((fs - 0.25) * 100) / 100);
    return fs;
  });
  sp.textContent = "";
  jobs.forEach(function (j, i) {
    if (out[i]) j.el.style.fontSize = out[i] + "px";
  });
}
export function openCountInfo() {
  var T = G.viewKey || todayKey(),
    e = S.days[T] || {},
    defs = defsOf(e).length ? defsOf(e) : activeDefs(T),
    rq = reqOf(defs).filter(function (q) {
      return q.type !== "limit";
    }),
    skip = defs.filter(function (q) {
      return rq.indexOf(q) < 0;
    });
  openG("Today\u2019s count", function (b) {
    b.innerHTML =
      '<p class="help">The count is required quests done today. Clear them all (and break no limit) to clear the day.</p><div class="dtl">' +
      rq
        .map(function (q) {
          var m = metQ(q, e);
          return (
            '<div class="dt-r"><span>' +
            esc(q.label) +
            '</span><b class="' +
            (m ? "okc" : "") +
            '">' +
            (m ? "\u2714 Done" : "To do") +
            "</b></div>"
          );
        })
        .join("") +
      "</div>" +
      (skip.length
        ? '<p class="sh2">Not counted</p><p class="help">' +
          skip
            .map(function (q) {
              return (
                esc(q.label) +
                " (" +
                (q.type === "limit"
                  ? "limit"
                  : q.type === "todo"
                    ? "to-do"
                    : q.type === "weekly"
                      ? "weekly goal"
                      : "optional") +
                ")"
              );
            })
            .join(", ") +
          "</p>"
        : "") +
      '<div class="edrow end"><button type="button" class="stone save" id="ciOk">Got it</button></div>';
    b.querySelector("#ciOk").addEventListener("click", closeG);
  });
}
export function runBox(id) {
  var el = qEls[id];
  if (!el) return;
  var row = el.row,
    on = S.timer && S.timer.id === id;
  row.classList.toggle("running", !!on);
  var rb = row.querySelector(".runbox");
  if (!on) {
    if (rb) rb.remove();
    return;
  }
  var q = activeDefs(todayKey()).filter(function (x) {
    return x.id === id;
  })[0];
  if (!q) return;
  if (!rb) {
    rb = document.createElement("div");
    rb.className = "runbox";
    rb.innerHTML =
      '<div class="rb-t"></div><div class="rb-s"></div><div class="rb-b"><i></i></div><div class="rb-f"></div><div class="rb-tp" role="group" aria-label="Topic"></div>';
    rb.addEventListener("click", function (ev) {
      var b = ev.target.closest("[data-rtp]");
      if (!b) return;
      ev.stopPropagation();
      haptic("light");
      switchTopic(b.getAttribute("data-rtp"));
    });
    el.tmr.parentNode.insertBefore(rb, el.tmr);
  }
  var e = S.days[todayKey()] || {},
    el2 = Date.now() - S.timer.start,
    mins = Math.floor(el2 / 60000),
    lg = +e[q.id] || 0,
    tg = S.timer.commit && !S.timer.c5 ? S.timer.commit : q.roll ? 0 : q.min,
    tot = lg + mins;
  var rbt = rb.querySelector(".rb-t"),
    tx = fmtT(el2);
  rbt.textContent = tx;
  rbt.style.setProperty("--n", tx.length);
  rb.querySelector(".rb-s").textContent =
    S.timer.commit && !S.timer.c5
      ? "Just 5 minutes \u00b7 " + Math.max(0, 5 - mins) + " min to go"
      : tg
        ? hm(tot) + " of " + hm(tg) + (tot >= tg ? " \u2714" : "")
        : hm(tot) + " today";
  rb.querySelector(".rb-b i").style.width =
    Math.min(100, tg ? Math.round((S.timer.commit && !S.timer.c5 ? mins / 5 : tot / tg) * 100) : 100) + "%";
  rb.querySelector(".rb-f").textContent = S.timer.first ? "First: " + S.timer.first : "";
  var cur = S.timer.topic || "",
    pool = qTopicPool(q);
  Object.keys(S.timer.tacc || {})
    .concat(cur ? [cur] : [])
    .forEach(function (x) {
      if (pool.indexOf(x) < 0 && topicById(x)) pool.unshift(x);
    });
  var tp = rb.querySelector(".rb-tp"),
    sig = pool.join(",") + "|" + cur;
  if (tp.getAttribute("data-sig") !== sig) {
    tp.setAttribute("data-sig", sig);
    tp.innerHTML =
      pool.length > 1
        ? pool
            .map(function (id) {
              var on = id === cur;
              return (
                '<button type="button" class="stone mini' +
                (on ? " on" : "") +
                '" data-rtp="' +
                id +
                '" aria-pressed="' +
                on +
                '">' +
                esc(topicName(id)) +
                "</button>"
              );
            })
            .join("")
        : pool.length
          ? '<span class="rb-tp1">' + esc(topicName(pool[0])) + "</span>"
          : "";
  }
}

/* Runs once at startup, in file-number order (main.js). */
export function init() {
  COLQ = { time: 1, target: 1, limit: 1, wake: 1, scale: 1 };
  FIT_MIN = 7;
  LESS_N = 3;
  fitCv = null;
  var fitRaf = 0;
  window.addEventListener("resize", function () {
    if (fitRaf) return;
    fitRaf = requestAnimationFrame(function () {
      fitRaf = 0;
      fitLabels();
    });
  });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(fitLabels);
  /* fonts.ready can settle before the pixel font is even requested; refit whenever a font finishes loading. */
  if (document.fonts && document.fonts.addEventListener) document.fonts.addEventListener("loadingdone", fitLabels);
  /* Rows opened from their summary box stay open when the list is rebuilt (a quest changed here, a sync from another device). */
  qOpen = {};
  G.offOpen = !!uiGet("off");
  G.ignOpen = !!uiGet("ign");
  G.doneOpen = !!uiGet("done");
}
