/* ---- main navigation, and the native app shell (downloads, back button) ---- */
var VIEWS = ["today", "subjects", "rules", "achievements", "trends", "settings"],
  curView = "today";
(function () {
  var sb = document.getElementById("settingsBody"),
    sp = document.getElementById("setPage");
  if (sb && sp) sp.appendChild(sb);
})();
function go(v, noHash) {
  if ((v === "grove" || v === "achievements") && rewardsOff()) v = "today";
  if (v === "grove") {
    openGrove(false);
    return;
  }
  if (VIEWS.indexOf(v) < 0) v = "today";
  var prevView = curView;
  curView = v;
  document.querySelectorAll("[data-view]").forEach(function (el) {
    el.hidden = el.getAttribute("data-view") !== v;
  });
  document.querySelectorAll("#mainnav [data-go]").forEach(function (b) {
    var on = b.getAttribute("data-go") === v;
    b.classList.toggle("on", on);
    if (on) b.setAttribute("aria-current", "page");
    else b.removeAttribute("aria-current");
  });
  document.body.setAttribute("data-cur", v);
  var vt = document.getElementById("viewTitle");
  if (vt)
    vt.textContent =
      {
        today: "Today",
        subjects: "Subjects",
        rules: "Rules",
        achievements: "Badges",
        trends: "Trends",
        settings: "Settings",
      }[v] || "";
  var sb = document.getElementById("setBtn");
  if (sb) sb.classList.toggle("on", v === "settings");
  var tb = document.getElementById("trendsBtn");
  if (tb) tb.classList.toggle("on", v === "trends");
  if (v === "settings") {
    if (prevView !== "settings") setTab = null;
    renderSettings();
  }
  if (v === "subjects") renderSubjects();
  if (v === "today" || v === "achievements") render();
  if (v === "trends") renderTrends();

  if (!noHash && location.hash !== "#" + v) {
    try {
      history.pushState(null, "", "#" + v);
    } catch (x) {
      location.hash = v;
    }
  }
  window.scrollTo(0, 0);
}
document.querySelectorAll("#mainnav [data-go]").forEach(function (b) {
  b.addEventListener("click", function () {
    go(b.getAttribute("data-go"));
  });
});
window.addEventListener("popstate", function () {
  go((location.hash || "#today").slice(1), true);
});
window.addEventListener("hashchange", function () {
  go((location.hash || "#today").slice(1), true);
});
if (nativeApp()) {
  var FS = capPlugin("Filesystem"),
    SH = capPlugin("Share");
  if (FS && SH)
    dl = {
      save: function (o) {
        return toB64(o.data)
          .then(function (b64) {
            return FS.writeFile({ path: o.filename, data: b64, directory: "CACHE" });
          })
          .then(function (r) {
            return SH.share({ title: o.filename, files: [r.uri] });
          })
          .catch(function (e) {
            var m = String((e && e.message) || e || "");
            if (/cancel/i.test(m)) throw { code: "declined" };
            throw e;
          });
      },
    };
}
(function () {
  var AP = capPlugin("App");
  if (!AP || !AP.addListener) return;
  AP.addListener("backButton", function () {
    if (typeof authOpen === "function" && authOpen()) {
      if (!auGate) closeAuth();
      else if (AP.minimizeApp) AP.minimizeApp();
      return;
    }
    var qm = document.querySelector(".qmenu");
    if (qm) {
      closeQMenu();
      return;
    }
    if (!document.getElementById("gModal").hidden) {
      closeG();
      return;
    }
    if (!document.getElementById("nqModal").hidden) {
      var nb = document.querySelector("#nqModal .drawer-h .stone");
      if (nb) nb.click();
      return;
    }
    if (typeof hpOpen === "function" && hpOpen()) {
      closeHelp();
      return;
    }
    if (typeof schOpen === "function" && schOpen()) {
      closeSchedule();
      return;
    }
    if (groveOpen) {
      closeGrove();
      return;
    }
    if (S.sprint && !spEl.hidden) {
      spHide();
      return;
    }
    if (!document.getElementById("mgrSheet").hidden) {
      closeMgr();
      return;
    }
    if (curView === "settings" && setTab) {
      setTab = null;
      renderSettings();
      return;
    }
    if (curView !== "today") {
      go("today");
      return;
    }
    if (AP.minimizeApp) AP.minimizeApp();
    else if (AP.exitApp) AP.exitApp();
  });
})();
