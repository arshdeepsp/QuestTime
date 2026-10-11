/* ---- busy times (a weekday template in cfg.busy) ---- */
import { G } from "../core/g.js";
import { cfg, saveCfg } from "../core/config.js";
import { add, parse, todayKey } from "../core/days.js";
import { locked } from "../core/entries.js";
import { clone, fmtD } from "../core/util.js";
import { DN } from "../quests/02-quest-list.js";
import { WDN } from "../quests/35b-daily-limit.js";
import { SCH_STEP } from "./51-schedule.js";
import { schClash, schName, schNewId, schNext, schWin } from "./model.js";
import { wkSort } from "./repeats.js";

/* ---- busy-time template ---- */
export function busyList() {
  return cfg().busy || [];
}
export function busyById(id) {
  return busyList().filter(function (b) {
    return b.id === id;
  })[0];
}
export function busyOn(b, k) {
  return k >= b.from && (!b.until || k <= b.until) && b.dows.indexOf(parse(k).getDay()) >= 0;
}
export function busyDaysText(dows) {
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
export function busyText(b) {
  return busyDaysText(b.dows) + (b.until ? " until " + fmtD(b.until) : ", every week");
}
export function busyKey(wd) {
  var T = todayKey();
  for (var i = 1; i <= 7; i++) {
    var k = add(T, i);
    if (parse(k).getDay() === wd) return k;
  }
  return T;
}
export function busyForWd(wd) {
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
export function busySave(fn) {
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
  G.nfSig = "";
  G.qSig = "";
}
export function busyRecent() {
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
export function busyAdd(lb, m) {
  var T = todayKey(),
    w = schWin(),
    L = busyForWd(G.schWd),
    f = m,
    t = Math.min(w.e, f + 60);
  lb = (lb || "").trim().slice(0, 30);
  if (!lb) {
    G.schMsg = "Give it a name.";
    return false;
  }
  var nx = schNext(L, null, f, w.e);
  if (nx < t) t = nx;
  var c = schClash(L, null, f, t);
  if (c || t - f < SCH_STEP) {
    G.schMsg = "That overlaps " + schName(c) + ". Pick a free time.";
    return false;
  }
  var id = "z" + schNewId();
  busySave(function (B) {
    B.push({ id: id, lb: lb, f: f, t: t, dows: [G.schWd], from: T });
  });
  G.schMsg = G.schWd === parse(T).getDay() ? "Applies from today." : "";
  G.schSel = id;
  G.schPick = null;
  return true;
}
export function busyDay(id, d) {
  var b = busyById(id);
  if (!b) return;
  var on = b.dows.indexOf(d) >= 0;
  if (on && b.dows.length === 1) {
    G.schMsg = "It needs at least one day. Use Remove to delete it.";
    return;
  }
  if (!on) {
    var c = schClash(busyForWd(d), id, b.f, b.t);
    if (c) {
      G.schMsg = "That clashes with " + c.lb + " on " + WDN[d] + ".";
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
  G.schMsg = "";
}
export function busyWeeks(id, n) {
  var T = todayKey();
  busySave(function (B) {
    B.forEach(function (x) {
      if (x.id !== id) return;
      if (n > 0) x.until = add(T, n * 7 - 1);
      else delete x.until;
    });
  });
}
export function busyRemove(id) {
  busySave(function (B) {
    return B.filter(function (x) {
      return x.id !== id;
    });
  });
  G.schSel = null;
  G.schMsg = "Removed.";
}
