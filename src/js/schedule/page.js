/* ---- the schedule page: drawing, footer, drag and resize ---- */
import { G } from "../core/g.js";
import { S } from "../core/00-state.js";
import { add, daysBetween, nowMinInDay, parse, todayKey, wkOrder } from "../core/days.js";
import { locked } from "../core/entries.js";
import { esc, fmtD, hm } from "../core/util.js";
import { DN, qEls } from "../quests/02-quest-list.js";
import { WDN, WDS } from "../quests/35b-daily-limit.js";
import { metQ } from "../rules/day-rules.js";
import { REP_MAX, SCH_AHEAD, SCH_DENSE_MIN, SCH_EDGE, SCH_ROW_DENSE, SCH_ROW_FULL, SCH_STEP } from "./51-schedule.js";
import {
  busyAdd,
  busyById,
  busyDay,
  busyForWd,
  busyRecent,
  busyRemove,
  busySave,
  busyText,
  busyWeeks,
} from "./busy.js";
import {
  dayOvClear,
  dayOvSave,
  hhmmOf,
  schAdd,
  schAll,
  schAt,
  schAuto,
  schClash,
  schCut,
  schEdit,
  schEnded,
  schFloor,
  schGeo,
  schK,
  schLeft,
  schLen,
  schList,
  schMode,
  schMove,
  schNext,
  schOfQ,
  schPlaced,
  schQuests,
  schRemove,
  schSave,
  schSplit,
  schStarted,
  schTd,
  busyOff,
  busySkipped,
  schText,
} from "./model.js";
import { schDayDone, schDoneIn, schReplan, schShort } from "./progress.js";
import { repById, repText, schRepCount, schRepDays, schRepEvery, schRepSave, schRepStop } from "./repeats.js";
import { schLeftIn, schResWord, schResumable } from "./resume.js";
import { renderSettings } from "../settings/10-settings.js";
import { toggleTimer } from "../timer/13-focus-timer.js";
import { render } from "../ui/04-render.js";
import { go } from "../ui/44-navigation.js";
import { haptic } from "../ui/45-gestures.js";

export function schOpen() {
  return !!G.schPg && !G.schPg.hidden;
}
export function schEnsure() {
  if (!G.schPg) {
    G.schPg = document.createElement("div");
    G.schPg.id = "schPage";
    G.schPg.className = "schpage";
    G.schPg.setAttribute("role", "dialog");
    G.schPg.setAttribute("aria-modal", "true");
    G.schPg.setAttribute("aria-labelledby", "schTitle");
    G.schPg.innerHTML =
      '<div class="sch-hd"><div class="sch-hdt"><div class="sch-nav"><button type="button" class="stone mini" id="schDP" aria-label="Previous day">‹</button><h2 id="schTitle">Today</h2><button type="button" class="stone mini" id="schDN" aria-label="Next day">›</button></div><p class="sch-sum"><span id="schSum"></span> <button type="button" class="lnk sch-adjb" id="schAdjB" aria-expanded="false">Adjust today</button></p></div><button type="button" class="stone save" id="schOk">Done</button></div><div class="sch-adj" id="schAdj" hidden></div><div class="sch-tray" id="schTray"></div><div class="sch-scroll" id="schScroll"><div class="sch-tl" id="schTl"></div><button type="button" class="stone sch-nowb" id="schNowBtn" hidden>\u25bc Now</button></div><div class="sch-ft" id="schFt"></div>';
    document.body.appendChild(G.schPg);
    G.schPg.querySelector("#schOk").addEventListener("click", closeSchedule);
    G.schPg.querySelector("#schAdjB").addEventListener("click", function () {
      G.schAdj = !G.schAdj;
      schDraw();
    });
    G.schPg.querySelector("#schDP").addEventListener("click", function () {
      schGoDay(-1);
    });
    G.schPg.querySelector("#schDN").addEventListener("click", function () {
      schGoDay(1);
    });
    schWire();
  }
  G.schPg.hidden = false;
  document.body.classList.add("sch-open");
  G.schBody = G.schPg;
}
export function schGoDay(n) {
  var T = todayKey(),
    k = add(schK(), n);
  if (k < T || k > add(T, SCH_AHEAD)) return;
  G.schDay = k > T ? k : null;
  G.schSel = null;
  G.schPick = null;
  G.schRep = null;
  G.schDet = null;
  G.schMsg = "";
  G.schAdj = false;
  haptic("light");
  schDraw(true);
}
export function schDayName(k) {
  var T = todayKey();
  return k === T ? "Today" : k === add(T, 1) ? "Tomorrow" : WDS[parse(k).getDay()] + ", " + fmtD(k);
}
export function openSchedule() {
  if (locked()) return;
  G.schMd = "today";
  G.schDay = null;
  G.schBack = false;
  G.schSel = null;
  G.schQ = null;
  G.schPick = null;
  G.schAdj = false;
  G.schMsg = "";
  G.schDet = null;
  G.schRep = null;
  schEnsure();
  schDraw(true);
}
export function openBusy(wd, at, back) {
  if (locked()) return;
  G.schMd = "busy";
  G.schWd = wd == null ? parse(todayKey()).getDay() : wd;
  G.schBack = !!back;
  G.schSel = null;
  G.schPick = at == null ? null : at;
  G.schAdj = false;
  G.schMsg = "";
  G.schDet = null;
  G.schRep = null;
  schEnsure();
  schDraw(true);
}
export function closeSchedule() {
  if (!G.schPg) return;
  if (G.schMd === "busy" && G.schBack) {
    G.schMd = "today";
    G.schBack = false;
    G.schSel = null;
    G.schPick = null;
    G.schMsg = "";
    schDraw(true);
    return;
  }
  G.schPg.hidden = true;
  document.body.classList.remove("sch-open");
  G.schBody = null;
  G.schDrag = null;
  G.schSel = null;
  G.schPick = null;
  G.schMd = "today";
  render();
  if (typeof renderSettings === "function" && G.setTab === "day") renderSettings();
}
/* "Now" button: sticky at the bottom of the scroller on today, shown only while the now line is off screen; tapping scrolls the now line a third of the way down. */
export function schNowVis() {
  var sc = G.schPg.querySelector("#schScroll"),
    nb = G.schPg.querySelector("#schNowBtn"),
    nw = G.schPg.querySelector("#schNow");
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
export function schGoNow() {
  var sc = G.schPg.querySelector("#schScroll"),
    nw = G.schPg.querySelector("#schNow");
  if (!nw) return;
  sc.scrollTo({ top: Math.max(0, nw.offsetTop - sc.clientHeight / 3), behavior: "smooth" });
  haptic("light");
}
export function schWire() {
  var sc = G.schPg.querySelector("#schScroll"),
    tl = G.schPg.querySelector("#schTl"),
    lp = null;
  sc.addEventListener("scroll", schNowVis, { passive: true });
  G.schPg.querySelector("#schNowBtn").addEventListener("click", schGoNow);
  tl.addEventListener("click", function (ev) {
    if (G.schDrag) return;
    var bk = ev.target.closest("[data-sb]");
    if (bk) {
      var id = bk.getAttribute("data-sb");
      G.schSel = G.schSel === id ? null : id;
      G.schPick = null;
      G.schRep = null;
      G.schDet = null;
      G.schMsg = "";
      schDraw();
      return;
    }
    var m = schAt(ev.clientY);
    if (G.schRep) {
      G.schRep = null;
      schDraw();
      return;
    }
    if (
      G.schSel &&
      (G.schSel.indexOf("z-") === 0 ||
        schEnded(
          schK(),
          schList().filter(function (x) {
            return x.id === G.schSel;
          })[0],
        ))
    )
      G.schSel = null;
    else if (G.schSel) {
      schMove(G.schSel, m);
      schDraw();
      return;
    }
    if (schClash(schList(), null, m, m + 1)) {
      schDraw();
      return;
    }
    G.schPick = G.schPick === m ? null : m;
    G.schMsg =
      G.schPick != null && m < schFloor()
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
export function schAutoScroll(sc, tick) {
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
export function schMoveDrag(bk, y0, kind) {
  var g = schGeo(),
    id = bk.getAttribute("data-sb"),
    L = schList(),
    bl = L.filter(function (x) {
      return x.id === id;
    })[0];
  if (!bl) return;
  var len = bl.t - bl.f,
    f = bl.f,
    sc = G.schPg.querySelector("#schScroll"),
    tl = G.schPg.querySelector("#schTl"),
    grab = y0 - bk.getBoundingClientRect().top;
  G.schDrag = { id: id };
  bk.classList.add("lift");
  function show(y) {
    var r = tl.getBoundingClientRect(),
      nf = g.s0 + Math.round((y - grab - r.top) / G.SCH_ROW) * SCH_STEP;
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
    else if (f !== bl.f) G.schMsg = "Can’t drop it there: it overlaps another block or the time has passed.";
    G.schSel = sid;
    G.schPick = null;
    schDraw();
    setTimeout(function () {
      G.schDrag = null;
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
export function schResize(ev, hd) {
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
    tl = G.schPg.querySelector("#schTl"),
    sc = G.schPg.querySelector("#schScroll"),
    grab = ev.clientY - blk.getBoundingClientRect().bottom;
  G.schDrag = { id: id };
  try {
    hd.setPointerCapture(ev.pointerId);
  } catch (x) {}
  var lo = Math.max(bl.f + SCH_STEP, schStarted(schK(), bl) ? Math.min(schCut(), bl.t) : -1e9);
  function show(y) {
    var r = tl.getBoundingClientRect();
    t = Math.max(lo, Math.min(cap, g.s0 + Math.round((y - grab - r.top) / G.SCH_ROW) * SCH_STEP));
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
    G.schSel = sid;
    G.schPick = null;
    schDraw();
    setTimeout(function () {
      G.schDrag = null;
    }, 0);
  }
  hd.addEventListener("pointermove", mv);
  hd.addEventListener("pointerup", up);
  hd.addEventListener("pointercancel", up);
}
export function schDraw(first) {
  if (!schOpen()) return;
  var T = schK(),
    FT = T !== todayKey(),
    nw0 = FT ? -1e9 : nowMinInDay(),
    g = schGeo(),
    w = g.w,
    BZ = G.schMd === "busy",
    Q = BZ ? [] : schQuests(T),
    L = schList(),
    e = S.days[T] || {},
    px = g.px,
    fl = schFloor(),
    now = nowMinInDay();
  var sum = G.schPg.querySelector("#schSum"),
    tray = G.schPg.querySelector("#schTray"),
    tl = G.schPg.querySelector("#schTl"),
    ft = G.schPg.querySelector("#schFt");
  if (
    G.schSel &&
    !L.some(function (x) {
      return x.id === G.schSel;
    })
  )
    G.schSel = null;
  if (
    G.schRep &&
    !L.some(function (x) {
      return x.id === G.schRep.id;
    })
  )
    G.schRep = null;
  if (G.schDet && G.schDet.id !== G.schSel) G.schDet = null;
  var adj = G.schPg.querySelector("#schAdj"),
    adjB = G.schPg.querySelector("#schAdjB");
  G.schPg.classList.toggle("busymode", BZ);
  G.schPg.querySelector("#schTitle").textContent = BZ ? "Busy times" : schDayName(T);
  var dP = G.schPg.querySelector("#schDP"),
    dN = G.schPg.querySelector("#schDN");
  dP.hidden = dN.hidden = BZ;
  dP.disabled = !FT;
  dN.disabled = T >= add(todayKey(), SCH_AHEAD);
  G.schPg.querySelector("#schOk").textContent = BZ && G.schBack ? "Back" : "Done";
  adjB.hidden = BZ || FT;
  adj.hidden = BZ || FT || !G.schAdj;
  adjB.setAttribute("aria-expanded", G.schAdj);
  adjB.textContent = G.schAdj ? "Close" : "Adjust today";
  if (!BZ && !FT && G.schAdj) {
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
    G.SCH_ROW = !BZ && tot + bz < SCH_DENSE_MIN ? SCH_ROW_DENSE : SCH_ROW_FULL;
    g = schGeo();
    px = g.px;
  }
  tl.classList.toggle("dense", G.SCH_ROW === SCH_ROW_DENSE);
  tl.style.setProperty("--row", G.SCH_ROW + "px");
  var smMin = G.SCH_ROW === SCH_ROW_DENSE ? 45 : 30;
  if (BZ) {
    sum.textContent =
      WDN[G.schWd] +
      " · " +
      (L.length ? L.length + " block" + (L.length === 1 ? "" : "s") + " · " + hm(bz) : "nothing blocked");
    tray.innerHTML =
      '<div class="sch-wds" role="tablist" aria-label="Weekday">' +
      wkOrder()
        .map(function (d) {
          var n = busyForWd(d).length;
          return (
            '<button type="button" class="stone' +
            (d === G.schWd ? " on" : "") +
            '" data-wd="' +
            d +
            '" role="tab" aria-selected="' +
            (d === G.schWd) +
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
  if (G.schPick != null)
    h +=
      '<i class="sch-ghost" style="top:' +
      px(G.schPick) +
      "px;height:" +
      G.SCH_ROW * 2 +
      'px"><span>' +
      hhmmOf(G.schPick) +
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
      grip = !(bl.j5 || ro || G.schSel !== bl.id);
    h +=
      '<div class="sch-b' +
      (bl.lb ? " busy" : "") +
      (ro ? " ro" : "") +
      (en ? " past" : "") +
      (cl ? " clash" : "") +
      (bl.j5 ? " j5" : "") +
      (bl.rep ? " rep" : "") +
      (G.schSel === bl.id ? " on" : "") +
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
      Math.max(G.SCH_ROW, px(bl.t) - px(bl.f)) +
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
  var sb = G.schSel
      ? L.filter(function (x) {
          return x.id === G.schSel;
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
  var wdn = WDN[G.schWd];
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
  } else if (BZ && G.schPick != null) {
    f2 =
      '<p class="sch-ft-h">Busy at <b>' +
      hhmmOf(G.schPick) +
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
  } else if (G.schRep) {
    var rb = L.filter(function (x) {
        return x.id === G.schRep.id;
      })[0],
      okd = schRepDays(rb),
      n = schRepCount(rb, G.schRep.dows, G.schRep.weeks),
      u = add(T, G.schRep.weeks * 7 - 1);
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
          var on = G.schRep.dows.indexOf(d) >= 0,
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
      (G.schRep.weeks <= 1 ? " disabled" : "") +
      '>−</button><b id="schWkN">' +
      G.schRep.weeks +
      " week" +
      (G.schRep.weeks === 1 ? "" : "s") +
      '</b><button type="button" class="stone" id="schWkP" aria-label="More weeks"' +
      (G.schRep.weeks >= REP_MAX ? " disabled" : "") +
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
      '.</p><div class="sch-acts"><button type="button" class="stone" id="schBzSkip">Not ' +
      schTd() +
      '</button><button type="button" class="stone" id="schBzEdit">Edit busy times</button><button type="button" class="stone sch-x" id="schDesel" aria-label="Deselect">✕</button></div>';
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
      det = G.schDet && G.schDet.id === sb.id,
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
  } else if (G.schPick != null) {
    var past = G.schPick < fl,
      open = Q.slice().sort(function (a, b) {
        return (schLeft(T, b) > 0) - (schLeft(T, a) > 0);
      });
    f2 =
      '<p class="sch-ft-h">' +
      (past ? "Earlier today, <b>" + hhmmOf(G.schPick) + "</b>" : "Add at <b>" + hhmmOf(G.schPick) + "</b>") +
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
    var bzOff = busySkipped(T);
    f2 =
      (pr2 ? '<div class="sch-acts sch-pri">' + pr2 + "</div>" : "") +
      (bzOff.length
        ? '<div class="sch-acts">' +
          bzOff
            .map(function (b) {
              return (
                '<button type="button" class="stone" data-bzon="' +
                esc(b.id) +
                '">' +
                esc(b.lb) +
                " is off " +
                schTd() +
                " \u00b7 Put back</button>"
              );
            })
            .join("") +
          "</div>"
        : "") +
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
  ft.innerHTML = (G.schMsg ? '<p class="cmsg2" id="schMsg">' + esc(G.schMsg) + "</p>" : "") + f2;
  function on(id, fn) {
    var x = ft.querySelector("#" + id);
    if (x) x.addEventListener("click", fn);
  }
  tray.querySelectorAll("[data-wd]").forEach(function (x) {
    x.addEventListener("click", function () {
      G.schWd = +x.getAttribute("data-wd");
      G.schSel = null;
      G.schPick = null;
      G.schMsg = "";
      haptic("light");
      schDraw(true);
    });
  });
  ft.querySelectorAll("[data-sm]").forEach(function (x) {
    x.addEventListener("click", function () {
      schMode(G.schSel, x.getAttribute("data-sm") === "j5");
      schDraw();
    });
  });
  ft.querySelectorAll("[data-pk]").forEach(function (x) {
    x.addEventListener("click", function () {
      var m2 = G.schPick;
      G.schPick = null;
      schAdd(x.getAttribute("data-pk"), m2);
      schDraw();
    });
  });
  ft.querySelectorAll("[data-bz]").forEach(function (x) {
    x.addEventListener("click", function () {
      busyAdd(x.getAttribute("data-bz"), G.schPick);
      schDraw();
    });
  });
  ft.querySelectorAll("[data-bd]").forEach(function (x) {
    x.addEventListener("click", function () {
      busyDay(G.schSel, +x.getAttribute("data-bd"));
      haptic("light");
      schDraw();
    });
  });
  ft.querySelectorAll("[data-rd]").forEach(function (x) {
    x.addEventListener("click", function () {
      var d = +x.getAttribute("data-rd"),
        k = G.schRep.dows.indexOf(d);
      if (k >= 0) G.schRep.dows.splice(k, 1);
      else G.schRep.dows.push(d);
      haptic("light");
      schDraw();
    });
  });
  if (BZ && sb) {
    var bt3 = busyById(sb.id),
      wk3 = bt3 && bt3.until ? Math.max(1, Math.ceil((daysBetween(T, bt3.until) + 1) / 7)) : 0;
    on("schBzAlways", function () {
      busyWeeks(G.schSel, 0);
      schDraw();
    });
    on("schWkM", function () {
      busyWeeks(G.schSel, Math.max(1, (wk3 || 5) - 1));
      schDraw();
    });
    on("schWkP", function () {
      busyWeeks(G.schSel, Math.min(REP_MAX, (wk3 || 3) + 1));
      schDraw();
    });
    var nm = ft.querySelector("#schBzName"),
      nmId = G.schSel,
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
      G.schRep.weeks = Math.max(1, G.schRep.weeks - 1);
      schDraw();
    });
    on("schWkP", function () {
      G.schRep.weeks = Math.min(REP_MAX, G.schRep.weeks + 1);
      schDraw();
    });
  }
  on("schBzRm", function () {
    busyRemove(G.schSel);
    schDraw();
  });
  on("schRepNo", function () {
    G.schRep = null;
    schDraw();
  });
  on("schRepOk", function () {
    schRepSave(G.schRep.id, G.schRep.dows, G.schRep.weeks, G.schRep.weeks === G.schRep.w0);
    schDraw();
  });
  on("schRepB", function () {
    var b = L.filter(function (x) {
        return x.id === G.schSel;
      })[0],
      r = b && (b.rep || b.src) ? repById(b.rep || b.src) : null;
    G.schRep = {
      id: G.schSel,
      dows: r
        ? r.dows.slice()
        : [parse(T).getDay()].filter(function (d) {
            return schRepDays(b).indexOf(d) >= 0;
          }),
      weeks: r ? Math.max(1, Math.min(REP_MAX, Math.ceil((daysBetween(T, r.until) + 1) / 7))) : 4,
    };
    G.schRep.w0 = r ? G.schRep.weeks : -1;
    G.schMsg = "";
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
        return x.id === G.schSel;
      })[0],
    );
  });
  on("schResA", function () {
    var r = schResumable(T);
    if (r) resume(r.b);
  });
  on("schStop", function () {
    var b = L.filter(function (x) {
      return x.id === G.schSel;
    })[0];
    if (b && b.rep) schRepStop(b.rep);
    schDraw();
  });
  on("schPkNo", function () {
    G.schPick = null;
    G.schMsg = "";
    schDraw();
  });
  on("schBzB", function () {
    openBusy(parse(T).getDay(), G.schPick, true);
  });
  on("schBzOpen", function () {
    openBusy(parse(T).getDay(), null, true);
  });
  on("schBzSkip", function () {
    var b = L.filter(function (x) {
      return x.id === G.schSel;
    })[0];
    if (!b || !b.busy || !busyOff(b.busy, true)) return;
    G.schSel = null;
    G.schMsg = b.lb + " is off " + schTd() + ". The time is free; it still repeats.";
    haptic("light");
    schDraw();
  });
  ft.querySelectorAll("[data-bzon]").forEach(function (x) {
    x.addEventListener("click", function () {
      if (!busyOff(x.getAttribute("data-bzon"), false)) return;
      G.schMsg = "";
      haptic("light");
      schDraw();
    });
  });
  on("schBzEdit", function () {
    var b = L.filter(function (x) {
      return x.id === G.schSel;
    })[0];
    openBusy(parse(T).getDay(), null, true);
    if (b && b.busy) {
      G.schSel = b.busy;
      schDraw();
    }
  });
  on("schBzAdd", function () {
    busyAdd(ft.querySelector("#schBzIn").value, G.schPick);
    schDraw();
  });
  var bzi = ft.querySelector("#schBzIn");
  if (bzi)
    bzi.addEventListener("keydown", function (ev) {
      if (ev.key === "Enter") {
        busyAdd(bzi.value, G.schPick);
        schDraw();
      }
    });
  on("schSplit", function () {
    schSplit(G.schSel);
    schDraw();
  });
  on("schRm", function () {
    schRemove(G.schSel);
    schDraw();
  });
  on("schDesel", function () {
    G.schSel = null;
    G.schDet = null;
    G.schMsg = "";
    schDraw();
  });
  on("schAuto", function () {
    schAuto();
    schDraw();
  });
  on("schRpl", function () {
    schReplan(G.schSel);
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
      G.schSel = null;
      G.schMsg =
        (FT ? "Cleared this day." : "Cleared what’s left today. Blocks already started stay.") +
        (rr.length ? " Repeats continue next time." : "");
      schDraw();
    });
  var sc0 = G.schPg.querySelector("#schScroll"),
    onB = tl.querySelector(".sch-b.on");
  if (onB && G.schSel !== G.schShown && !G.schDrag) {
    var bb = onB.offsetTop + onB.offsetHeight,
      vb = sc0.scrollTop + sc0.clientHeight;
    if (bb > sc0.scrollTop + sc0.clientHeight * 0.6)
      sc0.scrollTop = Math.min(onB.offsetTop - 8, bb - Math.round(sc0.clientHeight * 0.55));
    else if (onB.offsetTop < sc0.scrollTop) sc0.scrollTop = onB.offsetTop - 8;
  }
  G.schShown = G.schSel;
  if (first) {
    var nw = tl.querySelector("#schNow"),
      sc = G.schPg.querySelector("#schScroll");
    sc.scrollTop = 0;
    if (nw) sc.scrollTop = Math.max(0, nw.offsetTop - sc.clientHeight / 3);
    else if (G.schPick != null) sc.scrollTop = Math.max(0, px(G.schPick) - sc.clientHeight / 3);
  }
  schNowVis();
}
export function schRows(defs, k) {
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
