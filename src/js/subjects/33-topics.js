/* ---- topic time + review ---- */
function allTopics() {
  var out = [];
  subjList().forEach(function (s) {
    (s.topics || []).forEach(function (t) {
      out.push({ sid: s.id, sname: s.name, t: t });
    });
  });
  return out;
}
function topicName(tid) {
  var x = allTopics().filter(function (o) {
    return o.t.id === tid;
  })[0];
  return x ? x.t.name : "";
}
function addTopicTime(T, tid, m) {
  if (!tid || m < 1) return;
  var e = Object.assign({}, S.days[T] || {});
  e.tt = Object.assign({}, e.tt || {});
  e.tt[tid] = (e.tt[tid] || 0) + m;
  S.days[T] = e;
  dirty[T] = true;
  cache();
  clearTimeout(timer);
  timer = setTimeout(flush, 300);
}
function topicStats(t) {
  var tot = 0,
    mo = 0,
    last = null,
    T = todayKey(),
    m30 = add(T, -29);
  Object.keys(S.days).forEach(function (d) {
    var v = ((S.days[d] || {}).tt || {})[t.id] || 0;
    if (!v) return;
    tot += v;
    if (d >= m30) mo += v;
    if (!last || d > last) last = d;
  });
  (t.hist || []).forEach(function (h) {
    if (!last || h.d > last) last = h.d;
  });
  var age = last ? daysBetween(last, T) : t.created ? daysBetween(t.created, T) : 0;
  return { tot: tot, mo: mo, last: last, due: age >= 14 };
}
function topicSelect(id, sel) {
  var A = allTopics();
  if (!A.length) return "";
  return (
    '<label class="tpk">Topic (optional)<select id="' +
    id +
    '"><option value="">No topic</option>' +
    A.map(function (o) {
      return (
        '<option value="' +
        o.t.id +
        '"' +
        (o.t.id === sel ? " selected" : "") +
        ">" +
        esc(o.sname) +
        " \u203a " +
        esc(o.t.name) +
        "</option>"
      );
    }).join("") +
    "</select></label>"
  );
}
/* Effort without progress: STALL_MIN+ minutes on a topic in the last STALL_DAYS days, and no rise in its rating over that span. */
var STALL_MIN = 300,
  STALL_DAYS = 28;
function topicFlat(t) {
  if (!t || (t.p || 0) >= 5) return null;
  var T = todayKey(),
    from = add(T, -(STALL_DAYS - 1)),
    m = 0;
  Object.keys(S.days).forEach(function (d) {
    if (d >= from && d <= T) m += ((S.days[d] || {}).tt || {})[t.id] | 0;
  });
  if (m < STALL_MIN) return null;
  var h = t.hist || [],
    before = h
      .filter(function (x) {
        return x.d < from;
      })
      .pop(),
    base = before ? before.p : h.length ? h[0].p : t.p || 0;
  return (t.p || 0) > base ? null : { m: m };
}
function topicOrder(L) {
  var last = {};
  Object.keys(S.days).forEach(function (d) {
    var tt = (S.days[d] || {}).tt || {};
    Object.keys(tt).forEach(function (id) {
      if (!last[id] || d > last[id]) last[id] = d;
    });
  });
  return L.map(function (id, i) {
    var o = topicById(id);
    return {
      id: id,
      due: topicStats(o.t).due ? 1 : 0,
      gap: Math.max(0, (o.t.target || 0) - (o.t.p || 0)),
      last: last[id] || "",
      i: i,
    };
  })
    .sort(function (a, b) {
      return b.due - a.due || b.gap - a.gap || (b.last > a.last ? 1 : b.last < a.last ? -1 : 0) || a.i - b.i;
    })
    .map(function (x) {
      return x.id;
    });
}
function defaultTopic(q) {
  return topicOrder(qTopicPool(q))[0] || null;
}
function timerTopicStart(q) {
  if (!S.timer) return;
  S.timer.topic = defaultTopic(q);
  S.timer.tAt = S.timer.start;
  S.timer.tacc = {};
}
function switchTopic(tid) {
  var t = S.timer;
  if (!t || t.topic === tid || !topicById(tid)) return;
  var now = Date.now();
  t.tacc = t.tacc || {};
  if (t.topic) t.tacc[t.topic] = (t.tacc[t.topic] || 0) + now - (t.tAt || t.start);
  t.topic = tid;
  t.tAt = now;
  cache();
  runBox(t.id);
  setTimeout(focusSync, 0);
  setSync("Now on " + topicName(tid));
}
function topicSplit(t, end) {
  var acc = Object.assign({}, t.tacc || {});
  if (t.topic) acc[t.topic] = (acc[t.topic] || 0) + end - (t.tAt || t.start);
  var m = Math.round((end - t.start) / 60000),
    ids = Object.keys(acc),
    out = {},
    sum = 0;
  ids.forEach(function (id) {
    out[id] = Math.floor(acc[id] / 60000);
    sum += out[id];
  });
  ids.sort(function (a, b) {
    return (acc[b] % 60000) - (acc[a] % 60000);
  });
  for (var k = 0; sum < m && k < ids.length; k++) {
    out[ids[k]]++;
    sum++;
  }
  return out;
}
function weekTop() {
  var ws = add(weekStart(todayKey()), -7),
    acc = {};
  for (var d = ws; d <= add(ws, 6); d = add(d, 1)) {
    var tt = (S.days[d] || {}).tt || {};
    Object.keys(tt).forEach(function (id) {
      acc[id] = (acc[id] || 0) + (tt[id] | 0);
    });
  }
  return Object.keys(acc)
    .filter(function (id) {
      return acc[id] >= RERATE_MIN && topicById(id);
    })
    .sort(function (a, b) {
      return acc[b] - acc[a];
    })
    .slice(0, 3)
    .map(function (id) {
      return { id: id, m: acc[id] };
    });
}
/* Due once a week: not shown since this week began, and not in the last 2 days (so moving the week start doesn't ask twice).
     Waits for timers, sprints, other modals and full-screen pages (schedule, quest editor, help, grove). */
/* Weekly check-in: once a week (pc-rerate = the day it was last answered or skipped; due when that's before this week's start and 2+ days ago), the top 3 topics by last week's time (RERATE_MIN each) get a rating card at the top of Subjects (rerateCard/wireRerate, drawn by renderSubjects). Save writes setRating only for ratings changed; Skip just stamps the week. It never blocks another page. */
function rerateDue() {
  var last = "",
    T = todayKey();
  try {
    last = localStorage.getItem("pc-rerate") || "";
  } catch (x) {}
  if (last >= weekStart(T) || (last && daysBetween(last, T) < 2) || locked()) return false;
  return weekTop().length > 0;
}
var rrPick = null,
  rrWeek = "";
function rerateCard() {
  if (!rerateDue()) return "";
  var L = weekTop(),
    ws = weekStart(todayKey());
  if (rrWeek !== ws || !rrPick) {
    rrWeek = ws;
    rrPick = {};
  }
  L.forEach(function (o) {
    if (rrPick[o.id] == null) rrPick[o.id] = topicById(o.id).t.p || 0;
  });
  return (
    '<section class="rrcard" id="rrCard"><div class="rrcard-h"><b>Weekly check-in</b><small>Your top topics last week. Rate what you can do now, not how much time you put in.</small></div><div class="rr">' +
    L.map(function (o) {
      var x = topicById(o.id),
        pv = rrPick[o.id];
      return (
        '<div class="rr-r"><div class="rr-n"><b>' +
        esc(x.t.name) +
        "</b><small>" +
        esc(x.s.name) +
        " \u00b7 " +
        hm(o.m) +
        "</small></div>" +
        pips(pv, 'data-rr="' + o.id + '"') +
        '<span class="rr-l">' +
        PROF[pv] +
        '</span><span class="rr-do">' +
        PROF_DO[pv] +
        "</span>" +
        (topicFlat(x.t) ? '<span class="rr-flat">Lots of time lately, level unchanged.</span>' : "") +
        "</div>"
      );
    }).join("") +
    '</div><div class="edrow end"><button type="button" class="stone" id="rrSkip">Skip this week</button><button type="button" class="stone save" id="rrSave">Save</button></div></section>'
  );
}
function wireRerate(el) {
  var card = el.querySelector("#rrCard");
  if (!card) return;
  function stamp() {
    try {
      localStorage.setItem("pc-rerate", todayKey());
    } catch (x) {}
    rrPick = null;
  }
  card.querySelectorAll("[data-rr]").forEach(function (x) {
    x.addEventListener("click", function () {
      rrPick[x.getAttribute("data-rr")] = +x.getAttribute("data-pv");
      haptic("light");
      renderSubjects();
    });
  });
  card.querySelector("#rrSkip").addEventListener("click", function () {
    stamp();
    renderSubjects();
  });
  card.querySelector("#rrSave").addEventListener("click", function () {
    var pick = rrPick || {};
    saveSubj(function (Ls) {
      Ls.forEach(function (s) {
        (s.topics || []).forEach(function (t) {
          if (pick[t.id] != null && pick[t.id] !== (t.p || 0)) setRating(t, pick[t.id]);
        });
      });
    });
    stamp();
    setSync("Ratings saved");
    render();
    renderSubjects();
  });
}
