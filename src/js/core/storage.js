/* ---- where the state is saved on this device (one copy per account) ---- */
/* ---- the store ----
     State lives in S; persistence goes through `store`, which thinks in documents so a sync backend can be plugged in
     without touching the app: `cfg` (one doc, carries `updated`), `refl` (one doc, a map by day), `days/<date>` (one doc
     per day), and `session` (device-local: timer, sprint, sprint defaults, the answered call — never synced).
     cache() = store.flush(): it works out which docs changed since the last flush by identity (the app replaces S.cfg,
     S.refl and S.days[k] rather than mutating them in place), stamps S.meta.u[doc] with the time (and S.meta.del[doc] for
     days removed, so a sync can delete them), then hands the whole state plus the changed list to the adapter.
     The only adapter today writes the whole state to localStorage["pc-cache-v1"] as before; a Firestore adapter would
     write the changed docs (users/<uid>/data/cfg, users/<uid>/data/refl, users/<uid>/days/<date>) and merge remote docs by their
     `u` stamp — the Firestore SDK's own offline cache covers the local side, so no IndexedDB code is needed here.
     store.docs() returns the state in that document shape. Loading, schema migration and the rescue copy
     (pc-cache-rescue + cacheBlock when the data can't be read or is from a newer version) are unchanged. */
/* Data is linked to accounts: each account signed in on this device has its own copy (pc-cache-u-<uid>), and data
     made without an account lives in pc-cache-v1 (the guest copy). Only the copy of whoever is signed in is loaded.
     Switching (sign in, sign out, account deleted) writes nothing more (storeHold) and reloads the app. One-time
     upgrade: a device that was signed in before copies were per account hands its data to that account. */
function storeKey() {
  var a = null,
    up = false;
  try {
    a = JSON.parse(localStorage.getItem("pc-account") || "null");
    if (!localStorage.getItem("pc-slots")) {
      localStorage.setItem("pc-slots", "1");
      up = true;
    }
  } catch (x) {}
  if (!a || !a.uid) return "pc-cache-v1";
  var k = "pc-cache-u-" + a.uid;
  try {
    if (up && localStorage.getItem(k) === null && localStorage.getItem("pc-cache-v1") !== null) {
      localStorage.setItem(k, localStorage.getItem("pc-cache-v1"));
      localStorage.removeItem("pc-cache-v1");
    }
  } catch (x) {}
  return k;
}
/* The signed-in account on this device (pc-account), readable before the sync code (sync/54-account.js) has run. */
function cloudAccount() {
  try {
    return JSON.parse(localStorage.getItem("pc-account") || "null");
  } catch (x) {
    return null;
  }
}
function cache() {
  store.flush();
}
function flush() {
  cache();
}
