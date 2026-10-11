/* ---- status line, toasts and the locks-soon note ---- */
function setSync(t) {
  var el = document.getElementById("sync");
  el.textContent = t;
  clearTimeout(syncT);
  if (t)
    syncT = setTimeout(function () {
      if (el.textContent === t) el.textContent = "";
    }, 6000);
}
function showToast(a) {
  if (!userActed && Date.now() - bootAt < TOAST_HOLD) {
    toastQ = a;
    return;
  }
  toast.innerHTML =
    '<div class="ach px"><div class="slot">' +
    svg(a.icon) +
    '</div><div><div class="t1">' +
    esc(a.kicker || "Badge earned!") +
    '</div><div class="t2"></div><div class="t3"></div></div></div>';
  toast.querySelector(".t2").textContent = a.title;
  toast.querySelector(".t3").textContent = a.desc || "";
  requestAnimationFrame(function () {
    toast.classList.add("show");
  });
  setTimeout(function () {
    toast.classList.remove("show");
  }, 5000);
}
function lockIn() {
  var el = document.getElementById("lockIn");
  if (ro()) {
    el.textContent = "Locked";
    return;
  }
  var n = new Date(),
    DE = dayEnd(),
    sd = new Date(n.getTime() - DE * 3600000),
    m = new Date(sd.getFullYear(), sd.getMonth(), sd.getDate() + 1, DE) - n,
    h = Math.floor(m / 3600000),
    mm = Math.floor((m % 3600000) / 60000);
  el.textContent = m <= LOCK_SOON * 60000 ? "Locks in " + (h ? h + "h " : "") + mm + "m" : "";
}
