/* ---- deadlines + term in HUD ---- */
function renderHudExtras(T) {
  var c = cfg(),
    dl = (c.deadlines || [])
      .filter(function (d) {
        return d.date && d.date >= T;
      })
      .sort(function (a, b) {
        return a.date < b.date ? -1 : 1;
      }),
    row = document.getElementById("dlRow"),
    h = "";
  dl.slice(0, 3).forEach(function (d) {
    var n = daysBetween(T, d.date);
    h +=
      '<span class="dlc' +
      (n <= 3 ? " soon" : "") +
      '">' +
      esc(d.title) +
      " \u00b7 " +
      (n === 0 ? "today" : n === 1 ? "tomorrow" : n + "d") +
      "</span>";
  });
  if (dl.length > 3) h += '<span class="dlc more">+' + (dl.length - 3) + "</span>";
  h += '<button type="button" class="dlc add" id="dlNew">+ Deadline</button>';
  row.innerHTML = h;
  row.hidden = false;
  document.getElementById("dlNew").addEventListener("click", openDeadlineModal);
  var tt = document.getElementById("termTxt"),
    tm = c.term;
  tt.textContent = "";
  if (tm && tm.start && tm.end) {
    if (T < tm.start) {
      var n2 = daysBetween(T, tm.start);
      tt.textContent = (tm.name || "Term") + " starts in " + n2 + " day" + (n2 === 1 ? "" : "s");
    } else if (T <= tm.end) {
      var wk = Math.floor(daysBetween(tm.start, T) / 7) + 1,
        tw = Math.ceil((daysBetween(tm.start, tm.end) + 1) / 7);
      tt.textContent = (tm.name ? tm.name + ": " : "") + "Week " + wk + " of " + tw;
    }
  }
  tt.hidden = !tt.textContent;
}
