/* ---- Morning promise: the first rules of the Rulebook as check quests that open the day ---- */
import { G } from "../core/g.js";
import { S } from "../core/00-state.js";
import { cfg, saveCfg } from "../core/config.js";
import { add, parse, todayKey } from "../core/days.js";
import { clone } from "../core/util.js";

/* cfg.vow = [{from, to?}] (to exclusive), like cfg.noStreak, so history keeps which days had it. Turning it on or off
     always takes effect tomorrow. On a day inside a range, activeDefs puts one required check quest per rule (the first
     VOW_MAX rules of the Rulebook, in order) at the top of the list, and Today shows only those until all are ticked. */
export function vowMax() {
  return 4;
}
export function vowOn(k) {
  return ((S.cfg && S.cfg.vow) || []).some(function (r) {
    return k >= r.from && (!r.to || k < r.to);
  });
}
export function vowHash(s) {
  var h = 5381;
  for (var i = 0; i < s.length; i++) h = ((h * 33) ^ s.charCodeAt(i)) >>> 0;
  return h.toString(36);
}
/* A rule's text as one plain line: Rulebook markup (card:/fact:/chips:, +/x/>/- bullets, | separators) dropped. */
export function vowText(t) {
  return String(t || "")
    .split("\n")
    .map(function (l) {
      return l
        .replace(/^\s*(card|fact|chips):\s*/i, "")
        .replace(/^\s*([+x>\-]|\d+\.)\s+/, "")
        .replace(/\s*\|\s*/g, ", ")
        .trim();
    })
    .filter(Boolean)
    .join(" · ");
}
export function vowRules() {
  var out = [],
    seen = {};
  ((S.cfg && S.cfg.rules) || []).forEach(function (sec) {
    (sec.blocks || []).forEach(function (b) {
      var h = String(b.h || "").trim();
      if (!h || out.length >= vowMax()) return;
      var id = "vw" + vowHash((sec.title || "") + "\n" + h);
      while (seen[id]) id += "x";
      seen[id] = true;
      var r = { id: id, type: "check", label: h, vow: true },
        n = vowText(b.t);
      if (n) r.note = n;
      out.push(r);
    });
  });
  return out;
}
export function vowDefs(k) {
  return vowOn(k) ? vowRules() : [];
}
/* Today's promise is still open: some rule quest on the list isn't ticked. */
export function vowPending(defs, e) {
  return defs.some(function (q) {
    return q.vow && !(e && e[q.id]);
  });
}
/* Notification ids for day k's reminders: 2700 + (day number mod 7) × 10 + n, so the same day keeps the same ids. */
export function vowNid(k, n) {
  return 2700 + (Math.round(parse(k).getTime() / 864e5) % 7) * 10 + n;
}
export function setVow(on) {
  var c2 = clone(cfg()),
    T = todayKey(),
    tm = add(T, 1),
    L = (c2.vow || []).slice();
  if (on) {
    var j = L.filter(function (r) {
      return r.to && r.to >= tm;
    })[0];
    if (j) delete j.to;
    else if (!vowOn(tm)) L.push({ from: tm });
  } else
    L = L.map(function (r) {
      if (r.to && r.to <= tm) return r;
      return r.from >= tm ? null : Object.assign({}, r, { to: tm });
    }).filter(Boolean);
  if (L.length) c2.vow = L;
  else delete c2.vow;
  saveCfg(c2);
  G.qSig = "";
  G.nfSig = "";
}
