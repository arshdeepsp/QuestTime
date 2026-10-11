/* ---- small helpers: cloning, numbers, escaping, time formatting ---- */
function clone(x) {
  return JSON.parse(JSON.stringify(x));
}
function num(v) {
  return Math.round((+v || 0) * 100) / 100;
}
function svg(name) {
  var ic = D.icons[name],
    r = "";
  ic.rows.forEach(function (row, y) {
    for (var x = 0; x < 16; x++) {
      var ch = row[x];
      if (ch !== ".") r += '<rect x="' + x + '" y="' + y + '" width="1" height="1" fill="' + ic.pal[ch] + '"/>';
    }
  });
  return '<svg viewBox="0 0 16 16" aria-hidden="true">' + r + "</svg>";
}
function hm(m) {
  m = m | 0;
  var h = Math.floor(m / 60),
    r = m % 60;
  return h ? h + "h" + (r ? " " + r + "m" : "") : r + "m";
}
function hmL(m) {
  m = m | 0;
  return m >= 60 && m % 60 === 0 ? m / 60 + " hour" + (m > 60 ? "s" : "") : m >= 60 ? hm(m) : m + " min";
}
function fmtD(k) {
  return parse(k).toLocaleDateString("en-CA", { month: "short", day: "numeric" });
}
function esc(x) {
  return String(x == null ? "" : x).replace(/[&<>"]/g, function (c) {
    return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
  });
}
