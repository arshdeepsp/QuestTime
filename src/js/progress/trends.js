/* ---- trends ---- */
import { S, START_KEY } from "../core/00-state.js";
import { cfg } from "../core/config.js";
import { add, dayWin, daysBetween, parse, todayKey, weekStart } from "../core/days.js";
import { esc, fmtD, hm, svg } from "../core/util.js";
import { compute } from "../rules/compute.js";
import { gold, hasEntry, metQ } from "../rules/day-rules.js";
import { noStreakOn, rewardsOff } from "../rules/modes.js";
import { defsOf } from "../rules/quests-on-day.js";
import { schAll } from "../schedule/model.js";
import { subjList } from "../subjects/32-subjects.js";
import { allTopics, topicFlat, topicName, topicStats } from "../subjects/33-topics.js";
import { topicById } from "../subjects/35-links.js";
import { lastSt } from "../ui/04-render.js";

export function svgBars(vals, labs, mx, col, fmt) {
  var W = 560,
    H = 170,
    n = vals.length,
    bw = Math.floor((W - 20) / n) - 6,
    o = '<svg viewBox="0 0 ' + W + " " + (H + 34) + '" class="tchart" role="img" shape-rendering="crispEdges">';
  o += '<rect x="0" y="' + H + '" width="' + W + '" height="3" fill="#555"/>';
  vals.forEach(function (v, i) {
    var h = mx ? Math.round((v / mx) * (H - 24)) : 0,
      x = 10 + i * (bw + 6);
    o += '<rect x="' + x + '" y="' + (H - h) + '" width="' + bw + '" height="' + h + '" fill="' + col + '"/>';
    if (v)
      o +=
        '<text x="' + (x + bw / 2) + '" y="' + (H - h - 6) + '" text-anchor="middle" class="tv">' + fmt(v) + "</text>";
    o += '<text x="' + (x + bw / 2) + '" y="' + (H + 24) + '" text-anchor="middle" class="tl">' + labs[i] + "</text>";
  });
  return o + "</svg>";
}
export function renderTrends() {
  var el = document.getElementById("trendsBody");
  if (!el) return;
  var T = todayKey(),
    st = lastSt || compute(),
    ws0 = weekStart(T);
  function focusOf(d) {
    var e = S.days[d] || {},
      m = 0;
    defsOf(e).forEach(function (q) {
      if (q.type === "time") m += e[q.id] | 0;
    });
    return m;
  }
  function span(a, b) {
    var s = 0;
    for (var d = a; d <= b; d = add(d, 1)) if (d >= START_KEY) s += focusOf(d);
    return s;
  }
  function planKept(d) {
    var e = S.days[d] || {},
      D2 = defsOf(e),
      bl = schAll(d).filter(function (b) {
        return (
          b.q &&
          !D2.some(function (x) {
            return x.id === b.q && x.ign;
          })
        );
      });
    if (!bl.length) return null;
    var qs = bl
      .map(function (b) {
        return b.q;
      })
      .filter(function (x, i, a) {
        return a.indexOf(x) === i;
      });
    return qs.every(function (id) {
      var q = D2.filter(function (x) {
        return x.id === id;
      })[0];
      return q && metQ(q, e);
    });
  }
  var nIn = daysBetween(ws0, T),
    thisW = span(ws0, T),
    lastW = span(add(ws0, -7), add(ws0, -7 + nIn)),
    dW = thisW - lastW;
  var clr = 0,
    dIn = 0,
    deep = 0,
    calls = 0,
    ttW = {},
    plN = 0,
    plK = 0;
  var off = rewardsOff(),
    lgd = 0;
  for (var d = ws0; d <= T; d = add(d, 1)) {
    if (d < START_KEY) continue;
    dIn++;
    if (st.marks[d] === "ok") clr++;
    if (hasEntry(S.days[d])) lgd++;
    var e = S.days[d] || {};
    deep += (e.sess || []).filter(function (z) {
      return z.m >= 90;
    }).length;
    calls += e.calls | 0;
    Object.keys(e.tt || {}).forEach(function (id) {
      ttW[id] = (ttW[id] || 0) + (e.tt[id] | 0);
    });
    var pk = planKept(d);
    if (pk !== null && (d < T || pk)) {
      plN++;
      if (pk) plK++;
    }
  }
  var ttTot = 0,
    ttTop = null;
  Object.keys(ttW).forEach(function (id) {
    if (!topicById(id)) return;
    ttTot += ttW[id];
    if (!ttTop || ttW[id] > ttW[ttTop]) ttTop = id;
  });
  var gold30 = 0,
    bestDay = 0,
    bestDayK = null,
    longest = 0,
    tt28 = {},
    hrs = [],
    lv30 = 0;
  for (var hz = 0; hz < 24; hz++) hrs.push(0);
  Object.keys(S.days).forEach(function (k) {
    if (k < START_KEY || k > T) return;
    var e = S.days[k];
    if (k >= add(T, -29) && !noStreakOn(k) && gold(e)) gold30++;
    var f = focusOf(k);
    if (f > bestDay) {
      bestDay = f;
      bestDayK = k;
    }
    (e.sess || []).forEach(function (z) {
      if (z.m > longest) longest = z.m;
    });
    if (k >= add(T, -27))
      Object.keys(e.tt || {}).forEach(function (id) {
        tt28[id] = (tt28[id] || 0) + (e.tt[id] | 0);
      });
    if (k >= add(T, -29))
      (e.sess || []).forEach(function (z) {
        for (var t = z.s; t < z.e; ) {
          var dt = new Date(t),
            nx = new Date(dt.getFullYear(), dt.getMonth(), dt.getDate(), dt.getHours() + 1).getTime(),
            en = Math.min(z.e, nx);
          hrs[dt.getHours()] += (en - t) / 60000;
          t = en;
        }
      });
  });
  subjList().forEach(function (s) {
    (s.topics || []).forEach(function (t) {
      var h = (t.hist || [])
          .filter(function (x) {
            return x.d < add(T, -29);
          })
          .pop(),
        from = h ? h.p : ((t.hist || [])[0] || { p: t.p || 0 }).p;
      if ((t.p || 0) > from) lv30 += (t.p || 0) - from;
    });
  });
  var wk = [],
    labs = [],
    bestWeek = 0;
  for (var i = 7; i >= 0; i--) {
    var ws = add(ws0, -7 * i);
    wk.push(ws);
    labs.push(parse(ws).toLocaleDateString("en-CA", { month: "short", day: "numeric" }));
    var wf = span(ws, add(ws, 6));
    if (wf > bestWeek) bestWeek = wf;
  }
  var cleared = wk.map(function (ws) {
    var n = 0;
    for (var j = 0; j < 7; j++) {
      var dd = add(ws, j);
      if (rewardsOff() ? dd >= START_KEY && dd <= T && hasEntry(S.days[dd]) : st.marks[dd] === "ok") n++;
    }
    return n;
  });
  var done = cfg().quests.filter(function (q) {
    return q.completed && q.completed.how !== "archived";
  }).length;
  function tile(col, icon, label, big, sub, cls) {
    return (
      '<div class="ttile" style="--tc:' +
      col +
      '"><div class="tt-i">' +
      svg(icon) +
      '</div><div class="tt-b"><div class="tt-l">' +
      label +
      '</div><div class="tt-v">' +
      big +
      "</div>" +
      (sub ? '<div class="tt-s ' + (cls || "") + '">' + sub + "</div>" : "") +
      "</div></div>"
    );
  }
  var h =
    '<div class="tsec"><div class="tsec-h">This week</div><div class="tgrid">' +
    tile(
      "#3C8527",
      "clock",
      "Focus time",
      hm(thisW),
      dW === 0 ? "Same as last week" : (dW > 0 ? "▲ " + hm(dW) : "▼ " + hm(-dW)) + " vs last week",
      dW > 0 ? "up" : dW < 0 ? "dn" : "",
    ) +
    (off
      ? tile("#2C6FB0", "metronome", "Days logged", lgd + "/" + Math.max(1, dIn), "Casual mode")
      : tile(
          "#2C6FB0",
          "metronome",
          "Days cleared",
          clr + "/" + Math.max(1, dIn),
          clr === dIn && dIn ? "Perfect so far!" : "Streak " + st.streak + "d",
        )) +
    tile("#8A3A9E", "book", "Topic time", hm(ttTot), ttTop ? "Most: " + esc(topicName(ttTop)) : "No topic time yet") +
    tile(
      "#C0392B",
      "calendar",
      "Plan kept",
      plN ? plK + "/" + plN : "—",
      plN ? "planned days" : planKept(T) === false ? "Today’s plan in progress" : "Nothing scheduled",
    ) +
    tile("#B8860B", "bell", "Reminders", calls, "answered in 2 min") +
    tile("#16A085", "dumbbell", "Deep sessions", deep, "90+ min unbroken") +
    "</div></div>";
  var TL = Object.keys(tt28)
      .filter(function (id) {
        return topicById(id) && tt28[id] > 0;
      })
      .sort(function (a, b) {
        return tt28[b] - tt28[a];
      })
      .slice(0, 6),
    mx = TL.length ? tt28[TL[0]] : 0,
    nFlat = allTopics().filter(function (o) {
      return topicFlat(o.t);
    }).length,
    due = allTopics().filter(function (o) {
      return topicStats(o.t).due;
    }).length;
  h +=
    '<div class="tsec"><div class="tsec-h">Topics</div><div class="trcard"><div class="sh2">Time by topic, last 4 weeks</div>' +
    (TL.length
      ? '<div class="ttop">' +
        TL.map(function (id) {
          var o = topicById(id),
            t = o.t,
            p = t.p || 0;
          return (
            '<div class="ttop-r"><div class="ttop-n"><b>' +
            esc(t.name) +
            "</b><small>" +
            esc(o.s.name) +
            " · " +
            p +
            "/5" +
            (t.target ? (p >= t.target ? " ✔" : " → " + t.target + "/5") : "") +
            "</small>" +
            (topicFlat(t) ? '<em class="ttop-flat">level flat</em>' : "") +
            '</div><span class="ttop-m">' +
            hm(tt28[id]) +
            '</span><div class="ttop-b"><i style="width:' +
            Math.max(4, Math.round((tt28[id] / mx) * 100)) +
            '%"></i></div></div>'
          );
        }).join("") +
        "</div>"
      : '<p class="help light">Link quests to topics and time your sessions to see this.</p>') +
    (nFlat
      ? '<p class="ttop-warn">' +
        nFlat +
        " topic" +
        (nFlat === 1 ? "" : "s") +
        " got 5h+ in 4 weeks with no level change. Either the rating is behind, or that time wasn’t really on the topic.</p>"
      : "") +
    '<div class="ttop-f"><span>' +
    (lv30 ? "▲ " + lv30 + " level" + (lv30 === 1 ? "" : "s") + " gained in 30 days" : "No level changes in 30 days") +
    "</span><span" +
    (due ? ' class="dn"' : "") +
    ">" +
    (due ? due + " due for review" : "Nothing due for review") +
    "</span></div></div></div>";
  var w = dayWin(T),
    h0 = Math.floor(w.s / 60),
    h1 = Math.ceil(w.e / 60),
    hv = [],
    hl = [];
  for (var hh = h0; hh < h1; hh++) {
    var hx = hh % 24;
    hv.push(Math.round(hrs[hx]));
    hl.push(hx % 3 === 0 ? String(hx) : "");
  }
  var hasH = hv.some(function (v) {
      return v > 0;
    }),
    peak = 0;
  hv.forEach(function (v, i) {
    if (v > hv[peak]) peak = i;
  });
  h +=
    '<div class="tsec"><div class="tsec-h">Charts</div><div class="tcharts"><div class="trcard"><div class="sh2">Focus time, last 14 days</div>';
  var daysL = [],
    dl = [];
  for (var k2 = 13; k2 >= 0; k2--) {
    var d2 = add(T, -k2);
    daysL.push(d2 < START_KEY ? 0 : focusOf(d2));
    dl.push(parse(d2).toLocaleDateString("en-CA", { weekday: "narrow" }));
  }
  h +=
    svgBars(daysL, dl, Math.max(60, ...daysL), "#FFD23F", function (v) {
      return v >= 60 ? Math.round((v / 60) * 10) / 10 + "h" : v + "m";
    }) +
    "</div>" +
    '<div class="trcard"><div class="sh2">When you focus, last 30 days</div>' +
    (hasH
      ? svgBars(hv, hl, Math.max(30, ...hv), "#7D86C9", function () {
          return "";
        }) +
        '<p class="tnote">Most focus around ' +
        ((h0 + peak) % 24) +
        ":00</p>"
      : '<p class="help light">Time a few sessions to see your best hours.</p>') +
    "</div>" +
    '<div class="trcard"><div class="sh2">' +
    (off ? "Days logged per week" : "Days cleared per week") +
    "</div>" +
    svgBars(cleared, labs, 7, "#7FE05A", function (v) {
      return v;
    }) +
    "</div></div></div>";
  h +=
    '<div class="tsec"><div class="tsec-h">Records</div><div class="tgrid five">' +
    tile("#C0392B", "trophy", "Best focus day", hm(bestDay), bestDayK ? fmtD(bestDayK) : "—") +
    tile("#16A085", "clock", "Longest session", longest ? hm(longest) : "—", longest >= 90 ? "Deep work!" : "") +
    tile("#D35400", "sprout", "Best week", hm(bestWeek), "last 8 weeks") +
    (off ? "" : tile("#C99A1E", "star", "Gold days", gold30, "last 30 days")) +
    tile("#5D6D7E", "target", "Quests finished", done, "all time") +
    "</div></div>";
  el.innerHTML = h;
}
