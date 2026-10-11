/* ---- work styles ---- */
var STYLES = {
  steady: {
    name: "Steady",
    tag: "Planned rhythm",
    d: "Daily minimums, plan counters, 50-minute sprints with strict breaks.",
    set: { showPlan: true, bank: false, rollDefault: false, sparkTools: false },
    len: 50,
  },
  surge: {
    name: "Surge",
    tag: "Uneven, deep bursts",
    d: "Weekly totals for new time quests (busy days cover empty ones), long 1h 45m blocks with flow extension.",
    set: { showPlan: true, bank: false, rollDefault: true, sparkTools: false },
    len: 105,
  },
  spark: {
    name: "Spark",
    tag: "Hard to start, likes variety",
    d: "Just 5 minutes, Pick for me and Batch to-dos up front, 25-minute blocks, and room for an extra streak freeze.",
    set: { showPlan: false, bank: false, rollDefault: false, sparkTools: true },
    len: 25,
  },
};
function applyStyle(id, quiet) {
  var st = STYLES[id];
  if (!st) return;
  var c = clone(cfg());
  c.style = id;
  Object.keys(st.set).forEach(function (k) {
    c[k] = st.set[k];
  });
  saveCfg(c);
  S.spLen = st.len;
  cache();
  qSig = "";
  render();
  if (!quiet) setSync(st.name + " style applied");
}
function fzCap() {
  return (S.cfg && S.cfg.style) === "spark" ? 4 : 3;
}
function styleCards(sel, attr) {
  return (
    '<div class="stylegrid">' +
    Object.keys(STYLES)
      .map(function (k) {
        var s = STYLES[k],
          on = sel === k;
        return (
          '<button type="button" class="stylecard' +
          (on ? " on" : "") +
          '" ' +
          attr +
          '="' +
          k +
          '" aria-pressed="' +
          on +
          '"><b>' +
          s.name +
          "</b><em>" +
          s.tag +
          "</em><span>" +
          s.d +
          "</span></button>"
        );
      })
      .join("") +
    "</div>"
  );
}
