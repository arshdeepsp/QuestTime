/* ---- startup: first render, the route, the welcome, and the day-lock timers ---- */
/* Repair settings saved with a quest twice (see dedupeQuests): saved as an edit, so a signed-in device pushes the fix. */
(function () {
  if (!S.cfg || cacheBlock) return;
  var c0 = clone(S.cfg),
    n = dedupeQuests(c0);
  if (!n) return;
  saveCfg(c0);
  qSig = "";
  setSync("Removed " + n + " duplicated quest" + (n === 1 ? "" : "s") + ".");
})();
elapsed();
render();
calmSync();
go((location.hash || "#today").slice(1), true);
setTimeout(function () {
  try {
    var logged = Object.keys(S.days).filter(function (k) {
      return hasEntry(S.days[k]);
    }).length;
    if (logged < 3) return;
    var last = +localStorage.getItem("pc-lastExport") || 0,
      snooze = +localStorage.getItem("pc-backupSnooze") || 0,
      now = Date.now();
    if (now - last < 7 * 864e5 || now < snooze) return;
    var bn = document.getElementById("bkNudge");
    bn.hidden = false;
    bn.querySelector("#bkNow").addEventListener("click", function () {
      document.getElementById("expBtn").click();
      bn.hidden = true;
    });
    bn.querySelector("#bkLater").addEventListener("click", function () {
      localStorage.setItem("pc-backupSnooze", String(now + 3 * 864e5));
      bn.hidden = true;
    });
  } catch (x) {}
}, 4000);
welcomeCheck(300);
var lastDay = todayKey();
if (cacheBlock)
  setTimeout(function () {
    openG("Saved data not loaded", function (b) {
      b.innerHTML =
        '<p class="mhead bad">' +
        (cacheBlock === "newer"
          ? "Your data is from a newer version of the app."
          : "Your saved data couldn\u2019t be read.") +
        '</p><p class="help">It\u2019s untouched, and a copy is kept on this device. Nothing will be saved over it until you ' +
        (cacheBlock === "newer" ? "update the app or " : "") +
        'import a backup (Settings \u203a Your data).</p><div class="edrow end"><button type="button" class="stone" id="cbOk">Got it</button></div>';
      b.querySelector("#cbOk").addEventListener("click", closeG);
    });
  }, 600);
setInterval(elapsed, 5000);
/* "Locks in 1h 20m" only in the last LOCK_SOON minutes before the day locks (it's noise the rest of the day); "Locked" on a past day. */
var LOCK_SOON = 120;
lockIn();
setInterval(function () {
  lockIn();
  if (todayKey() !== lastDay) {
    lastDay = todayKey();
    flush();
    render();
  }
}, 15000);
