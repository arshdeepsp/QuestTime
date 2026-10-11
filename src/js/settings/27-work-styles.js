/* ---- work styles ---- */
import { G } from "../core/g.js";
import { S } from "../core/00-state.js";
import { cfg, saveCfg } from "../core/config.js";
import { cache } from "../core/storage.js";
import { clone } from "../core/util.js";
import { render } from "../ui/04-render.js";
import { setSync } from "../ui/feedback.js";

export var STYLES;

export function applyStyle(id, quiet) {
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
  G.qSig = "";
  render();
  if (!quiet) setSync(st.name + " style applied");
}
export function styleCards(sel, attr) {
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

/* Runs once at startup, in file-number order (main.js). */
export function init() {
  STYLES = {
    steady: {
      name: "Steady",
      tag: "Planned rhythm",
      d: "Daily minimums, plan counters, 50-minute sprints with strict breaks.",
      set: { showPlan: true, rollDefault: false, sparkTools: false },
      len: 50,
    },
    surge: {
      name: "Surge",
      tag: "Uneven, deep bursts",
      d: "Weekly totals for new time quests (busy days cover empty ones), long 1h 45m blocks with flow extension.",
      set: { showPlan: true, rollDefault: true, sparkTools: false },
      len: 105,
    },
    spark: {
      name: "Spark",
      tag: "Hard to start, likes variety",
      d: "Just 5 minutes, Pick for me and Batch to-dos up front, 25-minute blocks, and room for an extra streak freeze.",
      set: { showPlan: false, rollDefault: false, sparkTools: true },
      len: 25,
    },
  };
}
