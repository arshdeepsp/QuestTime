/* ---- main navigation, and the native app shell (downloads, back button) ---- */
import { G } from "../core/g.js";
import { S } from "../core/00-state.js";
import { cfg } from "../core/config.js";
import { capPlugin, nativeApp, toB64 } from "../core/native.js";
import { closeGrove, openGrove } from "../progress/42-grove-sky.js";
import { renderTrends } from "../progress/trends.js";
import { closeQMenu } from "../quests/11-row-menu.js";
import { closeMgr } from "../quests/38-quest-editor.js";
import { rewardsOff } from "../rules/modes.js";
import { closeSchedule, schOpen } from "../schedule/page.js";
import { renderSettings } from "../settings/10-settings.js";
import { renderNotes } from "../notes/30-notes.js";
import { renderSubjects } from "../subjects/32-subjects.js";
import { auGate, authOpen, closeAuth } from "../sync/55-auth-pages.js";
import { spEl, spHide } from "../timer/43-sprint.js";
import { closePomo, pmOpen } from "../timer/43b-pomodoro.js";
import { render } from "./04-render.js";
import { closeG } from "./18-modal.js";
import { closeHelp, hpOpen } from "./24-help.js";
import { applyRoute, pageBack } from "./routes.js";

export var VIEWS, curView;

export function go(v, noHash) {
  var v0 = v;
  if ((v === "grove" || v === "achievements") && rewardsOff()) v = "today";
  if (v === "notes" && !cfg().addNotes) v = "today";
  /* A hash naming a view that isn't available (a deep link to a switched-off add-on) is rewritten to where we landed. */
  if (noHash && v !== v0) pageBack("#" + v);
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
        notes: "Notes",
        achievements: "Badges",
        trends: "Trends",
        settings: "Settings",
      }[v] || "";
  var sb = document.getElementById("setBtn");
  if (sb) sb.classList.toggle("on", v === "settings");
  var tb = document.getElementById("trendsBtn");
  if (tb) tb.classList.toggle("on", v === "trends");
  var nb = document.getElementById("notesBtn");
  if (nb) nb.classList.toggle("on", v === "notes");
  if (v === "settings") {
    if (prevView !== "settings") G.setTab = null;
    renderSettings();
  }
  if (v === "subjects") renderSubjects();
  if (v === "today" || v === "achievements") render();
  if (v === "trends") renderTrends();
  if (v === "notes") renderNotes();

  if (!noHash && location.hash !== "#" + v) {
    try {
      history.pushState(null, "", "#" + v);
    } catch (x) {
      location.hash = v;
    }
  }
  window.scrollTo(0, 0);
}

/* Runs once at startup, in file-number order (main.js). */
export function init() {
  VIEWS = ["today", "subjects", "rules", "achievements", "trends", "notes", "settings"];
  curView = "today";
  (function () {
    var sb = document.getElementById("settingsBody"),
      sp = document.getElementById("setPage");
    if (sb && sp) sp.appendChild(sb);
  })();
  document.querySelectorAll("#mainnav [data-go]").forEach(function (b) {
    b.addEventListener("click", function () {
      go(b.getAttribute("data-go"));
    });
  });
  window.addEventListener("popstate", function () {
    applyRoute(location.hash);
  });
  window.addEventListener("hashchange", function () {
    applyRoute(location.hash);
  });
  if (nativeApp()) {
    var FS = capPlugin("Filesystem"),
      SH = capPlugin("Share");
    if (FS && SH)
      G.dl = {
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
      if (pmOpen()) {
        closePomo();
        return;
      }
      if (G.groveOpen) {
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
      if (curView === "settings" && G.setTab) {
        G.setTab = null;
        renderSettings();
        if (/^#settings\//.test(location.hash)) pageBack("#settings");
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
}
