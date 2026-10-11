/* ---- deadline breakdown ---- */
import { S } from "../core/00-state.js";
import { add, daysBetween } from "../core/days.js";

export function dlMin(q, k) {
  var s = 0;
  for (var d = q.dl.from; d < k; d = add(d, 1)) s += +(S.days[d] || {})[q.id] || 0;
  var rem = Math.max(0, q.dl.total - s),
    days = Math.max(1, daysBetween(k, q.dl.due) + 1);
  return Math.ceil(rem / days);
}
