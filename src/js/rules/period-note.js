/* ---- period totals: what this week (or 2 weeks / month) still needs ---- */
import { DAYF } from "../core/00-state.js";
import { parse, todayKey } from "../core/days.js";
import { esc, fmtD, hm, num } from "../core/util.js";
import { midDay, midNeed, perEnd, perOf, periodList, rollFmt, rollNeed, rollSum, weekTarget } from "./26-periods.js";
import { rewardsOff } from "./modes.js";
import { closeG, openG } from "../ui/18-modal.js";

/* Before the halfway checkpoint the goal shown is a third of the target by that day; after it, the full target by period end. */
export function periodStatus(T) {
  return periodList(T)
    .map(function (q) {
      var s = rollSum(q.id, T, q),
        full = weekTarget(q, T),
        md = midDay(q, T),
        pre = md && T <= md && md !== perEnd(q, T) && s < midNeed(q, T),
        tg = pre ? midNeed(q, T) : full;
      return { q: q, s: s, tg: tg, full: full, mid: !!pre, end: pre ? md : perEnd(q, T), behind: s < rollNeed(q, T) };
    })
    .filter(function (x) {
      return x.full > 0;
    });
}
export function openCarryInfo() {
  openG("Weekly totals", function (b) {
    var P = periodStatus(todayKey());
    b.innerHTML =
      '<p class="help">Day to day, only your daily quests count toward clearing days. A total quest (time or a count, over a week, 2 weeks or a calendar month) is checked twice.</p><p class="help"><b>Halfway:</b> by the end of the middle work day you need a third of the total. Miss it and the days so far are lost and your streak resets.</p><p class="help"><b>At the end:</b> reach the full total and the days you cleared stand. Miss it and the whole period is lost.</p><p class="help">The pace shown on each total is a guide to finish on time: fall behind and the gap is spread over the work days left.</p>' +
      (P.length
        ? '<div class="mlist">' +
          P.map(function (x) {
            var ok_ = x.s >= x.tg;
            return (
              '<div class="mrow' +
              (ok_ ? " ok" : x.behind ? " no" : " opt") +
              '"><i class="mk"></i><span class="ml">' +
              esc(x.q.label) +
              " <em>by " +
              esc(DAYF[parse(x.end).getDay()].slice(0, 3)) +
              " " +
              esc(fmtD(x.end)) +
              '</em></span><span class="mv">' +
              rollFmt(x.q, x.s) +
              " of " +
              rollFmt(x.q, x.tg) +
              (x.mid ? " (a third)" : "") +
              "</span></div>"
            );
          }).join("") +
          "</div>"
        : "") +
      '<div class="edrow end"><button type="button" class="stone" id="ciOk">Got it</button></div>';
    b.querySelector("#ciOk").addEventListener("click", closeG);
  });
}
export function renderCarryNote() {
  var el = document.getElementById("carryNote");
  if (!el) return;
  var T = todayKey(),
    P = rewardsOff()
      ? []
      : periodStatus(T).filter(function (x) {
          return x.s < x.tg;
        });
  if (!P.length) {
    el.hidden = true;
    return;
  }
  el.hidden = false;
  var hot = P.some(function (x) {
      return x.behind;
    }),
    last = P.some(function (x) {
      return x.end === T;
    });
  el.innerHTML =
    "<span>" +
    esc(
      (last
        ? "Checkpoint today: "
        : "Keep this " +
          (P.every(function (x) {
            return !perOf(x.q);
          })
            ? "week"
            : "period") +
          ": ") +
        P.map(function (x) {
          return (
            x.q.label +
            " " +
            (x.q.type === "time" ? hm(x.s) + "/" + hm(x.tg) : num(x.s) + "/" + rollFmt(x.q, x.tg)) +
            (x.end === T ? "" : " by " + DAYF[parse(x.end).getDay()].slice(0, 3))
          );
        }).join(" \u00b7 ") +
        (last ? " \u2014 or the days so far are lost." : ""),
    ) +
    '</span><i class="sq" aria-hidden="true">?</i>';
  el.className = "carrynote" + (last && hot ? " hot" : hot ? " warm" : "");
  el.setAttribute("aria-label", "How period totals work");
  if (!el.dataset.w) {
    el.dataset.w = 1;
    el.setAttribute("role", "button");
    el.tabIndex = 0;
    el.addEventListener("click", openCarryInfo);
  }
}
