/* ---- Challenge and Casual modes, the ignore list, pauses and vacations ---- */
/* Modes. Challenge (default): streak with grace and freezes, period-total checkpoints, badges, grove, easing changes from tomorrow. Casual (a cfg.noStreak range, so history keeps each day's mode): XP, levels and rank still earned and shown; the streak holds (days are neutral), nothing is judged, badges and grove are hidden, and changes apply at once. modeOn(k) names a day's mode; rewardsOff() = today is Casual (kept as the gate name everywhere). Settings are never cleared on a switch — only their application is gated. */
function noStreakOn(k) {
  return ((S.cfg && S.cfg.noStreak) || []).some(function (r) {
    return k >= r.from && (!r.to || k < r.to);
  });
}
function rewardsOff() {
  return noStreakOn(todayKey());
}
/* Ignore list (cfg.ignore = quest ids), Casual only: on a Casual day an ignored quest is optional (o.ign) and kept
     out of the main list, the schedule, Just 5, Pick and reminders. Cleared when streaks come back on. */
function ignoredOn(id, k) {
  return noStreakOn(k) && ((S.cfg && S.cfg.ignore) || []).indexOf(id) >= 0;
}
function noStreakIn(a, b) {
  return ((S.cfg && S.cfg.noStreak) || []).some(function (r) {
    return r.from <= b && (!r.to || r.to > a);
  });
}
function isPaused(q, k) {
  return !!q.pausedUntil && k < q.pausedUntil && (!q.pausedFrom || k >= q.pausedFrom);
}
function isVac(k) {
  return (cfg().vacs || []).some(function (v) {
    return k >= v.from && k < v.to;
  });
}
function curVac() {
  var T = todayKey();
  return (cfg().vacs || []).filter(function (v) {
    return v.to > T;
  })[0];
}
/* Ignore / add back (Casual only): swipe right on a row, or the row menu. */
function setIgnore(id, on) {
  if (!rewardsOff()) return;
  var c2 = clone(cfg()),
    L = (c2.ignore || []).filter(function (x) {
      return x !== id;
    });
  if (on) L.push(id);
  if (L.length) c2.ignore = L;
  else delete c2.ignore;
  saveCfg(c2);
  qSig = "";
  nfSig = "";
  render();
  var q = c2.quests.filter(function (x) {
    return x.id === id;
  })[0];
  setSync(
    (q ? q.label : "Quest") + (on ? " ignored. Swipe right in Ignored to add it back." : " is back on your list."),
  );
}
