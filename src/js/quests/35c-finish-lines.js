/* ---- finish lines: a quest completes when its goal is reached; the trophy shelf ---- */
function finishMet(q) {
  var f = q.fin;
  if (q.dl) {
    var s = 0,
      T = todayKey();
    for (var d = q.dl.from; d <= T; d = add(d, 1)) s += +(S.days[d] || {})[q.id] || 0;
    if (s >= q.dl.total) return "target met";
    if (T > q.dl.due) return "deadline passed";
    return null;
  }
  if (!f) return null;
  if (f.t === "total" && q.total && projSum(q.id) >= q.total) return "project total reached";
  if (f.t === "topic") {
    var TL = qTopicPool(q).map(function (x) {
      return topicById(x).t;
    });
    if (
      TL.length &&
      TL.every(function (t) {
        return (t.p || 0) >= (f.lvl || 4);
      })
    )
      return (TL.length === 1 ? TL[0].name : "All its topics") + " reached " + LV[f.lvl || 4];
  }
  if (f.t === "subject") {
    var SJ2 = qSubjs(q)
      .map(subjById)
      .filter(function (s) {
        return s && (s.topics || []).length;
      });
    if (
      SJ2.length &&
      SJ2.every(function (s) {
        return Math.round(avgProf(s)) >= (f.lvl || 4);
      })
    )
      return (SJ2.length === 1 ? SJ2[0].name : "All its subjects") + " reached " + LV[f.lvl || 4];
  }
  return null;
}
function completeQuest(id, how, silent) {
  var c = clone(cfg()),
    q = c.quests.filter(function (x) {
      return x.id === id;
    })[0];
  if (!q || q.completed) return;
  q.completed = { on: todayKey(), how: how };
  saveCfg(c);
  qSig = "";
  if (!silent && how !== "archived") {
    sfx("level");
    showToast({ icon: "trophy", kicker: "Quest complete!", title: q.label, desc: how !== "manual" ? how : "" });
    setSync(
      "Quest complete: " + q.label + "." + (rewardsOff() ? "" : " It moves to Badges \u203a Completed from tomorrow."),
    );
  }
}
var finChecking = false;
function checkFinish() {
  if (finChecking || locked()) return;
  finChecking = true;
  try {
    cfg().quests.forEach(function (q) {
      if (q.completed || q.type === "todo") return;
      var m = finishMet(q);
      if (m) completeQuest(q.id, m);
    });
  } finally {
    finChecking = false;
  }
}
function completionXP(upto) {
  return cfg().quests.reduce(function (a, q) {
    return (
      a +
      (q.completed && (!upto || q.completed.on <= upto)
        ? q.completed.how === "archived"
          ? 0
          : q.completed.how === "manual"
            ? 25
            : 100
        : 0)
    );
  }, 0);
}
function markCompleteManual(q) {
  var met = finishMet(q);
  if (met) {
    completeQuest(q.id, met);
    render();
    return;
  }
  openG("Mark quest complete?", function (b) {
    var inf = easeInfo();
    b.innerHTML =
      '<p class="mhead">Finish \u201c' +
      esc(q.label) +
      '\u201d?</p><p class="help">It stays on today\u2019s list, then moves to Badges \u203a Completed from tomorrow. Its history is kept.</p>' +
      '<div class="edrow end"><button type="button" class="stone" id="mcNo">Cancel</button><button type="button" class="stone save" id="mcGo">Mark complete</button></div>';
    b.querySelector("#mcNo").addEventListener("click", closeG);
    b.querySelector("#mcGo").addEventListener("click", function () {
      var c = clone(cfg()),
        old = clone(c.quests),
        g = guardEasing(c, old, inf.setup ? [] : [q.id]);
      if (!g.ok) {
        b.querySelector(".help").textContent = g.msg;
        return;
      }
      var t = c.quests.filter(function (x) {
        return x.id === q.id;
      })[0];
      t.completed = { on: todayKey(), how: "manual" };
      saveCfg(c);
      qSig = "";
      closeG();
      sfx("level");
      showToast({ icon: "trophy", kicker: "Quest complete!", title: q.label, desc: "" });
      render();
    });
  });
}
function renderShelf() {
  var el = document.getElementById("shelf");
  if (!el) return;
  var L = cfg().quests.filter(function (q) {
    return q.completed;
  });
  el.hidden = !L.length;
  if (!L.length) {
    el.innerHTML = "";
    return;
  }
  el.innerHTML =
    '<h3 class="ach-sub">Completed quests</h3><div class="shelf">' +
    L.slice()
      .sort(function (a, b) {
        return a.completed.on < b.completed.on ? 1 : -1;
      })
      .map(function (q) {
        var ar = q.completed.how === "archived";
        return (
          '<div class="shelf-r' +
          (ar ? " ar" : "") +
          '"><span class="ml">' +
          (ar ? "" : "\u2713 ") +
          esc(q.label) +
          '</span><span class="mv">' +
          (ar ? "Archived" : "Done") +
          " " +
          fmtD(q.completed.on) +
          (ar || q.completed.how === "manual" ? "" : " \u00b7 " + esc(q.completed.how)) +
          "</span>" +
          (ar ? '<button type="button" class="stone mini" data-restore="' + q.id + '">Restore</button>' : "") +
          "</div>"
        );
      })
      .join("") +
    "</div>";
  el.querySelectorAll("[data-restore]").forEach(function (x) {
    x.addEventListener("click", function () {
      var c = clone(cfg()),
        q = c.quests.filter(function (z) {
          return z.id === x.getAttribute("data-restore");
        })[0];
      if (!q) return;
      var tq = clone(q);
      delete tq.completed;
      var ov0 = overDays(
        c.quests
          .filter(function (z) {
            return z !== q;
          })
          .concat([tq]),
      );
      if (ov0.length) {
        setSync(overMsg(ov0));
        return;
      }
      delete q.completed;
      saveCfg(c);
      qSig = "";
      render();
      renderShelf();
      setSync(q.label + " restored");
    });
  });
}
