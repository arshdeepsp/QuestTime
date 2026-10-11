/* ---- haptics, tap-to-type, swipe, calm mode ---- */
function haptic(k, quiet) {
  if (!quiet) tapSound(k);
  if (cfg().haptics === false) return;
  var H = capPlugin("Haptics");
  try {
    if (H) {
      if (k === "success" || k === "error" || k === "warning")
        H.notification({ type: k.toUpperCase() }).catch(function () {});
      else H.impact({ style: k === "medium" ? "MEDIUM" : k === "heavy" ? "HEAVY" : "LIGHT" }).catch(function () {});
    } else if (navigator.vibrate && matchMedia("(pointer:coarse)").matches) {
      navigator.vibrate(k === "success" ? [20, 40, 30] : k === "error" ? [60, 40, 60] : k === "medium" ? 18 : 8);
    }
  } catch (x) {}
}
document.addEventListener(
  "click",
  function (e) {
    var t = e.target;
    if (t && t.closest && t.closest(".ctr .stone,.sw,.stone.sc,.wkbtn,.tdbtn,.tmr,.pp,.mainnav button"))
      haptic("light");
  },
  true,
);
function parseMins(s) {
  s = String(s || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "");
  if (!s) return null;
  var m;
  if ((m = s.match(/^(\d+(?:\.\d+)?)h(?:(\d{1,2})m?)?$/))) return Math.round(+m[1] * 60 + (+m[2] || 0));
  if ((m = s.match(/^(\d+):(\d{1,2})$/))) return +m[1] * 60 + +m[2];
  if ((m = s.match(/^(\d+)m?$/))) return +m[1];
  return null;
}
function openNum(q, isPlan) {
  var tq = q.type === "time" || (q.type === "limit" && q.unit === "min"),
    e0 = S.days[todayKey()] || {},
    key = isPlan ? "plan_" + q.id : q.id,
    cur = isPlan ? planOf(q, e0) : +e0[q.id] || 0;
  openG((isPlan ? "Plan for " : "") + q.label, function (b) {
    b.innerHTML =
      '<p class="help">' +
      (tq
        ? "Type minutes, or hours like 1h30 or 1:30."
        : "Type the amount" + (q.ul ? " (" + esc(q.ul) + ")" : "") + ".") +
      '</p><div class="edrow"><input id="numIn" ' +
      (tq ? 'inputmode="text" placeholder="e.g. 45 or 1h30"' : 'type="number" inputmode="decimal" step="any" min="0"') +
      ' value="' +
      (tq ? (cur ? hm(cur).replace(/\s/g, "") : "") : cur || "") +
      '"><button type="button" class="stone save" id="numGo">Set</button></div><p class="cmsg2" id="numMsg"></p>';
    var inp = b.querySelector("#numIn");
    setTimeout(function () {
      inp.focus();
      inp.select();
    }, 50);
    function go_() {
      var v = tq ? parseMins(inp.value) : num(inp.value);
      if (v == null || isNaN(v) || v < 0) {
        b.querySelector("#numMsg").textContent = tq ? "Try 45, 90, 1h30 or 1:30." : "Enter a number.";
        return;
      }
      var e = entry();
      if (isPlan) v = Math.max(q.min, Math.min(MAXM, v));
      else {
        v = Math.min(tq ? MAXM : 1e6, v);
        if (tq && limOf(q)) v = Math.min(v, q.lim);
      }
      e[key] = v;
      closeG();
      commit();
      haptic("medium");
    }
    b.querySelector("#numGo").addEventListener("click", go_);
    inp.addEventListener("keydown", function (ev) {
      if (ev.key === "Enter") go_();
    });
  });
}
function swipeRow(row, q) {
  var x0 = null,
    y0 = 0,
    dx = 0,
    act = false;
  row.addEventListener(
    "touchstart",
    function (e) {
      if (e.target.closest(".ctl button,.ctl input,.ctl output,.qgrip,.pzb,.sjchip")) {
        x0 = null;
        return;
      }
      var t = e.touches[0];
      x0 = t.clientX;
      y0 = t.clientY;
      dx = 0;
      act = false;
    },
    { passive: true },
  );
  row.addEventListener(
    "touchmove",
    function (e) {
      if (x0 == null) return;
      if (row.classList.contains("dragging")) {
        x0 = null;
        return;
      }
      var t = e.touches[0],
        ddx = t.clientX - x0,
        ddy = t.clientY - y0;
      if (!act) {
        if (Math.abs(ddx) > 14 && Math.abs(ddx) > Math.abs(ddy) * 1.4) act = true;
        else if (Math.abs(ddy) > 14) {
          x0 = null;
          return;
        } else return;
      }
      dx = Math.max(-110, Math.min(110, ddx));
      row.style.transform = "translateX(" + dx + "px)";
      var ign = rewardsOff(),
        canR = ign || q.type === "check" || q.type === "todo" || q.type === "weekly";
      row.classList.toggle("sw-r", !ign && canR && dx > 64);
      row.classList.toggle("sw-ign", ign && dx > 64);
      row.classList.toggle("sw-l", dx < -64);
    },
    { passive: true },
  );
  function end() {
    if (x0 == null && !act) return;
    x0 = null;
    row.style.transform = "";
    var r = row.classList.contains("sw-r"),
      ig = row.classList.contains("sw-ign"),
      l = row.classList.contains("sw-l");
    row.classList.remove("sw-r", "sw-l", "sw-ign");
    if (!act) return;
    act = false;
    if (ro() || locked()) return;
    if (ig) {
      haptic("medium");
      setIgnore(q.id, !ignoredOn(q.id, todayKey()));
    } else if (r) {
      if (q.type === "todo") toggleTodo(q);
      else {
        var e = entry();
        e[q.id] = !e[q.id];
        commit();
      }
      haptic("medium");
    } else if (l) {
      haptic("light");
      openQMenu(q, row.querySelector(".pzb"));
    }
  }
  row.addEventListener("touchend", end);
  row.addEventListener("touchcancel", function () {
    x0 = null;
    act = false;
    row.style.transform = "";
    row.classList.remove("sw-r", "sw-l", "sw-ign");
  });
}
/* swipeMenu(el, items, skipSel): swipe left on any list row opens its popMenu (same gesture as a quest row). items is a
     function returning popMenu items so labels reflect the state at the time of the swipe; touches that start on a control
     (inputs, links, `.stone` buttons, pips, drag grips, or skipSel) never swipe; a row-wide toggle button such as a subject's fold header does. Horizontal only: a vertical drift cancels, so scrolling is untouched. */
function swipeMenu(el, items, skipSel) {
  var x0 = null,
    y0 = 0,
    act = false,
    sk = "input,select,textarea,a,.dragh,.stone,.pp,.lnk" + (skipSel ? "," + skipSel : "");
  el.addEventListener(
    "touchstart",
    function (e) {
      if (e.target.closest(sk)) {
        x0 = null;
        return;
      }
      var t = e.touches[0];
      x0 = t.clientX;
      y0 = t.clientY;
      act = false;
    },
    { passive: true },
  );
  el.addEventListener(
    "touchmove",
    function (e) {
      if (x0 == null) return;
      if (el.classList.contains("dragging")) {
        x0 = null;
        return;
      }
      var t = e.touches[0],
        ddx = t.clientX - x0,
        ddy = t.clientY - y0;
      if (!act) {
        if (ddx < -14 && Math.abs(ddx) > Math.abs(ddy) * 1.4) act = true;
        else if (Math.abs(ddy) > 14 || ddx > 14) {
          x0 = null;
          return;
        } else return;
      }
      var dx = Math.max(-110, Math.min(0, ddx));
      el.style.transform = "translateX(" + dx + "px)";
      el.classList.toggle("sw-l", dx < -64);
    },
    { passive: true },
  );
  function end() {
    if (x0 == null && !act) return;
    x0 = null;
    el.style.transform = "";
    var l = el.classList.contains("sw-l");
    el.classList.remove("sw-l");
    if (!act) return;
    act = false;
    if (!l) return;
    haptic("light");
    popMenu(el, items());
  }
  el.addEventListener("touchend", end);
  el.addEventListener("touchcancel", function () {
    x0 = null;
    act = false;
    el.style.transform = "";
    el.classList.remove("sw-l");
  });
}
/* swipeLR(el, onRight, onLeft, skipSel): a row that answers a two-way swipe (the to-do review: right = keep, left = delete). Same thresholds as the quest rows; the row shows .sw-r / .sw-l past the point of no return. */
function swipeLR(el, onRight, onLeft, skipSel) {
  var x0 = null,
    y0 = 0,
    act = false,
    dx = 0,
    sk = "input,select,textarea,a,.dragh" + (skipSel ? "," + skipSel : "");
  el.addEventListener(
    "touchstart",
    function (e) {
      if (e.target.closest(sk)) {
        x0 = null;
        return;
      }
      var t = e.touches[0];
      x0 = t.clientX;
      y0 = t.clientY;
      dx = 0;
      act = false;
    },
    { passive: true },
  );
  el.addEventListener(
    "touchmove",
    function (e) {
      if (x0 == null) return;
      var t = e.touches[0],
        ddx = t.clientX - x0,
        ddy = t.clientY - y0;
      if (!act) {
        if (Math.abs(ddx) > 14 && Math.abs(ddx) > Math.abs(ddy) * 1.4) act = true;
        else if (Math.abs(ddy) > 14) {
          x0 = null;
          return;
        } else return;
      }
      dx = Math.max(-110, Math.min(110, ddx));
      el.style.transform = "translateX(" + dx + "px)";
      el.classList.toggle("sw-r", dx > 64);
      el.classList.toggle("sw-l", dx < -64);
    },
    { passive: true },
  );
  function end() {
    if (x0 == null && !act) return;
    x0 = null;
    el.style.transform = "";
    var r = el.classList.contains("sw-r"),
      l = el.classList.contains("sw-l");
    el.classList.remove("sw-r", "sw-l");
    if (!act) return;
    act = false;
    if (r) {
      haptic("light");
      onRight();
    } else if (l) {
      haptic("light");
      onLeft();
    }
  }
  el.addEventListener("touchend", end);
  el.addEventListener("touchcancel", function () {
    x0 = null;
    act = false;
    el.style.transform = "";
    el.classList.remove("sw-r", "sw-l");
  });
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
var lowBatt = false;
function calmSync() {
  var c = cfg().calm || "auto",
    pr = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches,
    on = c === "on" || (c === "auto" && (pr || lowBatt));
  document.body.classList.toggle("calm", !!on);
}
try {
  if (navigator.getBattery)
    navigator
      .getBattery()
      .then(function (bt) {
        function u() {
          lowBatt = bt.level <= 0.2 && !bt.charging;
          calmSync();
        }
        u();
        bt.addEventListener("levelchange", u);
        bt.addEventListener("chargingchange", u);
      })
      .catch(function () {});
} catch (x) {}
