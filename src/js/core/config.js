/* ---- settings (cfg): read with cfg(), change with saveCfg(clone); look and feel in cfg.ui ---- */
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
function cfg() {
  if (!S.cfg) {
    S.cfg = { quests: [], rules: null, start: START_AT.toISOString(), updated: "" };
    cache();
  }
  if (!S.cfg.start) S.cfg.start = START_AT.toISOString();
  return S.cfg;
}
function saveCfg(nc) {
  nc.updated = new Date().toISOString();
  S.cfg = nc;
  cache();
}
