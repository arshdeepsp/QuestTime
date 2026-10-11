/* ---- today's entry: read with entry(), save with commit() ---- */
import { G } from "./g.js";
import { S, dirty } from "./00-state.js";
import { dayKey, todayKey } from "./days.js";
import { cache, flush } from "./storage.js";
import { activeDefs } from "../rules/quests-on-day.js";
import { render } from "../ui/04-render.js";

export function ro() {
  return !!G.viewKey && G.viewKey !== todayKey();
}
export function locked() {
  return ro();
}
export function entry() {
  if (locked()) return Object.assign({}, S.days[dayKey()] || {});
  var k = dayKey();
  if (!S.days[k]) S.days[k] = {};
  else S.days[k] = Object.assign({}, S.days[k]);
  S.days[k].q = activeDefs(k);
  return S.days[k];
}
export function commit() {
  if (locked()) {
    render();
    return;
  }
  var k = dayKey();
  dirty[k] = true;
  cache();
  render(true);
  clearTimeout(G.timer);
  G.timer = setTimeout(flush, 700);
}
