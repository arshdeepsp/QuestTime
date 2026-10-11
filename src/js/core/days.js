/* ---- dates and the day window: keys, the lock hour, Your day, week start ---- */
function key(d) {
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
}
function parse(k) {
  var p = k.split("-");
  return new Date(+p[0], p[1] - 1, +p[2]);
}
function add(k, n) {
  var d = parse(k);
  d.setDate(d.getDate() + n);
  return key(d);
}
/* The day rolls over (locks) at midnight, or at your usual bedtime when that is after midnight (rounded up to the hour, 5 am at most). */
function lockHour(bed, wake) {
  var b = mins(bed || "23:00"),
    w = mins(wake || "07:00");
  return b >= w ? 0 : Math.min(5, Math.ceil(b / 60));
}
function dayEnd() {
  var d = (S.cfg && S.cfg.day) || {};
  return lockHour(d.bed, d.wake);
}
function todayKey() {
  var d = new Date();
  d.setHours(d.getHours() - dayEnd());
  return key(d);
}
function mins(t) {
  var p = String(t).split(":");
  return +p[0] * 60 + +p[1];
}
function localKey(d) {
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
}
function nowMinInDay() {
  var d = new Date(),
    T = todayKey(),
    m = d.getHours() * 60 + d.getMinutes();
  if (localKey(d) !== T) m += 1440;
  return m;
}
function dayBound() {
  return 1440 + dayEnd() * 60;
}
function winSpan(w, b) {
  var s = mins(w),
    e = mins(b);
  if (e <= s) e += 1440;
  return { s: s, e: e };
}
function winErr(w, b, today) {
  if (!/^\d{2}:\d{2}$/.test(w || "") || !/^\d{2}:\d{2}$/.test(b || "")) return "Pick a wake-up time and a bedtime.";
  var x = winSpan(w, b),
    de = today ? dayEnd() : lockHour(b, w);
  if (x.e - x.s < 60) return "Leave at least an hour between wake-up and bedtime.";
  if (!today && x.e > 1440 + 300) return "Bedtime can be 5:00 am at the latest.";
  if (x.s < de * 60) return "Wake-up has to be after bedtime.";
  if (today && x.e > dayBound())
    return (
      "Today\u2019s bedtime can\u2019t be later than your usual one after midnight (" +
      (de ? de + ":00 am" : "midnight") +
      "). Change your usual bedtime first."
    );
  return "";
}
function dayWin(k) {
  var c = cfg(),
    o = c.dayOv && c.dayOv.date === k ? c.dayOv : null,
    d = Object.assign({}, DAY_DEF, c.day || {});
  if (o && !winErr(o.wake, o.bed, true)) d = { wake: o.wake, bed: o.bed };
  if (winErr(d.wake, d.bed)) {
    var x0 = winSpan(d.wake, d.bed);
    if (x0.e > dayBound() && dayBound() - x0.s >= 60)
      return { s: x0.s, e: dayBound(), wake: d.wake, bed: d.bed, today: !!o };
    d = DAY_DEF;
  }
  var x = winSpan(d.wake, d.bed);
  return { s: x.s, e: x.e, wake: d.wake, bed: d.bed, today: !!o };
}
function atMin(k, m) {
  var p = parse(k);
  p.setHours(0, m, 0, 0);
  return p.getTime();
}
function dayMidMin(k) {
  var w = dayWin(k);
  return Math.round((w.s + w.e) / 2);
}
function nextMonday(k) {
  var ws = weekStart(k);
  return add(ws, 7);
}
function lateInWeek(k) {
  var d = daysBetween(weekStart(k), k);
  return d > 3 || (d === 3 && nowMinInDay() >= 720);
}
/* The week starts on Monday (cfg.weekStart 1, default) or Sunday (0). Every weekly rule goes through weekStart. */
function wkS() {
  var c = S.cfg;
  return c && c.weekStart === 0 ? 0 : 1;
}
function weekStart(k) {
  return add(k, -((parse(k).getDay() - wkS() + 7) % 7));
}
function wkOrder() {
  return wkS() === 1 ? [1, 2, 3, 4, 5, 6, 0] : [0, 1, 2, 3, 4, 5, 6];
}
function wkEndDay() {
  return (wkS() + 6) % 7;
}
function wkSpan() {
  return wkS() === 1 ? "Mon\u2013Sun" : "Sun\u2013Sat";
}
function dayKey() {
  return ro() ? viewKey : todayKey();
}
function daysBetween(a, b) {
  return Math.round((parse(b) - parse(a)) / 86400000);
}
