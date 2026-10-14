/* ---- notes ----
     A quick-notes page (Settings › Add-ons › Notes page, cfg.addNotes; the title bar's #notesBtn, view "notes", hash
     #notes), after Google Keep: a "Take a note…" bar, a search box, pinned notes above the rest, cards in a masonry grid
     with a colour each, and an editor sheet (the generic modal) that saves as you type. Nothing is permanent: a note
     clears itself NOTE_DAYS (30) days after its last edit (the card says how long it has left).
     Data: S.notes (its own store doc, "notes", synced as users/<uid>/data/notes like refl) = {id: {t, b, c, u, col?, pin?}}
     — title, body, created, last edit (ms), colour index into NOTE_COLS, pinned. A deleted note leaves a tombstone
     {x: ms} (no content) so the deletion wins over another device's copy on merge (merge3 unions map keys); a note edited
     after the deletion (u > x) comes back. notesPrune drops expired notes and old tombstones in one pass over the map,
     at startup (deferred past init) and whenever the page draws, so nothing runs on a timer.
     Speed: typing saves on a NOTE_SAVE_MS debounce and on close, each save one replace of the notes map; a save that
     only touched the notes doc doesn't re-render the app (ui/04-render.js onStoreChange), the grid is one innerHTML
     string, search redraws only the grid, and the sorted list is cached by the map's identity. */
import { G } from "../core/g.js";
import { S, store } from "../core/00-state.js";
import { cache } from "../core/storage.js";
import { esc } from "../core/util.js";
import { closeG, openG } from "../ui/18-modal.js";
import { haptic } from "../ui/45-gestures.js";
import { curView, go } from "../ui/44-navigation.js";
import { setSync } from "../ui/feedback.js";

export var NOTE_DAYS, NOTE_SAVE_MS, NOTE_T_MAX, NOTE_B_MAX, NOTE_COLS, ntQ, ntList, ntListSrc, ntEd, ntArm;

export function noteLive(n) {
  return !!n && typeof n === "object" && (!n.x || (n.u || 0) > n.x);
}
export function noteId() {
  return "n" + Date.now().toString(36) + Math.floor(Math.random() * 1e4).toString(36);
}
/* Live notes, pinned first, newest edit first. Cached until S.notes is replaced. */
export function noteList() {
  if (ntListSrc === S.notes && ntList) return ntList;
  var m = S.notes || {};
  ntList = Object.keys(m)
    .filter(function (id) {
      return noteLive(m[id]);
    })
    .map(function (id) {
      return Object.assign({ id: id }, m[id]);
    })
    .sort(function (a, b) {
      return (b.pin ? 1 : 0) - (a.pin ? 1 : 0) || (b.u || 0) - (a.u || 0);
    });
  ntListSrc = S.notes;
  return ntList;
}
/* Days before a note clears (ceil; 0 = today). */
export function noteLeft(n, now) {
  return Math.max(0, Math.ceil(((n.u || 0) + NOTE_DAYS * 86400000 - (now || Date.now())) / 86400000));
}
/* Drop notes NOTE_DAYS past their last edit and tombstones that old (every device has seen them by then). One pass;
     the map is replaced only when something went. Returns how many notes cleared. */
export function notesPrune(now) {
  var m = S.notes || {},
    ks = Object.keys(m),
    lim = (now || Date.now()) - NOTE_DAYS * 86400000,
    out = {},
    gone = 0,
    drop = false;
  for (var i = 0; i < ks.length; i++) {
    var n = m[ks[i]];
    if (!n || typeof n !== "object") {
      drop = true;
      continue;
    }
    var live = noteLive(n),
      t = live ? n.u || 0 : n.x || 0;
    if (t <= lim) {
      drop = true;
      if (live) gone++;
      continue;
    }
    out[ks[i]] = n;
  }
  if (drop) {
    S.notes = out;
    cache();
  }
  return gone;
}
export function noteSave(id, patch) {
  var m = S.notes || {},
    old = noteLive(m[id]) ? m[id] : { c: Date.now() },
    n = Object.assign({}, old, patch, { u: Date.now() });
  delete n.x;
  if (!n.col) delete n.col;
  if (!n.pin) delete n.pin;
  var nm = Object.assign({}, m);
  nm[id] = n;
  S.notes = nm;
  cache();
  return n;
}
export function noteDelete(id) {
  var m = S.notes || {};
  if (!m[id]) return;
  var nm = Object.assign({}, m);
  nm[id] = { x: Date.now() };
  S.notes = nm;
  cache();
}
export function ago(t, now) {
  var d = Math.max(0, now - t);
  if (d < 60000) return "just now";
  if (d < 3600000) return Math.floor(d / 60000) + "m ago";
  if (d < 86400000) return Math.floor(d / 3600000) + "h ago";
  var days = Math.floor(d / 86400000);
  return days === 1 ? "yesterday" : days + "d ago";
}
export function leftText(n, now) {
  var L = noteLeft(n, now);
  return L === 0 ? "clears today" : L === 1 ? "1 day left" : L + " days left";
}
export function card(n, now) {
  var t = (n.t || "").trim(),
    b = (n.b || "").trim();
  return (
    '<button type="button" class="nt-card c' +
    (n.col | 0) +
    (n.pin ? " pinned" : "") +
    '" data-nt="' +
    n.id +
    '" aria-label="' +
    esc(t || b.slice(0, 40) || "Empty note") +
    '">' +
    (n.pin ? '<i class="nt-pin" aria-hidden="true"></i>' : "") +
    (t ? '<b class="nt-t">' + esc(t) + "</b>" : "") +
    (b ? '<div class="nt-b">' + esc(b) + "</div>" : "") +
    '<div class="nt-f">' +
    ago(n.u || 0, now) +
    " · " +
    leftText(n, now) +
    "</div></button>"
  );
}
export function match(n, q) {
  return !q || ((n.t || "") + "\n" + (n.b || "")).toLowerCase().indexOf(q) >= 0;
}
/* The grid alone (search and new-note bar stay, so typing in the search box keeps focus). */
export function ntDraw() {
  var g = document.getElementById("ntGrid");
  if (!g) return;
  var now = Date.now(),
    q = (ntQ || "").trim().toLowerCase(),
    L = noteList().filter(function (n) {
      return match(n, q);
    }),
    P = L.filter(function (n) {
      return n.pin;
    }),
    O = L.filter(function (n) {
      return !n.pin;
    }),
    h = "";
  if (!L.length)
    h +=
      '<p class="nt-empty help">' +
      (q
        ? "No note matches “" + esc(ntQ.trim()) + "”."
        : noteList().length
          ? ""
          : "Nothing here yet. Notes clear themselves " + NOTE_DAYS + " days after their last edit.") +
      "</p>";
  if (P.length) {
    h +=
      '<h3 class="nt-h">Pinned</h3><div class="nt-grid">' +
      P.map(function (n) {
        return card(n, now);
      }).join("") +
      "</div>";
    if (O.length) h += '<h3 class="nt-h">Others</h3>';
  }
  if (O.length)
    h +=
      '<div class="nt-grid">' +
      O.map(function (n) {
        return card(n, now);
      }).join("") +
      "</div>";
  g.innerHTML = h;
}
export function renderNotes() {
  var body = document.getElementById("notesBody");
  if (!body) return;
  notesPrune();
  if (!document.getElementById("ntGrid")) {
    body.innerHTML =
      '<div class="nt-bar"><button type="button" class="nt-new" id="ntNew">Take a note…</button>' +
      '<input type="search" id="ntQ" class="nt-q" placeholder="Search" aria-label="Search notes" autocomplete="off"></div>' +
      '<div id="ntGrid"></div>' +
      '<p class="help nt-hint">Notes clear themselves ' +
      NOTE_DAYS +
      " days after their last edit.</p>";
    document.getElementById("ntQ").value = ntQ || "";
  }
  ntDraw();
}
export function edMeta() {
  var m = document.getElementById("ntMeta");
  if (!m || !ntEd) return;
  var n = (S.notes || {})[ntEd.id];
  m.textContent =
    n && noteLive(n) ? "Edited " + ago(n.u, Date.now()) + " · " + leftText(n, Date.now()) : "Not saved yet";
}
/* Save what's typed: now, or NOTE_SAVE_MS after the last keystroke. An empty new note is never stored. */
export function ntFlush() {
  if (!ntEd) return;
  clearTimeout(ntEd.t);
  ntEd.t = 0;
  var tI = document.getElementById("ntT"),
    bI = document.getElementById("ntB");
  if (!tI || !bI) return;
  var t = tI.value.slice(0, NOTE_T_MAX),
    b = bI.value.slice(0, NOTE_B_MAX),
    n = (S.notes || {})[ntEd.id],
    had = noteLive(n);
  if (!t.trim() && !b.trim()) {
    if (had) noteDelete(ntEd.id);
    return;
  }
  if (had && n.t === t && n.b === b) return;
  noteSave(ntEd.id, { t: t, b: b });
  edMeta();
}
export function edQueue() {
  if (!ntEd) return;
  clearTimeout(ntEd.t);
  ntEd.t = setTimeout(ntFlush, NOTE_SAVE_MS);
}
export function edCols(col) {
  var w = document.getElementById("ntCols");
  if (!w) return;
  w.querySelectorAll("[data-col]").forEach(function (b) {
    b.setAttribute("aria-checked", String((b.getAttribute("data-col") | 0) === col));
  });
  var ed = document.getElementById("ntEd");
  if (ed) ed.className = "nt-ed ed c" + col;
}
export function openNote(id) {
  var isNew = !id,
    n = (!isNew && noteLive((S.notes || {})[id]) && S.notes[id]) || null;
  if (!isNew && !n) {
    setSync("That note is gone.");
    return;
  }
  ntEd = { id: id || noteId(), t: 0, isNew: isNew };
  ntArm = 0;
  var col = n ? n.col | 0 : 0,
    pin = !!(n && n.pin);
  openG(
    isNew ? "New note" : "Note",
    function (bd) {
      bd.innerHTML =
        '<div class="nt-ed ed c' +
        col +
        '" id="ntEd"><input id="ntT" placeholder="Title" maxlength="' +
        NOTE_T_MAX +
        '" aria-label="Title"><textarea id="ntB" placeholder="Note" rows="7" maxlength="' +
        NOTE_B_MAX +
        '" aria-label="Note"></textarea>' +
        '<div class="nt-cols" id="ntCols" role="radiogroup" aria-label="Colour">' +
        NOTE_COLS.map(function (c, i) {
          return (
            '<button type="button" class="nt-c c' +
            i +
            '" role="radio" data-col="' +
            i +
            '" aria-checked="' +
            (i === col) +
            '" aria-label="' +
            c +
            '"></button>'
          );
        }).join("") +
        '</div><div class="edrow end nt-acts"><span class="help" id="ntMeta"></span><button type="button" class="stone" id="ntPin" aria-pressed="' +
        pin +
        '">' +
        (pin ? "Unpin" : "Pin") +
        '</button><button type="button" class="stone del" id="ntDel"' +
        (isNew ? " hidden" : "") +
        ">Delete</button></div></div>";
      document.getElementById("ntT").value = n ? n.t || "" : "";
      document.getElementById("ntB").value = n ? n.b || "" : "";
      edMeta();
      bd.addEventListener("input", function (ev) {
        if (ev.target.id === "ntT" || ev.target.id === "ntB") edQueue();
      });
      bd.addEventListener("click", function (ev) {
        var c = ev.target.closest("[data-col]");
        if (c) {
          var v = c.getAttribute("data-col") | 0;
          edCols(v);
          ntFlush();
          if (noteLive((S.notes || {})[ntEd.id])) noteSave(ntEd.id, { col: v });
          else ntEd.col = v;
          haptic("light");
          return;
        }
        if (ev.target.id === "ntPin") {
          ntFlush();
          var cur = (S.notes || {})[ntEd.id],
            on = !(cur && cur.pin);
          if (noteLive(cur)) noteSave(ntEd.id, { pin: on });
          else ntEd.pin = on;
          ev.target.textContent = on ? "Unpin" : "Pin";
          ev.target.setAttribute("aria-pressed", String(on));
          haptic("light");
          return;
        }
        if (ev.target.id === "ntDel") {
          if (!ntArm || Date.now() - ntArm > 4000) {
            ntArm = Date.now();
            ev.target.textContent = "Delete?";
            haptic("light");
            return;
          }
          clearTimeout(ntEd.t);
          noteDelete(ntEd.id);
          ntEd = null;
          closeG();
          setSync("Note deleted.");
        }
      });
      var f = document.getElementById(isNew ? "ntT" : "ntB");
      if (f) f.focus();
    },
    function () {
      if (!ntEd) {
        renderNotes();
        return;
      }
      ntFlush();
      /* Colour or pin chosen before the first keystroke land once there's a note to put them on. */
      var cur = (S.notes || {})[ntEd.id];
      if (noteLive(cur) && (ntEd.col || ntEd.pin)) noteSave(ntEd.id, { col: ntEd.col | 0, pin: !!ntEd.pin });
      ntEd = null;
      renderNotes();
    },
  );
  /* Blur (switching apps, the keyboard going) saves too. */
  var ta = document.getElementById("ntB"),
    ti = document.getElementById("ntT");
  if (ta) ta.addEventListener("blur", ntFlush);
  if (ti) ti.addEventListener("blur", ntFlush);
}
/* Runs once at startup, in file-number order (main.js). */
export function init() {
  NOTE_DAYS = 30;
  NOTE_SAVE_MS = 600;
  NOTE_T_MAX = 120;
  NOTE_B_MAX = 10000;
  NOTE_COLS = ["Stone", "Sun", "Leaf", "Sky", "Rose", "Clay"];
  ntQ = "";
  ntEd = null;
  ntArm = 0;
  var nb = document.getElementById("notesBtn");
  if (nb)
    nb.addEventListener("click", function () {
      go("notes");
    });
  var body = document.getElementById("notesBody");
  if (body) {
    body.addEventListener("click", function (ev) {
      var c = ev.target.closest("[data-nt]");
      if (c) {
        openNote(c.getAttribute("data-nt"));
        return;
      }
      if (ev.target.closest("#ntNew")) openNote(null);
    });
    var qt = 0;
    body.addEventListener("input", function (ev) {
      if (ev.target.id !== "ntQ") return;
      ntQ = ev.target.value;
      clearTimeout(qt);
      qt = setTimeout(ntDraw, 120);
    });
  }
  /* Expired notes go on launch, after every init has run (the save emits to subscribers). */
  setTimeout(function () {
    notesPrune();
  }, 0);
  /* A notes doc arriving from another device (or a save of our own) redraws the page if it's open and no note is being edited. */
  store.subscribe(function (ids) {
    if (ids.indexOf("notes") >= 0 && curView === "notes" && !ntEd) renderNotes();
  });
}
