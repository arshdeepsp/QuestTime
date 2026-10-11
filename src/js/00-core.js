var START_KEY, START_AT;
(function () {
  var st = null;
  try {
    st = (JSON.parse(localStorage.getItem(storeKey()) || "{}").cfg || {}).start;
  } catch (e) {}
  if (!st) {
    var n = new Date();
    st = new Date(n.getFullYear(), n.getMonth(), n.getDate()).toISOString();
  }
  setStart(st);
})();
function setStart(st) {
  START_AT = new Date(st);
  START_KEY =
    START_AT.getFullYear() +
    "-" +
    String(START_AT.getMonth() + 1).padStart(2, "0") +
    "-" +
    String(START_AT.getDate()).padStart(2, "0");
}
var D = JSON.parse(document.getElementById("achData").textContent);
var LEGACY = [];
var MIN = 15,
  STEP = 10,
  MAXM = 960;
/* Answered the call: start a timer within CALL_MIN minutes of a reminder you tapped. e.calls counts them per day. */
var CALL_MIN = 2,
  CALL_XP = 10,
  CALL_CAP = 5;
var RANKS = [
  [0, "Apprentice", "sprout"],
  [7, "Journeyman", "sprout"],
  [21, "Session Player", "flame"],
  [42, "Bandleader", "metronome"],
  [90, "Virtuoso", "dumbbell"],
  [180, "Master", "trophy"],
  [365, "Maestro", "star"],
];
var S = { days: {}, refl: {}, cfg: null },
  dl = null,
  dlChecked = false,
  view = "today",
  dirty = {},
  timer = null;
/* Data schema. Bump SCHEMA and add a step to migrate() whenever the stored shape changes. */
var SCHEMA = 18,
  RERATE_MIN = 60,
  MID_FRAC = 1 / 3;
function migrate(c) {
  c = c || {};
  var v = c.schema || 2;
  if (v < 3) {
    if (c.cfg) {
      delete c.cfg.bank;
      delete c.cfg.commitCheck;
    }
    v = 3;
  }
  if (v < 4) {
    Object.keys(c.days || {}).forEach(function (k) {
      var d = c.days[k],
        s = d && d.sched;
      if (s && !Array.isArray(s) && typeof s === "object")
        d.sched = Object.keys(s)
          .sort()
          .map(function (id) {
            return Object.assign({ id: "b-" + id, q: id }, s[id]);
          });
    });
    v = 4;
  }
  if (v < 5) {
    if (c.cfg) {
      var de = c.cfg.dayEnd | 0;
      if (de > 0) {
        var dd = Object.assign({ wake: "07:00", bed: "23:00" }, c.cfg.day || {});
        if (lockHour(dd.bed, dd.wake) < de) dd.bed = String(de).padStart(2, "0") + ":00";
        c.cfg.day = dd;
      }
      delete c.cfg.dayEnd;
    }
    v = 5;
  }
  if (v < 6) {
    Object.keys(c.days || {}).forEach(function (k) {
      var d = c.days[k];
      if (d) {
        delete d.ended;
        delete d.endedAt;
      }
    });
    v = 6;
  }
  if (v < 7) {
    var SJ7 = (c.cfg && c.cfg.subjects) || [];
    ((c.cfg && c.cfg.quests) || []).forEach(function (q) {
      var L = q.subjs && q.subjs.length ? q.subjs : q.subj ? [q.subj] : [];
      if (!L.length || q.topics) {
        delete q.topic;
        return;
      }
      var T = [];
      if (q.topic) T = [q.topic];
      else
        L.forEach(function (sid) {
          var sj = SJ7.filter(function (x) {
            return x.id === sid;
          })[0];
          ((sj && sj.topics) || []).forEach(function (t) {
            T.push(t.id);
          });
        });
      if (T.length) q.topics = T;
      delete q.topic;
    });
    v = 7;
  }
  if (v < 8) v = 8;
  if (v < 9) {
    if (c.cfg) delete c.cfg.customAch;
    v = 9;
  }
  if (v < 10) {
    var cf = c.cfg;
    if (cf) {
      var B = cf.busy || [];
      (cf.rep || []).forEach(function (r) {
        if (r.lb)
          B.push({ id: "z" + r.id, lb: r.lb, f: r.f, t: r.t, dows: r.dows.slice(), from: r.from, until: r.until });
      });
      if (cf.rep) {
        cf.rep = cf.rep.filter(function (r) {
          return !r.lb;
        });
        if (!cf.rep.length) delete cf.rep;
      }
      Object.keys(c.days || {}).forEach(function (k) {
        var d = c.days[k];
        if (!d || !Array.isArray(d.sched)) return;
        var keep = d.sched.filter(function (b) {
          if (!b.lb) return true;
          B.push({ id: "z" + b.id, lb: b.lb, f: b.f, t: b.t, dows: [parse(k).getDay()], from: k, until: k });
          return false;
        });
        if (keep.length) d.sched = keep;
        else delete d.sched;
      });
      if (B.length) cf.busy = B;
    }
    v = 10;
  }
  if (v < 11) v = 11;
  if (v < 12) v = 12;
  if (v < 13) v = 13;
  if (v < 14) {
    if (c.schema && c.cfg && !c.cfg.ckFrom) {
      c.cfg.ckFrom = key(new Date());
      Object.keys(c.days || {}).forEach(function (d) {
        var x = c.days[d];
        if (x && x.ck && d < c.cfg.ckFrom) x.ck = [];
      });
    }
    v = 14;
  }
  if (v < 15) v = 15;
  /* 16: Strict mode, per-quest change locks and the queued changes they scheduled, the easing budget log, the cap lock date and the commitment-break counter are gone. */
  if (v < 16) {
    if (c.cfg) {
      delete c.cfg.strict;
      delete c.cfg.easeLog;
      delete c.cfg.capSet;
      (c.cfg.quests || []).forEach(function (q) {
        delete q.lock;
        delete q.lockFrom;
        delete q.pending;
      });
    }
    Object.keys(c.days || {}).forEach(function (k) {
      var x = c.days[k];
      if (x && x.brk != null) delete x.brk;
    });
    v = 16;
  }
  /* 17: look-and-feel choices that lived in this device's localStorage move into cfg.ui, so they sync with the account. */
  if (v < 17) {
    if (c.cfg) {
      var ui = Object.assign({}, c.cfg.ui || {});
      try {
        var g = function (k) {
          return localStorage.getItem(k);
        };
        if (g("pc-sfx") === "off") ui.sfx = false;
        if (g("pc-focusview") === "1") ui.focus = true;
        if (g("pc-stats") === "1") ui.stats = true;
        if (g("pc-hudopen") === "1") ui.hud = true;
        if (g("pc-doneopen") === "1") ui.done = true;
        if (g("pc-offopen") === "1") ui.off = true;
        if (g("pc-ignopen") === "1") ui.ign = true;
        if (g("pc-groveinfo") === "0") ui.groveInfo = false;
        var sf = JSON.parse(g("pc-sjfold") || "[]");
        if (Array.isArray(sf) && sf.length) ui.sjfold = sf;
      } catch (x) {}
      if (Object.keys(ui).length) c.cfg.ui = ui;
    }
    v = 17;
  }
  /* 18: leftovers of retired features that later code still wrote or kept: cfg.bank (work-style presets wrote false),
     cfg.capSet (the daily limit setting stamped it after 16 dropped it) and day.top (Top 3). */
  if (v < 18) {
    if (c.cfg) {
      delete c.cfg.bank;
      delete c.cfg.capSet;
    }
    Object.keys(c.days || {}).forEach(function (k) {
      var x = c.days[k];
      if (x && "top" in x) delete x.top;
    });
    v = 18;
  }
  c.schema = v;
  return c;
}
/* Look-and-feel choices (cfg.ui, synced with the account): sound on/off (sfx), Minimal view (focus), stats panel (stats),
     HUD details (hud), Done/Off today/Ignored groups (done/off/ign), folded subjects (sjfold), grove info (groveInfo). */
function uiGet(k, def) {
  var u = (S.cfg && S.cfg.ui) || {};
  return k in u ? u[k] : def;
}
function uiSet(k, v) {
  if (!S.cfg) return;
  var c = clone(S.cfg);
  c.ui = Object.assign({}, c.ui || {});
  c.ui[k] = v;
  saveCfg(c);
}
/* If saved data can't be read, or comes from a newer app version, a copy goes to pc-cache-rescue and nothing is saved
     over it (cacheBlock) until a backup is imported. */
var cacheBlock = "";
/* ---- the store ----
     State lives in S; persistence goes through `store`, which thinks in documents so a sync backend can be plugged in
     without touching the app: `cfg` (one doc, carries `updated`), `refl` (one doc, a map by day), `days/<date>` (one doc
     per day), and `session` (device-local: timer, sprint, sprint defaults, the answered call — never synced).
     cache() = store.flush(): it works out which docs changed since the last flush by identity (the app replaces S.cfg,
     S.refl and S.days[k] rather than mutating them in place), stamps S.meta.u[doc] with the time (and S.meta.del[doc] for
     days removed, so a sync can delete them), then hands the whole state plus the changed list to the adapter.
     The only adapter today writes the whole state to localStorage["pc-cache-v1"] as before; a Firestore adapter would
     write the changed docs (users/<uid>/data/cfg, users/<uid>/data/refl, users/<uid>/days/<date>) and merge remote docs by their
     `u` stamp — the Firestore SDK's own offline cache covers the local side, so no IndexedDB code is needed here.
     store.docs() returns the state in that document shape. Loading, schema migration and the rescue copy
     (pc-cache-rescue + cacheBlock when the data can't be read or is from a newer version) are unchanged. */
/* Data is linked to accounts: each account signed in on this device has its own copy (pc-cache-u-<uid>), and data
     made without an account lives in pc-cache-v1 (the guest copy). Only the copy of whoever is signed in is loaded.
     Switching (sign in, sign out, account deleted) writes nothing more (storeHold) and reloads the app. One-time
     upgrade: a device that was signed in before copies were per account hands its data to that account. */
function storeKey() {
  var a = null,
    up = false;
  try {
    a = JSON.parse(localStorage.getItem("pc-account") || "null");
    if (!localStorage.getItem("pc-slots")) {
      localStorage.setItem("pc-slots", "1");
      up = true;
    }
  } catch (x) {}
  if (!a || !a.uid) return "pc-cache-v1";
  var k = "pc-cache-u-" + a.uid;
  try {
    if (up && localStorage.getItem(k) === null && localStorage.getItem("pc-cache-v1") !== null) {
      localStorage.setItem(k, localStorage.getItem("pc-cache-v1"));
      localStorage.removeItem("pc-cache-v1");
    }
  } catch (x) {}
  return k;
}
var storeHold = false;
var localAdapter = {
  name: "local",
  load: function () {
    return localStorage.getItem(storeKey());
  },
  save: function (state) {
    if (storeHold) return;
    localStorage.setItem(storeKey(), JSON.stringify(state));
  },
};
var store = (function () {
  var ad = localAdapter,
    last = { cfg: null, refl: null, days: {} };
  function changed() {
    var ch = [];
    if (S.cfg !== last.cfg) ch.push("cfg");
    if (S.refl !== last.refl) ch.push("refl");
    Object.keys(S.days).forEach(function (k) {
      if (S.days[k] !== last.days[k]) ch.push("days/" + k);
    });
    Object.keys(last.days).forEach(function (k) {
      if (!(k in S.days)) ch.push("-days/" + k);
    });
    return ch;
  }
  function remember() {
    last.cfg = S.cfg;
    last.refl = S.refl;
    last.days = {};
    Object.keys(S.days).forEach(function (k) {
      last.days[k] = S.days[k];
    });
  }
  return {
    use: function (a) {
      ad = a;
    },
    adapter: function () {
      return ad;
    },
    markClean: function (id, obj) {
      if (id === "cfg") last.cfg = obj;
      else if (id === "refl") last.refl = obj || S.refl;
      else if (id.indexOf("days/") === 0) {
        var k = id.slice(5);
        if (obj) last.days[k] = obj;
        else delete last.days[k];
      }
    },
    load: function () {
      var raw = null;
      try {
        raw = ad.load();
        var c0 = typeof raw === "string" ? JSON.parse(raw) : raw || {};
        if ((c0.schema | 0) > SCHEMA) throw "newer";
        var c = migrate(c0);
        S.days = c.days || {};
        S.refl = c.refl || {};
        S.cfg = c.cfg || null;
        S.meta = c.meta || { u: {} };
        if (!S.meta.u) S.meta.u = {};
        S.timer = c.timer || null;
        S.sprint = c.sprint || null;
        if (c.spLen) S.spLen = c.spLen;
        if (c.spRounds != null) S.spRounds = c.spRounds;
        if (c.spLongOn === false) S.spLongOn = false;
        remember();
      } catch (e) {
        S.days = {};
        S.refl = {};
        S.cfg = null;
        S.meta = { u: {} };
        S.timer = null;
        S.sprint = null;
        if (raw) {
          cacheBlock = e === "newer" ? "newer" : "error";
          try {
            if (!localStorage.getItem("pc-cache-rescue"))
              localStorage.setItem("pc-cache-rescue", typeof raw === "string" ? raw : JSON.stringify(raw));
          } catch (x) {}
        }
      }
    },
    changed: changed,
    flush: function () {
      if (cacheBlock) return [];
      var ch = changed(),
        now = Date.now();
      S.meta = S.meta || { u: {} };
      ch.forEach(function (d) {
        if (d.charAt(0) === "-") {
          delete S.meta.u[d.slice(1)];
          (S.meta.del = S.meta.del || {})[d.slice(1)] = now;
        } else {
          S.meta.u[d] = now;
          if (S.meta.del) delete S.meta.del[d];
        }
      });
      S.schema = SCHEMA;
      remember();
      try {
        ad.save(S, ch.concat(["session"]));
      } catch (e) {}
      return ch;
    },
    docs: function () {
      var d = {
        cfg: S.cfg,
        refl: { map: S.refl },
        days: S.days,
        session: {
          timer: S.timer,
          sprint: S.sprint,
          spLen: S.spLen,
          spRounds: S.spRounds,
          spLongOn: S.spLongOn,
          call: S.call,
        },
        meta: S.meta,
      };
      return d;
    },
  };
})();
/* The signed-in account on this device (pc-account), readable before the sync code (54) has run. */
function cloudAccount() {
  try {
    return JSON.parse(localStorage.getItem("pc-account") || "null");
  } catch (x) {
    return null;
  }
}
store.load();
function cache() {
  store.flush();
}
function flush() {
  cache();
}
function key(d) {
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
}
function parse(k) {
  var p = k.split("-");
  return new Date(+p[0], p[1] - 1, +p[2]);
}
function add(k, n) {
  var d = parse(k);
  d.setDate(d.getDate() + n);
  return key(d);
}
/* The day rolls over (locks) at midnight, or at your usual bedtime when that is after midnight (rounded up to the hour, 5 am at most). */
function lockHour(bed, wake) {
  var b = mins(bed || "23:00"),
    w = mins(wake || "07:00");
  return b >= w ? 0 : Math.min(5, Math.ceil(b / 60));
}
function dayEnd() {
  var d = (S.cfg && S.cfg.day) || {};
  return lockHour(d.bed, d.wake);
}
function todayKey() {
  var d = new Date();
  d.setHours(d.getHours() - dayEnd());
  return key(d);
}
function mins(t) {
  var p = String(t).split(":");
  return +p[0] * 60 + +p[1];
}
function clone(x) {
  return JSON.parse(JSON.stringify(x));
}
function cfg() {
  if (!S.cfg) {
    S.cfg = { quests: [], rules: null, start: START_AT.toISOString(), updated: "" };
    cache();
  }
  if (!S.cfg.start) S.cfg.start = START_AT.toISOString();
  return S.cfg;
}
/* Modes. Challenge (default): streak with grace and freezes, period-total checkpoints, badges, grove, easing changes from tomorrow. Casual (a cfg.noStreak range, so history keeps each day's mode): XP, levels and rank still earned and shown; the streak holds (days are neutral), nothing is judged, badges and grove are hidden, and changes apply at once. modeOn(k) names a day's mode; rewardsOff() = today is Casual (kept as the gate name everywhere). Settings are never cleared on a switch — only their application is gated. */
function noStreakOn(k) {
  return ((S.cfg && S.cfg.noStreak) || []).some(function (r) {
    return k >= r.from && (!r.to || k < r.to);
  });
}
function rewardsOff() {
  return noStreakOn(todayKey());
}
/* Ignore list (cfg.ignore = quest ids), Casual only: on a Casual day an ignored quest is optional (o.ign) and kept
     out of the main list, the schedule, Just 5, Pick and reminders. Cleared when streaks come back on. */
function ignoredOn(id, k) {
  return noStreakOn(k) && ((S.cfg && S.cfg.ignore) || []).indexOf(id) >= 0;
}
function noStreakIn(a, b) {
  return ((S.cfg && S.cfg.noStreak) || []).some(function (r) {
    return r.from <= b && (!r.to || r.to > a);
  });
}
function isPaused(q, k) {
  return !!q.pausedUntil && k < q.pausedUntil && (!q.pausedFrom || k >= q.pausedFrom);
}
function slim(q) {
  var o = { id: q.id, type: q.type, label: q.label };
  [
    "min",
    "max",
    "from",
    "to",
    "unit",
    "note",
    "days",
    "opt",
    "ul",
    "step",
    "scale",
    "total",
    "due",
    "roll",
    "per",
    "lim",
    "dl",
    "subj",
    "subjs",
    "topics",
    "fin",
    "addedOn",
    "addedMin",
    "startOn",
  ].forEach(function (f) {
    if (q[f] != null && q[f] !== "") o[f] = q[f];
  });
  return o;
}
function scheduled(q, k) {
  return !q.days || !q.days.length || q.days.indexOf(parse(k).getDay()) >= 0;
}
function activeDefs(k) {
  var vc = isVac(k),
    c0 = cfg(),
    LD = c0.lockDay && c0.lockDay.date === k ? c0.lockDay.defs : null,
    src = c0.quests.map(function (q) {
      return LD && LD[q.id] ? LD[q.id] : q;
    });
  if (LD)
    Object.keys(LD).forEach(function (id) {
      if (
        !c0.quests.some(function (q) {
          return q.id === id;
        })
      )
        src.push(LD[id]);
    });
  return src
    .filter(function (q) {
      if (q.completed && q.completed.on < k) return false;
      if (q.startOn && k < q.startOn && q.type !== "todo") return false;
      if (q.type === "todo") return !q.doneOn || q.doneOn === k;
      if (q.dl && (k > q.dl.due || k < q.dl.from)) return false;
      return !isPaused(q, k) && (scheduled(q, k) || (q.type === "time" && q.roll));
    })
    .map(function (q) {
      var o = slim(q);
      if (q.type === "time" && q.roll && q.opt) o.uopt = true;
      if (q.type === "time" && q.roll && !scheduled(q, k)) {
        o.opt = true;
        o.off = true;
      }
      if (q.dl) {
        o.min = dlMin(q, k);
        if (!o.min) o.opt = true;
      }
      if (vc) o.opt = true;
      if (lateStart(q, k)) o.opt = true;
      if (ignoredOn(q.id, k)) {
        o.opt = true;
        o.ign = true;
      }
      return o;
    });
}
function localKey(d) {
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
}
function nowMinInDay() {
  var d = new Date(),
    T = todayKey(),
    m = d.getHours() * 60 + d.getMinutes();
  if (localKey(d) !== T) m += 1440;
  return m;
}
/* Your day: waking hours used app-wide (schedule, midday point, reminders). cfg.day is the usual window; cfg.dayOv overrides one date. */
var DAY_DEF = { wake: "07:00", bed: "23:00" };
function dayBound() {
  return 1440 + dayEnd() * 60;
}
function winSpan(w, b) {
  var s = mins(w),
    e = mins(b);
  if (e <= s) e += 1440;
  return { s: s, e: e };
}
function winErr(w, b, today) {
  if (!/^\d{2}:\d{2}$/.test(w || "") || !/^\d{2}:\d{2}$/.test(b || "")) return "Pick a wake-up time and a bedtime.";
  var x = winSpan(w, b),
    de = today ? dayEnd() : lockHour(b, w);
  if (x.e - x.s < 60) return "Leave at least an hour between wake-up and bedtime.";
  if (!today && x.e > 1440 + 300) return "Bedtime can be 5:00 am at the latest.";
  if (x.s < de * 60) return "Wake-up has to be after bedtime.";
  if (today && x.e > dayBound())
    return (
      "Today\u2019s bedtime can\u2019t be later than your usual one after midnight (" +
      (de ? de + ":00 am" : "midnight") +
      "). Change your usual bedtime first."
    );
  return "";
}
function dayWin(k) {
  var c = cfg(),
    o = c.dayOv && c.dayOv.date === k ? c.dayOv : null,
    d = Object.assign({}, DAY_DEF, c.day || {});
  if (o && !winErr(o.wake, o.bed, true)) d = { wake: o.wake, bed: o.bed };
  if (winErr(d.wake, d.bed)) {
    var x0 = winSpan(d.wake, d.bed);
    if (x0.e > dayBound() && dayBound() - x0.s >= 60)
      return { s: x0.s, e: dayBound(), wake: d.wake, bed: d.bed, today: !!o };
    d = DAY_DEF;
  }
  var x = winSpan(d.wake, d.bed);
  return { s: x.s, e: x.e, wake: d.wake, bed: d.bed, today: !!o };
}
function atMin(k, m) {
  var p = parse(k);
  p.setHours(0, m, 0, 0);
  return p.getTime();
}
function dayMidMin(k) {
  var w = dayWin(k);
  return Math.round((w.s + w.e) / 2);
}
function nextMonday(k) {
  var ws = weekStart(k);
  return add(ws, 7);
}
function lateInWeek(k) {
  var d = daysBetween(weekStart(k), k);
  return d > 3 || (d === 3 && nowMinInDay() >= 720);
}
function stampAdded(q) {
  q.addedOn = todayKey();
  q.addedMin = nowMinInDay();
  return q;
}
function lateStart(q, k) {
  if (!q.addedOn || q.type === "todo" || q.type === "weekly") return false;
  if (q.startOn) return false;
  if (q.type === "time" && q.roll) return false;
  return k === q.addedOn && (q.addedMin || 0) >= dayMidMin(k);
}
/* Required each day: not optional, not X-times-a-week, not a to-do, and not a period total (q.roll): totals are judged
     once, at the end of their period (see periodCheck in compute). */
function reqOf(d) {
  return d.filter(function (q) {
    return !q.opt && q.type !== "weekly" && q.type !== "todo" && !(q.type === "time" && q.roll);
  });
}
function reqDefsFor(k) {
  if (isVac(k)) return [];
  var e = S.days[k];
  return reqOf(e && e.q ? e.q : hasEntry(e) ? LEGACY : activeDefs(k));
}
function num(v) {
  return Math.round((+v || 0) * 100) / 100;
}
function projSum(id, upto) {
  var t = 0;
  Object.keys(S.days).forEach(function (k) {
    if (!upto || k <= upto) t += +(S.days[k] || {})[id] || 0;
  });
  return num(t);
}
function hasEntry(e) {
  return (
    !!e &&
    Object.keys(e).some(function (f) {
      return (
        f !== "q" &&
        f !== "sched" &&
        f !== "schSkip" &&
        f !== "calls" &&
        f !== "ck" &&
        f !== "rep" &&
        f.indexOf("plan_") !== 0 &&
        e[f] !== "" &&
        e[f] != null &&
        e[f] !== 0 &&
        e[f] !== false
      );
    })
  );
}
function defsOf(e) {
  return (e && e.q) || (hasEntry(e) ? LEGACY : activeDefs(todayKey()));
}
function metQ(q, e) {
  e = e || {};
  var v = e[q.id];
  if (q.type === "wake") {
    if (!v) return q.id === "wakeAt" && e.wake === true;
    var m = mins(v);
    return m >= mins(q.from) && m <= mins(q.to);
  }
  if (q.type === "time") return timeMet(q, e);
  if (q.type === "limit") return (v | 0) <= q.max;
  if (q.type === "check" || q.type === "weekly" || q.type === "todo") return v === true;
  if (q.type === "target") return num(v) >= q.min;
  if (q.type === "scale") return (v | 0) >= q.min;
  return false;
}
/* Daily limit for a time quest (q.lim, minutes): past it the timer stops and logs, and nothing more is tracked that day. 0 = none. */
function limOf(q) {
  return q && q.type === "time" && q.lim > 0 ? q.lim : 0;
}
function overQ(q, e) {
  return q.type === "limit" && ((e || {})[q.id] | 0) > q.max;
}
function planOf(q, e) {
  return Math.max(q.min, (e || {})["plan_" + q.id] || q.min);
}
function ok(e) {
  if (!hasEntry(e)) return false;
  var dq = reqOf(defsOf(e));
  return (
    dq.length > 0 &&
    dq.every(function (q) {
      return metQ(q, e);
    })
  );
}
function limBroken(e) {
  return (
    !!e &&
    reqOf(defsOf(e)).some(function (q) {
      return overQ(q, e);
    })
  );
}
function gold(e) {
  return (
    ok(e) &&
    reqOf(defsOf(e)).every(function (q) {
      return q.type !== "time" || q.roll || (e[q.id] | 0) >= planOf(q, e);
    })
  );
}
function dayXP(e) {
  if (!e) return 0;
  var x = 0;
  defsOf(e).forEach(function (q) {
    if (q.type !== "time") {
      if (metQ(q, e) && q.type !== "limit" && q.type !== "wake" && hasEntry(e)) x += q.opt ? 10 : 20;
      return;
    }
    var d = Math.min(240, e[q.id] | 0);
    x += d;
    if (d > 0 && d >= planOf(q, e)) x += 30;
  });
  x +=
    (e.sess || []).filter(function (z) {
      return z.m >= 90;
    }).length * 25;
  x += Math.min(CALL_CAP, e.calls | 0) * CALL_XP;
  if (ok(e)) x += 50;
  if (gold(e)) x += 100;
  return Math.max(0, x);
}
/* The week starts on Monday (cfg.weekStart 1, default) or Sunday (0). Every weekly rule goes through weekStart. */
function wkS() {
  var c = S.cfg;
  return c && c.weekStart === 0 ? 0 : 1;
}
function weekStart(k) {
  return add(k, -((parse(k).getDay() - wkS() + 7) % 7));
}
function wkOrder() {
  return wkS() === 1 ? [1, 2, 3, 4, 5, 6, 0] : [0, 1, 2, 3, 4, 5, 6];
}
function wkEndDay() {
  return (wkS() + 6) % 7;
}
function wkSpan() {
  return wkS() === 1 ? "Mon\u2013Sun" : "Sun\u2013Sat";
}
var DAYF = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
function weekCount(id, k, upto) {
  var s0 = weekStart(k),
    n = 0;
  for (var i = 0; i < 7; i++) {
    var d = add(s0, i);
    if (upto && d > k) break;
    if ((S.days[d] || {})[id] === true) n++;
  }
  return n;
}
function totalXP(upto) {
  var t = upto || todayKey(),
    x = completionXP(t);
  Object.keys(S.days).forEach(function (k) {
    if (k >= START_KEY && k <= t) {
      var e = S.days[k];
      x += dayXP(e);
      if (e)
        defsOf(e).forEach(function (q) {
          if (q.type === "weekly" && e[q.id] === true && weekCountOn(q.id, k) === q.min) x += 100;
        });
    }
  });
  return x;
}
function weekCountOn(id, k) {
  var n = 0;
  for (var d = weekStart(k); d <= k; d = add(d, 1)) if ((S.days[d] || {})[id] === true) n++;
  return n;
}
/* Per-quest streak and consistency (both modes; counters, not judgments). qStreak(id,k): consecutive scheduled days
     up to k on which the quest was met (today counts once met; a day the quest wasn't on the list, was off, paused or
     not scheduled is skipped, not broken). qConsist(id,k): met / scheduled over the last 30 days. Daily time, check,
     target, scale and clock-time quests only (not totals, weekly counts, limits or to-dos). */
var STREAK_TYPES = { time: 1, check: 1, target: 1, scale: 1, wake: 1 };
function qStreakable(q) {
  return !!q && STREAK_TYPES[q.type] && !q.roll;
}
function qDayState(id, d) {
  var cq = cfgQ(id),
    from = cq ? cq.addedOn || firstSeen(id) : null;
  if (from && d < from) return null;
  var q = dayDefMap(d)[id];
  if (!q) {
    if (!cq || !qStreakable(cq)) return null;
    return !scheduled(cq, d) || isPaused(cq, d) || (cq.startOn && d < cq.startOn) ? "skip" : null;
  }
  if (!qStreakable(q)) return null;
  if (q.off || q.ign || !scheduled(q, d)) return "skip";
  return metQ(q, S.days[d] || {}) ? "met" : "miss";
}
function qStreak(id, k) {
  var n = 0,
    d = k,
    st = qDayState(id, k);
  if (st === "miss") d = add(k, -1);
  for (var i = 0; i < 400 && d >= START_KEY; i++, d = add(d, -1)) {
    var x = qDayState(id, d);
    if (x === null) break;
    if (x === "skip") continue;
    if (x === "met") n++;
    else break;
  }
  return n;
}
function qConsist(id, k) {
  var met = 0,
    sch = 0;
  for (var i = 0; i < 30; i++) {
    var d = add(k, -i);
    if (d < START_KEY) break;
    var x = qDayState(id, d);
    if (x === "met") {
      met++;
      sch++;
    } else if (x === "miss") sch++;
  }
  return { met: met, sch: sch };
}
/* XP spent on streak repairs comes off the level, never off the day totals. */
function xpNet(upto) {
  return Math.max(0, totalXP(upto) - ((S.cfg && S.cfg.xpSpent) | 0));
}
function level(x) {
  var l = 1,
    need = 300;
  while (x >= need) {
    x -= need;
    l++;
    need = 300 * l;
  }
  return { l: l, cur: x, need: need };
}
