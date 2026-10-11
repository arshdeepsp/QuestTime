/* ---- app state (S), constants, and the document store (store) ---- */
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
/* If saved data can't be read, or comes from a newer app version, a copy goes to pc-cache-rescue and nothing is saved
     over it (cacheBlock) until a backup is imported. */
var cacheBlock = "";
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
store.load();
/* Your day: waking hours used app-wide (schedule, midday point, reminders). cfg.day is the usual window; cfg.dayOv overrides one date. */
var DAY_DEF = { wake: "07:00", bed: "23:00" };
var DAYF = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
/* Per-quest streak and consistency (both modes; counters, not judgments). qStreak(id,k): consecutive scheduled days
     up to k on which the quest was met (today counts once met; a day the quest wasn't on the list, was off, paused or
     not scheduled is skipped, not broken). qConsist(id,k): met / scheduled over the last 30 days. Daily time, check,
     target, scale and clock-time quests only (not totals, weekly counts, limits or to-dos). */
var STREAK_TYPES = { time: 1, check: 1, target: 1, scale: 1, wake: 1 };
