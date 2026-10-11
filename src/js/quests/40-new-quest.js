/* ---- new quest modal ---- */
import { G } from "../core/g.js";
import { S, dirty } from "../core/00-state.js";
import { cfg, saveCfg } from "../core/config.js";
import { add, lateInWeek, nextMonday, todayKey, wkOrder, wkSpan } from "../core/days.js";
import { locked } from "../core/entries.js";
import { cache, flush } from "../core/storage.js";
import { clone, esc, fmtD, num } from "../core/util.js";
import { DN } from "./02-quest-list.js";
import { countsOnDay, overMsg, wouldExceed } from "./35b-daily-limit.js";
import { LIB, TN, moreSum } from "./38-quest-editor.js";
import { perOf, perWord } from "../rules/26-periods.js";
import { activeDefs, stampAdded } from "../rules/quests-on-day.js";
import { subjList } from "../subjects/32-subjects.js";
import { topicPick, wireTopicPick } from "../subjects/35-links.js";
import { render } from "../ui/04-render.js";
import { setSync } from "../ui/feedback.js";

export var TDESC, nqEl, nqB, nqS, NQ, nqLast;

export function nqDefaults(t, label) {
  var q = { type: t, label: label || "" };
  if (t === "time") {
    q.min = 30;
    if (cfg().rollDefault) q.roll = 420;
  }
  if (t === "limit") q.max = 3;
  if (t === "wake") {
    q.from = "06:00";
    q.to = "08:00";
  }
  if (t === "target") {
    q.min = 10;
    q.step = 1;
  }
  if (t === "scale") {
    q.scale = 5;
    q.min = 3;
  }
  if (t === "weekly") q.min = 3;
  return q;
}
export function openNQ() {
  if (locked()) {
    setSync("This day is locked. New quests can be added tomorrow.");
    return;
  }
  nqLast = document.activeElement;
  NQ = nqDefaults("check", "");
  drawNQ();
  nqEl.hidden = false;
  nqS.hidden = false;
  var f = nqB.querySelector("#nqName");
  if (f) f.focus();
}
export function closeNQ() {
  nqEl.hidden = true;
  nqS.hidden = true;
  NQ = null;
  if (nqLast && nqLast.focus) nqLast.focus();
}
export function drawNQ(msg) {
  var q = NQ,
    h = '<div class="ed">';
  h +=
    '<div class="edrow"><label class="grow">Start from the library<select id="nqLib"><option value="">Choose a ready-made quest\u2026</option>' +
    LIB.map(function (x, j) {
      return '<option value="' + j + '">' + esc(x.label) + " (" + TN[x.type] + ")</option>";
    }).join("") +
    "</select></label></div>";
  var PRI = ["check", "time", "todo"],
    showAll = NQ._all || PRI.indexOf(q.type) < 0;
  h +=
    '<p class="help">Or build your own:</p><div class="tgrid" role="radiogroup" aria-label="Quest type">' +
    PRI.concat(
      showAll
        ? Object.keys(TN).filter(function (t) {
            return PRI.indexOf(t) < 0;
          })
        : [],
    )
      .map(function (t) {
        return (
          '<button type="button" class="tcard' +
          (q.type === t ? " on" : "") +
          '" role="radio" aria-checked="' +
          (q.type === t) +
          '" data-t="' +
          t +
          '"><b>' +
          TN[t] +
          "</b><span>" +
          TDESC[t] +
          "</span></button>"
        );
      })
      .join("") +
    "</div>" +
    (showAll
      ? ""
      : '<button type="button" class="stone mini" id="nqMore">More types (target, limit, weekly, clock time, rating)</button>');
  h +=
    '<label>Name<input id="nqName" maxlength="40" value="' +
    esc(q.label) +
    '" placeholder="' +
    {
      time: "Study",
      target: "Drink water",
      limit: "Screen time",
      check: "Journal",
      todo: "Email advisor",
      weekly: "Gym",
      wake: "Wake up on time",
      scale: "Mood",
    }[q.type] +
    '"></label>';
  var p = "";
  if (q.type === "time")
    p =
      '<div class="goalcards" role="radiogroup" aria-label="Goal type"><button type="button" class="gcard' +
      (q.roll ? "" : " on") +
      '" data-goal="" role="radio" aria-checked="' +
      !q.roll +
      '"><b>Daily minimum</b><span>Same amount every day</span></button><button type="button" class="gcard' +
      (q.roll ? " on" : "") +
      '" data-goal="1" role="radio" aria-checked="' +
      !!q.roll +
      '"><b>Total over a period</b><span>Busy days cover empty ones later in the period</span></button></div>' +
      (q.roll
        ? '<div class="sjfield"><span class="sjlab">Every</span><div class="sjpick" role="radiogroup" aria-label="Period">' +
          [
            ["", "Week"],
            ["2w", "2 weeks"],
            ["month", "Month"],
          ]
            .map(function (o) {
              var on = perOf(q) === o[0];
              return (
                '<button type="button" class="stone mini' +
                (on ? " on" : "") +
                '" data-per="' +
                o[0] +
                '" role="radio" aria-checked="' +
                on +
                '">' +
                o[1] +
                (o[0] === "" ? " <small>" + wkSpan() + "</small>" : "") +
                "</button>"
              );
            })
            .join("") +
          "</div></div><label>Total per " +
          perWord(q) +
          ' (hours)<input type="number" id="nqRollH" min="0.5" step="0.5" value="' +
          num(q.roll / 60) +
          '"></label>'
        : '<label>Daily minimum (minutes)<input type="number" data-n="min" min="10" step="10" value="' +
          q.min +
          '"></label>');
  else if (q.type === "target")
    p =
      '<label>Goal<input type="number" data-n="min" min="0" step="any" value="' +
      q.min +
      '"></label><label>Unit<input data-s="ul" value="' +
      esc(q.ul || "") +
      '" placeholder="glasses"></label><label>Step<input type="number" data-n="step" min="0" step="any" value="' +
      (q.step || 1) +
      '"></label>';
  else if (q.type === "limit")
    p =
      '<label>Maximum<input type="number" data-n="max" min="0" step="1" value="' +
      q.max +
      '"></label><label>Counts<select data-s="unit"><option value=""' +
      (q.unit === "min" ? "" : " selected") +
      '>number</option><option value="min"' +
      (q.unit === "min" ? " selected" : "") +
      ">minutes</option></select></label>";
  else if (q.type === "wake")
    p =
      '<label>From<input type="time" data-s="from" value="' +
      q.from +
      '"></label><label>To<input type="time" data-s="to" value="' +
      q.to +
      '"></label>';
  else if (q.type === "scale")
    p =
      '<label>Out of<select data-n="scale"><option value="5"' +
      ((q.scale || 5) == 5 ? " selected" : "") +
      '>5</option><option value="10"' +
      (q.scale == 10 ? " selected" : "") +
      '>10</option></select></label><label>Pass at<input type="number" data-n="min" min="1" max="' +
      (q.scale || 5) +
      '" value="' +
      q.min +
      '"></label>';
  else if (q.type === "weekly")
    p = '<label>Times per week<input type="number" data-n="min" min="1" max="7" value="' + q.min + '"></label>';
  else if (q.type === "todo")
    p = '<label>Due (optional)<input type="date" data-s="due" value="' + esc(q.due || "") + '"></label>';
  if (p) h += '<div class="edrow">' + p + "</div>";
  if (q.type !== "weekly" && q.type !== "todo") {
    var days = q.days && q.days.length ? q.days : [0, 1, 2, 3, 4, 5, 6];
    h +=
      '<div class="edrow"><div class="days" role="group" aria-label="Days">' +
      wkOrder()
        .map(function (d) {
          return (
            '<button type="button" class="stone mini' +
            (days.indexOf(d) >= 0 ? " on" : "") +
            '" data-d="' +
            d +
            '" aria-pressed="' +
            (days.indexOf(d) >= 0) +
            '">' +
            DN[d].slice(0, 2) +
            "</button>"
          );
        })
        .join("") +
      '</div><button type="button" class="stone mini' +
      (q.opt ? " on" : "") +
      '" id="nqOpt" aria-pressed="' +
      !!q.opt +
      '">Optional</button></div>';
  }
  /* The rest folds under More options (what's set shows in the button's summary): starts, change rules, feeds topics, daily limit. */
  if (q.type !== "todo") {
    var T0 = todayKey(),
      optsS = [
        ["", "Today"],
        [add(T0, 1), "Tomorrow"],
        [nextMonday(T0), "Next week"],
      ];
    if (NQ.startOn === undefined && q.type === "time" && q.roll && !perOf(q) && lateInWeek(T0))
      NQ.startOn = nextMonday(T0);
    var cur = NQ.startOn || "",
      more = "";
    more +=
      '<div class="sjfield"><span class="sjlab">Starts</span><div class="sjpick">' +
      optsS
        .map(function (o) {
          return (
            '<button type="button" class="stone mini' +
            (cur === o[0] ? " on" : "") +
            '" data-start="' +
            o[0] +
            '" aria-pressed="' +
            (cur === o[0]) +
            '">' +
            o[1] +
            (o[0] ? " <small>" + fmtD(o[0]) + "</small>" : "") +
            "</button>"
          );
        })
        .join("") +
      "</div></div>";
    if (q.type === "time")
      more +=
        '<div class="edrow"><label>Daily limit, minutes (optional)<input type="number" data-n="lim" min="0" step="5" value="' +
        (q.lim || "") +
        '" placeholder="none"></label></div>';
    if (subjList().length)
      more +=
        '<div class="sjfield"><span class="sjlab">Feeds topics (optional)</span>' + topicPick("data-nq", q) + "</div>";
    h +=
      '<button type="button" class="stone mini more-tog" id="nqMoreOpt" aria-expanded="' +
      !!NQ._more +
      '">' +
      (NQ._more ? "Fewer options" : "More options") +
      (NQ._more ? "" : "<small>" + esc(moreSum(q)) + "</small>") +
      "</button>" +
      (NQ._more ? '<div class="moreb">' + more + "</div>" : "");
  }
  h +=
    '<p class="cmsg2">' +
    esc(msg || "") +
    '</p><div class="edrow end"><button type="button" class="stone" id="nqCancel">Cancel</button><button type="button" class="stone save" id="nqSave">Add quest</button></div></div>';
  nqB.innerHTML = h;
  var mt = nqB.querySelector("#nqMore");
  if (mt)
    mt.addEventListener("click", function () {
      NQ._all = true;
      drawNQ();
    });
  var mo = nqB.querySelector("#nqMoreOpt");
  if (mo)
    mo.addEventListener("click", function () {
      NQ._more = !NQ._more;
      drawNQ();
      var f = nqB.querySelector(".moreb input,.moreb select,.moreb button");
      if (f && NQ._more) f.focus();
    });
  nqB.querySelector("#nqLib").addEventListener("change", function () {
    if (this.value === "") return;
    var x = clone(LIB[+this.value]);
    NQ = x;
    drawNQ();
  });
  nqB.querySelectorAll(".tcard").forEach(function (b) {
    b.addEventListener("click", function () {
      var nm = NQ.label,
        al = NQ._all,
        old = NQ;
      NQ = nqDefaults(b.getAttribute("data-t"), nm);
      if (al) NQ._all = true;
      if (NQ.type !== "todo")
        ["topics", "subjs", "subj"].forEach(function (f) {
          if (old[f]) NQ[f] = old[f];
        });
      if (old.days && NQ.type !== "weekly" && NQ.type !== "todo") NQ.days = old.days;
      drawNQ();
      var c = nqB.querySelector('.tcard[data-t="' + NQ.type + '"]');
      if (c) c.focus();
    });
  });
  nqB.querySelector("#nqName").addEventListener("input", function () {
    NQ.label = this.value;
  });
  wireTopicPick(
    nqB,
    function () {
      return NQ;
    },
    drawNQ,
  );
  nqB.querySelectorAll("[data-start]").forEach(function (x) {
    x.addEventListener("click", function () {
      var v = x.getAttribute("data-start");
      NQ.startOn = v || null;
      drawNQ();
    });
  });
  nqB.querySelectorAll("[data-per]").forEach(function (x) {
    x.addEventListener("click", function () {
      var p = x.getAttribute("data-per"),
        k0 = { "": 1, "2w": 2, month: 4.3 },
        was = perOf(NQ);
      NQ.roll = Math.max(30, Math.round(((NQ.roll / k0[was]) * k0[p]) / 30) * 30);
      if (p) NQ.per = p;
      else delete NQ.per;
      drawNQ();
    });
  });
  nqB.querySelectorAll("[data-goal]").forEach(function (x) {
    x.addEventListener("click", function () {
      if (x.getAttribute("data-goal")) NQ.roll = NQ.roll || 420;
      else delete NQ.roll;
      drawNQ();
    });
  });
  var nrh = nqB.querySelector("#nqRollH");
  if (nrh)
    nrh.addEventListener("input", function () {
      var v = num(this.value);
      if (v > 0) NQ.roll = Math.round(v * 60);
    });
  nqB.querySelectorAll("[data-n]").forEach(function (x) {
    x.addEventListener(x.tagName === "SELECT" ? "change" : "input", function () {
      var f = x.getAttribute("data-n");
      NQ[f] = num(x.value);
      if (f === "scale") {
        if (NQ.min > NQ.scale) NQ.min = NQ.scale;
        drawNQ();
      }
    });
  });
  nqB.querySelectorAll("[data-s]").forEach(function (x) {
    x.addEventListener(x.tagName === "SELECT" ? "change" : "input", function () {
      var f = x.getAttribute("data-s");
      if (x.value) NQ[f] = x.value;
      else delete NQ[f];
      if (f === "unit") drawNQ();
    });
  });
  nqB.querySelectorAll("[data-d]").forEach(function (x) {
    x.addEventListener("click", function () {
      var d = +x.getAttribute("data-d"),
        ds = NQ.days && NQ.days.length ? NQ.days.slice() : [0, 1, 2, 3, 4, 5, 6],
        ix = ds.indexOf(d);
      if (ix >= 0) ds.splice(ix, 1);
      else ds.push(d);
      if (ds.length === 7) delete NQ.days;
      else NQ.days = ds;
      drawNQ();
    });
  });
  var ob = nqB.querySelector("#nqOpt");
  if (ob)
    ob.addEventListener("click", function () {
      if (NQ.opt) delete NQ.opt;
      else NQ.opt = true;
      drawNQ();
    });
  nqB.querySelector("#nqCancel").addEventListener("click", closeNQ);
  nqB.querySelector("#nqSave").addEventListener("click", function () {
    var q = NQ;
    q.label = (q.label || "").trim();
    stampAdded(q);
    if (!q.startOn) delete q.startOn;
    if (countsOnDay(q)) {
      var ovq = wouldExceed(q);
      if (ovq.length) {
        drawNQ(overMsg(ovq));
        return;
      }
    }
    if (!q.label) {
      drawNQ("Give the quest a name.");
      return;
    }
    if (!(q.lim > 0)) delete q.lim;
    if (
      ((q.type === "time" || q.type === "weekly" || q.type === "target") && !(q.min > 0)) ||
      (q.type === "time" && q.lim && q.lim < (q.roll ? 5 : q.min)) ||
      (q.type === "scale" && !(q.min >= 1 && q.min <= (q.scale || 5))) ||
      (q.type === "wake" && !(q.from && q.to && q.from < q.to)) ||
      (q.type === "limit" && !(q.max >= 0)) ||
      (q.days && !q.days.length)
    ) {
      drawNQ("Check the values: something is missing or out of range.");
      return;
    }
    delete q._all;
    delete q._more;
    if (q.type === "weekly" || q.type === "todo") {
      delete q.days;
      delete q.opt;
    }
    q.id = (q.type === "todo" ? "td" : "q") + Date.now().toString(36);
    var c = clone(cfg());
    c.quests.push(clone(q));
    saveCfg(c);
    var T = todayKey();
    if (S.days[T]) {
      S.days[T] = Object.assign({}, S.days[T], { q: activeDefs(T) });
      dirty[T] = true;
      cache();
      clearTimeout(G.timer);
      G.timer = setTimeout(flush, 300);
    }
    G.qSig = "";
    closeNQ();
    render();
    setSync(q.label + " added");
  });
}

/* Runs once at startup, in file-number order (main.js). */
export function init() {
  TDESC = {
    time: "Minutes per day, or a weekly total",
    target: "Count up to a number (steps, pages, glasses)",
    limit: "Stay under a maximum (screen time, snacks)",
    check: "A daily yes/no habit",
    todo: "A one-off task that disappears once done",
    weekly: "X times a week, on any days",
    wake: "Log a time that must fall in a window",
    scale: "Rate something 1-5 or 1-10",
  };
  nqEl = document.getElementById("nqModal");
  nqB = document.getElementById("nqBody");
  nqS = document.getElementById("modalScrim");
  NQ = null;
  nqLast = null;
  document.getElementById("nqBtn").addEventListener("click", openNQ);
  document.getElementById("nqClose").addEventListener("click", closeNQ);
  nqS.addEventListener("click", closeNQ);
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && !nqEl.hidden) closeNQ();
  });
}
