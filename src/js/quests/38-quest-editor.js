/* quest manager */
import { G } from "../core/g.js";
import { MAXM, S, dirty } from "../core/00-state.js";
import { cfg, saveCfg } from "../core/config.js";
import { add, todayKey, wkOrder, wkSpan } from "../core/days.js";
import { ro } from "../core/entries.js";
import { cache, flush } from "../core/storage.js";
import { clone, esc, fmtD, hm, hmL, num } from "../core/util.js";
import { DN, reqText } from "./02-quest-list.js";
import { WDN, capOf, overDays } from "./35b-daily-limit.js";
import { renderRules } from "../rulebook/07b-rulebook.js";
import { logOnly, perOf, perWord } from "../rules/26-periods.js";
import { easeNote, easedIds, guardEasing } from "../rules/easing.js";
import { isPaused } from "../rules/modes.js";
import { activeDefs } from "../rules/quests-on-day.js";
import { renderSettings } from "../settings/10-settings.js";
import { subjList } from "../subjects/32-subjects.js";
import { LV, qSubjs, qTopics, subjById, topicPick, wireTopicPick } from "../subjects/35-links.js";
import { render } from "../ui/04-render.js";
import { applyTheme } from "../ui/08-themes.js";
import { setSync } from "../ui/feedback.js";

export var qmgr, qDraft, mqOpenId, mgrSheet, mqMore, TN, LIB;

/* One-line summary of a quest's folded options, for the More options button: what's set beyond name and goal. */
export function moreSum(q) {
  var p = [];
  if (q.startOn && q.startOn > todayKey()) p.push("starts " + fmtD(q.startOn));
  if (q.lim) p.push("up to " + hmL(q.lim) + "/day");
  if (q.total) p.push("project " + (q.type === "time" ? hm(q.total) : num(q.total)));
  var tl = qTopics(q),
    sl = qSubjs(q);
  if (tl.length) p.push(tl.length + " topic" + (tl.length === 1 ? "" : "s"));
  else if (sl.length) p.push(sl.length + " subject" + (sl.length === 1 ? "" : "s"));
  if (q.fin) p.push("finish line");
  if (q.note) p.push("note");
  return p.length ? p.join(" \u00b7 ") : "starts today, no limit, no topics";
}
export function openMgr() {
  if (ro()) return;
  G.mgrOpen = true;
  mqOpenId = null;
  mqMore = {};
  qDraft = clone(cfg().quests);
  drawMgr();
  qmgr.hidden = false;
  mgrSheet.hidden = false;
  document.body.classList.add("mgr-on");
  document.getElementById("mgrBody").scrollTop = 0;
}
export function closeMgr() {
  G.mgrOpen = false;
  qmgr.hidden = true;
  mgrSheet.hidden = true;
  document.body.classList.remove("mgr-on");
  qDraft = null;
  render();
}
export function drawMgr(msg) {
  var T = todayKey(),
    h =
      '<div class="mgrtop"><div class="edrow end">' +
      (qDraft.some(function (q) {
        return q.type === "todo" && q.doneOn;
      })
        ? '<button type="button" class="stone" id="mgrTdClr">Clear done to-dos</button>'
        : "") +
      (qDraft.length > 1 ? '<button type="button" class="stone" id="mgrSort">Sort by type</button>' : "") +
      (qDraft.length ? '<button type="button" class="stone del" id="mgrClear">Clear all quests</button>' : "") +
      '<button type="button" class="stone" data-mcancel>Cancel</button><button type="button" class="stone save" data-msave>Save quests</button></div><p class="help"><b>' +
      esc(easeNote()) +
      '</b></p><p class="help">' +
      'Past days keep the quests they had. Optional quests earn XP but never fail the day. Days with nothing required are rest days and never break a streak. To pause a quest for a week, use the pause button next to it in the quest list.</p><p class="cmsg2" data-mmsg>' +
      esc(msg || "") +
      "</p></div>";
  function numIn(lbl, f, i, v, st, mn, mx) {
    return (
      "<label>" +
      lbl +
      '<input type="number" data-p="' +
      f +
      '" data-i="' +
      i +
      '" value="' +
      (v == null ? "" : v) +
      '" step="' +
      st +
      '" min="' +
      mn +
      '"' +
      (mx != null ? ' max="' + mx + '"' : "") +
      "></label>"
    );
  }
  function txtIn(lbl, f, i, v, ph) {
    return (
      "<label>" +
      lbl +
      '<input data-p="' +
      f +
      '" data-i="' +
      i +
      '" value="' +
      esc(v || "") +
      '" placeholder="' +
      (ph || "") +
      '"></label>'
    );
  }
  qDraft.forEach(function (q, i) {
    var p = isPaused(q, T),
      par = "",
      parMore = "";
    if (q.type === "todo")
      par =
        '<label>Due (optional)<input type="date" data-p="due" data-i="' +
        i +
        '" value="' +
        esc(q.due || "") +
        '"></label>' +
        (q.doneOn ? '<span class="pz ok">Done ' + fmtD(q.doneOn) + "</span>" : "");
    else if (q.type === "weekly") par = numIn("Times per week", "min", i, q.min, 1, 1, 7);
    else if (q.type === "time") {
      par =
        '<label>Goal type<select data-p="rollmode" data-i="' +
        i +
        '"' +
        (logOnly(q) ? " disabled" : "") +
        '><option value=""' +
        (q.roll ? "" : " selected") +
        '>Daily minimum</option><option value="roll"' +
        (q.roll && !perOf(q) ? " selected" : "") +
        ">Weekly total (" +
        wkSpan() +
        ')</option><option value="roll2w"' +
        (q.roll && perOf(q) === "2w" ? " selected" : "") +
        '>Total every 2 weeks</option><option value="rollm"' +
        (q.roll && perOf(q) === "month" ? " selected" : "") +
        ">Monthly total</option></select></label>" +
        (q.roll
          ? numIn("Total per " + perWord(q) + " (hours)", "rollh", i, num(q.roll / 60), "any", 0.5)
          : numIn("Min (minutes)", "min", i, q.min, 10, 0, 960) +
            '<p class="help" data-lo="' +
            i +
            '"' +
            (logOnly(q) ? "" : " hidden") +
            ">No minimum: it just logs time and is never required. Set a minimum to pick another goal type.</p>");
      parMore =
        numIn("Project total, hours (optional)", "totalh", i, q.total ? num(q.total / 60) : "", "any", 0) +
        numIn("Daily limit, minutes (optional)", "lim", i, q.lim || "", 5, 0, MAXM) +
        (q.lim
          ? '<p class="help">The timer stops and logs at ' + hmL(q.lim) + "; nothing more is tracked that day.</p>"
          : "");
    } else if (q.type === "target") {
      par =
        numIn("Goal", "min", i, q.min, "any", 0) +
        txtIn("Unit", "ul", i, q.ul, "glasses") +
        numIn("Step", "step", i, q.step || 1, "any", 0);
      parMore = numIn("Project total (optional)", "total", i, q.total || "", "any", 0);
    } else if (q.type === "limit")
      par =
        numIn("Max", "max", i, q.max, 1, 0, 999) +
        '<label>Counts<select data-p="unit" data-i="' +
        i +
        '"><option value=""' +
        (q.unit === "min" ? "" : " selected") +
        '>number</option><option value="min"' +
        (q.unit === "min" ? " selected" : "") +
        ">minutes</option></select></label>" +
        (q.unit === "min" ? "" : txtIn("Unit", "ul", i, q.ul, "cups"));
    else if (q.type === "wake")
      par =
        '<label>From<input type="time" data-p="from" data-i="' +
        i +
        '" value="' +
        q.from +
        '"></label><label>To<input type="time" data-p="to" data-i="' +
        i +
        '" value="' +
        q.to +
        '"></label>';
    else if (q.type === "scale")
      par =
        '<label>Out of<select data-p="scale" data-i="' +
        i +
        '"><option value="5"' +
        ((q.scale || 5) == 5 ? " selected" : "") +
        '>5</option><option value="10"' +
        (q.scale == 10 ? " selected" : "") +
        ">10</option></select></label>" +
        numIn("Pass at", "min", i, q.min, 1, 1, q.scale || 5);
    var days = q.days && q.days.length ? q.days : [0, 1, 2, 3, 4, 5, 6],
      dh = '<div class="days" role="group" aria-label="Days">';
    wkOrder().forEach(function (d) {
      dh +=
        '<button type="button" class="stone mini' +
        (days.indexOf(d) >= 0 ? " on" : "") +
        '" data-day="' +
        i +
        "," +
        d +
        '" aria-pressed="' +
        (days.indexOf(d) >= 0) +
        '">' +
        DN[d].slice(0, 2) +
        "</button>";
    });
    dh += "</div>";
    if (q.completed) return;
    var sjs = subjList(),
      sl = qSubjs(q),
      sjo = sl.length ? subjById(sl[0]) : null,
      tl = qTopics(q),
      linkH = "";
    if (q.type !== "todo") {
      linkH =
        (sjs.length
          ? '<div class="sjfield"><span class="sjlab">Feeds topics</span>' +
            topicPick('data-lq="' + i + '"', q) +
            "</div>"
          : "") +
        '<div class="edrow">' +
        (q.dl
          ? '<p class="help">Completes when its deadline target is met or the deadline passes.</p>'
          : '<label>Done when<select data-p="fin" data-i="' +
            i +
            '"><option value="">Ongoing (no finish line)</option>' +
            (q.type === "time" || q.type === "target"
              ? '<option value="total"' +
                (q.fin && q.fin.t === "total" ? " selected" : "") +
                ">Project total reached</option>"
              : "") +
            (sjo
              ? '<option value="subject"' +
                (q.fin && q.fin.t === "subject" ? " selected" : "") +
                ">Subject reaches a level</option>"
              : "") +
            (tl.length
              ? '<option value="topic"' +
                (q.fin && q.fin.t === "topic" ? " selected" : "") +
                ">" +
                (tl.length === 1 ? "Topic reaches a level" : "All its topics reach a level") +
                "</option>"
              : "") +
            "</select></label>" +
            (q.fin && (q.fin.t === "subject" || q.fin.t === "topic")
              ? '<label>Level<select data-p="finlvl" data-i="' +
                i +
                '">' +
                [2, 3, 4, 5]
                  .map(function (v) {
                    return (
                      '<option value="' +
                      v +
                      '"' +
                      ((q.fin.lvl || 4) === v ? " selected" : "") +
                      ">" +
                      LV[v] +
                      "</option>"
                    );
                  })
                  .join("") +
                "</select></label>"
              : "") +
            (q.fin && q.fin.t === "total" && !q.total ? '<span class="pz">Set a project total above</span>' : "")) +
        "</div>";
    }
    h +=
      '<div class="mq' +
      (p ? " paused" : "") +
      (mqOpenId === q.id ? " open" : "") +
      '" data-idx="' +
      i +
      '" data-qid="' +
      q.id +
      '"><div class="edrow mqtop"><button type="button" class="dragh" data-drag="' +
      i +
      '" aria-label="Drag to reorder ' +
      esc(q.label) +
      '" title="Drag to reorder (or use arrow keys)"><i></i></button><input data-p="label" data-i="' +
      i +
      '" value="' +
      esc(q.label) +
      '" aria-label="Quest name"><span class="ty">' +
      TN[q.type] +
      '</span><button type="button" class="stone mq-tog" data-tog="' +
      q.id +
      '" aria-label="Show settings for ' +
      esc(q.label) +
      '" aria-expanded="' +
      (mqOpenId === q.id) +
      '"><i></i></button></div><span class="mqsum">' +
      esc(reqText(q)) +
      '</span><div class="edrow">' +
      par +
      '</div><div class="edrow">' +
      (q.type === "todo"
        ? '<p class="help">A one-off task. It stays on your list until you mark it done, then disappears the next day. It never affects the streak.</p>'
        : q.type === "weekly"
          ? '<p class="help">Tap "Done today" on any day you do it. Weekly goals never fail a day or affect the streak; hitting the target earns bonus XP.</p>'
          : dh +
            '<button type="button" class="stone mini' +
            (q.opt ? " on" : "") +
            '" data-opt="' +
            i +
            '" aria-pressed="' +
            !!q.opt +
            '">Optional</button>') +
      "</div>" +
      (q.type === "todo"
        ? '<div class="edrow"><label class="grow">Note<input data-p="note" data-i="' +
          i +
          '" value="' +
          esc(q.note || "") +
          '"></label></div>'
        : '<button type="button" class="stone mini more-tog" data-more="' +
          q.id +
          '" aria-expanded="' +
          !!mqMore[q.id] +
          '">' +
          (mqMore[q.id] ? "Fewer options" : "More options") +
          (mqMore[q.id] ? "" : "<small>" + esc(moreSum(q)) + "</small>") +
          "</button>" +
          (mqMore[q.id]
            ? '<div class="moreb"><div class="edrow">' +
              parMore +
              '<label class="grow">Note<input data-p="note" data-i="' +
              i +
              '" value="' +
              esc(q.note || "") +
              '"></label><label>Starts<input type="date" data-p="startOn" data-i="' +
              i +
              '" value="' +
              esc(q.startOn || "") +
              '"></label></div>' +
              linkH +
              "</div>"
            : "")) +
      '</div><div class="edrow end">' +
      (p ? '<span class="pz">Paused until ' + fmtD(add(q.pausedUntil, -1)) + "</span>" : "") +
      '<button type="button" class="stone del" data-del="' +
      i +
      '">Delete</button></div></div>';
  });
  h += '<div class="mq add"><p class="help">To add a quest, close the editor and use + New quest.</p></div>';
  h +=
    '<div class="edrow end"><button type="button" class="stone" data-mcancel>Cancel</button><button type="button" class="stone save" data-msave>Save quests</button></div>';
  qmgr.innerHTML = h;
  wireTopicPick(
    qmgr,
    function (x) {
      return qDraft[+x.getAttribute("data-lq")];
    },
    drawMgr,
  );
  qmgr.querySelectorAll("[data-more]").forEach(function (x) {
    x.addEventListener("click", function () {
      var id = x.getAttribute("data-more");
      mqMore[id] = !mqMore[id];
      drawMgr();
      var b = qmgr.querySelector('[data-more="' + id + '"]');
      if (b && mqMore[id]) {
        var f = b.nextElementSibling && b.nextElementSibling.querySelector("input,select,button");
        if (f) f.focus();
      }
    });
  });
  qmgr.querySelectorAll("[data-tog]").forEach(function (x) {
    x.addEventListener("click", function () {
      var id = x.getAttribute("data-tog");
      mqOpenId = mqOpenId === id ? null : id;
      drawMgr();
      var el = qmgr.querySelector('.mq[data-qid="' + id + '"]');
      if (el && mqOpenId) el.scrollIntoView({ block: "nearest" });
    });
  });
  qmgr.querySelectorAll("[data-p]").forEach(function (x) {
    x.addEventListener(x.tagName === "SELECT" ? "change" : "input", function () {
      var q = qDraft[+x.getAttribute("data-i")],
        f = x.getAttribute("data-p"),
        v = x.value;
      if (f === "unit") {
        if (v) q.unit = v;
        else delete q.unit;
        drawMgr();
        return;
      }
      if (f === "scale") {
        q.scale = +v;
        if (q.min > q.scale) q.min = q.scale;
        drawMgr();
        return;
      }
      if (f === "startOn") {
        if (v && v > todayKey()) q.startOn = v;
        else delete q.startOn;
        return;
      }
      if (f === "fin") {
        if (v) q.fin = { t: v, lvl: (q.fin && q.fin.lvl) || 4 };
        else delete q.fin;
        drawMgr();
        return;
      }
      if (f === "finlvl") {
        if (q.fin) q.fin.lvl = +v;
        return;
      }
      if (f === "rollmode") {
        var was = perOf(q);
        if (v) {
          var per = v === "roll2w" ? "2w" : v === "rollm" ? "month" : "",
            k0 = { "": 1, "2w": 2, month: 4.3 };
          q.roll = q.roll
            ? Math.round(((q.roll / k0[was]) * k0[per]) / 30) * 30 || q.roll
            : Math.max(60, (q.min || 30) * 7 * k0[per]);
          if (per) q.per = per;
          else delete q.per;
        } else {
          delete q.roll;
          delete q.per;
        }
        drawMgr();
        return;
      }
      if (f === "rollh") {
        var rh = num(v);
        if (rh > 0) q.roll = Math.round(rh * 60);
        return;
      }
      if (f === "lim") {
        var lv = Math.round(num(v));
        if (lv > 0) q.lim = lv;
        else delete q.lim;
        return;
      }
      if (f === "total" || f === "totalh") {
        var tv = num(v);
        if (tv > 0) q.total = f === "totalh" ? Math.round(tv * 60) : tv;
        else delete q.total;
        return;
      }
      if (f === "min" || f === "max" || f === "step") {
        v = q.type === "target" || f === "step" ? num(v) : Math.max(0, Math.round(+v || 0));
      }
      q[f] = v;
      if (f === "min" && q.type === "time" && !q.roll) {
        var rs = qmgr.querySelector('select[data-p="rollmode"][data-i="' + x.getAttribute("data-i") + '"]'),
          lh = qmgr.querySelector('[data-lo="' + x.getAttribute("data-i") + '"]');
        if (rs) rs.disabled = logOnly(q);
        if (lh) lh.hidden = !logOnly(q);
      }
    });
  });
  qmgr.querySelectorAll("[data-day]").forEach(function (x) {
    x.addEventListener("click", function () {
      var a = x.getAttribute("data-day").split(","),
        q = qDraft[+a[0]],
        d = +a[1],
        ds = q.days && q.days.length ? q.days.slice() : [0, 1, 2, 3, 4, 5, 6],
        ix = ds.indexOf(d);
      if (ix >= 0) ds.splice(ix, 1);
      else ds.push(d);
      if (ds.length === 7) delete q.days;
      else q.days = ds;
      drawMgr();
    });
  });
  qmgr.querySelectorAll("[data-opt]").forEach(function (x) {
    x.addEventListener("click", function () {
      var q = qDraft[+x.getAttribute("data-opt")];
      if (q.opt) delete q.opt;
      else q.opt = true;
      drawMgr();
    });
  });
  qmgr.querySelectorAll("[data-del]").forEach(function (x) {
    var arm = null;
    x.addEventListener("click", function () {
      if (!arm) {
        x.textContent = "Confirm";
        arm = setTimeout(function () {
          arm = null;
          x.textContent = "Delete";
        }, 4000);
        return;
      }
      qDraft.splice(+x.getAttribute("data-del"), 1);
      drawMgr();
    });
  });
  function nid() {
    return "q" + Date.now().toString(36) + Math.floor(Math.random() * 1e4).toString(36);
  }
  qmgr.querySelectorAll("[data-mcancel]").forEach(function (x) {
    x.addEventListener("click", function () {
      closeMgr();
      setSync("Quest changes discarded");
    });
  });
  var mtc = document.getElementById("mgrTdClr");
  if (mtc)
    mtc.addEventListener("click", function () {
      var T2 = todayKey();
      qDraft = qDraft.filter(function (q) {
        return !(q.type === "todo" && q.doneOn && q.doneOn < T2);
      });
      drawMgr("Finished to-dos removed (today\u2019s stay until tomorrow). Save to keep it.");
    });
  var ms = document.getElementById("mgrSort");
  if (ms)
    ms.addEventListener("click", function () {
      var O = ["wake", "time", "target", "weekly", "check", "todo", "scale", "limit"];
      qDraft.sort(function (a, b) {
        return O.indexOf(a.type) - O.indexOf(b.type);
      });
      drawMgr("Sorted by type. Save to keep this order.");
    });
  qmgr.querySelectorAll("[data-drag]").forEach(function (hd) {
    hd.addEventListener("keydown", function (ev) {
      if (ev.key !== "ArrowUp" && ev.key !== "ArrowDown") return;
      ev.preventDefault();
      var i = +hd.getAttribute("data-drag"),
        j = i + (ev.key === "ArrowUp" ? -1 : 1);
      if (j < 0 || j >= qDraft.length) return;
      qDraft.splice(j, 0, qDraft.splice(i, 1)[0]);
      drawMgr();
      var n = qmgr.querySelector('[data-drag="' + j + '"]');
      if (n) n.focus();
    });
    hd.addEventListener("pointerdown", function (ev) {
      if (ev.button !== undefined && ev.button !== 0) return;
      ev.preventDefault();
      var row = hd.closest(".mq"),
        moved = false;
      row.classList.add("dragging");
      function mv(e) {
        var rows = [].slice.call(qmgr.querySelectorAll(".mq[data-idx]")),
          placed = false;
        if (e.clientY < 60) window.scrollBy(0, -12);
        else if (e.clientY > window.innerHeight - 60) window.scrollBy(0, 12);
        for (var r = 0; r < rows.length; r++) {
          var el = rows[r];
          if (el === row) continue;
          var bb = el.getBoundingClientRect();
          if (e.clientY < bb.top + bb.height / 2) {
            if (el.previousElementSibling !== row) {
              el.parentNode.insertBefore(row, el);
              moved = true;
            }
            placed = true;
            break;
          }
        }
        if (!placed) {
          var last = rows
            .filter(function (x) {
              return x !== row;
            })
            .pop();
          if (last && last.nextElementSibling !== row) {
            last.parentNode.insertBefore(row, last.nextSibling);
            moved = true;
          }
        }
      }
      function up() {
        document.removeEventListener("pointermove", mv);
        document.removeEventListener("pointerup", up);
        document.removeEventListener("pointercancel", up);
        row.classList.remove("dragging");
        if (moved) {
          var order = [].slice.call(qmgr.querySelectorAll(".mq[data-idx]")).map(function (x) {
            return +x.getAttribute("data-idx");
          });
          qDraft = order
            .map(function (k) {
              return qDraft[k];
            })
            .concat(
              qDraft.filter(function (_, k) {
                return order.indexOf(k) < 0;
              }),
            );
          drawMgr("Order changed. Save to keep it.");
        }
      }
      document.addEventListener("pointermove", mv);
      document.addEventListener("pointerup", up);
      document.addEventListener("pointercancel", up);
    });
  });
  var mc = document.getElementById("mgrClear"),
    mca = null;
  if (mc)
    mc.addEventListener("click", function () {
      if (!mca) {
        mc.textContent = "Confirm clear";
        mca = setTimeout(function () {
          mca = null;
          mc.textContent = "Clear all quests";
        }, 4000);
        return;
      }
      clearTimeout(mca);
      qDraft = [];
      drawMgr("All quests removed. Save to confirm, or Cancel to keep them.");
    });
  qmgr.querySelectorAll("[data-msave]").forEach(function (x) {
    x.addEventListener("click", saveMgr);
  });
}
export function saveMgr() {
  var T = todayKey();
  var ovm = overDays(qDraft);
  if (ovm.length) {
    drawMgr(
      ovm
        .map(function (o) {
          return WDN[o.w] + ": " + o.n;
        })
        .join(", ") +
        " quests. That\u2019s over your daily limit of " +
        capOf() +
        ". Untick some days, make one optional, or pause or complete one.",
    );
    return;
  }
  {
    var bad = qDraft.filter(function (q) {
      return (
        !(q.label || "").trim() ||
        (q.type === "weekly" && !(q.min > 0)) ||
        (q.type === "time" && !(q.min >= 0)) ||
        (q.type === "target" && !(q.min > 0 && (+q.step || 1) > 0)) ||
        (q.type === "limit" && !(q.max >= 0)) ||
        (q.type === "time" && q.lim && q.lim < (q.roll ? 5 : q.min)) ||
        (q.type === "scale" && !(q.min >= 1 && q.min <= (q.scale || 5))) ||
        (q.type === "wake" && !(q.from && q.to && q.from < q.to)) ||
        (q.days && !q.days.length)
      );
    })[0];
    if (bad) {
      drawMgr("Check " + (bad.label || "a quest") + ": it needs a name and valid values.");
      return;
    }
    qDraft.forEach(function (q) {
      if (q.type === "weekly" || q.type === "todo") {
        delete q.days;
        delete q.opt;
      }
      if (q.type === "todo" && !q.due) delete q.due;
      q.label = q.label.trim();
      if (q.note != null && !String(q.note).trim()) delete q.note;
    });
    var c5 = clone(cfg()),
      oldQ = clone(c5.quests),
      ids = easedIds(oldQ, qDraft, T);
    var g = guardEasing(c5, oldQ, ids);
    c5.quests = qDraft;
    saveCfg(c5);
    if (S.days[T]) {
      S.days[T] = Object.assign({}, S.days[T], { q: activeDefs(T) });
      dirty[T] = true;
      cache();
      clearTimeout(G.timer);
      G.timer = setTimeout(flush, 300);
    }
    G.qSig = "";
    closeMgr();
    setSync(
      g.eased
        ? "Saved. " +
            g.eased +
            " easing change" +
            (g.eased === 1 ? "" : "s") +
            " take" +
            (g.eased === 1 ? "s" : "") +
            " effect tomorrow."
        : "Quests saved",
    );
  }
}

/* Runs once at startup, in file-number order (main.js). */
export function init() {
  qmgr = document.getElementById("qmgr");
  qDraft = null;
  G.mgrOpen = false;
  mqOpenId = null;
  mgrSheet = document.getElementById("mgrSheet");
  document.getElementById("mgrBody").appendChild(qmgr);
  mqMore = {};
  document.getElementById("mgrSaveTop").addEventListener("click", function () {
    var b = qmgr.querySelector("[data-msave]");
    if (b) b.click();
  });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && !mgrSheet.hidden && document.getElementById("gModal").hidden) {
      var b = qmgr.querySelector("[data-mcancel]");
      if (b) b.click();
      else closeMgr();
    }
  });
  document.getElementById("mgrCancelTop").addEventListener("click", function () {
    var b = qmgr.querySelector("[data-mcancel]");
    if (b) b.click();
    else closeMgr();
  });
  TN = {
    time: "Time",
    target: "Target",
    limit: "Limit",
    check: "Check",
    todo: "To-do",
    weekly: "Weekly",
    wake: "Clock time",
    scale: "Rating",
  };
  LIB = [
    { label: "Wake up on time", type: "wake", from: "06:00", to: "07:30" },
    { label: "In bed on time", type: "wake", from: "21:00", to: "23:00", note: "log it when you get into bed" },
    { label: "Workout", type: "time", min: 30 },
    { label: "Study", type: "time", min: 60 },
    { label: "Read", type: "time", min: 20 },
    { label: "Practice an instrument", type: "time", min: 30 },
    { label: "Learn a language", type: "time", min: 15 },
    { label: "Meditate", type: "time", min: 10 },
    { label: "Deep work", type: "time", min: 90 },
    { label: "Steps", type: "target", min: 8000, ul: "steps", step: 500 },
    { label: "Drink water", type: "target", min: 8, ul: "glasses", step: 1 },
    { label: "Vegetables", type: "target", min: 5, ul: "servings", step: 1 },
    { label: "Pages read", type: "target", min: 20, ul: "pages", step: 5 },
    { label: "Distance", type: "target", min: 5, ul: "km", step: 0.5 },
    { label: "Journal", type: "check" },
    { label: "Make the bed", type: "check" },
    { label: "Tidy up", type: "check" },
    { label: "Plan tomorrow", type: "check" },
    { label: "No alcohol", type: "check" },
    { label: "Call a friend or family", type: "check", opt: true },
    { label: "Screen time", type: "limit", max: 120, unit: "min" },
    { label: "Social media", type: "limit", max: 30, unit: "min" },
    { label: "Caffeine", type: "limit", max: 2, ul: "cups" },
    { label: "Snacks", type: "limit", max: 1, ul: "snacks" },
    { label: "Spending", type: "limit", max: 20, ul: "$" },
    { label: "Mood", type: "scale", scale: 5, min: 3, opt: true },
    { label: "Energy", type: "scale", scale: 5, min: 3, opt: true },
    { label: "Focus", type: "scale", scale: 10, min: 6 },
  ];
  document.getElementById("qEditBtn").addEventListener("click", function () {
    G.mgrOpen ? closeMgr() : openMgr();
  });
  renderRules();
  applyTheme();
  renderSettings();
}
