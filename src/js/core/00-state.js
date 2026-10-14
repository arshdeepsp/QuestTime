/* ---- app state (S), constants, and the document store (store) ---- */
import { G } from "./g.js";
import { migrate } from "./migrate.js";
import { storeKey } from "./storage.js";

export var START_KEY,
  START_AT,
  D,
  LEGACY,
  MIN,
  STEP,
  MAXM,
  CALL_MIN,
  CALL_XP,
  CALL_CAP,
  RANKS,
  S,
  view,
  dirty,
  SCHEMA,
  RERATE_MIN,
  MID_FRAC,
  localAdapter,
  store,
  DAY_DEF,
  DAYF,
  STREAK_TYPES;

export function setStart(st) {
  START_AT = new Date(st);
  START_KEY =
    START_AT.getFullYear() +
    "-" +
    String(START_AT.getMonth() + 1).padStart(2, "0") +
    "-" +
    String(START_AT.getDate()).padStart(2, "0");
}

/* Runs once at startup, in file-number order (main.js). */
export function init() {
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
  D = JSON.parse(document.getElementById("achData").textContent);
  LEGACY = [];
  MIN = 15;
  STEP = 10;
  MAXM = 960;
  /* Answered the call: start a timer within CALL_MIN minutes of a reminder you tapped. e.calls counts them per day. */
  CALL_MIN = 2;
  CALL_XP = 10;
  CALL_CAP = 5;
  RANKS = [
    [0, "Apprentice", "sprout"],
    [7, "Journeyman", "sprout"],
    [21, "Session Player", "flame"],
    [42, "Bandleader", "metronome"],
    [90, "Virtuoso", "dumbbell"],
    [180, "Master", "trophy"],
    [365, "Maestro", "star"],
  ];
  S = { days: {}, refl: {}, notes: {}, cfg: null };
  G.dl = null;
  G.dlChecked = false;
  view = "today";
  dirty = {};
  G.timer = null;
  /* Data schema. Bump SCHEMA and add a step to migrate() whenever the stored shape changes. */
  SCHEMA = 23;
  RERATE_MIN = 60;
  MID_FRAC = 1 / 3;
  /* If saved data can't be read, or comes from a newer app version, a copy goes to pc-cache-rescue and nothing is saved
     over it (cacheBlock) until a backup is imported. */
  G.cacheBlock = "";
  G.storeHold = false;
  localAdapter = {
    name: "local",
    load: function () {
      return localStorage.getItem(storeKey());
    },
    save: function (state) {
      if (G.storeHold) return;
      localStorage.setItem(storeKey(), JSON.stringify(state));
    },
  };
  /* store.subscribe(fn): fn(ids) runs after every save that changed documents ("cfg", "refl", "notes", "days/<date>",
     "-days/<date>" for a removed day) and after a document adopted from the cloud. ui/04-render.js subscribes to re-render.
     refl and notes are "map docs": one document each, a map by key (S.refl by day, S.notes by note id). */
  store = (function () {
    var ad = localAdapter,
      subs = [],
      last = { cfg: null, refl: null, notes: null, days: {} };
    function emit(ids) {
      subs.slice().forEach(function (fn) {
        try {
          fn(ids);
        } catch (e) {}
      });
    }
    function changed() {
      var ch = [];
      if (S.cfg !== last.cfg) ch.push("cfg");
      if (S.refl !== last.refl) ch.push("refl");
      if (S.notes !== last.notes) ch.push("notes");
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
      last.notes = S.notes;
      last.days = {};
      Object.keys(S.days).forEach(function (k) {
        last.days[k] = S.days[k];
      });
    }
    return {
      subscribe: function (fn) {
        subs.push(fn);
        return function () {
          subs = subs.filter(function (x) {
            return x !== fn;
          });
        };
      },
      emit: emit,
      use: function (a) {
        ad = a;
      },
      adapter: function () {
        return ad;
      },
      markClean: function (id, obj) {
        if (id === "cfg") last.cfg = obj;
        else if (id === "refl") last.refl = obj || S.refl;
        else if (id === "notes") last.notes = obj || S.notes;
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
          S.notes = c.notes || {};
          S.cfg = c.cfg || null;
          S.meta = c.meta || { u: {} };
          if (!S.meta.u) S.meta.u = {};
          S.timer = c.timer || null;
          S.sprint = c.sprint || null;
          S.pomo = c.pomo || null;
          if (c.spLen) S.spLen = c.spLen;
          if (c.spRounds != null) S.spRounds = c.spRounds;
          if (c.spLongOn === false) S.spLongOn = false;
          remember();
        } catch (e) {
          S.days = {};
          S.refl = {};
          S.notes = {};
          S.cfg = null;
          S.meta = { u: {} };
          S.timer = null;
          S.sprint = null;
          S.pomo = null;
          if (raw) {
            G.cacheBlock = e === "newer" ? "newer" : "error";
            try {
              if (!localStorage.getItem("pc-cache-rescue"))
                localStorage.setItem("pc-cache-rescue", typeof raw === "string" ? raw : JSON.stringify(raw));
            } catch (x) {}
          }
        }
      },
      changed: changed,
      flush: function () {
        if (G.cacheBlock) return [];
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
        if (ch.length) emit(ch);
        return ch;
      },
      docs: function () {
        var d = {
          cfg: S.cfg,
          refl: { map: S.refl },
          notes: { map: S.notes },
          days: S.days,
          session: {
            timer: S.timer,
            sprint: S.sprint,
            pomo: S.pomo,
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
  DAY_DEF = { wake: "07:00", bed: "23:00" };
  DAYF = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  /* Per-quest streak and consistency (both modes; counters, not judgments). qStreak(id,k): consecutive scheduled days
     up to k on which the quest was met (today counts once met; a day the quest wasn't on the list, was off, paused or
     not scheduled is skipped, not broken). qConsist(id,k): met / scheduled over the last 30 days. Daily time, check,
     target, scale and clock-time quests only (not totals, weekly counts, limits or to-dos). */
  STREAK_TYPES = { time: 1, check: 1, target: 1, scale: 1, wake: 1 };
}
