/* ---- a quest's own reminder ----
     A quest can carry q.rem = "HH:MM" (its editor's More options, or the new-quest form): on each day it's on the list, a
     notification at that time if it isn't done by then. "Done" is what the schedule calls met today (schDayDone): a
     daily quest's minimum or target, ticked, rated; for a total, today's share. Planned like every other reminder in
     nfPlan (pre-scheduled for today and the next 6 days, re-planned on every change), so ticking the quest or logging
     its time cancels today's. Ids 4100 + day × 40 + the quest's place in cfg.quests (the first 40 quests).
     A weekly-X-times quest stops reminding once its week is made.
     Never for limits (nothing to finish), clock-time quests (their window is the reminder), to-dos (they have the
     to-do review) or log-only time quests (never "done"). */
import { S } from "../core/00-state.js";
import { cfg } from "../core/config.js";
import { nativeApp } from "../core/native.js";
import { nf } from "./35d-plan.js";
import { add, parse } from "../core/days.js";
import { esc, hm, num } from "../core/util.js";
import { weekCount } from "../rules/xp.js";
import { logOnly } from "../rules/26-periods.js";
import { activeDefs } from "../rules/quests-on-day.js";
import { schDayDone } from "../schedule/progress.js";
import { schLen } from "../schedule/model.js";

export function remOk(q) {
  return !!q && q.type !== "limit" && q.type !== "wake" && q.type !== "todo" && !logOnly(q);
}
export function remId(day, idx) {
  return 4100 + day * 40 + idx;
}
export function remTime(k, hhmm) {
  var p = parse(k),
    a = String(hhmm).split(":");
  p.setHours(+a[0], +a[1], 0, 0);
  return p;
}
/* Where the quest stands on day k, for the notification and the tap prompt. */
export function remStatus(q, e, k) {
  var v = (e || {})[q.id];
  if (q.type === "time")
    return hm(v | 0) + " of " + hm(q.roll ? schLen(q, k) : q.min) + (q.roll ? " today" : "") + " so far.";
  if (q.type === "target") return num(+v || 0) + " of " + num(q.min) + (q.ul ? " " + q.ul : "") + " so far.";
  if (q.type === "scale") return "Not rated yet.";
  if (q.type === "weekly") return weekCount(q.id, k) + " of " + q.min + " days this week so far.";
  return "Not done yet.";
}
export function questRemPlan(T, push) {
  var L = cfg().quests || [];
  for (var i = 0; i < 7; i++) {
    var k = add(T, i),
      e = S.days[k] || {};
    activeDefs(k).forEach(function (q) {
      if (!q.rem || !/^\d{2}:\d{2}$/.test(q.rem) || !remOk(q) || q.off || q.ign || q.vow) return;
      var idx = -1;
      for (var j = 0; j < L.length; j++)
        if (L[j].id === q.id) {
          idx = j;
          break;
        }
      if (idx < 0 || idx >= 40) return;
      /* A weekly-X-times quest whose week is already made needs no nudge on its other days. */
      if (q.type === "weekly" && weekCount(q.id, k) >= q.min) return;
      if (i === 0) {
        if (schDayDone(q, e, k)) return;
        if (S.timer && S.timer.id === q.id) return;
        if (S.pomo && S.pomo.q === q.id) return;
      }
      push(remId(i, idx), q.label + " isn’t done yet", remStatus(q, e, k), remTime(k, q.rem), { q: q.id });
    });
  }
}
/* Editor field (quest editor and new-quest form): "Remind me if not done by" + a time; attr = the form's data key. */
export function remField(q, attr) {
  if (!remOk(q)) return "";
  var n = nf(),
    why = !nativeApp()
      ? "Sent by the Android app"
      : !n.on
        ? "Notifications are off (Settings › Notifications)"
        : !n.qrem
          ? "Quest reminders are off (Settings › Notifications)"
          : "";
  return (
    '<div class="edrow"><label class="grow">Remind me if not done by<input type="time" class="remt" ' +
    attr +
    ' value="' +
    esc(q.rem || "") +
    '" aria-label="Reminder time"></label>' +
    (why ? '<p class="help">' + why + "</p>" : "") +
    "</div>"
  );
}
