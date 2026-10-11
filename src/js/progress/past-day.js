/* 2. past day modal */
import { S } from "../core/00-state.js";
import { parse, todayKey } from "../core/days.js";
import { esc } from "../core/util.js";
import { doWrap } from "./49-wrap-up.js";
import { compute } from "../rules/compute.js";
import { bases, gold, hasEntry } from "../rules/day-rules.js";
import { isVac } from "../rules/modes.js";
import { defsOf, reqOf } from "../rules/quests-on-day.js";
import { dayXP } from "../rules/xp.js";
import { lastSt } from "../ui/04-render.js";
import { closeG, openG, qList } from "../ui/18-modal.js";

export function openDayModal(k) {
  var e = S.days[k] || {},
    st = lastSt || compute(),
    m = st.marks[k] || "miss",
    defs = defsOf(e);
  var label =
    {
      lost:
        "Lost: a weekly total was missed that " +
        (function () {
          var x = (st.lost || []).filter(function (l) {
            return k >= l.from && k <= l.k;
          })[0];
          return x ? (x.mid ? "halfway checkpoint" : "period") + " (" + x.q.join(", ") + ")" : "period";
        })(),
      frozen: "Missed, saved by a streak freeze",
      pause: "Streaks paused: tracking only",
      rest: isVac(k) ? "Vacation day" : "Rest day",
      ok: gold(e) ? "Gold day" : "Cleared",
      miss: "Missed",
      grace: "Missed (grace day)",
      pend: "Not logged",
    }[m] || "Missed";
  openG(parse(k).toLocaleDateString("en-CA", { weekday: "long", month: "long", day: "numeric" }), function (b) {
    var h =
      '<p class="mhead ' +
      (m === "ok" ? "good" : m === "rest" || m === "frozen" || m === "pause" ? "" : "bad") +
      '">' +
      label +
      (m !== "rest" ? " \u00b7 " + bases(e) + "/" + reqOf(defs).length + " done" : "") +
      (m === "pause" ? "" : " \u00b7 +" + dayXP(e) + " XP") +
      "</p>";
    if (!hasEntry(e)) h += '<p class="help">Nothing was logged this day.</p>';
    else h += qList(e, defs);
    if (S.refl[k]) h += '<p class="sh2">Reflection</p><p class="help">' + esc(S.refl[k].text || "") + "</p>";
    h +=
      '<p class="help">' +
      (k === todayKey() ? "Today is ended and locked." : "Past days are locked.") +
      '</p><div class="edrow end"><button type="button" class="stone" id="dmWrap">Download wrap-up</button><button type="button" class="stone" id="dmClose">Close</button></div>';
    b.innerHTML = h;
    b.querySelector("#dmClose").addEventListener("click", closeG);
    var wb = b.querySelector("#dmWrap");
    wb.addEventListener("click", function () {
      doWrap(k, wb);
    });
  });
}
