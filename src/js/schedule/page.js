/* ---- the schedule page: drawing, footer, drag and resize ---- */
function schOpen() {
  return !!schPg && !schPg.hidden;
}
function schEnsure() {
  if (!schPg) {
    schPg = document.createElement("div");
    schPg.id = "schPage";
    schPg.className = "schpage";
    schPg.setAttribute("role", "dialog");
    schPg.setAttribute("aria-modal", "true");
    schPg.setAttribute("aria-labelledby", "schTitle");
    schPg.innerHTML =
      '<div class="sch-hd"><div class="sch-hdt"><div class="sch-nav"><button type="button" class="stone mini" id="schDP" aria-label="Previous day">‹</button><h2 id="schTitle">Today</h2><button type="button" class="stone mini" id="schDN" aria-label="Next day">›</button></div><p class="sch-sum"><span id="schSum"></span> <button type="button" class="lnk sch-adjb" id="schAdjB" aria-expanded="false">Adjust today</button></p></div><button type="button" class="stone save" id="schOk">Done</button></div><div class="sch-adj" id="schAdj" hidden></div><div class="sch-tray" id="schTray"></div><div class="sch-scroll" id="schScroll"><div class="sch-tl" id="schTl"></div><button type="button" class="stone sch-nowb" id="schNowBtn" hidden>\u25bc Now</button></div><div class="sch-ft" id="schFt"></div>';
    document.body.appendChild(schPg);
    schPg.querySelector("#schOk").addEventListener("click", closeSchedule);
    schPg.querySelector("#schAdjB").addEventListener("click", function () {
      schAdj = !schAdj;
      schDraw();
    });
    schPg.querySelector("#schDP").addEventListener("click", function () {
      schGoDay(-1);
    });
    schPg.querySelector("#schDN").addEventListener("click", function () {
      schGoDay(1);
    });
    schWire();
  }
  schPg.hidden = false;
  document.body.classList.add("sch-open");
  schBody = schPg;
}
function schGoDay(n) {
  var T = todayKey(),
    k = add(schK(), n);
  if (k < T || k > add(T, SCH_AHEAD)) return;
  schDay = k > T ? k : null;
  schSel = null;
  schPick = null;
  schRep = null;
  schDet = null;
  schMsg = "";
  schAdj = false;
  haptic("light");
  schDraw(true);
}
function schDayName(k) {
  var T = todayKey();
  return k === T ? "Today" : k === add(T, 1) ? "Tomorrow" : WDS[parse(k).getDay()] + ", " + fmtD(k);
}
function openSchedule() {
  if (locked()) return;
  schMd = "today";
  schDay = null;
  schBack = false;
  schSel = null;
  schQ = null;
  schPick = null;
  schAdj = false;
  schMsg = "";
  schDet = null;
  schRep = null;
  schEnsure();
  schDraw(true);
}
function openBusy(wd, at, back) {
  if (locked()) return;
  schMd = "busy";
  schWd = wd == null ? parse(todayKey()).getDay() : wd;
  schBack = !!back;
  schSel = null;
  schPick = at == null ? null : at;
  schAdj = false;
  schMsg = "";
  schDet = null;
  schRep = null;
  schEnsure();
  schDraw(true);
}
function closeSchedule() {
  if (!schPg) return;
  if (schMd === "busy" && schBack) {
    schMd = "today";
    schBack = false;
    schSel = null;
    schPick = null;
    schMsg = "";
    schDraw(true);
    return;
  }
  schPg.hidden = true;
  document.body.classList.remove("sch-open");
  schBody = null;
  schDrag = null;
  schSel = null;
  schPick = null;
  schMd = "today";
  render();
  if (typeof renderSettings === "function" && setTab === "day") renderSettings();
}
/* "Now" button: sticky at the bottom of the scroller on today, shown only while the now line is off screen; tapping scrolls the now line a third of the way down. */
function schNowVis() {
  var sc = schPg.querySelector("#schScroll"),
    nb = schPg.querySelector("#schNowBtn"),
    nw = schPg.querySelector("#schNow");
  if (!nb) return;
  if (!nw) {
    nb.hidden = true;
    return;
  }
  var y = nw.offsetTop,
    top = sc.scrollTop + 40,
    bot = sc.scrollTop + sc.clientHeight - 60;
  nb.hidden = y >= top && y <= bot;
  nb.textContent = (y < top ? "\u25b2" : "\u25bc") + " Now";
}
function schGoNow() {
  var sc = schPg.querySelector("#schScroll"),
    nw = schPg.querySelector("#schNow");
  if (!nw) return;
  sc.scrollTo({ top: Math.max(0, nw.offsetTop - sc.clientHeight / 3), behavior: "smooth" });
  haptic("light");
}
function schWire() {
  var sc = schPg.querySelector("#schScroll"),
    tl = schPg.querySelector("#schTl"),
    lp = null;
  sc.addEventListener("scroll", schNowVis, { passive: true });
  schPg.querySelector("#schNowBtn").addEventListener("click", schGoNow);
  tl.addEventListener("click", function (ev) {
    if (schDrag) return;
    var bk = ev.target.closest("[data-sb]");
    if (bk) {
      var id = bk.getAttribute("data-sb");
      schSel = schSel === id ? null : id;
      schPick = null;
      schRep = null;
      schDet = null;
      schMsg = "";
      schDraw();
      return;
    }
    var m = schAt(ev.clientY);
    if (schRep) {
      schRep = null;
      schDraw();
      return;
    }
    if (
      schSel &&
      (schSel.indexOf("z-") === 0 ||
        schEnded(
          schK(),
          schList().filter(function (x) {
            return x.id === schSel;
          })[0],
        ))
    )
      schSel = null;
    else if (schSel) {
      schMove(schSel, m);
      schDraw();
      return;
    }
    if (schClash(schList(), null, m, m + 1)) {
      schDraw();
      return;
    }
    schPick = schPick === m ? null : m;
    schMsg =
      schPick != null && m < schFloor()
        ? "That time has passed. Quests can’t go there, but you can block it as busy."
        : "";
    schDraw();
  });
  tl.addEventListener("pointerdown", function (ev) {
    var hd = ev.target.closest("[data-sh]");
    if (hd) {
      schResize(ev, hd);
      return;
    }
    var bk = ev.target.closest("[data-sb]");
    if (!bk || bk.hasAttribute("data-ro") || ev.pointerType !== "mouse") return;
    var y0 = ev.clientY;
    function mv(e2) {
      if (Math.abs(e2.clientY - y0) > 4) {
        document.removeEventListener("pointermove", mv);
        document.removeEventListener("pointerup", up);
        schMoveDrag(bk, y0, "mouse");
      }
    }
    function up() {
      document.removeEventListener("pointermove", mv);
      document.removeEventListener("pointerup", up);
    }
    document.addEventListener("pointermove", mv);
    document.addEventListener("pointerup", up);
  });
  tl.addEventListener(
    "touchstart",
    function (ev) {
      if (ev.target.closest("[data-sh]")) return;
      var bk = ev.target.closest("[data-sb]");
      if (!bk || bk.hasAttribute("data-ro") || ev.touches.length !== 1) return;
      var y0 = ev.touches[0].clientY;
      clearTimeout(lp);
      lp = setTimeout(function () {
        lp = null;
        haptic("medium");
        schMoveDrag(bk, y0, "touch");
      }, 350);
      function cancel(e2) {
        if (e2.type === "touchmove" && Math.abs(e2.touches[0].clientY - y0) < 8) return;
        clearTimeout(lp);
        tl.removeEventListener("touchmove", cancel);
        tl.removeEventListener("touchend", cancel);
      }
      tl.addEventListener("touchmove", cancel, { passive: true });
      tl.addEventListener("touchend", cancel, { passive: true });
    },
    { passive: true },
  );
}
function schAutoScroll(sc, tick) {
  var y = null,
    y0 = null,
    armed = false,
    raf = 0;
  function step() {
    raf = 0;
    if (y == null || !armed) return;
    var r = sc.getBoundingClientRect(),
      v = 0;
    if (y < r.top + SCH_EDGE) v = -Math.min(18, Math.ceil((r.top + SCH_EDGE - y) / 6));
    else if (y > r.bottom - SCH_EDGE) v = Math.min(18, Math.ceil((y - (r.bottom - SCH_EDGE)) / 6));
    if (v) {
      var b0 = sc.scrollTop;
      sc.scrollTop = b0 + v;
      if (sc.scrollTop !== b0) tick(y);
    }
    if (v) raf = requestAnimationFrame(step);
  }
  return {
    at: function (ny) {
      if (y0 == null) y0 = ny;
      if (Math.abs(ny - y0) >= 12) armed = true;
      y = ny;
      tick(y);
      if (armed && !raf) raf = requestAnimationFrame(step);
    },
    stop: function () {
      y = null;
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
    },
  };
}
function schMoveDrag(bk, y0, kind) {
  var g = schGeo(),
    id = bk.getAttribute("data-sb"),
    L = schList(),
    bl = L.filter(function (x) {
      return x.id === id;
    })[0];
  if (!bl) return;
  var len = bl.t - bl.f,
    f = bl.f,
    sc = schPg.querySelector("#schScroll"),
    tl = schPg.querySelector("#schTl"),
    grab = y0 - bk.getBoundingClientRect().top;
  schDrag = { id: id };
  bk.classList.add("lift");
  function show(y) {
    var r = tl.getBoundingClientRect(),
      nf = g.s0 + Math.round((y - grab - r.top) / SCH_ROW) * SCH_STEP;
    nf = Math.max(g.s0, Math.min(g.w.e - len, nf));
    f = nf;
    bk.style.top = g.px(nf) + "px";
    bk.querySelector("span").textContent = hhmmOf(nf) + "–" + hhmmOf(nf + len);
    bk.classList.toggle("bad", (nf < schFloor() && !bl.lb) || !!schClash(L, id, nf, nf + len));
  }
  var as = schAutoScroll(sc, show);
  function done() {
    as.stop();
    bk.classList.remove("lift");
    var ok = f !== bl.f && (f >= schFloor() || !!bl.lb) && !schClash(L, id, f, f + len),
      sid = id;
    if (ok)
      sid = schEdit(
        id,
        function (x) {
          x.f = f;
          x.t = f + len;
        },
        true,
      );
    else if (f !== bl.f) schMsg = "Can’t drop it there: it overlaps another block or the time has passed.";
    schSel = sid;
    schPick = null;
    schDraw();
    setTimeout(function () {
      schDrag = null;
    }, 0);
  }
  if (kind === "mouse") {
    var mv = function (e) {
        as.at(e.clientY);
      },
      up = function () {
        document.removeEventListener("pointermove", mv);
        document.removeEventListener("pointerup", up);
        done();
      };
    document.addEventListener("pointermove", mv);
    document.addEventListener("pointerup", up);
  } else {
    var tm = function (e) {
        e.preventDefault();
        as.at(e.touches[0].clientY);
      },
      te = function () {
        document.removeEventListener("touchmove", tm);
        document.removeEventListener("touchend", te);
        document.removeEventListener("touchcancel", te);
        done();
      };
    document.addEventListener("touchmove", tm, { passive: false });
    document.addEventListener("touchend", te);
    document.addEventListener("touchcancel", te);
  }
}
/* Resize: only from the corner grip of the selected block (the grip isn't drawn otherwise, so scrolling can't start it). */
function schResize(ev, hd) {
  ev.preventDefault();
  ev.stopPropagation();
  var g = schGeo(),
    id = hd.getAttribute("data-sh"),
    L = schList(),
    bl = L.filter(function (x) {
      return x.id === id;
    })[0],
    blk = hd.parentNode,
    cap = schNext(L, id, bl.f + 1, g.w.e),
    t = bl.t,
    tl = schPg.querySelector("#schTl"),
    sc = schPg.querySelector("#schScroll"),
    grab = ev.clientY - blk.getBoundingClientRect().bottom;
  schDrag = { id: id };
  try {
    hd.setPointerCapture(ev.pointerId);
  } catch (x) {}
  var lo = Math.max(bl.f + SCH_STEP, schStarted(schK(), bl) ? Math.min(schCut(), bl.t) : -1e9);
  function show(y) {
    var r = tl.getBoundingClientRect();
    t = Math.max(lo, Math.min(cap, g.s0 + Math.round((y - grab - r.top) / SCH_ROW) * SCH_STEP));
    blk.style.height = g.px(t) - g.px(bl.f) + "px";
    blk.querySelector("span").textContent = hhmmOf(bl.f) + "–" + hhmmOf(t);
  }
  var as = schAutoScroll(sc, show);
  blk.classList.add("sizing");
  function mv(e2) {
    as.at(e2.clientY);
  }
  function up() {
    as.stop();
    blk.classList.remove("sizing");
    hd.removeEventListener("pointermove", mv);
    hd.removeEventListener("pointerup", up);
    hd.removeEventListener("pointercancel", up);
    var sid = id;
    if (t !== bl.t)
      sid = schEdit(
        id,
        function (x) {
          x.t = t;
        },
        true,
      );
    schSel = sid;
    schPick = null;
    schDraw();
    setTimeout(function () {
      schDrag = null;
    }, 0);
  }
  hd.addEventListener("pointermove", mv);
  hd.addEventListener("pointerup", up);
  hd.addEventListener("pointercancel", up);
}
function schDraw(first) {
  if (!schOpen()) return;
  var T = schK(),
    FT = T !== todayKey(),
    nw0 = FT ? -1e9 : nowMinInDay(),
    g = schGeo(),
    w = g.w,
    BZ = schMd === "busy",
    Q = BZ ? [] : schQuests(T),
    L = schList(),
    e = S.days[T] || {},
    px = g.px,
    fl = schFloor(),
    now = nowMinInDay();
  var sum = schPg.querySelector("#schSum"),
    tray = schPg.querySelector("#schTray"),
    tl = schPg.querySelector("#schTl"),
    ft = schPg.querySelector("#schFt");
  if (
    schSel &&
    !L.some(function (x) {
      return x.id === schSel;
    })
  )
    schSel = null;
  if (
    schRep &&
    !L.some(function (x) {
      return x.id === schRep.id;
    })
  )
    schRep = null;
  if (schDet && schDet.id !== schSel) schDet = null;
  var adj = schPg.querySelector("#schAdj"),
    adjB = schPg.querySelector("#schAdjB");
  schPg.classList.toggle("busymode", BZ);
  schPg.querySelector("#schTitle").textContent = BZ ? "Busy times" : schDayName(T);
  var dP = schPg.querySelector("#schDP"),
    dN = schPg.querySelector("#schDN");
  dP.hidden = dN.hidden = BZ;
  dP.disabled = !FT;
  dN.disabled = T >= add(todayKey(), SCH_AHEAD);
  schPg.querySelector("#schOk").textContent = BZ && schBack ? "Back" : "Done";
  adjB.hidden = BZ || FT;
  adj.hidden = BZ || FT || !schAdj;
  adjB.setAttribute("aria-expanded", schAdj);
  adjB.textContent = schAdj ? "Close" : "Adjust today";
  if (!BZ && !FT && schAdj) {
    adj.innerHTML =
      '<label>Wake up <input type="time" id="setWakeT" value="' +
      esc(w.wake) +
      '"></label><label>Bedtime <input type="time" id="setBedT" value="' +
      esc(w.bed) +
      '"></label>' +
      (w.today ? '<button type="button" class="stone mini" id="setDayReset">Use usual</button>' : "");
    ["setWakeT", "setBedT"].forEach(function (id) {
      adj.querySelector("#" + id).addEventListener("change", function () {
        if (dayOvSave(adj.querySelector("#setWakeT").value, adj.querySelector("#setBedT").value)) schDraw();
        else schDraw();
      });
    });
    var ur = adj.querySelector("#setDayReset");
    if (ur)
      ur.addEventListener("click", function () {
        dayOvClear();
        schDraw();
      });
  }
  var tot = 0,
    bz = 0,
    nq = 0;
  L.forEach(function (x) {
    if (x.lb) bz += x.t - x.f;
    else tot += x.t - x.f;
  });
  Q.forEach(function (q) {
    if (
      L.some(function (x) {
        return x.q === q.id;
      })
    )
      nq++;
  });
  /* Hour scale: a day with under SCH_DENSE_MIN planned gets the denser scale (less scrolling through empty hours); decided on open or day change so the scale never jumps mid-edit. */
  if (first) {
    SCH_ROW = !BZ && tot + bz < SCH_DENSE_MIN ? SCH_ROW_DENSE : SCH_ROW_FULL;
    g = schGeo();
    px = g.px;
  }
  tl.classList.toggle("dense", SCH_ROW === SCH_ROW_DENSE);
  tl.style.setProperty("--row", SCH_ROW + "px");
  var smMin = SCH_ROW === SCH_ROW_DENSE ? 45 : 30;
  if (BZ) {
    sum.textContent =
      WDN[schWd] +
      " · " +
      (L.length ? L.length + " block" + (L.length === 1 ? "" : "s") + " · " + hm(bz) : "nothing blocked");
    tray.innerHTML =
      '<div class="sch-wds" role="tablist" aria-label="Weekday">' +
      wkOrder()
        .map(function (d) {
          var n = busyForWd(d).length;
          return (
            '<button type="button" class="stone' +
            (d === schWd ? " on" : "") +
            '" data-wd="' +
            d +
            '" role="tab" aria-selected="' +
            (d === schWd) +
            '">' +
            DN[d].slice(0, 2) +
            (n ? "<small>" + n + "</small>" : "") +
            "</button>"
          );
        })
        .join("") +
      "</div>";
  } else {
    sum.textContent =
      (FT && T === add(todayKey(), 1) ? WDS[parse(T).getDay()] + ", " + fmtD(T) + " · " : "") +
      w.wake +
      "–" +
      w.bed +
      (w.today ? " (today only)" : "") +
      " · " +
      nq +
      " of " +
      Q.length +
      " placed" +
      (tot ? " · " + hm(tot) + " blocked" : "") +
      (bz ? " · " + hm(bz) + " busy" : "");
    tray.innerHTML = Q.length
      ? Q.map(function (q) {
          var pl = schPlaced(T, q.id),
            n = L.filter(function (x) {
              return x.q === q.id;
            }).length,
            need = schLen(q, T),
            dd = schDayDone(q, e, T);
          return (
            '<span class="sch-q' +
            (pl >= need ? " placed" : pl ? " part" : "") +
            (dd ? " done" : "") +
            '" data-sq="' +
            q.id +
            '">' +
            (dd ? "✔ " : "") +
            esc(q.label) +
            " <small>" +
            (pl ? hm(pl) + " / " + hm(need) + (n > 1 ? " · " + n + " shots" : "") : hm(need)) +
            "</small></span>"
          );
        }).join("")
      : '<p class="help">No time quests ' + schTd() + ". Add one to schedule it.</p>";
  }
  var h = "";
  for (var m = g.s0; m < g.e0; m += SCH_STEP)
    h +=
      '<i class="sch-ln' +
      (m % 60 === 0 ? " hr" : "") +
      '" style="top:' +
      px(m) +
      'px"></i>' +
      (m % 60 === 0 ? '<span class="sch-hr" style="top:' + px(m) + 'px">' + hhmmOf(m) + "</span>" : "");
  if (!BZ && fl > g.s0) h += '<i class="sch-past" style="height:' + Math.min(px(g.e0), px(fl)) + 'px"></i>';
  if (!BZ && !FT && now >= g.s0 && now <= g.e0)
    h += '<i class="sch-now" id="schNow" style="top:' + px(now) + 'px"></i>';
  if (schPick != null)
    h +=
      '<i class="sch-ghost" style="top:' +
      px(schPick) +
      "px;height:" +
      SCH_ROW * 2 +
      'px"><span>' +
      hhmmOf(schPick) +
      "</span></i>";
  var BL = L.filter(function (x) {
    return x.busy;
  });
  function clashOf(bl) {
    return bl.q
      ? BL.filter(function (z) {
          return z.f < bl.t && bl.f < z.t;
        })[0]
      : null;
  }
  L.forEach(function (bl) {
    var q = bl.lb
        ? null
        : Q.filter(function (x) {
            return x.id === bl.q;
          })[0],
      dn = q && !FT ? schDoneIn(T, bl) : 0,
      ln = bl.t - bl.f,
      ok = !!q && dn >= ln,
      sht = q && !FT ? schShort(T, bl) : 0,
      sh = q
        ? L.filter(function (x) {
            return x.q === bl.q;
          })
        : [],
      ix = sh.indexOf(bl),
      en = !BZ && !bl.busy && schEnded(T, bl),
      ro = (!BZ && bl.busy) || en,
      cl = clashOf(bl),
      grip = !(bl.j5 || ro || schSel !== bl.id);
    h +=
      '<div class="sch-b' +
      (bl.lb ? " busy" : "") +
      (ro ? " ro" : "") +
      (en ? " past" : "") +
      (cl ? " clash" : "") +
      (bl.j5 ? " j5" : "") +
      (bl.rep ? " rep" : "") +
      (schSel === bl.id ? " on" : "") +
      (ok ? " done" : "") +
      (sht ? " short" : "") +
      (bl.t - bl.f < smMin ? " sm" : "") +
      '" data-sb="' +
      bl.id +
      '"' +
      (ro ? " data-ro" : "") +
      ' style="top:' +
      px(bl.f) +
      "px;height:" +
      Math.max(SCH_ROW, px(bl.t) - px(bl.f)) +
      'px"><b>' +
      (bl.rep ? "↻ " : "") +
      (bl.j5 ? "▶ 5 · " : "") +
      esc(bl.lb || q.label) +
      (sh.length > 1 ? " <em>" + (ix + 1) + "/" + sh.length + "</em>" : "") +
      "</b><span>" +
      hhmmOf(bl.f) +
      "–" +
      hhmmOf(bl.t) +
      (ok ? " ✔" : dn ? " · " + hm(Math.min(dn, ln)) + " of " + hm(ln) : "") +
      (sht ? " · " + hm(sht) + " short" : "") +
      "</span>" +
      (q && dn && !ok ? '<i class="sch-pg" style="width:' + Math.round((dn * 100) / ln) + '%"></i>' : "") +
      (grip ? '<i class="sch-h" data-sh="' + bl.id + '" role="slider" aria-label="Drag to change length"></i>' : "") +
      "</div>";
  });
  tl.style.height = px(g.e0) + "px";
  tl.innerHTML = h;
  var sb = schSel
      ? L.filter(function (x) {
          return x.id === schSel;
        })[0]
      : null,
    f2 = "";
  function nameOf(b) {
    return (
      b.lb ||
      (
        Q.filter(function (q) {
          return q.id === b.q;
        })[0] || {}
      ).label ||
      ""
    );
  }
  var wdn = WDN[schWd];
  if (BZ && sb) {
    var bt = busyById(sb.id),
      wk = bt && bt.until ? Math.max(1, Math.min(REP_MAX, Math.ceil((daysBetween(T, bt.until) + 1) / 7))) : 0;
    f2 =
      '<div class="sch-bzn"><input id="schBzName" maxlength="30" value="' +
      esc(sb.lb) +
      '" aria-label="Name"><span>' +
      hhmmOf(sb.f) +
      "–" +
      hhmmOf(sb.t) +
      "</span></div>" +
      '<div class="sch-days" role="group" aria-label="Busy on">' +
      wkOrder()
        .map(function (d) {
          var on = bt.dows.indexOf(d) >= 0;
          return (
            '<button type="button" class="stone' +
            (on ? " on" : "") +
            '" data-bd="' +
            d +
            '" aria-pressed="' +
            on +
            '">' +
            DN[d].slice(0, 2) +
            "</button>"
          );
        })
        .join("") +
      "</div>" +
      '<div class="sch-wk"><button type="button" class="stone' +
      (wk ? "" : " on") +
      '" id="schBzAlways" aria-pressed="' +
      !wk +
      '">Every week</button><button type="button" class="stone" id="schWkM" aria-label="Fewer weeks"' +
      (wk <= 1 ? " disabled" : "") +
      '>−</button><b id="schWkN">' +
      (wk ? wk + " week" + (wk === 1 ? "" : "s") : "For…") +
      '</b><button type="button" class="stone" id="schWkP" aria-label="More weeks"' +
      (wk >= REP_MAX ? " disabled" : "") +
      ">+</button></div>" +
      '<div class="sch-acts"><button type="button" class="stone del" id="schBzRm">Remove</button><button type="button" class="stone sch-x" id="schDesel" aria-label="Deselect">✕</button></div>';
  } else if (BZ && schPick != null) {
    f2 =
      '<p class="sch-ft-h">Busy at <b>' +
      hhmmOf(schPick) +
      "</b> on " +
      wdn +
      '</p><div class="sch-pick">' +
      busyRecent()
        .map(function (x) {
          return '<button type="button" class="stone" data-bz="' + esc(x) + '">' + esc(x) + "</button>";
        })
        .join("") +
      '</div><div class="sch-bzin"><input id="schBzIn" maxlength="30" placeholder="Or name it" aria-label="Busy block name"><button type="button" class="stone save" id="schBzAdd">Add</button></div><div class="sch-acts"><button type="button" class="stone" id="schPkNo">Cancel</button></div>';
  } else if (BZ) {
    f2 =
      '<p class="help sch-help">Tap a time on ' +
      wdn +
      " to block it: lectures, meetings, work. Blocks repeat every week on their days, starting the day you add them. Quests already scheduled on top stay for that day; new ones go around them.</p>";
  } else if (schRep) {
    var rb = L.filter(function (x) {
        return x.id === schRep.id;
      })[0],
      okd = schRepDays(rb),
      n = schRepCount(rb, schRep.dows, schRep.weeks),
      u = add(T, schRep.weeks * 7 - 1);
    f2 =
      '<p class="sch-ft-h">Repeat <b>' +
      esc(nameOf(rb)) +
      "</b> " +
      hhmmOf(rb.f) +
      "–" +
      hhmmOf(rb.t) +
      '</p><div class="sch-days" role="group" aria-label="Repeat on">' +
      wkOrder()
        .map(function (d) {
          var on = schRep.dows.indexOf(d) >= 0,
            ok = okd.indexOf(d) >= 0;
          return (
            '<button type="button" class="stone' +
            (on && ok ? " on" : "") +
            '" data-rd="' +
            d +
            '" aria-pressed="' +
            (on && ok) +
            '"' +
            (ok ? "" : ' disabled title="' + esc(nameOf(rb)) + ' doesn’t run that day"') +
            ">" +
            DN[d].slice(0, 2) +
            "</button>"
          );
        })
        .join("") +
      "</div>" +
      '<div class="sch-wk"><span>For</span><button type="button" class="stone" id="schWkM" aria-label="Fewer weeks"' +
      (schRep.weeks <= 1 ? " disabled" : "") +
      '>−</button><b id="schWkN">' +
      schRep.weeks +
      " week" +
      (schRep.weeks === 1 ? "" : "s") +
      '</b><button type="button" class="stone" id="schWkP" aria-label="More weeks"' +
      (schRep.weeks >= REP_MAX ? " disabled" : "") +
      ">+</button></div>" +
      '<p class="help sch-help" id="schRepSum">' +
      (n ? n + " time" + (n === 1 ? "" : "s") + ", until " + fmtD(u) : "Pick at least one day.") +
      '</p><div class="sch-acts"><button type="button" class="stone" id="schRepNo">Cancel</button><button type="button" class="stone save" id="schRepOk"' +
      (n ? "" : " disabled") +
      ">Save repeat</button></div>";
  } else if (sb && sb.busy) {
    var bt2 = busyById(sb.busy);
    f2 =
      '<p class="sch-ft-h"><b>' +
      esc(sb.lb) +
      "</b> " +
      hhmmOf(sb.f) +
      "–" +
      hhmmOf(sb.t) +
      ' <small class="sch-tag">Busy</small></p>' +
      (bt2 ? '<p class="sch-rep">↻ ' + esc(busyText(bt2)) + "</p>" : "") +
      '<p class="help sch-help">Busy times are set in Busy times. Quests already placed on top of it stay for ' +
      schTd() +
      '.</p><div class="sch-acts"><button type="button" class="stone" id="schBzEdit">Edit busy times</button><button type="button" class="stone sch-x" id="schDesel" aria-label="Deselect">✕</button></div>';
  } else if (sb && schEnded(T, sb)) {
    var rpE = sb.rep ? repById(sb.rep) : null,
      dnE = sb.q ? schDoneIn(T, sb) : 0,
      lnE = sb.t - sb.f,
      shE = schShort(T, sb);
    f2 =
      '<p class="sch-ft-h"><b>' +
      esc(nameOf(sb)) +
      "</b> " +
      hhmmOf(sb.f) +
      "–" +
      hhmmOf(sb.t) +
      ' <small class="sch-tag">Ended</small></p>' +
      (rpE ? '<p class="sch-rep">↻ ' + esc(repText(rpE)) + "</p>" : "") +
      '<p class="help sch-help">' +
      (!sb.q
        ? ""
        : dnE >= lnE
          ? "Done ✔ "
          : dnE
            ? hm(dnE) + " of " + hm(lnE) + " done" + (shE ? ", " + hm(shE) + " short" : "") + ". "
            : "Nothing timed in it. ") +
      "Ended blocks stay as planned.</p>" +
      (shE
        ? '<div class="sch-acts sch-pri"><button type="button" class="stone save" id="schRpl">Re-plan ' +
          hm(shE) +
          "</button></div>"
        : "") +
      '<div class="sch-acts">' +
      (sb.q
        ? '<button type="button" class="stone" id="schRepB">' + (rpE ? "Edit repeat" : "Repeat") + "</button>"
        : "") +
      (rpE ? '<button type="button" class="stone del" id="schStop">Stop</button>' : "") +
      '<button type="button" class="stone sch-x" id="schDesel" aria-label="Deselect">✕</button></div>';
  } else if (sb) {
    var rp = sb.rep ? repById(sb.rep) : null,
      det = schDet && schDet.id === sb.id,
      cz = clashOf(sb),
      sht0 = schShort(T, sb),
      lf0 = schLeftIn(T, sb),
      pri =
        (det ? '<button type="button" class="stone save" id="schEvery">Every week</button>' : "") +
        (lf0
          ? '<button type="button" class="stone save" id="schRes">' +
            schResWord(T, sb) +
            " \u00b7 " +
            hm(lf0) +
            " left</button>"
          : "") +
        (sht0 ? '<button type="button" class="stone save" id="schRpl">Re-plan ' + hm(sht0) + "</button>" : "");
    f2 =
      '<p class="sch-ft-h"><b>' +
      esc(nameOf(sb)) +
      "</b> " +
      hhmmOf(sb.f) +
      "–" +
      hhmmOf(sb.t) +
      "</p>" +
      (rp ? '<p class="sch-rep">↻ ' + esc(repText(rp)) + "</p>" : "") +
      (cz
        ? '<p class="sch-clash">Overlaps ' +
          esc(cz.lb) +
          ". It stays for " +
          schTd() +
          ", but can’t be moved onto busy time.</p>"
        : "") +
      '<p class="help sch-help">' +
      (sht0 ? "Ended " + hm(sht0) + " short. Re-plan puts it in your next free time. " : "") +
      (det
        ? "Changed for " + schTd() + " only."
        : (sb.j5 ? "Its reminder starts a 5-minute timer. " : "Drag the corner tab to resize. ") +
          "Hold and drag to move, or tap a free time.") +
      "</p>" +
      (sb.q && !schStarted(T, sb)
        ? '<div class="sch-row"><div class="sjpick" role="radiogroup" aria-label="How to start"><button type="button" class="stone mini' +
          (sb.j5 ? "" : " on") +
          '" data-sm="range" role="radio" aria-checked="' +
          !sb.j5 +
          '">Time range</button><button type="button" class="stone mini' +
          (sb.j5 ? " on" : "") +
          '" data-sm="j5" role="radio" aria-checked="' +
          !!sb.j5 +
          '">5-min start</button></div></div>'
        : "") +
      (pri ? '<div class="sch-acts sch-pri">' + pri + "</div>" : "") +
      '<div class="sch-acts">' +
      (rp
        ? '<button type="button" class="stone" id="schRepB">Edit repeat</button><button type="button" class="stone" id="schRm">Skip ' +
          schTd() +
          '</button><button type="button" class="stone del" id="schStop">Stop</button>'
        : '<button type="button" class="stone" id="schRepB">Repeat</button>' +
          (sb.q && !sb.j5 ? '<button type="button" class="stone" id="schSplit">Split</button>' : "") +
          '<button type="button" class="stone del" id="schRm">Remove</button>') +
      '<button type="button" class="stone sch-x" id="schDesel" aria-label="Deselect">✕</button></div>';
  } else if (schPick != null) {
    var past = schPick < fl,
      open = Q.slice().sort(function (a, b) {
        return (schLeft(T, b) > 0) - (schLeft(T, a) > 0);
      });
    f2 =
      '<p class="sch-ft-h">' +
      (past ? "Earlier today, <b>" + hhmmOf(schPick) + "</b>" : "Add at <b>" + hhmmOf(schPick) + "</b>") +
      "</p>" +
      (past
        ? ""
        : '<div class="sch-pick">' +
          open
            .map(function (q) {
              var lf = schLeft(T, q);
              return (
                '<button type="button" class="stone' +
                (lf > 0 ? " save" : "") +
                '" data-pk="' +
                q.id +
                '">' +
                esc(q.label) +
                " <small>" +
                (lf > 0 ? hm(lf) + (schPlaced(T, q.id) ? " left" : "") : "+30m extra") +
                "</small></button>"
              );
            })
            .join("") +
          "</div>") +
      '<div class="sch-acts"><button type="button" class="stone" id="schBzB">Block busy time…</button><button type="button" class="stone" id="schPkNo">Cancel</button></div>';
  } else {
    var rz = FT ? null : schResumable(T),
      rq =
        rz &&
        Q.filter(function (q) {
          return q.id === rz.b.q;
        })[0],
      sb2 = FT
        ? null
        : L.filter(function (b) {
            return schShort(T, b);
          })[0],
      sq2 =
        sb2 &&
        Q.filter(function (q) {
          return q.id === sb2.q;
        })[0],
      pr2 =
        (rq
          ? '<button type="button" class="stone save" id="schResA">' +
            schResWord(T, rz.b) +
            " " +
            esc(rq.label) +
            " \u00b7 " +
            hm(rz.left) +
            " left</button>"
          : "") +
        (sq2
          ? '<button type="button" class="stone save" id="schRplA">Re-plan ' +
            esc(sq2.label) +
            " \u00b7 " +
            hm(schShort(T, sb2)) +
            "</button>"
          : "");
    f2 =
      (pr2 ? '<div class="sch-acts sch-pri">' + pr2 + "</div>" : "") +
      '<p class="help sch-help">Tap a free time to add a quest. Tap a block to change or repeat it.</p><div class="sch-acts"><button type="button" class="stone save" id="schAuto"' +
      (Q.some(function (q) {
        return schLeft(T, q) >= SCH_STEP && !metQ(q, e);
      })
        ? ""
        : " disabled") +
      '>Auto-plan the rest</button><button type="button" class="stone" id="schBzOpen">Busy times</button>' +
      (L.some(function (x) {
        return !x.busy && x.f >= nw0;
      })
        ? '<button type="button" class="stone del" id="schClr">' + (FT ? "Clear all" : "Clear rest") + "</button>"
        : "") +
      "</div>";
  }
  ft.innerHTML = (schMsg ? '<p class="cmsg2" id="schMsg">' + esc(schMsg) + "</p>" : "") + f2;
  function on(id, fn) {
    var x = ft.querySelector("#" + id);
    if (x) x.addEventListener("click", fn);
  }
  tray.querySelectorAll("[data-wd]").forEach(function (x) {
    x.addEventListener("click", function () {
      schWd = +x.getAttribute("data-wd");
      schSel = null;
      schPick = null;
      schMsg = "";
      haptic("light");
      schDraw(true);
    });
  });
  ft.querySelectorAll("[data-sm]").forEach(function (x) {
    x.addEventListener("click", function () {
      schMode(schSel, x.getAttribute("data-sm") === "j5");
      schDraw();
    });
  });
  ft.querySelectorAll("[data-pk]").forEach(function (x) {
    x.addEventListener("click", function () {
      var m2 = schPick;
      schPick = null;
      schAdd(x.getAttribute("data-pk"), m2);
      schDraw();
    });
  });
  ft.querySelectorAll("[data-bz]").forEach(function (x) {
    x.addEventListener("click", function () {
      busyAdd(x.getAttribute("data-bz"), schPick);
      schDraw();
    });
  });
  ft.querySelectorAll("[data-bd]").forEach(function (x) {
    x.addEventListener("click", function () {
      busyDay(schSel, +x.getAttribute("data-bd"));
      haptic("light");
      schDraw();
    });
  });
  ft.querySelectorAll("[data-rd]").forEach(function (x) {
    x.addEventListener("click", function () {
      var d = +x.getAttribute("data-rd"),
        k = schRep.dows.indexOf(d);
      if (k >= 0) schRep.dows.splice(k, 1);
      else schRep.dows.push(d);
      haptic("light");
      schDraw();
    });
  });
  if (BZ && sb) {
    var bt3 = busyById(sb.id),
      wk3 = bt3 && bt3.until ? Math.max(1, Math.ceil((daysBetween(T, bt3.until) + 1) / 7)) : 0;
    on("schBzAlways", function () {
      busyWeeks(schSel, 0);
      schDraw();
    });
    on("schWkM", function () {
      busyWeeks(schSel, Math.max(1, (wk3 || 5) - 1));
      schDraw();
    });
    on("schWkP", function () {
      busyWeeks(schSel, Math.min(REP_MAX, (wk3 || 3) + 1));
      schDraw();
    });
    var nm = ft.querySelector("#schBzName"),
      nmId = schSel,
      nm0 = nm.value,
      nmT = null;
    function nmSave() {
      clearTimeout(nmT);
      var v = nm.value.trim().slice(0, 30);
      if (!v || v === nm0 || v === (busyById(nmId) || {}).lb) return;
      nm0 = v;
      busySave(function (B) {
        B.forEach(function (x) {
          if (x.id === nmId) x.lb = v;
        });
      });
      var lbl = tl.querySelector('.sch-b[data-sb="' + nmId + '"] b');
      if (lbl) lbl.textContent = v;
    }
    nm.addEventListener("input", function () {
      clearTimeout(nmT);
      nmT = setTimeout(nmSave, 400);
    });
    nm.addEventListener("change", nmSave);
    nm.addEventListener("keydown", function (ev) {
      if (ev.key === "Enter") {
        nmSave();
        nm.blur();
      }
    });
  } else {
    on("schWkM", function () {
      schRep.weeks = Math.max(1, schRep.weeks - 1);
      schDraw();
    });
    on("schWkP", function () {
      schRep.weeks = Math.min(REP_MAX, schRep.weeks + 1);
      schDraw();
    });
  }
  on("schBzRm", function () {
    busyRemove(schSel);
    schDraw();
  });
  on("schRepNo", function () {
    schRep = null;
    schDraw();
  });
  on("schRepOk", function () {
    schRepSave(schRep.id, schRep.dows, schRep.weeks, schRep.weeks === schRep.w0);
    schDraw();
  });
  on("schRepB", function () {
    var b = L.filter(function (x) {
        return x.id === schSel;
      })[0],
      r = b && (b.rep || b.src) ? repById(b.rep || b.src) : null;
    schRep = {
      id: schSel,
      dows: r
        ? r.dows.slice()
        : [parse(T).getDay()].filter(function (d) {
            return schRepDays(b).indexOf(d) >= 0;
          }),
      weeks: r ? Math.max(1, Math.min(REP_MAX, Math.ceil((daysBetween(T, r.until) + 1) / 7))) : 4,
    };
    schRep.w0 = r ? schRep.weeks : -1;
    schMsg = "";
    schDraw();
  });
  on("schEvery", function () {
    schRepEvery();
    schDraw();
  });
  function resume(b) {
    var q =
      b &&
      schQuests(T).filter(function (z) {
        return z.id === b.q;
      })[0];
    if (!q) return;
    closeSchedule();
    go("today");
    toggleTimer(q);
  }
  on("schRes", function () {
    resume(
      L.filter(function (x) {
        return x.id === schSel;
      })[0],
    );
  });
  on("schResA", function () {
    var r = schResumable(T);
    if (r) resume(r.b);
  });
  on("schStop", function () {
    var b = L.filter(function (x) {
      return x.id === schSel;
    })[0];
    if (b && b.rep) schRepStop(b.rep);
    schDraw();
  });
  on("schPkNo", function () {
    schPick = null;
    schMsg = "";
    schDraw();
  });
  on("schBzB", function () {
    openBusy(parse(T).getDay(), schPick, true);
  });
  on("schBzOpen", function () {
    openBusy(parse(T).getDay(), null, true);
  });
  on("schBzEdit", function () {
    var b = L.filter(function (x) {
      return x.id === schSel;
    })[0];
    openBusy(parse(T).getDay(), null, true);
    if (b && b.busy) {
      schSel = b.busy;
      schDraw();
    }
  });
  on("schBzAdd", function () {
    busyAdd(ft.querySelector("#schBzIn").value, schPick);
    schDraw();
  });
  var bzi = ft.querySelector("#schBzIn");
  if (bzi)
    bzi.addEventListener("keydown", function (ev) {
      if (ev.key === "Enter") {
        busyAdd(bzi.value, schPick);
        schDraw();
      }
    });
  on("schSplit", function () {
    schSplit(schSel);
    schDraw();
  });
  on("schRm", function () {
    schRemove(schSel);
    schDraw();
  });
  on("schDesel", function () {
    schSel = null;
    schDet = null;
    schMsg = "";
    schDraw();
  });
  on("schAuto", function () {
    schAuto();
    schDraw();
  });
  on("schRpl", function () {
    schReplan(schSel);
    schDraw();
  });
  on("schRplA", function () {
    var b = L.filter(function (x) {
      return schShort(T, x);
    })[0];
    if (b) schReplan(b.id);
    schDraw();
  });
  var cl = ft.querySelector("#schClr"),
    arm = null;
  if (cl)
    cl.addEventListener("click", function () {
      if (!arm) {
        cl.textContent = "Confirm clear";
        arm = setTimeout(function () {
          arm = null;
          cl.textContent = FT ? "Clear all" : "Clear rest";
        }, 4000);
        return;
      }
      clearTimeout(arm);
      var rr = schAll(T)
        .filter(function (b) {
          return b.rep && b.f >= nw0;
        })
        .map(function (b) {
          return b.rep;
        });
      schSave(function (L2, e2) {
        if (rr.length) e2.schSkip = (e2.schSkip || []).concat(rr);
        return L2.filter(function (x) {
          return x.f < nw0;
        });
      });
      schSel = null;
      schMsg =
        (FT ? "Cleared this day." : "Cleared what’s left today. Blocks already started stay.") +
        (rr.length ? " Repeats continue next time." : "");
      schDraw();
    });
  var sc0 = schPg.querySelector("#schScroll"),
    onB = tl.querySelector(".sch-b.on");
  if (onB && schSel !== schShown && !schDrag) {
    var bb = onB.offsetTop + onB.offsetHeight,
      vb = sc0.scrollTop + sc0.clientHeight;
    if (bb > sc0.scrollTop + sc0.clientHeight * 0.6)
      sc0.scrollTop = Math.min(onB.offsetTop - 8, bb - Math.round(sc0.clientHeight * 0.55));
    else if (onB.offsetTop < sc0.scrollTop) sc0.scrollTop = onB.offsetTop - 8;
  }
  schShown = schSel;
  if (first) {
    var nw = tl.querySelector("#schNow"),
      sc = schPg.querySelector("#schScroll");
    sc.scrollTop = 0;
    if (nw) sc.scrollTop = Math.max(0, nw.offsetTop - sc.clientHeight / 3);
    else if (schPick != null) sc.scrollTop = Math.max(0, px(schPick) - sc.clientHeight / 3);
  }
  schNowVis();
}
function schRows(defs, k) {
  defs.forEach(function (q) {
    var el = qEls[q.id];
    if (!el || q.type !== "time") return;
    var L = schOfQ(k, q.id);
    if (!L.length) return;
    var txt = L.map(function (b) {
        var l = k === todayKey() ? schLeftIn(k, b) : 0;
        return schText(b) + (l ? " (" + hm(l) + " left)" : "");
      }).join(", "),
      rq = el.row.querySelector(".req");
    if (rq && rq.textContent.indexOf(txt) < 0) rq.textContent += " · " + txt;
  });
}
