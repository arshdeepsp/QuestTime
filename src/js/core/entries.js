/* ---- today's entry: read with entry(), save with commit() ---- */
function ro() {
  return !!viewKey && viewKey !== todayKey();
}
function locked() {
  return ro();
}
function entry() {
  if (locked()) return Object.assign({}, S.days[dayKey()] || {});
  var k = dayKey();
  if (!S.days[k]) S.days[k] = {};
  else S.days[k] = Object.assign({}, S.days[k]);
  S.days[k].q = activeDefs(k);
  return S.days[k];
}
function commit() {
  if (locked()) {
    render();
    return;
  }
  var k = dayKey();
  dirty[k] = true;
  cache();
  render(true);
  clearTimeout(timer);
  timer = setTimeout(flush, 700);
}
