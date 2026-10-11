/* ---- per-quest streaks (display only) ---- */
function qStreakable(q) {
  return !!q && STREAK_TYPES[q.type] && !q.roll;
}
function qDayState(id, d) {
  var cq = cfgQ(id),
    from = cq ? cq.addedOn || firstSeen(id) : null;
  if (from && d < from) return null;
  var q = dayDefMap(d)[id];
  if (!q) {
    if (!cq || !qStreakable(cq)) return null;
    return !scheduled(cq, d) || isPaused(cq, d) || (cq.startOn && d < cq.startOn) ? "skip" : null;
  }
  if (!qStreakable(q)) return null;
  if (q.off || q.ign || !scheduled(q, d)) return "skip";
  return metQ(q, S.days[d] || {}) ? "met" : "miss";
}
function qStreak(id, k) {
  var n = 0,
    d = k,
    st = qDayState(id, k);
  if (st === "miss") d = add(k, -1);
  for (var i = 0; i < 400 && d >= START_KEY; i++, d = add(d, -1)) {
    var x = qDayState(id, d);
    if (x === null) break;
    if (x === "skip") continue;
    if (x === "met") n++;
    else break;
  }
  return n;
}
function qConsist(id, k) {
  var met = 0,
    sch = 0;
  for (var i = 0; i < 30; i++) {
    var d = add(k, -i);
    if (d < START_KEY) break;
    var x = qDayState(id, d);
    if (x === "met") {
      met++;
      sch++;
    } else if (x === "miss") sch++;
  }
  return { met: met, sch: sch };
}
