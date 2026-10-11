/* ---- today's schedule ----
     Places today's time quests on Your day. Stored on the day entry as e.sched = [{id, q, f, t, j5}]: one entry per
     block ("shot"), so a quest can be split into several. f/t are minutes from that day's midnight (dayWin scale).
     j5 = "5-min start": fixed length, its notification starts Just 5; otherwise a resizable range whose notification
     starts the normal timer. Planning only: hasEntry ignores it, so it never affects clearing or streaks.
     Busy times are a weekday template in cfg.busy = [{id, lb, f, t, dows, from, until?}], edited on the same page in
     "busy" mode (Settings › Your day › Busy times, or from the schedule). A block applies from the day it was added
     (from) on its weekdays, until `until` if set. schAll merges them as read-only {id:"z-"+id, busy, lb}: Auto-plan and
     new shots avoid them, but shots already placed that overlap stay (marked .clash) and still remind.
     Weekly quest repeats live in cfg.rep = [{id, q, f, t, j5?, dows, from, until}]; schAll merges them into each day as
     {id:"r-"+rep, rep, ...}. Editing one occurrence detaches it (a one-off copy + e.schSkip), with "Every week" to push
     the change back to the series. */
var SCH_STEP = 15,
  SCH_ROW = 22,
  SCH_ROW_FULL = 22,
  SCH_ROW_DENSE = 16,
  SCH_DENSE_MIN = 120,
  REP_MAX = 26,
  schSel = null,
  schQ = null,
  schMsg = "",
  schBody = null,
  schDrag = null,
  schDet = null,
  schRep = null,
  schMd = "today",
  schWd = 1,
  schBack = false,
  schShown = null,
  schDay = null,
  SCH_AHEAD = 13;
/* The day the schedule shows: today, or one of the next SCH_AHEAD days picked with the header arrows. */
function schK() {
  var T = todayKey();
  return schDay && schDay > T && schDay <= add(T, SCH_AHEAD) ? schDay : T;
}
function schFut() {
  return schK() !== todayKey();
}
/* A block whose end has passed is a record of the plan: it can't be moved, resized, split, switched or removed (Trends'
     "plan kept" reads it). Only Re-plan (adds new blocks) and series actions (Repeat, Stop) remain. */
function schEnded(T, b) {
  return !!b && T === todayKey() && b.t <= nowMinInDay();
}
/* The part of a block under way that has passed (up to schCut, the current 15-min step) is a record too: moving the
     block leaves that part behind as an ended block (keeping the old id), removing it trims it to that part, resizing
     can't cut into it, Split never splits inside it, and its start type can't be switched once it has started. */
function schCut() {
  return Math.floor(nowMinInDay() / SCH_STEP) * SCH_STEP;
}
function schStarted(T, b) {
  return !!b && T === todayKey() && b.f < nowMinInDay();
}
var SCH_ENDED = "That block has ended, so it stays as planned. Re-plan or add a new block instead.";
function schTd() {
  return schFut() ? "this day" : "today";
}
function schQuests(k) {
  return activeDefs(k).filter(function (q) {
    return q.type === "time" && !q.off && !q.ign;
  });
}
function schLen(q, k) {
  var m = q.roll ? q.roll / perWorkDays(q, k || todayKey()) : q.min;
  return Math.max(SCH_STEP, Math.ceil(m / 5) * 5);
}
function schNorm(s) {
  if (Array.isArray(s)) return s;
  var out = [];
  if (s && typeof s === "object")
    Object.keys(s)
      .sort()
      .forEach(function (id) {
        var b = s[id];
        if (b && b.f != null) out.push(Object.assign({ id: "b-" + id, q: id }, b));
      });
  return out;
}
function schReps() {
  return cfg().rep || [];
}
function repById(id) {
  return schReps().filter(function (r) {
    return r.id === id;
  })[0];
}
function repOn(r, k) {
  return k >= r.from && k <= r.until && r.dows.indexOf(parse(k).getDay()) >= 0;
}
function wkSort(L) {
  var o = wkOrder();
  return L.slice().sort(function (a, b) {
    return o.indexOf(a) - o.indexOf(b);
  });
}
function repText(r) {
  var d = wkSort(r.dows),
    w =
      d.length === 7
        ? "Every day"
        : d.join() === "1,2,3,4,5"
          ? "Weekdays"
          : d
              .map(function (x) {
                return DN[x];
              })
              .join(", ");
  return w + " until " + fmtD(r.until);
}
function schAll(k) {
  var e = S.days[k] || {},
    sk = e.schSkip || [],
    out = schNorm(e.sched).slice(),
    Q = null;
  schReps().forEach(function (r) {
    if (!repOn(r, k) || sk.indexOf(r.id) >= 0) return;
    if (r.q) {
      Q = Q || schQuests(k);
      if (
        !Q.some(function (q) {
          return q.id === r.q;
        })
      )
        return;
    }
    var b = { id: "r-" + r.id, rep: r.id, f: r.f, t: r.t };
    if (r.q) b.q = r.q;
    if (r.lb) b.lb = r.lb;
    if (r.j5) b.j5 = true;
    out.push(b);
  });
  busyList().forEach(function (b) {
    if (busyOn(b, k)) out.push({ id: "z-" + b.id, busy: b.id, lb: b.lb, f: b.f, t: b.t });
  });
  return out.sort(function (a, b) {
    return a.f - b.f;
  });
}
/* ---- busy-time template ---- */
function busyList() {
  return cfg().busy || [];
}
function busyById(id) {
  return busyList().filter(function (b) {
    return b.id === id;
  })[0];
}
function busyOn(b, k) {
  return k >= b.from && (!b.until || k <= b.until) && b.dows.indexOf(parse(k).getDay()) >= 0;
}
function busyDaysText(dows) {
  var d = wkSort(dows);
  return d.length === 7
    ? "Every day"
    : d.join() === "1,2,3,4,5"
      ? "Weekdays"
      : d
          .map(function (x) {
            return DN[x];
          })
          .join(", ");
}
function busyText(b) {
  return busyDaysText(b.dows) + (b.until ? " until " + fmtD(b.until) : ", every week");
}
function busyKey(wd) {
  var T = todayKey();
  for (var i = 1; i <= 7; i++) {
    var k = add(T, i);
    if (parse(k).getDay() === wd) return k;
  }
  return T;
}
function busyForWd(wd) {
  var T = todayKey();
  return busyList()
    .filter(function (b) {
      return b.dows.indexOf(wd) >= 0 && (!b.until || b.until >= T);
    })
    .map(function (b) {
      return { id: b.id, lb: b.lb, f: b.f, t: b.t, tpl: true };
    })
    .sort(function (a, b) {
      return a.f - b.f;
    });
}
function busySave(fn) {
  if (locked()) return;
  var c2 = clone(cfg()),
    T0 = todayKey();
  c2.busy = (c2.busy || []).filter(function (b) {
    return !b.until || b.until >= T0;
  });
  var r = fn(c2.busy);
  if (r) c2.busy = r;
  if (!c2.busy.length) delete c2.busy;
  saveCfg(c2);
  nfSig = "";
  qSig = "";
}
function busyRecent() {
  var out = [];
  function a(x) {
    if (x && out.indexOf(x) < 0) out.push(x);
  }
  busyList().forEach(function (b) {
    a(b.lb);
  });
  ["Lecture", "Meeting", "Work", "Commute"].forEach(function (x) {
    if (out.length < 4) a(x);
  });
  return out.slice(0, 6);
}
function busyAdd(lb, m) {
  var T = todayKey(),
    w = schWin(),
    L = busyForWd(schWd),
    f = m,
    t = Math.min(w.e, f + 60);
  lb = (lb || "").trim().slice(0, 30);
  if (!lb) {
    schMsg = "Give it a name.";
    return false;
  }
  var nx = schNext(L, null, f, w.e);
  if (nx < t) t = nx;
  var c = schClash(L, null, f, t);
  if (c || t - f < SCH_STEP) {
    schMsg = "That overlaps " + schName(c) + ". Pick a free time.";
    return false;
  }
  var id = "z" + schNewId();
  busySave(function (B) {
    B.push({ id: id, lb: lb, f: f, t: t, dows: [schWd], from: T });
  });
  schMsg = schWd === parse(T).getDay() ? "Applies from today." : "";
  schSel = id;
  schPick = null;
  return true;
}
function busyDay(id, d) {
  var b = busyById(id);
  if (!b) return;
  var on = b.dows.indexOf(d) >= 0;
  if (on && b.dows.length === 1) {
    schMsg = "It needs at least one day. Use Remove to delete it.";
    return;
  }
  if (!on) {
    var c = schClash(busyForWd(d), id, b.f, b.t);
    if (c) {
      schMsg = "That clashes with " + c.lb + " on " + WDN[d] + ".";
      return;
    }
  }
  busySave(function (B) {
    B.forEach(function (x) {
      if (x.id !== id) return;
      if (on)
        x.dows = x.dows.filter(function (y) {
          return y !== d;
        });
      else x.dows = x.dows.concat([d]);
    });
  });
  schMsg = "";
}
function busyWeeks(id, n) {
  var T = todayKey();
  busySave(function (B) {
    B.forEach(function (x) {
      if (x.id !== id) return;
      if (n > 0) x.until = add(T, n * 7 - 1);
      else delete x.until;
    });
  });
}
function busyRemove(id) {
  busySave(function (B) {
    return B.filter(function (x) {
      return x.id !== id;
    });
  });
  schSel = null;
  schMsg = "Removed.";
}
function schWin() {
  return dayWin(schMd === "busy" ? busyKey(schWd) : schK());
}
function schList() {
  if (schMd === "busy") return busyForWd(schWd);
  var T = schK(),
    Q = schQuests(T);
  return schAll(T).filter(function (x) {
    return (
      x.lb ||
      Q.some(function (q) {
        return q.id === x.q;
      })
    );
  });
}
function schOfQ(k, qid) {
  return schAll(k).filter(function (b) {
    return b.q === qid;
  });
}
function schPlaced(k, qid) {
  return schOfQ(k, qid).reduce(function (a, b) {
    return a + (b.t - b.f);
  }, 0);
}
function hhmmOf(m) {
  m = ((m % 1440) + 1440) % 1440;
  return String(Math.floor(m / 60)).padStart(2, "0") + ":" + String(m % 60).padStart(2, "0");
}
function schText(b) {
  return b.j5 ? "5-min start " + hhmmOf(b.f) : hhmmOf(b.f) + "–" + hhmmOf(b.t);
}
function schFloor() {
  return schMd === "busy" || schFut() ? -1e9 : Math.floor(nowMinInDay() / SCH_STEP) * SCH_STEP;
}
function schClash(L, id, f, t) {
  var hit = null;
  L.forEach(function (b) {
    if (b.id !== id && b.f < t && f < b.t) hit = b;
  });
  return hit;
}
function schNext(L, id, f, cap) {
  var n = cap;
  L.forEach(function (b) {
    if (b.id !== id && b.f >= f && b.f < n) n = b.f;
  });
  return n;
}
function schLabel(qid) {
  var q = schQuests(schK()).filter(function (x) {
    return x.id === qid;
  })[0];
  return q ? q.label : "another quest";
}
function schName(b) {
  return b ? b.lb || schLabel(b.q) : "another block";
}
function schNewId() {
  return "b" + Date.now().toString(36) + Math.floor(Math.random() * 1e4).toString(36);
}
function schSave(fn) {
  if (locked()) return false;
  var k = schK(),
    fut = k !== todayKey(),
    e = fut ? (S.days[k] = Object.assign({}, S.days[k] || {})) : entry(),
    L = schNorm(e.sched).map(function (b) {
      return Object.assign({}, b);
    });
  L = fn(L, e) || L;
  L.sort(function (a, b) {
    return a.f - b.f;
  });
  if (L.length) e.sched = L;
  else delete e.sched;
  if (e.schSkip && !e.schSkip.length) delete e.schSkip;
  if (fut) {
    if (!Object.keys(e).length) delete S.days[k];
    dirty[k] = true;
  }
  commit();
  return true;
}
/* Change one block. A repeat occurrence is first detached into a one-off for today (schDet offers "Every week"). */
function schEdit(id, fn, offer) {
  if (schMd === "busy") {
    var cur = busyById(id);
    if (!cur) return id;
    var nx = clone(cur);
    fn(nx, []);
    var bad = null;
    nx.dows.forEach(function (d) {
      var c = schClash(busyForWd(d), id, nx.f, nx.t);
      if (c && !bad) bad = { c: c, d: d };
    });
    if (bad) {
      schMsg = "That clashes with " + bad.c.lb + " on " + WDN[bad.d] + ".";
      return id;
    }
    busySave(function (B) {
      B.forEach(function (x) {
        if (x.id === id) fn(x, B);
      });
    });
    return id;
  }
  var b = schAll(schK()).filter(function (x) {
      return x.id === id;
    })[0],
    out = id;
  if (!b) return id;
  if (schEnded(schK(), b)) {
    schMsg = SCH_ENDED;
    return id;
  }
  schSave(function (L, e) {
    var x = L.filter(function (z) {
      return z.id === id;
    })[0];
    if (!x && b.rep) {
      x = { id: schNewId(), f: b.f, t: b.t, src: b.rep };
      if (b.q) x.q = b.q;
      if (b.lb) x.lb = b.lb;
      if (b.j5) x.j5 = true;
      L.push(x);
      e.schSkip = (e.schSkip || []).concat([b.rep]);
      out = x.id;
      schDet = offer ? { rep: b.rep, id: x.id } : null;
    }
    if (x) {
      var w0 = { f: x.f, t: x.t },
        cut = schCut(),
        live = schK() === todayKey() && w0.f < cut;
      fn(x, L);
      x.ed = Date.now();
      if (live && x.t < Math.min(cut, w0.t)) x.t = Math.min(cut, w0.t);
      if (live && x.f !== w0.f) {
        var st = Object.assign({}, x, { f: w0.f, t: cut });
        delete st.ed;
        L.push(st);
        x.id = schNewId();
        if (schDet && schDet.id === st.id) schDet.id = x.id;
        out = x.id;
      }
    }
  });
  return out;
}
function schRepDays(b) {
  var q = b.q
    ? schQuests(schK()).filter(function (x) {
        return x.id === b.q;
      })[0]
    : null;
  return q && q.days && q.days.length ? q.days : [0, 1, 2, 3, 4, 5, 6];
}
function schRepCount(b, dows, weeks) {
  var T = schK(),
    u = add(T, weeks * 7 - 1),
    ok = schRepDays(b),
    n = 0;
  for (var d = T; d <= u; d = add(d, 1)) {
    var w = parse(d).getDay();
    if (dows.indexOf(w) >= 0 && ok.indexOf(w) >= 0) n++;
  }
  return n;
}
/* First clash a repeat would hit on a day after today (other blocks, repeats or busy times), as {b, k}. */
function repClash(rid, f, t, dows, until, qd) {
  var T = schK();
  for (var d = add(T, 1); d <= until; d = add(d, 1)) {
    var w = parse(d).getDay();
    if (dows.indexOf(w) < 0 || (qd && qd.indexOf(w) < 0)) continue;
    var c = schClash(
      schAll(d).filter(function (x) {
        return !rid || x.rep !== rid;
      }),
      null,
      f,
      t,
    );
    if (c) return { b: c, k: d };
  }
  return null;
}
function repClashMsg(c) {
  return "That clashes with " + schName(c.b) + " on " + DAYF[parse(c.k).getDay()].slice(0, 3) + " " + fmtD(c.k) + ".";
}
/* keep = the week count wasn't touched, so an existing series keeps its end date. Days the quest doesn't run on are dropped. */
function schRepSave(id, dows, weeks, keep) {
  var T = schK(),
    b = schAll(T).filter(function (x) {
      return x.id === id;
    })[0];
  if (!b || locked()) return;
  if (b.q) {
    var okd = schRepDays(b);
    dows = dows.filter(function (d) {
      return okd.indexOf(d) >= 0;
    });
  }
  if (!dows.length) return;
  var c2 = clone(cfg()),
    R = (c2.rep = (c2.rep || []).filter(function (r) {
      return r.until >= todayKey();
    })),
    src = !b.rep && b.src && repById(b.src) ? b.src : null,
    rid = b.rep || src,
    r0 = rid ? repById(rid) : null,
    u = keep && r0 ? r0.until : add(T, weeks * 7 - 1);
  var cl = repClash(rid, b.f, b.t, dows, u, b.q ? schRepDays(b) : null);
  if (cl) {
    schMsg = repClashMsg(cl);
    schRep = null;
    return;
  }
  if (rid) {
    R.forEach(function (r) {
      if (r.id === rid) {
        r.dows = dows.slice();
        r.until = u;
        if (src) {
          r.f = b.f;
          r.t = b.t;
          if (b.j5) r.j5 = true;
          else delete r.j5;
        }
      }
    });
  } else {
    rid = "r" + schNewId();
    var r = { id: rid, f: b.f, t: b.t, dows: dows.slice(), from: T, until: u };
    if (b.q) r.q = b.q;
    if (b.lb) r.lb = b.lb;
    if (b.j5) r.j5 = true;
    R.push(r);
  }
  saveCfg(c2);
  var today = dows.indexOf(parse(T).getDay()) >= 0;
  if (!b.rep && today)
    schSave(function (L, e) {
      if (src && e.schSkip)
        e.schSkip = e.schSkip.filter(function (x) {
          return x !== src;
        });
      return L.filter(function (x) {
        return x.id !== id;
      });
    });
  var keep = null;
  if (b.rep && !today) {
    keep = schNewId();
    schSave(function (L) {
      var x = { id: keep, f: b.f, t: b.t, src: b.rep };
      if (b.q) x.q = b.q;
      if (b.lb) x.lb = b.lb;
      if (b.j5) x.j5 = true;
      L.push(x);
    });
  }
  schSel = keep || (b.rep || today ? "r-" + rid : id);
  schRep = null;
  schDet = null;
  schMsg = "Repeats " + repText(repById(rid)) + ".";
  nfSig = "";
  notifSync();
}
function schRepStop(rid) {
  var T = schK(),
    b = schAll(T).filter(function (x) {
      return x.rep === rid;
    })[0],
    keep = b && T === todayKey() && b.f < nowMinInDay();
  var c2 = clone(cfg());
  c2.rep = (c2.rep || []).filter(function (r) {
    return r.id !== rid;
  });
  if (!c2.rep.length) delete c2.rep;
  saveCfg(c2);
  schSave(function (L, e) {
    if (e.schSkip)
      e.schSkip = e.schSkip.filter(function (x) {
        return x !== rid;
      });
    if (keep) {
      var x = { id: b.id, f: b.f, t: b.t, src: rid };
      if (b.q) x.q = b.q;
      if (b.lb) x.lb = b.lb;
      if (b.j5) x.j5 = true;
      L.push(x);
    }
  });
  schSel = null;
  schDet = null;
  schMsg = "Stopped repeating.";
  nfSig = "";
  notifSync();
}
function schRepEvery() {
  var d = schDet;
  if (!d) return;
  var b = schAll(schK()).filter(function (x) {
      return x.id === d.id;
    })[0],
    r0 = repById(d.rep);
  if (!b || !r0) return;
  var cl = repClash(d.rep, b.f, b.t, r0.dows, r0.until, b.q ? schRepDays(b) : null);
  if (cl) {
    schMsg = repClashMsg(cl);
    return;
  }
  var c2 = clone(cfg());
  (c2.rep || []).forEach(function (r) {
    if (r.id !== d.rep) return;
    r.f = b.f;
    r.t = b.t;
    if (b.j5) r.j5 = true;
    else delete r.j5;
  });
  saveCfg(c2);
  schSave(function (L, e) {
    if (e.schSkip)
      e.schSkip = e.schSkip.filter(function (x) {
        return x !== d.rep;
      });
    return L.filter(function (x) {
      return x.id !== d.id;
    });
  });
  schSel = "r-" + d.rep;
  schDet = null;
  schMsg = "Changed every week.";
  nfSig = "";
  notifSync();
}
function schAdd(qid, m) {
  var T = schK(),
    w = dayWin(T),
    q = schQuests(T).filter(function (x) {
      return x.id === qid;
    })[0];
  if (!q) return;
  var L = schList(),
    left = schLeft(T, q, L),
    len = left >= SCH_STEP ? left : SCH_STEP * 2,
    f = m,
    t = Math.min(w.e, f + len);
  if (f < schFloor()) {
    schMsg = "That time has already passed.";
    return;
  }
  if (t - f < SCH_STEP) {
    schMsg = "That’s too close to bedtime.";
    return;
  }
  var nx = schNext(L, null, f, w.e);
  if (nx < t) t = nx;
  var c = schClash(L, null, f, t);
  if (c || t - f < SCH_STEP) {
    schMsg = "That overlaps " + schName(c) + ". Pick a free time.";
    return;
  }
  var id = schNewId();
  schSave(function (S2) {
    S2.push({ id: id, q: qid, f: f, t: t });
  });
  schMsg = t - f < len ? "Placed " + hm(t - f) + " before the next block. Add another shot for the rest." : "";
  schSel = null;
  schQ = null;
}
function schMove(id, m) {
  var w = schWin(),
    L = schList(),
    b = L.filter(function (x) {
      return x.id === id;
    })[0];
  if (!b) return;
  if (b.busy) {
    schSel = null;
    return;
  }
  var len = b.t - b.f,
    f = m,
    t = Math.min(w.e, f + len);
  if (f < schFloor() && !b.lb) {
    schMsg = "That time has already passed.";
    return;
  }
  if (t - f < SCH_STEP) {
    schMsg = "That’s too close to bedtime.";
    return;
  }
  var c = schClash(L, id, f, t);
  if (c) {
    schMsg = "That overlaps " + schName(c) + ". Pick a free time, or shorten it first.";
    return;
  }
  var nid = schEdit(
    id,
    function (x) {
      x.f = f;
      x.t = t;
    },
    true,
  );
  schMsg = "";
  schSel = b.rep || b.tpl ? nid : null;
}
function schMode(id, j5) {
  var T = schK(),
    w = dayWin(T),
    L = schAll(T),
    b = L.filter(function (x) {
      return x.id === id;
    })[0];
  if (!b || !!b.j5 === j5) return;
  if (schStarted(T, b)) {
    schMsg = "It has already started.";
    return;
  }
  schSel = schEdit(
    id,
    function (x) {
      if (j5) x.j5 = true;
      else delete x.j5;
    },
    true,
  );
}
function schRemove(id) {
  var b = schAll(schK()).filter(function (x) {
    return x.id === id;
  })[0];
  if (schEnded(schK(), b)) {
    schMsg = SCH_ENDED;
    return;
  }
  if (schStarted(schK(), b) && schCut() > b.f) {
    schEdit(id, function (x) {
      x.t = schCut();
    });
    schSel = null;
    schDet = null;
    schMsg = "Removed the rest. The part that has passed stays.";
    return;
  }
  schSave(function (S2, e) {
    if (b && b.rep) e.schSkip = (e.schSkip || []).concat([b.rep]);
    return S2.filter(function (x) {
      return x.id !== id;
    });
  });
  schSel = null;
  schDet = null;
  if (b && b.rep) schMsg = "Skipped " + schTd() + ". It still repeats.";
}
function schSplit(id) {
  var T = schK(),
    L = schAll(T),
    b = L.filter(function (x) {
      return x.id === id;
    })[0];
  if (!b) return;
  var len = b.t - b.f;
  if (len < SCH_STEP * 2) {
    schMsg = "Too short to split.";
    return;
  }
  var half = Math.floor(len / 2 / SCH_STEP) * SCH_STEP;
  if (schStarted(T, b)) half = Math.max(half, schCut() - b.f);
  if (b.t - b.f - half < SCH_STEP) {
    schMsg = "Too little left to split.";
    return;
  }
  var nid = schNewId();
  schEdit(id, function (x, S2) {
    x.t = x.f + half;
    S2.push({ id: nid, q: b.q, f: b.f + half, t: b.t });
  });
  schDet = null;
  schSel = nid;
  schMsg = "Split in two. Tap a free time to move the selected half.";
}
/* Full-screen page (#schPage): header, quest chips, the timeline as the only scroller, and a bottom bar that is
     either help + Auto-plan, a quest picker for a tapped free time (schPick), or controls for a selected block (schSel). */
var schPick = null,
  schPg = null,
  schAdj = false;
function dayOvSave(w, b) {
  var er = winErr(w, b, true);
  if (er) {
    setSync(er);
    return false;
  }
  var c2 = clone(cfg());
  c2.dayOv = { date: todayKey(), wake: w, bed: b };
  saveCfg(c2);
  nfSig = "";
  qSig = "";
  render();
  setSync("Today: " + w + " to " + b);
  return true;
}
function dayOvClear() {
  var c2 = clone(cfg());
  delete c2.dayOv;
  saveCfg(c2);
  nfSig = "";
  qSig = "";
  render();
  setSync("Today uses your usual hours");
}
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
function schGeo() {
  var w = schWin(),
    s0 = Math.floor(w.s / SCH_STEP) * SCH_STEP,
    e0 = Math.ceil(w.e / SCH_STEP) * SCH_STEP;
  return {
    w: w,
    s0: s0,
    e0: e0,
    px: function (m) {
      return ((m - s0) / SCH_STEP) * SCH_ROW;
    },
  };
}
function schAt(clientY) {
  var tl = schPg.querySelector("#schTl"),
    g = schGeo(),
    r = tl.getBoundingClientRect();
  return Math.min(g.e0 - SCH_STEP, Math.max(g.s0, g.s0 + Math.floor((clientY - r.top) / SCH_ROW) * SCH_STEP));
}
/* What's left to place for a quest today: its daily share minus minutes already logged and blocks still ahead. */
function schAhead(L, qid, from) {
  return L.filter(function (b) {
    return b.q === qid && b.t > from;
  }).reduce(function (a, b) {
    return a + b.t - Math.max(b.f, from);
  }, 0);
}
function schLeft(T, q, L) {
  var td = T === todayKey(),
    from = td ? Math.floor(nowMinInDay() / SCH_STEP) * SCH_STEP : -1e9;
  var run =
    td && S.timer && S.timer.id === q.id && S.timer.day === T ? Math.floor((Date.now() - S.timer.start) / 60000) : 0;
  return (
    Math.min(schLen(q, T), limOf(q) || 1e9) - ((S.days[T] || {})[q.id] | 0) - run - schAhead(L || schAll(T), q.id, from)
  );
}
function schFree(L, from, to, pad, minLen) {
  var gaps = [],
    c = from;
  pad = pad || 0;
  L.slice()
    .sort(function (a, b) {
      return a.f - b.f;
    })
    .forEach(function (b) {
      var bf = b.f - pad,
        bt = b.t + pad;
      if (bt <= c) return;
      if (bf > c) gaps.push([c, Math.min(bf, to)]);
      c = Math.max(c, bt);
    });
  if (c < to) gaps.push([c, to]);
  return gaps.filter(function (g) {
    return g[1] - g[0] >= (minLen || SCH_STEP);
  });
}
function schAuto() {
  var T = schK(),
    w = dayWin(T),
    Q = schQuests(T),
    e = S.days[T] || {},
    from = Math.max(
      T === todayKey() ? Math.ceil(nowMinInDay() / SCH_STEP) * SCH_STEP : -1e9,
      Math.floor(w.s / SCH_STEP) * SCH_STEP,
    ),
    n = 0; /* each new shot keeps a 15-minute break from its neighbours and is at least 30m (or whatever is left) */
  var RP = schAll(T).filter(function (b) {
      return b.rep || b.busy;
    }),
    vis = function (b) {
      return (
        !b.q ||
        Q.some(function (q) {
          return q.id === b.q;
        })
      );
    };
  schSave(function (L0) {
    var L = L0.filter(vis),
      hid = L0.filter(function (b) {
        return !vis(b);
      });
    Q.forEach(function (q) {
      if (metQ(q, e)) return;
      var left = schLeft(T, q, L.concat(RP));
      while (left >= SCH_STEP) {
        var g = schFree(L.concat(RP), from, w.e, SCH_STEP, Math.min(left, SCH_STEP * 2))[0];
        if (!g) break;
        var len = Math.min(left, g[1] - g[0]);
        len = Math.max(SCH_STEP, Math.floor(len / 5) * 5);
        L.push({ id: schNewId(), q: q.id, f: g[0], t: g[0] + len });
        n++;
        left -= len;
      }
    });
    return L.concat(hid);
  });
  schMsg = n
    ? "Planned " + n + " shot" + (n === 1 ? "" : "s") + " with 15-minute breaks. Drag or tap to adjust."
    : "Nothing left to plan, or no free time left " + schTd() + ".";
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
/* Edge auto-scroll for drags: while the finger/mouse sits within SCH_EDGE px of the timeline's top or bottom (or past
     it, e.g. over the footer), the timeline keeps scrolling on its own, faster the deeper you go. tick(y) is re-run every
     frame with the last pointer position, so the dragged block stays under the finger while the day scrolls. */
var SCH_EDGE = 64;
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
/* Start/resume a block under way: now inside it, no timer on its quest, time left (what's left of the block, never more
     than the time until its end). "Resume" once some minutes were timed inside it, else "Start". Once its end has passed (or you pull the end in to finish early) there's nothing to resume.
     The schedule footer (with or without the block selected) and the quest row offer Resume whenever that holds. The persistent
     notification (id 905, ongoing; strict) also needs today's share/minimum not done yet and the block not re-planned since you
     last worked in it, so it never nags after you've deliberately finished. */
/* Minutes credited to a block: every timed stretch of its quest (sessions, plus a running timer) that overlaps it gives
     the block the overlap; the part outside all of that quest's blocks goes to the block it overlaps most. So starting late
     or running over still counts for the block, and nothing is counted twice. Stretches that touch no block credit none. */
function schSess(T, qid) {
  var L = ((S.days[T] || {}).sess || [])
    .filter(function (z) {
      return z.id === qid;
    })
    .map(function (z) {
      return { s: z.s, e: z.e };
    });
  if (S.timer && S.timer.id === qid && S.timer.day === T) L.push({ s: S.timer.start, e: Date.now() });
  return L;
}
function schDoneIn(T, b) {
  if (!b || !b.q) return 0;
  var Bs = schOfQ(T, b.q),
    ix = -1,
    m = 0;
  Bs.forEach(function (x, i) {
    if (x.id === b.id) ix = i;
  });
  if (ix < 0) return 0;
  schSess(T, b.q).forEach(function (z) {
    var ov = Bs.map(function (x) {
        return Math.max(0, Math.min(z.e, atMin(T, x.t)) - Math.max(z.s, atMin(T, x.f)));
      }),
      tot = 0,
      top = 0;
    ov.forEach(function (v, i) {
      tot += v;
      if (v > ov[top]) top = i;
    });
    if (!ov[ix]) return;
    m += ov[ix];
    if (top === ix) m += Math.max(0, z.e - z.s - tot);
  });
  return Math.round(m / 60000);
}
/* After a block ends short: what's missing from it, but never more than the quest still needs today (share/minimum minus
     time logged and blocks still ahead). Blocks already re-planned for it (rf = the short block's id) count against it, so
     removing one brings the shortfall back. Re-plan places that in the next free time. */
function schShort(T, b) {
  if (T !== todayKey() || !b || !b.q || b.j5 || nowMinInDay() < b.t) return 0;
  var q = schQuests(T).filter(function (x) {
    return x.id === b.q;
  })[0];
  if (!q) return 0;
  var rp = schOfQ(T, b.q).reduce(function (a, x) {
      return a + (x.rf === b.id ? x.t - x.f : 0);
    }, 0),
    s = Math.min(b.t - b.f - schDoneIn(T, b) - rp, schLeft(T, q));
  return s >= 5 ? s : 0;
}
function schReplan(id) {
  var T = todayKey(),
    b = schAll(T).filter(function (x) {
      return x.id === id;
    })[0],
    amt = schShort(T, b);
  if (!amt) return;
  var q = schQuests(T).filter(function (x) {
      return x.id === b.q;
    })[0],
    w = dayWin(T),
    from = Math.max(Math.ceil(nowMinInDay() / SCH_STEP) * SCH_STEP, Math.floor(w.s / SCH_STEP) * SCH_STEP),
    put = [];
  schSave(function (L) {
    var all = schAll(T)
        .filter(function (x) {
          return x.busy || x.rep;
        })
        .concat(
          L.filter(function (x) {
            return !x.rep;
          }),
        ),
      left = Math.max(amt, SCH_STEP);
    while (left >= SCH_STEP) {
      var g =
        schFree(all, from, w.e, SCH_STEP, Math.min(left, SCH_STEP * 2))[0] || schFree(all, from, w.e, 0, SCH_STEP)[0];
      if (!g) break;
      var len = Math.max(SCH_STEP, Math.floor(Math.min(left, g[1] - g[0]) / 5) * 5),
        nb = { id: schNewId(), q: q.id, f: g[0], t: g[0] + len, rf: b.id };
      L.push(nb);
      all.push(nb);
      put.push(nb);
      left -= len;
    }
  });
  schSel = null;
  schMsg = put.length
    ? "Re-planned " +
      hm(amt) +
      ": " +
      put
        .map(function (x) {
          return hhmmOf(x.f) + "–" + hhmmOf(x.t);
        })
        .join(", ") +
      "."
    : "No free time left today to re-plan it.";
}
function schDayDone(q, e, k) {
  return q.roll ? ((e || {})[q.id] | 0) >= schLen(q, k) : metQ(q, e);
}
function schLeftIn(T, b, strict) {
  var nw = nowMinInDay();
  if (T !== todayKey() || !b || !b.q || b.lb || b.j5 || nw < b.f || nw >= b.t || (S.timer && S.timer.id === b.q))
    return 0;
  var q = schQuests(T).filter(function (x) {
    return x.id === b.q;
  })[0];
  if (!q) return 0;
  var d = schDoneIn(T, b);
  if (strict && (d < 1 || ((S.days[T] || {})[q.id] | 0) >= timerMin(q) || (b.ed && schLastIn(T, b) <= b.ed))) return 0;
  var l = Math.min(b.t - b.f - d, b.t - nw);
  return l >= 1 ? l : 0;
}
function schResWord(T, b) {
  return schDoneIn(T, b) >= 1 ? "Resume" : "Start";
}
/* End of the latest timed stretch inside the block. A block edited after that (shortened, moved, delayed) means you've
     re-planned it yourself, so there's nothing to resume until you work in it again. */
function schLastIn(T, b) {
  var s0 = atMin(T, b.f),
    s1 = atMin(T, b.t),
    m = 0;
  ((S.days[T] || {}).sess || []).forEach(function (z) {
    if (z.id === b.q && z.e > s0 && z.s < s1 && z.e > m) m = z.e;
  });
  return m;
}
function schResumable(T, strict) {
  var best = null;
  schAll(T).forEach(function (b) {
    var l = schLeftIn(T, b, strict);
    if (l && (!best || b.f > best.b.f)) best = { b: b, left: l };
  });
  return best;
}
var resKey = "?",
  resT = 0;
function resumeSync(ln) {
  var T = todayKey(),
    n0 = nf(),
    r = locked() || !n0.on || !n0.sched ? null : schResumable(T, true),
    k = r ? T + r.b.id + "|" + r.left : "";
  clearTimeout(resT);
  if (r) resT = setTimeout(notifSync, Math.max(1000, atMin(T, r.b.t) - Date.now() + 1000));
  if (k === resKey) return;
  var was = resKey;
  resKey = k;
  var p = Promise.resolve();
  if (was)
    p = p
      .then(function () {
        return ln.cancel({ notifications: [{ id: 905 }] });
      })
      .then(function () {
        return ln.removeDeliveredNotifications
          ? ln.removeDeliveredNotifications({ notifications: [{ id: 905 }] })
          : null;
      });
  if (r) {
    var q = schQuests(T).filter(function (x) {
      return x.id === r.b.q;
    })[0];
    p = p
      .then(function () {
        return ensureChannels();
      })
      .then(function () {
        return ln.schedule({
          notifications: [
            {
              id: 905,
              title: "Resume " + (q ? q.label : "your block"),
              body: hm(r.left) + " left of your " + schText(r.b) + " block. Tap to pick it back up.",
              channelId: "pc_alerts2",
              ongoing: true,
              autoCancel: false,
              extra: { sched: r.b.q, resume: 1 },
              schedule: { at: new Date(Date.now() + 1500), allowWhileIdle: true },
            },
          ],
        });
      });
  }
  p.catch(function (err) {
    console.warn("resume notif", err);
  });
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
function schNotifs(T, e, push) {
  var Q = schQuests(T);
  schAll(T).forEach(function (bl, i) {
    var q = Q.filter(function (x) {
      return x.id === bl.q;
    })[0];
    if (!q || schDayDone(q, e, T) || (S.timer && S.timer.id === q.id)) return;
    push(
      3500 + i,
      (bl.j5 ? "5 minutes on " : "Time for ") + q.label,
      bl.j5
        ? "Tap to start a 5-minute timer. Planned until " + hhmmOf(bl.t) + "."
        : hhmmOf(bl.f) + "–" + hhmmOf(bl.t) + ". Tap to start the timer.",
      atMin(T, bl.f),
      { sched: q.id, j5: !!bl.j5 },
    );
  });
  /* Blocks on the next SCH_AHEAD days (planned ahead or repeats) are scheduled too (3700 + day×20 + n), so they remind even if the app isn't opened that day. */
  for (var dd = 1; dd <= SCH_AHEAD; dd++) {
    var k = add(T, dd),
      Qk = schQuests(k),
      n = 0;
    schAll(k).forEach(function (bl) {
      if (!bl.q || n >= 20) return;
      var q = Qk.filter(function (x) {
        return x.id === bl.q;
      })[0];
      if (!q) return;
      push(
        3700 + dd * 20 + n++,
        (bl.j5 ? "5 minutes on " : "Time for ") + q.label,
        bl.j5
          ? "Tap to start a 5-minute timer. Planned until " + hhmmOf(bl.t) + "."
          : hhmmOf(bl.f) + "–" + hhmmOf(bl.t) + ". Tap to start the timer.",
        atMin(k, bl.f),
        { sched: q.id, j5: !!bl.j5 },
      );
    });
  }
}
/* A reminder tap only starts a timer if that quest still has a block today (or, for 905, is still resumable). */
function schTap(x) {
  var T = todayKey(),
    q = schQuests(T).filter(function (z) {
      return z.id === x.sched;
    })[0];
  if (!q || locked() || (S.timer && S.timer.id === q.id)) return;
  var r = x.resume ? schResumable(T) : null;
  if (x.resume ? !r || r.b.q !== q.id : !schOfQ(T, q.id).length) {
    nfGo();
    setSync("That block has changed. Nothing to start.");
    return;
  }
  go("today");
  if (x.j5) start5(q);
  else toggleTimer(q);
}
