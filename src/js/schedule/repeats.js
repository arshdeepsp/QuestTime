/* ---- weekly repeats of quest blocks (cfg.rep) ---- */
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
