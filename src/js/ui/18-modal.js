/* ---- generic modal ---- */
import { esc, hm, hmL, num } from "../core/util.js";
import { eKey, perOf, perWord, rollSum, weekTarget } from "../rules/26-periods.js";
import { metQ } from "../rules/day-rules.js";

export var gEl, gBody, gTitle, gScrim, gLast, gOnClose;

export function openG(title, build, onClose) {
  gLast = document.activeElement;
  gTitle.textContent = title;
  gBody.innerHTML = "";
  gOnClose = onClose || null;
  gEl.hidden = false;
  gScrim.hidden = false;
  build(gBody);
  var f = gBody.querySelector("input,textarea,select,button");
  if (f) f.focus();
}
export function closeG() {
  if (gEl.hidden) return;
  gEl.hidden = true;
  if (document.getElementById("nqModal").hidden) gScrim.hidden = true;
  var cb = gOnClose;
  gOnClose = null;
  if (cb) cb();
  if (gLast && gLast.focus && document.contains(gLast)) gLast.focus();
}
export function fmtVal(q, e) {
  var v = e[q.id];
  if (q.type === "wake") return v || "\u2014";
  if (q.type === "time" && q.roll) {
    var k = eKey.get(e);
    return k
      ? hm(v) + " \u00b7 " + hm(rollSum(q.id, k, q)) + " of " + hm(weekTarget(q, k)) + " this " + perWord(q)
      : hm(v);
  }
  if (q.type === "time") return hm(v) + " of " + hmL(q.min);
  if (q.type === "target") return num(v) + " / " + num(q.min) + (q.ul ? " " + q.ul : "");
  if (q.type === "limit")
    return (q.unit === "min" ? hm(v) : v | 0) + " (max " + (q.unit === "min" ? hmL(q.max) : q.max) + ")";
  if (q.type === "scale") return v ? v + "/" + (q.scale || 5) : "\u2014";
  return v ? "Done" : "Not done";
}
export function qList(e, defs) {
  return (
    '<div class="mlist">' +
    defs
      .map(function (q) {
        var tot = q.type === "time" && !!q.roll,
          k0 = tot && eKey.get(e),
          ok_ = tot ? !!k0 && rollSum(q.id, k0, q) >= weekTarget(q, k0) : metQ(q, e),
          opt = q.opt || q.type === "weekly" || q.type === "todo" || tot;
        return (
          '<div class="mrow' +
          (ok_ ? " ok" : opt ? " opt" : " no") +
          '"><i class="mk"></i><span class="ml">' +
          esc(q.label) +
          (tot ? " <em>" + esc(perOf(q) ? "total" : "weekly") + "</em>" : opt ? " <em>optional</em>" : "") +
          '</span><span class="mv">' +
          esc(fmtVal(q, e)) +
          "</span></div>"
        );
      })
      .join("") +
    "</div>"
  );
}

/* Runs once at startup, in file-number order (main.js). */
export function init() {
  gEl = document.getElementById("gModal");
  gBody = document.getElementById("gBody");
  gTitle = document.getElementById("gTitle");
  gScrim = document.getElementById("modalScrim");
  gLast = null;
  gOnClose = null;
  document.getElementById("gClose").addEventListener("click", closeG);
  gScrim.addEventListener("click", function () {
    if (!gEl.hidden) closeG();
  });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && !gEl.hidden) closeG();
  });
}
