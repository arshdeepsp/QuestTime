/* ---- quests UI ---- */
var qEls = {},
  qWrap = document.getElementById("quests"),
  qSig = "";
var DN = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
function reqText(q) {
  var t;
  if (q.type === "todo") {
    t = "to-do";
    if (q.due) {
      var dd = daysBetween(todayKey(), q.due);
      t +=
        " \u00b7 " +
        (dd < 0 ? "overdue " + -dd + "d" : dd === 0 ? "due today" : dd === 1 ? "due tomorrow" : "due in " + dd + "d");
    }
    if (q.note) t += ", " + q.note;
    return t;
  }
  if (q.type === "weekly") t = q.min + "x per week, any days";
  else if (q.type === "time")
    t =
      (q.roll ? hmL(q.roll) + " per " + perWord(q) : "min " + hmL(q.min)) +
      (limOf(q) ? " \u00b7 up to " + hmL(q.lim) + "/day" : "");
  else if (q.type === "limit") t = "max " + (q.unit === "min" ? hmL(q.max) : q.max + (q.ul ? " " + q.ul : ""));
  else if (q.type === "wake") t = "between " + q.from + "-" + q.to;
  else if (q.type === "target")
    t =
      "goal " +
      num(q.min) +
      (q.ul ? " " + q.ul : "") +
      (q.dl ? " today \u00b7 " + num(q.dl.total) + " total by " + fmtD(q.dl.due) : "");
  else if (q.type === "scale") t = "rate 1-" + (q.scale || 5) + ", pass at " + q.min + "+";
  else t = "done today";
  if (q.note) t += ", " + q.note;
  if (q.days && q.days.length && q.days.length < 7)
    t +=
      " \u00b7 " +
      q.days
        .slice()
        .sort()
        .map(function (d) {
          return DN[d];
        })
        .join("/");
  if (q.opt) t += " \u00b7 optional";
  return t;
}
function buildQuests(defs) {
  var sig = JSON.stringify(defs);
  if (sig === qSig) return;
  qSig = sig;
  qWrap.innerHTML = "";
  qEls = {};
  defs.forEach(function (q) {
    var row = document.createElement("div");
    row.className = "q t-" + q.type;
    row.innerHTML =
      '<button type="button" class="qgrip" aria-label="Drag to reorder ' +
      q.label.replace(/"/g, "") +
      '" title="Drag to set priority"><i></i></button><i class="gem" aria-hidden="true"></i><button type="button" class="pzb" aria-haspopup="menu" aria-label="More options for ' +
      q.label.replace(/"/g, "") +
      '">\u22ef</button><div><div class="lbl"></div><div class="req"></div></div><div class="ctl"></div>';
    var pz = row.querySelector(".pzb");
    pz.addEventListener("click", function (ev) {
      ev.stopPropagation();
      openQMenu(q, pz);
    });
    row.querySelector(".lbl").textContent = q.label;
    row.querySelector(".req").textContent = reqText(q);
    if (qStreakable(q)) {
      var sk = document.createElement("i");
      sk.className = "qstk";
      sk.hidden = true;
      sk.title = "Days in a row";
      row.children[3].appendChild(sk);
    }
    if (q.subj || (q.subjs && q.subjs.length)) {
      var ch = document.createElement("button");
      ch.type = "button";
      ch.className = "sjchip";
      ch.addEventListener("click", function (e) {
        e.stopPropagation();
        openSubjPick(q, ch);
      });
      row.children[3].appendChild(ch);
    }
    if (q.total && (q.type === "time" || q.type === "target")) {
      var pj = document.createElement("div");
      pj.className = "proj";
      pj.innerHTML = '<div class="pbar"><i></i></div><span></span>';
      row.children[3].appendChild(pj);
    }
    var ctl = row.querySelector(".ctl"),
      lab = q.label.replace(/"/g, "");
    if (q.type === "wake") {
      ctl.innerHTML =
        '<div class="ctr"><input type="time" class="tm" step="60" aria-label="' +
        lab +
        '"><button type="button" class="stone now">Now</button></div>';
      var inp = ctl.querySelector("input"),
        nb = ctl.querySelector("button");
      inp.addEventListener("change", function () {
        var e = entry();
        if (/^\d{2}:\d{2}/.test(inp.value)) e[q.id] = inp.value.slice(0, 5);
        else delete e[q.id];
        commit();
      });
      nb.addEventListener("click", function () {
        var d = new Date(),
          e = entry();
        e[q.id] = String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0");
        commit();
      });
      qEls[q.id] = { row: row, inp: inp };
    } else if (q.type === "scale") {
      var N = q.scale || 5,
        sh = '<div class="scale" role="group" aria-label="' + lab + '">';
      for (var z = 1; z <= N; z++)
        sh += '<button type="button" class="stone sc" data-v="' + z + '" aria-label="' + z + '">' + z + "</button>";
      ctl.innerHTML = sh + "</div>";
      ctl.querySelectorAll(".sc").forEach(function (bt) {
        bt.addEventListener("click", function () {
          var e = entry(),
            v = +bt.getAttribute("data-v");
          if (e[q.id] === v) delete e[q.id];
          else e[q.id] = v;
          commit();
        });
      });
      qEls[q.id] = { row: row, sc: ctl.querySelectorAll(".sc") };
    } else if (q.type === "target") {
      ctl.innerHTML =
        '<div class="ctr act"><button type="button" class="stone" aria-label="Less ' +
        lab +
        '">-</button><output></output><button type="button" class="stone" aria-label="More ' +
        lab +
        '">+</button></div>';
      var tb = ctl.querySelectorAll("button"),
        ts = +q.step || 1;
      tb[0].addEventListener("click", function () {
        var e = entry();
        e[q.id] = Math.max(0, num((+e[q.id] || 0) - ts));
        commit();
      });
      tb[1].addEventListener("click", function () {
        var e = entry();
        e[q.id] = Math.min(1e6, num((+e[q.id] || 0) + ts));
        commit();
      });
      qEls[q.id] = { row: row, out: ctl.querySelector("output"), minus: tb[0] };
    } else if (q.type === "todo") {
      ctl.innerHTML = '<button type="button" class="stone tdbtn" aria-pressed="false">Mark done</button>';
      var tdb = ctl.querySelector(".tdbtn");
      tdb.addEventListener("click", function () {
        toggleTodo(q);
      });
      qEls[q.id] = { row: row, td: tdb };
    } else if (q.type === "weekly") {
      ctl.innerHTML =
        '<div class="wkbox"><span class="pips" aria-hidden="true"></span><span class="wk"></span></div><button type="button" class="stone wkbtn" aria-pressed="false">Done today</button>';
      var wb = ctl.querySelector(".wkbtn");
      wb.addEventListener("click", function () {
        var e = entry();
        e[q.id] = !e[q.id];
        commit();
      });
      qEls[q.id] = { row: row, wb: wb, wk: ctl.querySelector(".wk"), pips: ctl.querySelector(".pips") };
    } else if (q.type === "check") {
      var b = document.createElement("button");
      b.type = "button";
      b.className = "sw";
      b.setAttribute("role", "switch");
      b.setAttribute("aria-label", lab);
      b.innerHTML = "<span></span>";
      b.addEventListener("click", function () {
        var e = entry();
        e[q.id] = !e[q.id];
        commit();
      });
      ctl.appendChild(b);
      qEls[q.id] = { row: row, sw: b, wk: ctl.querySelector(".wk") };
    } else {
      var tq = q.type === "time";
      ctl.innerHTML =
        (tq
          ? '<div class="ctr plan"><span class="tag">Plan</span><button type="button" class="stone" aria-label="Less planned ' +
            lab +
            '">-</button><output></output><button type="button" class="stone" aria-label="More planned ' +
            lab +
            '">+</button></div>'
          : "") +
        '<div class="ctr act">' +
        (tq ? '<span class="tag">Done</span>' : "") +
        '<button type="button" class="stone" aria-label="Less ' +
        lab +
        '">-</button><output></output><button type="button" class="stone" aria-label="More ' +
        lab +
        '">+</button></div>';
      if (tq) {
        var pk = "plan_" + q.id,
          pb = ctl.querySelectorAll(".plan button");
        pb[0].addEventListener("click", function () {
          var e = entry();
          e[pk] = Math.max(q.min, (e[pk] || q.min) - STEP);
          commit();
        });
        pb[1].addEventListener("click", function () {
          var e = entry();
          e[pk] = Math.min(MAXM, (e[pk] || q.min) + STEP);
          commit();
        });
      }
      var bs = ctl.querySelectorAll(".act button"),
        step = tq ? STEP : q.unit === "min" ? 5 : 1,
        mx = tq ? (limOf(q) ? Math.min(MAXM, q.lim) : MAXM) : q.unit === "min" ? MAXM : 999;
      bs[0].addEventListener("click", function () {
        var e = entry();
        e[q.id] = Math.max(0, (e[q.id] | 0) - step);
        commit();
      });
      bs[1].addEventListener("click", function () {
        var e = entry();
        e[q.id] = Math.min(mx, (e[q.id] | 0) + step);
        commit();
      });
      if (tq) {
        var tm = document.createElement("button");
        tm.type = "button";
        tm.className = "stone tmr";
        tm.setAttribute("aria-label", "Start focus timer for " + lab);
        tm.innerHTML = '<i class="ic"></i><span></span>';
        ctl.insertBefore(tm, ctl.firstChild);
        tm.addEventListener("click", function () {
          toggleTimer(q);
        });
      }
      qEls[q.id] = {
        tmr: tq ? ctl.querySelector(".tmr") : null,
        row: row,
        out: ctl.querySelector(".act output"),
        minus: bs[0],
        pout: tq ? ctl.querySelector(".plan output") : null,
        pminus: tq ? ctl.querySelector(".plan button") : null,
      };
    }
    row.querySelectorAll(".ctr output").forEach(function (o) {
      var isPlan = !!o.closest(".plan");
      o.classList.add("tapnum");
      o.setAttribute("role", "button");
      o.tabIndex = 0;
      o.title = "Tap to type a value";
      function ed() {
        if (ro() || locked()) return;
        openNum(q, isPlan);
      }
      o.addEventListener("click", ed);
      o.addEventListener("keydown", function (ev) {
        if (ev.key === "Enter") ed();
      });
    });
    swipeRow(row, q);
    if (q.opt) row.classList.add("optq");
    qWrap.appendChild(row);
  });
  if (!defs.length && !packsHidden()) {
    qWrap.innerHTML =
      '<p class="empty">No quests yet. Pick a starter pack, or tap "+ New quest" to build your own.</p><div class="packs">' +
      ["Student", "Fitness", "Creative", "Wellness", "Deep Work"]
        .map(function (p) {
          return '<button type="button" class="stone" data-pack="' + p + '">' + p + "</button>";
        })
        .join("") +
      "</div>";
    qWrap.querySelectorAll("[data-pack]").forEach(function (b) {
      b.addEventListener("click", function () {
        applyPack(b.getAttribute("data-pack"));
      });
    });
  } else if (!defs.length) qWrap.innerHTML = '<p class="empty">Nothing scheduled today.</p>';
  sortable(
    qWrap,
    ".q",
    ".qgrip",
    function (order) {
      if (ro() || locked()) {
        qSig = "";
        render();
        return;
      }
      var ids = defs.map(function (q) {
          return q.id;
        }),
        vis = order.map(function (k) {
          return ids[k];
        }),
        c = clone(cfg()),
        pos = 0,
        inVis = {};
      vis.forEach(function (id) {
        inVis[id] = 1;
      });
      var byId = {};
      c.quests.forEach(function (q) {
        byId[q.id] = q;
      });
      c.quests = c.quests.map(function (q) {
        if (!inVis[q.id]) return q;
        return byId[vis[pos++]] || q;
      });
      saveCfg(c);
      qSig = "";
      render();
      setSync("Priority order saved");
    },
    ".ctl,.pzb,.qgrip,.sjchip,.qsum,.qplay,button,input",
  );
  var xb = document.getElementById("xpbar"),
    rq = reqOf(defs).filter(function (q) {
      return q.type !== "limit";
    });
  xb.innerHTML = rq
    .map(function () {
      return "<i></i>";
    })
    .join("");
  xb.style.gridTemplateColumns = "repeat(" + Math.max(1, rq.length) + ",1fr)";
}
var viewKey = null;
var syncT = 0;
