/* ---- tap a number to type it ---- */
function parseMins(s) {
  s = String(s || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "");
  if (!s) return null;
  var m;
  if ((m = s.match(/^(\d+(?:\.\d+)?)h(?:(\d{1,2})m?)?$/))) return Math.round(+m[1] * 60 + (+m[2] || 0));
  if ((m = s.match(/^(\d+):(\d{1,2})$/))) return +m[1] * 60 + +m[2];
  if ((m = s.match(/^(\d+)m?$/))) return +m[1];
  return null;
}
function openNum(q, isPlan) {
  var tq = q.type === "time" || (q.type === "limit" && q.unit === "min"),
    e0 = S.days[todayKey()] || {},
    key = isPlan ? "plan_" + q.id : q.id,
    cur = isPlan ? planOf(q, e0) : +e0[q.id] || 0;
  openG((isPlan ? "Plan for " : "") + q.label, function (b) {
    b.innerHTML =
      '<p class="help">' +
      (tq
        ? "Type minutes, or hours like 1h30 or 1:30."
        : "Type the amount" + (q.ul ? " (" + esc(q.ul) + ")" : "") + ".") +
      '</p><div class="edrow"><input id="numIn" ' +
      (tq ? 'inputmode="text" placeholder="e.g. 45 or 1h30"' : 'type="number" inputmode="decimal" step="any" min="0"') +
      ' value="' +
      (tq ? (cur ? hm(cur).replace(/\s/g, "") : "") : cur || "") +
      '"><button type="button" class="stone save" id="numGo">Set</button></div><p class="cmsg2" id="numMsg"></p>';
    var inp = b.querySelector("#numIn");
    setTimeout(function () {
      inp.focus();
      inp.select();
    }, 50);
    function go_() {
      var v = tq ? parseMins(inp.value) : num(inp.value);
      if (v == null || isNaN(v) || v < 0) {
        b.querySelector("#numMsg").textContent = tq ? "Try 45, 90, 1h30 or 1:30." : "Enter a number.";
        return;
      }
      var e = entry();
      if (isPlan) v = Math.max(q.min, Math.min(MAXM, v));
      else {
        v = Math.min(tq ? MAXM : 1e6, v);
        if (tq && limOf(q)) v = Math.min(v, q.lim);
      }
      e[key] = v;
      closeG();
      commit();
      haptic("medium");
    }
    b.querySelector("#numGo").addEventListener("click", go_);
    inp.addEventListener("keydown", function (ev) {
      if (ev.key === "Enter") go_();
    });
  });
}
