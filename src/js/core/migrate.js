/* ---- migrate(): upgrades stored data to the current SCHEMA, one step per version ---- */
import { key, lockHour, parse } from "./days.js";

export function migrate(c) {
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
  if (v < 19) {
    if (c.cfg && c.cfg.theme === "nether") c.cfg.theme = "ember";
    v = 19;
  }
  c.schema = v;
  return c;
}
