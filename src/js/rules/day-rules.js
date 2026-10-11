/* ---- whether a quest is met, a limit broken, a day cleared or gold ---- */
function projSum(id, upto) {
  var t = 0;
  Object.keys(S.days).forEach(function (k) {
    if (!upto || k <= upto) t += +(S.days[k] || {})[id] || 0;
  });
  return num(t);
}
function hasEntry(e) {
  return (
    !!e &&
    Object.keys(e).some(function (f) {
      return (
        f !== "q" &&
        f !== "sched" &&
        f !== "schSkip" &&
        f !== "calls" &&
        f !== "ck" &&
        f !== "rep" &&
        f.indexOf("plan_") !== 0 &&
        e[f] !== "" &&
        e[f] != null &&
        e[f] !== 0 &&
        e[f] !== false
      );
    })
  );
}
function metQ(q, e) {
  e = e || {};
  var v = e[q.id];
  if (q.type === "wake") {
    if (!v) return q.id === "wakeAt" && e.wake === true;
    var m = mins(v);
    return m >= mins(q.from) && m <= mins(q.to);
  }
  if (q.type === "time") return timeMet(q, e);
  if (q.type === "limit") return (v | 0) <= q.max;
  if (q.type === "check" || q.type === "weekly" || q.type === "todo") return v === true;
  if (q.type === "target") return num(v) >= q.min;
  if (q.type === "scale") return (v | 0) >= q.min;
  return false;
}
/* Daily limit for a time quest (q.lim, minutes): past it the timer stops and logs, and nothing more is tracked that day. 0 = none. */
function limOf(q) {
  return q && q.type === "time" && q.lim > 0 ? q.lim : 0;
}
function overQ(q, e) {
  return q.type === "limit" && ((e || {})[q.id] | 0) > q.max;
}
function planOf(q, e) {
  return Math.max(q.min, (e || {})["plan_" + q.id] || q.min);
}
function ok(e) {
  if (!hasEntry(e)) return false;
  var dq = reqOf(defsOf(e));
  return (
    dq.length > 0 &&
    dq.every(function (q) {
      return metQ(q, e);
    })
  );
}
function limBroken(e) {
  return (
    !!e &&
    reqOf(defsOf(e)).some(function (q) {
      return overQ(q, e);
    })
  );
}
function gold(e) {
  return (
    ok(e) &&
    reqOf(defsOf(e)).every(function (q) {
      return q.type !== "time" || q.roll || (e[q.id] | 0) >= planOf(q, e);
    })
  );
}
function bases(e) {
  e = e || {};
  return reqOf(defsOf(e)).filter(function (q) {
    return metQ(q, e);
  }).length;
}
