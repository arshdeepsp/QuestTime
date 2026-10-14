/* ---- timed sessions and the focus heat map ---- */
import { S, dirty } from "../core/00-state.js";
import { todayKey } from "../core/days.js";
import { cache } from "../core/storage.js";

export function addSession(T, id, start, end) {
  var e = Object.assign({}, S.days[T] || {}),
    ss = (e.sess || []).slice(),
    m = Math.round((end - start) / 60000);
  if (m < 1) return;
  var last = ss[ss.length - 1];
  if (last && last.id === id && start - last.e < 120000) {
    last = Object.assign({}, last, { e: end, m: last.m + m });
    ss[ss.length - 1] = last;
  } else ss.push({ id: id, s: start, e: end, m: m });
  e.sess = ss;
  S.days[T] = e;
  dirty[T] = true;
  cache();
}
export function heat() {
  var T = todayKey(),
    now = Date.now(),
    h = 0,
    hr = (S.days[T] || {}).heatReset || 0;
  ((S.days[T] || {}).sess || []).forEach(function (s) {
    if (s.e <= hr) return;
    var age = Math.max(0, (now - s.e) / 60000);
    h += s.m * Math.exp(-age / 90);
  });
  if (S.timer) h += (now - S.timer.start) / 60000;
  if (S.sprint && S.sprint.phase === "focus" && !S.sprint.paused) h += (now - S.sprint.start) / 60000;
  if (S.pomo && S.pomo.phase === "work" && !S.pomo.paused)
    h += (now - S.pomo.start - (S.pomo.pausedTotal || 0)) / 60000;
  return Math.min(180, h);
}
