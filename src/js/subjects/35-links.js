/* ---- quest <-> subject links: the topics and subjects a quest feeds ---- */
import { S } from "../core/00-state.js";
import { esc } from "../core/util.js";
import { defsOf } from "../rules/quests-on-day.js";
import { sjFold, subjList } from "./32-subjects.js";
import { topicStats } from "./33-topics.js";
import { go } from "../ui/44-navigation.js";
import { popMenu } from "../ui/menus.js";

export var LV;

export function subjById(id) {
  return subjList().filter(function (s) {
    return s.id === id;
  })[0];
}
export function qSubjs(q) {
  var L = q && q.subjs && q.subjs.length ? q.subjs.slice() : q && q.subj ? [q.subj] : [];
  return L.filter(function (id) {
    return subjById(id);
  });
}
export function setSubjs(q, L) {
  L = (L || []).filter(function (x, i, a) {
    return x && a.indexOf(x) === i;
  });
  if (L.length) {
    q.subjs = L;
    q.subj = L[0];
  } else {
    delete q.subjs;
    delete q.subj;
    delete q.topics;
    if (q.fin && q.fin.t !== "total") delete q.fin;
  }
}
export function topicById(tid) {
  var r = null;
  subjList().some(function (s) {
    return (s.topics || []).some(function (t) {
      if (t.id === tid) {
        r = { s: s, t: t };
        return true;
      }
      return false;
    });
  });
  return r;
}
export function qTopics(q) {
  return ((q && q.topics) || []).filter(function (t, i, a) {
    return topicById(t) && a.indexOf(t) === i;
  });
}
export function qTopicPool(q) {
  var L = qTopics(q),
    out = L.slice();
  qSubjs(q).forEach(function (sid) {
    if (
      L.some(function (t) {
        return topicById(t).s.id === sid;
      })
    )
      return;
    (subjById(sid).topics || []).forEach(function (t) {
      out.push(t.id);
    });
  });
  return out;
}
export function setLinks(q, L, SL) {
  L = L.filter(function (x, i, a) {
    return a.indexOf(x) === i;
  });
  if (L.length) q.topics = L;
  else delete q.topics;
  setSubjs(q, SL);
  if (q.fin && q.fin.t === "topic" && !qTopics(q).length) delete q.fin;
}
export function linkTopic(q, tid) {
  var o = topicById(tid);
  if (!o) return;
  var L = qTopics(q),
    SL = qSubjs(q),
    k = L.indexOf(tid),
    sid = o.s.id;
  if (k >= 0) L.splice(k, 1);
  else L.push(tid);
  var has = L.some(function (x) {
    return topicById(x).s.id === sid;
  });
  if (has && SL.indexOf(sid) < 0) SL.push(sid);
  if (!has)
    SL = SL.filter(function (x) {
      return x !== sid;
    });
  setLinks(q, L, SL);
}
export function subjFull(q, sid) {
  var sj = subjById(sid),
    T = (sj && sj.topics) || [],
    L = qTopics(q);
  return T.length
    ? T.every(function (t) {
        return L.indexOf(t.id) >= 0;
      })
    : qSubjs(q).indexOf(sid) >= 0;
}
export function linkSubj(q, sid) {
  var sj = subjById(sid);
  if (!sj) return;
  var L = qTopics(q),
    SL = qSubjs(q),
    ids = (sj.topics || []).map(function (t) {
      return t.id;
    });
  if (subjFull(q, sid)) {
    L = L.filter(function (x) {
      return ids.indexOf(x) < 0;
    });
    SL = SL.filter(function (x) {
      return x !== sid;
    });
  } else {
    L = L.concat(ids);
    if (SL.indexOf(sid) < 0) SL.push(sid);
  }
  setLinks(q, L, SL);
}
export function topicPick(attr, q) {
  var SJ = subjList();
  if (!SJ.length) return "";
  var L = qTopics(q),
    SL = qSubjs(q);
  return (
    '<div class="tppick" role="group" aria-label="Feeds topics">' +
    SJ.map(function (sj) {
      var T = sj.topics || [],
        full = subjFull(q, sj.id);
      return (
        '<div class="tpg" data-sid="' +
        sj.id +
        '"><div class="tpg-h"><span class="tpg-n">' +
        esc(sj.name) +
        "</span>" +
        (T.length
          ? '<button type="button" class="lnk" ' +
            attr +
            ' data-lsj="' +
            sj.id +
            '">' +
            (full ? "None" : "All") +
            "</button>"
          : "") +
        '</div><div class="sjpick">' +
        (T.length
          ? T.map(function (t) {
              var on = L.indexOf(t.id) >= 0;
              return (
                '<button type="button" class="stone mini' +
                (on ? " on" : "") +
                '" ' +
                attr +
                ' data-ltp="' +
                t.id +
                '" aria-pressed="' +
                on +
                '">' +
                esc(t.name) +
                " <small>" +
                (t.p || 0) +
                "/5</small></button>"
              );
            }).join("")
          : '<button type="button" class="stone mini' +
            (full ? " on" : "") +
            '" ' +
            attr +
            ' data-lsj="' +
            sj.id +
            '" aria-pressed="' +
            full +
            '">Whole subject</button><span class="tpg-e">No topics yet</span>') +
        "</div></div>"
      );
    }).join("") +
    "</div>"
  );
}
export function wireTopicPick(root, getQ, redraw) {
  root.querySelectorAll("[data-ltp]").forEach(function (x) {
    x.addEventListener("click", function () {
      linkTopic(getQ(x), x.getAttribute("data-ltp"));
      redraw();
    });
  });
  root.querySelectorAll("[data-lsj]").forEach(function (x) {
    x.addEventListener("click", function () {
      linkSubj(getQ(x), x.getAttribute("data-lsj"));
      redraw();
    });
  });
}
/* Floating list of what a quest feeds (the "…" box on its row): each topic with its level, or the subject itself when it has no topics; tapping one opens that subject. */
export function openSubjPick(q, btn) {
  var pool = qTopicPool(q),
    items = [];
  pool.forEach(function (tid) {
    var x = topicById(tid);
    if (!x) return;
    items.push([
      esc(x.s.name) +
        " \u203a " +
        esc(x.t.name) +
        " \u00b7 " +
        (x.t.p || 0) +
        "/5" +
        (topicStats(x.t).due ? ' <i class="rdot"></i>' : ""),
      function () {
        jumpSubj(x.s.id);
      },
    ]);
  });
  qSubjs(q).forEach(function (sid) {
    var sj = subjById(sid);
    if (
      sj &&
      !pool.some(function (tid) {
        var x = topicById(tid);
        return x && x.s.id === sid;
      })
    )
      items.push([
        esc(sj.name) + " \u00b7 No topics yet",
        function () {
          jumpSubj(sid);
        },
      ]);
  });
  if (!items.length) return;
  if (btn) popMenu(btn, items);
  else items[0][1]();
}
export function jumpSubj(id) {
  go("subjects");
  setTimeout(function () {
    var c = document.querySelector('.sjsec[data-sid="' + id + '"]');
    if (c && c.classList.contains("fold")) sjFold(id);
    if (c) {
      c.scrollIntoView({ block: "center" });
      c.classList.add("flash");
      setTimeout(function () {
        c.classList.remove("flash");
      }, 1500);
    }
  }, 50);
}
export function subjMinutes(sid) {
  var t = 0;
  Object.keys(S.days).forEach(function (d) {
    var e = S.days[d];
    if (!e) return;
    defsOf(e).forEach(function (q) {
      if (q.type === "time" && qSubjs(q).indexOf(sid) >= 0) t += e[q.id] | 0;
    });
  });
  return t;
}

/* Runs once at startup, in file-number order (main.js). */
export function init() {
  LV = ["", "Novice", "Beginner", "Intermediate", "Advanced", "Expert"];
}
