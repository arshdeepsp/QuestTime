/* ---- account pages: sign in, create account, reset password, change password, delete account ----
     #authPage is a full-screen page (like How it works) with one view at a time (auView: login | signup | reset | change |
     delete). On launch, when nobody is signed in on this device and "Use without account" hasn't been chosen (pc-noacct),
     it opens as the gate: no Close, and "Use without account" at the bottom (remembered; Settings › Account can sign in
     later). Signing out, deleting the account, or the session ending elsewhere opens the gate again. A signed-in session
     never expires on its own: fb.js persists it in IndexedDB. All calls go through cloud (sync/54-account.js); errors read via authErr. */
import { G } from "../core/g.js";
import { cloudAccount } from "../core/storage.js";
import { esc } from "../core/util.js";
import { maybeReviewTodos } from "../quests/50b-todo-review.js";
import { renderSettings } from "../settings/10-settings.js";
import { cloud } from "./54-account.js";
import { welcomeCheck } from "../ui/24-help.js";
import { setSync } from "../ui/feedback.js";

export var NOACCT_KEY, auPg, auView, auGate, auNote, auEm, auArm, auBusy, AU_T;

/* "Use without account" holds for this launch only (sessionStorage), so every launch while signed out asks again. */
export function noAcct() {
  try {
    return !!sessionStorage.getItem(NOACCT_KEY);
  } catch (x) {
    return false;
  }
}
export function setNoAcct(on) {
  try {
    if (on) sessionStorage.setItem(NOACCT_KEY, "1");
    else sessionStorage.removeItem(NOACCT_KEY);
    localStorage.removeItem(NOACCT_KEY);
  } catch (x) {}
}
export function authOpen() {
  return !!auPg && !auPg.hidden;
}
export function authErr(e) {
  var c = String((e && e.code) || "");
  if (/invalid-credential|wrong-password|user-not-found|invalid-login/.test(c))
    return auView === "login" ? "Wrong email or password." : "That password isn’t right.";
  if (/email-already-in-use/.test(c)) return "That email already has an account. Sign in instead.";
  if (/weak-password/.test(c)) return "Use at least 6 characters.";
  if (/invalid-email|missing-email/.test(c)) return "That doesn’t look like an email.";
  if (/too-many-requests/.test(c)) return "Too many tries. Wait a few minutes and try again.";
  if (/network/.test(c)) return "No connection. Try again when you’re online.";
  if (/user-disabled/.test(c)) return "This account has been disabled.";
  if (/requires-recent-login/.test(c)) return "Please sign in again first.";
  return String((e && e.message) || e || "Something went wrong.");
}
export function auField(id, label, type, ac, val) {
  var pw = type === "password";
  return (
    '<label for="' +
    id +
    '">' +
    label +
    "</label>" +
    (pw ? '<div class="au-pw">' : "") +
    '<input id="' +
    id +
    '" type="' +
    type +
    '" autocomplete="' +
    ac +
    '"' +
    (type === "email" ? ' inputmode="email" autocapitalize="off" spellcheck="false"' : "") +
    (val ? ' value="' + esc(val) + '"' : "") +
    ">" +
    (pw
      ? '<button type="button" class="stone mini au-eye" data-eye="' +
        id +
        '" aria-label="Show password" aria-pressed="false">Show</button></div>'
      : "")
  );
}
export function openAuth(view, gate, note) {
  if (auPg && auPg.hidden) auEm = "";
  auView = view || "login";
  auGate = !!gate;
  auNote = note || "";
  auArm = 0;
  auBusy = false;
  if (!auPg) {
    auPg = document.createElement("div");
    auPg.id = "authPage";
    auPg.className = "aupage";
    auPg.setAttribute("role", "dialog");
    auPg.setAttribute("aria-modal", "true");
    auPg.setAttribute("aria-labelledby", "auTitle");
    document.body.appendChild(auPg);
  }
  auPg.hidden = false;
  document.body.classList.add("au-open");
  if (!auEm) {
    var a = cloudAccount();
    if (a) auEm = a.email;
  }
  authDraw();
}
export function closeAuth() {
  if (!auPg) return;
  var was = auGate;
  auPg.hidden = true;
  auGate = false;
  document.body.classList.remove("au-open");
  if (was && typeof welcomeCheck === "function") welcomeCheck(0);
  if (typeof renderSettings === "function" && typeof G.setTab !== "undefined" && G.setTab === "account")
    renderSettings();
  maybeReviewTodos();
}
export function authDraw() {
  var v = auView,
    ac = cloudAccount(),
    body = "",
    links = "";
  if (v === "login") {
    body =
      auField("auEmail", "Email", "email", "email", auEm) + auField("auPw", "Password", "password", "current-password");
    links =
      '<button type="button" class="lnk" data-av="reset">Forgot password?</button><button type="button" class="lnk" data-av="signup">Create an account</button>';
  } else if (v === "signup") {
    body =
      auField("auEmail", "Email", "email", "email", auEm) +
      auField("auPw", "Password", "password", "new-password") +
      auField("auPw2", "Confirm password", "password", "new-password") +
      '<p class="help">At least 6 characters. We’ll email you a link to verify your address.</p>';
    links = '<button type="button" class="lnk" data-av="login">I already have an account</button>';
  } else if (v === "reset") {
    body =
      auField("auEmail", "Email", "email", "email", auEm) +
      '<p class="help">We’ll email you a link to set a new password.</p>';
    links = '<button type="button" class="lnk" data-av="login">Back to sign in</button>';
  } else if (v === "change") {
    body =
      '<p class="help">Signed in as <b>' +
      esc(ac ? ac.email : "") +
      "</b>.</p>" +
      auField("auPw0", "Current password", "password", "current-password") +
      auField("auPw", "New password", "password", "new-password") +
      auField("auPw2", "Confirm new password", "password", "new-password");
  } else if (v === "delete") {
    body =
      '<p class="help au-warn">This deletes <b>' +
      esc(ac ? ac.email : "") +
      "</b> and all its data, in the cloud and on every device, including this one. It can’t be undone. Want a copy? Export a backup first (Settings › Your data).</p>" +
      auField("auPw0", "Password", "password", "current-password");
  }
  var go =
    v === "delete"
      ? auArm && Date.now() - auArm < 4000
        ? "Tap again to delete"
        : "Delete account"
      : v === "reset"
        ? "Send reset link"
        : AU_T[v];
  auPg.innerHTML =
    '<div class="au-hd"><h2 id="auTitle">' +
    AU_T[v] +
    "</h2>" +
    (auGate ? "" : '<button type="button" class="stone save" id="auClose">Close</button>') +
    "</div>" +
    '<div class="au-scroll"><form class="au-box" id="auForm" novalidate>' +
    (auGate && v === "login"
      ? '<p class="au-lead">Sign in to sync your quests, days and subjects across devices.</p>'
      : "") +
    (auNote ? '<p class="au-note" id="auNote">' + esc(auNote) + "</p>" : "") +
    body +
    '<p class="cmsg2" id="auMsg" role="status" aria-live="polite"></p><button type="submit" class="stone ' +
    (v === "delete" ? "del" : "save") +
    ' au-go" id="auGo">' +
    go +
    "</button>" +
    (links ? '<div class="au-links">' + links + "</div>" : "") +
    "</form>" +
    (auGate
      ? '<div class="au-skip"><button type="button" class="stone" id="auSkip">Use without account</button><p class="help">Your data stays on this device. You’ll be asked again next time you open the app.</p></div>'
      : "") +
    "</div>";
  var cl = auPg.querySelector("#auClose");
  if (cl) cl.addEventListener("click", closeAuth);
  var sk = auPg.querySelector("#auSkip");
  if (sk)
    sk.addEventListener("click", function () {
      setNoAcct(true);
      closeAuth();
    });
  auPg.querySelectorAll("[data-av]").forEach(function (b) {
    b.addEventListener("click", function () {
      keepEm();
      openAuth(b.getAttribute("data-av"), auGate);
    });
  });
  auPg.querySelectorAll("[data-eye]").forEach(function (b) {
    b.addEventListener("click", function () {
      var i = auPg.querySelector("#" + b.getAttribute("data-eye")),
        show = i.type === "password";
      i.type = show ? "text" : "password";
      b.textContent = show ? "Hide" : "Show";
      b.setAttribute("aria-pressed", show);
      b.setAttribute("aria-label", show ? "Hide password" : "Show password");
      i.focus();
    });
  });
  auPg.querySelector("#auForm").addEventListener("submit", function (ev) {
    ev.preventDefault();
    authGo();
  });
  var f0 = auPg.querySelector("input:not([value])") || auPg.querySelector("input");
  if (f0 && !("ontouchstart" in window))
    setTimeout(function () {
      try {
        f0.focus();
      } catch (x) {}
    }, 0);
}
export function keepEm() {
  var e = auPg && auPg.querySelector("#auEmail");
  if (e) auEm = e.value.trim();
}
export function auVal(id) {
  var x = auPg.querySelector("#" + id);
  return x ? x.value : "";
}
export function auSay(t, bad) {
  var m = auPg.querySelector("#auMsg");
  if (m) {
    m.textContent = t;
    m.className = "cmsg2" + (bad ? " bad" : " ok");
  }
}
export function authGo() {
  if (auBusy) return;
  var v = auView,
    em = auVal("auEmail").trim(),
    pw = auVal("auPw"),
    pw2 = auVal("auPw2"),
    pw0 = auVal("auPw0");
  keepEm();
  function busy(t) {
    auBusy = true;
    auSay(t);
    var b = auPg.querySelector("#auGo");
    if (b) b.disabled = true;
  }
  function fail(e) {
    auBusy = false;
    var b = auPg.querySelector("#auGo");
    if (b) b.disabled = false;
    auSay(authErr(e), true);
  }
  var mailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em);
  if (v === "login") {
    if (!mailOk) {
      auSay("That doesn’t look like an email.", true);
      return;
    }
    if (!pw) {
      auSay("Type your password.", true);
      return;
    }
    busy("Signing in…");
    cloud.signIn(em, pw).then(function () {
      setNoAcct(false);
      auSay("Signed in. Loading your data…");
    }, fail);
  } else if (v === "signup") {
    if (!mailOk) {
      auSay("That doesn’t look like an email.", true);
      return;
    }
    if (pw.length < 6) {
      auSay("Use at least 6 characters.", true);
      return;
    }
    if (pw !== pw2) {
      auSay("The passwords don’t match.", true);
      return;
    }
    busy("Creating your account…");
    cloud.signUp(em, pw).then(function () {
      setNoAcct(false);
      auSay("Account created. Loading…");
    }, fail);
  } else if (v === "reset") {
    if (!mailOk) {
      auSay("That doesn’t look like an email.", true);
      return;
    }
    var ok = function () {
      auBusy = false;
      var b = auPg.querySelector("#auGo");
      if (b) b.disabled = false;
      auSay("If there’s an account for " + em + ", a reset link is on its way. Check your spam folder too.");
    };
    busy("Sending…");
    cloud.reset(em).then(ok, function (e) {
      if (/user-not-found/.test(String(e && e.code))) ok();
      else fail(e);
    });
  } else if (v === "change") {
    if (!pw0) {
      auSay("Type your current password.", true);
      return;
    }
    if (pw.length < 6) {
      auSay("Use at least 6 characters.", true);
      return;
    }
    if (pw !== pw2) {
      auSay("The new passwords don’t match.", true);
      return;
    }
    if (pw === pw0) {
      auSay("That’s the same as your current password.", true);
      return;
    }
    busy("Changing your password…");
    cloud.changePw(pw0, pw).then(function () {
      closeAuth();
      setSync("Password changed.");
    }, fail);
  } else if (v === "delete") {
    if (!pw0) {
      auSay("Type your password to confirm.", true);
      return;
    }
    if (!(auArm && Date.now() - auArm < 4000)) {
      auArm = Date.now();
      var b = auPg.querySelector("#auGo");
      if (b) b.textContent = "Tap again to delete";
      setTimeout(function () {
        if (authOpen() && auView === "delete" && auArm && Date.now() - auArm >= 4000) {
          auArm = 0;
          var b2 = auPg.querySelector("#auGo");
          if (b2 && !auBusy) b2.textContent = "Delete account";
        }
      }, 4100);
      return;
    }
    auArm = 0;
    busy("Deleting your account…");
    cloud.deleteAccount(pw0).then(function () {
      auSay("Deleted.");
    }, fail);
  }
}

/* Runs once at startup, in file-number order (main.js). */
export function init() {
  G.acOutArm = 0;
  G.eraseArm = 0;
  G.eraseForce = false;
  NOACCT_KEY = "pc-noacct";
  auPg = null;
  auView = "login";
  auGate = false;
  auNote = "";
  auEm = "";
  auArm = 0;
  auBusy = false;
  AU_T = {
    login: "Sign in",
    signup: "Create account",
    reset: "Reset password",
    change: "Change password",
    delete: "Delete account",
  };
  /* Launch: a note left by a sign-in/out reload (pc-authnote), then the gate when nobody is signed in. */
  (function () {
    var note = "";
    try {
      localStorage.removeItem(NOACCT_KEY);
      note = sessionStorage.getItem("pc-authnote") || "";
      sessionStorage.removeItem("pc-authnote");
    } catch (x) {}
    if (!cloudAccount() && !noAcct()) openAuth("login", true, note);
    else if (note) setSync(note);
  })();
}
