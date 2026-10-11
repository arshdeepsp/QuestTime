/* ---- settings (cfg): read with cfg(), change with saveCfg(clone); look and feel in cfg.ui ---- */
import { S, START_AT } from "./00-state.js";
import { cache } from "./storage.js";
import { clone } from "./util.js";

/* Look-and-feel choices (cfg.ui, synced with the account): sound on/off (sfx), Minimal view (focus), stats panel (stats),
     HUD details (hud), Done/Off today/Ignored groups (done/off/ign), folded subjects (sjfold), grove info (groveInfo). */
export function uiGet(k, def) {
  var u = (S.cfg && S.cfg.ui) || {};
  return k in u ? u[k] : def;
}
export function uiSet(k, v) {
  if (!S.cfg) return;
  var c = clone(S.cfg);
  c.ui = Object.assign({}, c.ui || {});
  c.ui[k] = v;
  saveCfg(c);
}
/* A quest id appears once in cfg.quests: keeps the first copy of each id (a drag on a list that showed a quest no longer
   in cfg could write one quest twice, and the copies synced). Returns how many were dropped. */
export function dedupeQuests(c) {
  if (!c || !Array.isArray(c.quests)) return 0;
  var seen = {},
    out = c.quests.filter(function (q) {
      if (!q || q.id == null || seen[q.id]) return false;
      return (seen[q.id] = true);
    }),
    n = c.quests.length - out.length;
  if (n) c.quests = out;
  return n;
}
export function cfg() {
  if (!S.cfg) {
    S.cfg = { quests: [], rules: null, start: START_AT.toISOString(), updated: "" };
    cache();
  }
  if (!S.cfg.start) S.cfg.start = START_AT.toISOString();
  return S.cfg;
}
export function saveCfg(nc) {
  dedupeQuests(nc);
  nc.updated = new Date().toISOString();
  S.cfg = nc;
  cache();
}
