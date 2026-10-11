/* ---- schedule data: blocks on a day, placing, editing, auto-plan ---- */
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
