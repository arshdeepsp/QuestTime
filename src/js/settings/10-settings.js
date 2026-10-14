/* ---- settings panel ---- */
import { G } from "../core/g.js";
import { DAYF, DAY_DEF, S, START_KEY, dirty, setStart } from "../core/00-state.js";
import { cfg, saveCfg } from "../core/config.js";
import { add, dayEnd, dayWin, lockHour, parse, todayKey, winErr, wkS } from "../core/days.js";
import { LN, nativeApp } from "../core/native.js";
import { cache, cloudAccount, flush } from "../core/storage.js";
import { clone, esc, fmtD, svg } from "../core/util.js";
import { nf, notifDiag, notifEnable, notifSync, notifTest } from "../notifications/35d-plan.js";
import { idleReset } from "../progress/42-grove-sky.js";
import { PACKS, applyPack, packsHidden } from "../quests/07c-starter-packs.js";
import { WDN, WDS, busiest, capOf, overDays } from "../quests/35b-daily-limit.js";
import { openMgr } from "../quests/38-quest-editor.js";
import { easeInfo } from "../rules/easing.js";
import { curVac, noStreakOn, rewardsOff } from "../rules/modes.js";
import { setVow, vowMax, vowOn, vowRules, vowSet, vowStart } from "../rules/vow.js";
import { activeDefs } from "../rules/quests-on-day.js";
import { busyDaysText } from "../schedule/busy.js";
import { openBusy } from "../schedule/page.js";
import { STYLES, applyStyle, styleCards } from "./27-work-styles.js";
import { cloud } from "../sync/54-account.js";
import { authErr, openAuth } from "../sync/55-auth-pages.js";
import { focusSync } from "../timer/44b-live-notification.js";
import { elapsed, render } from "../ui/04-render.js";
import { applyTheme } from "../ui/08-themes.js";
import { closeG, openG } from "../ui/18-modal.js";
import { QUICK, quickSlots } from "../ui/23-quick-actions.js";
import { openHelp } from "../ui/24-help.js";
import { go } from "../ui/44-navigation.js";
import { pageBack, pageNav } from "../ui/routes.js";
import { haptic } from "../ui/45-gestures.js";
import { applyHide, hideOpts } from "../ui/48-declutter.js";
import { lockIn, setSync } from "../ui/feedback.js";
import { calmSync } from "../ui/look.js";

export var SET_CATS, THEME_NAMES;

/* cloud (sync/54-account.js) runs after this file; during startup renders fall back to the stored account and an "off" state. */
export function cl() {
  return typeof cloud !== "undefined" && cloud
    ? cloud
    : { account: cloudAccount, state: { status: "off", err: "", last: 0 } };
}
export function bind(id, ev, fn) {
  var x = document.getElementById(id);
  if (x) x.addEventListener(ev, fn);
}
/* Streaks and rewards on/off, asymmetric: pausing takes effect today (today becomes a paused day right away), resuming takes effect tomorrow (today during setup), so switching back can never rescue a failing day or earn today's XP. Pausing opens a cfg.noStreak range from today (or reopens one ending today or later, e.g. a pending resume); resuming closes the open range at tomorrow. The switch shows tomorrow's state. */
export function setStreaks(on) {
  var c2 = clone(cfg()),
    T = todayKey(),
    L = (c2.noStreak || []).slice(),
    rs = easeInfo().setup ? T : add(T, 1);
  if (on) {
    L = L.map(function (r) {
      return !r.to || rs < r.to ? (r.from >= rs ? null : Object.assign({}, r, { to: rs })) : r;
    }).filter(Boolean);
    if (rs === T) delete c2.ignore;
  } else if (
    !L.some(function (r) {
      return !r.to;
    })
  ) {
    var j = L.filter(function (r) {
      return r.to && r.to >= T;
    })[0];
    if (j) delete j.to;
    else {
      L.push({ from: T });
      delete c2.ignore;
    }
  }
  if (L.length) c2.noStreak = L;
  else delete c2.noStreak;
  saveCfg(c2);
  G.qSig = "";
  G.nfSig = "";
  render();
  if (typeof renderSettings === "function") renderSettings();
  setSync(
    on
      ? (rewardsOff() ? "Challenge mode from tomorrow." : "Challenge mode.") + " Your streak picks up where it was."
      : "Casual mode: XP and levels, no streak or checkpoints.",
  );
}
export function vowHint() {
  var T = todayKey(),
    n = vowRules().length,
    a = vowOn(T),
    b = vowOn(add(T, 1)),
    st = vowStart();
  if (!n) return "Add rules to the Rulebook first; your first " + vowMax() + " become morning check quests";
  var w = n === 1 ? "your rule" : "your first " + n + " rules";
  if (st && !b) return (a ? "Off tomorrow; back " : "Starts ") + fmtD(st) + ": tick " + w + " to unlock the day";
  if (a && b) return "Tick " + w + " each morning to unlock the day; alarm 15 min after waking";
  if (b) return "Starts tomorrow: tick " + w + " to unlock the day";
  if (a) return "Ends after today";
  return "Tick " + w + " each morning before your quests show. You pick the start day";
}
export function swc(id, on, label, attr) {
  return (
    '<button type="button" class="sw" role="switch" ' +
    (id ? 'id="' + id + '" ' : "") +
    (attr || "") +
    ' aria-checked="' +
    !!on +
    '" aria-label="' +
    esc(label) +
    '"><span></span></button>'
  );
}
export function srow(title, hint, ctrl, cls) {
  return (
    '<div class="srow' +
    (cls ? " " + cls : "") +
    '"><div class="srow-t"><b>' +
    title +
    "</b>" +
    (hint ? "<small>" + hint + "</small>" : "") +
    "</div>" +
    (ctrl ? '<div class="srow-c">' + ctrl + "</div>" : "") +
    "</div>"
  );
}
export function sgroup(title, rows, help) {
  return (
    '<section class="sgroup">' +
    (title
      ? '<h3 class="sgroup-h"><span>' +
        title +
        "</span>" +
        (help
          ? '<button type="button" class="sq" data-help="' +
            help +
            '" aria-label="How ' +
            esc(title) +
            ' works">?</button>'
          : "") +
        "</h3>"
      : "") +
    '<div class="scard">' +
    rows +
    "</div></section>"
  );
}
export function quickOpts() {
  return Object.keys(QUICK).map(function (id) {
    return [id, QUICK[id].name];
  });
}
export function opt(list, cur) {
  return list
    .map(function (o) {
      return (
        '<option value="' + o[0] + '"' + (String(cur) === String(o[0]) ? " selected" : "") + ">" + o[1] + "</option>"
      );
    })
    .join("");
}
export function setSummary(id) {
  var c = cfg(),
    w = dayWin(todayKey()),
    n = nf();
  if (id === "day") {
    var lk = dayEnd();
    return (
      w.wake +
      "–" +
      w.bed +
      " · locks " +
      (lk ? "at " + lk + ":00 am" : "at midnight") +
      (curVac() ? " · vacation set" : "")
    );
  }
  if (id === "quests")
    return (
      ((STYLES[c.style] || {}).name || "No style") +
      " · limit " +
      capOf() +
      " a day" +
      ((c.noStreak || []).some(function (r) {
        return !r.to || todayKey() < r.to;
      })
        ? " · casual"
        : " · challenge")
    );
  if (id === "alerts") return n.on ? "On · check-in " + n.checkinAt : "Off";
  if (id === "look") return (THEME_NAMES[c.theme || ""] || "Auto") + " theme";
  if (id === "sound")
    return (G.sfxOn ? "Sound on" : "Sound off") + " · vibration " + (c.haptics !== false ? "on" : "off");
  if (id === "extras") {
    var on = [c.sparkTools && "Quick-start", c.addShare && "Share week", c.addTrends && "Trends"].filter(Boolean);
    return on.length ? on.join(", ") : "No add-ons";
  }
  if (id === "account") {
    var a = cl().account(),
      st = cl().state;
    if (!a) return "Not signed in \u00b7 this device only";
    return (
      a.email +
      " \u00b7 " +
      (st.status === "error"
        ? "sync problem"
        : st.status === "on"
          ? "synced"
          : st.status === "syncing"
            ? "syncing\u2026"
            : "connecting\u2026")
    );
  }
  if (id === "data") {
    var le = 0;
    try {
      le = +localStorage.getItem("pc-lastExport") || 0;
    } catch (x) {}
    return le
      ? "Last backup " + new Date(le).toLocaleDateString("en-CA", { month: "short", day: "numeric" })
      : "No backup yet";
  }
  return "";
}
export function renderSettings() {
  var el = document.getElementById("settingsBody");
  if (!el) return;
  var c = cfg(),
    T = todayKey(),
    v = curVac(),
    h = "";
  if (!G.setTab) {
    h =
      '<div class="shome">' +
      SET_CATS.map(function (k) {
        return (
          '<button type="button" class="scat" data-st="' +
          k[0] +
          '"><span class="slot">' +
          svg(k[2]) +
          '</span><span class="scat-t"><b>' +
          k[1] +
          "</b><small>" +
          esc(setSummary(k[0])) +
          '</small></span><i class="schev" aria-hidden="true"></i></button>'
        );
      }).join("") +
      '</div><p class="help sfoot">Everything stays on this device. <button type="button" class="lnk" data-help="data">How it works</button></p>';
    el.innerHTML = h;
    el.querySelectorAll("[data-st]").forEach(function (b) {
      b.addEventListener("click", function () {
        G.setTab = b.getAttribute("data-st");
        renderSettings();
        window.scrollTo(0, 0);
        pageNav("#settings/" + G.setTab);
      });
    });
    el.querySelectorAll("[data-help]").forEach(function (b) {
      b.addEventListener("click", function () {
        openHelp(b.getAttribute("data-help"));
      });
    });
    return;
  }
  var cat =
    SET_CATS.filter(function (k) {
      return k[0] === G.setTab;
    })[0] || SET_CATS[0];
  h =
    '<div class="shead"><button type="button" class="stone mini sback" id="setBack" aria-label="Back to all settings">‹ All</button><h2 class="stitle">' +
    cat[1] +
    "</h2></div>";
  if (G.setTab === "day") {
    var dwU = Object.assign({}, DAY_DEF, c.day || {}),
      lk = lockHour(dwU.bed, dwU.wake);
    h += sgroup(
      "Waking hours",
      srow(
        "Wake up",
        "Starts your day and its schedule",
        '<input type="time" id="setWake" value="' + esc(dwU.wake) + '">',
      ) +
        srow(
          "Bedtime",
          "The day locks " + (lk ? "at " + lk + ":00 am" : "at midnight") + ". Change just today in Schedule.",
          '<input type="time" id="setBed" value="' + esc(dwU.bed) + '">',
        ),
      "day",
    );
    h += sgroup(
      "Week",
      srow(
        "Week starts on",
        "Weekly totals, pace, pauses and check-ins follow it",
        '<select id="setWkS" aria-label="Week starts on">' +
          opt(
            [
              [1, "Monday"],
              [0, "Sunday"],
            ],
            c.weekStart === 0 ? 0 : 1,
          ) +
          "</select>",
      ),
    );
    var BZL = (c.busy || []).filter(function (b) {
      return !b.until || b.until >= todayKey();
    });
    h += sgroup(
      "Busy times",
      srow(
        "Lectures, meetings, work",
        BZL.length
          ? BZL.length +
              " block" +
              (BZL.length === 1 ? "" : "s") +
              " · " +
              busyDaysText(
                BZL.reduce(function (a, b) {
                  b.dows.forEach(function (d) {
                    if (a.indexOf(d) < 0) a.push(d);
                  });
                  return a;
                }, []),
              )
          : "Nothing blocked yet. The schedule plans around these.",
        '<button type="button" class="stone mini save" id="setBusy">Edit</button>',
      ),
      "schedule",
    );
    h += sgroup(
      "Time off",
      v
        ? srow(
            v.from > T ? "Vacation from " + fmtD(v.from) : "On vacation",
            "Until " + fmtD(add(v.to, -1)) + ", every quest is optional",
            '<button type="button" class="stone mini del" id="vacEnd">End</button>',
          )
        : srow(
            "Vacation",
            "Every quest optional, streak safe",
            '<select id="vacLen" aria-label="Vacation length">' +
              opt(
                [1, 2, 3, 4, 5, 6, 7, 10, 14].map(function (x) {
                  return [x, x + " day" + (x > 1 ? "s" : "")];
                }),
                1,
              ) +
              "</select>",
          ) +
            '<div class="srow sbtns"><button type="button" class="stone mini" id="vacToday">Start today</button><button type="button" class="stone mini" id="vacTom">Start tomorrow</button></div>',
      "streak",
    );
    var tm = c.term || {};
    h += sgroup(
      "Term",
      srow(
        "Name",
        "Shows “Week 6 of 13” in the top panel",
        '<input id="tmName" value="' + esc(tm.name || "") + '" placeholder="Fall 2026">',
      ) +
        srow("Starts", "", '<input type="date" id="tmStart" value="' + esc(tm.start || "") + '">') +
        srow("Ends", "", '<input type="date" id="tmEnd" value="' + esc(tm.end || "") + '">') +
        srow(
          "Break",
          "Works like a vacation",
          '<input type="date" id="brFrom" aria-label="Break from"><input type="date" id="brTo" aria-label="Break to">',
          "swrap",
        ) +
        '<div class="srow sbtns"><button type="button" class="stone mini" id="brAdd">Add break</button>' +
        (c.term ? '<button type="button" class="stone mini del" id="tmClear">Clear term</button>' : "") +
        "</div>",
    );
    h += sgroup(
      "Start",
      srow("Started on", "Days before this are ignored", '<input type="date" id="setStart" value="' + START_KEY + '">'),
    );
  } else if (G.setTab === "quests") {
    var lkc = null,
      lockedC = false,
      bz = busiest();
    h += sgroup(
      "Work style",
      styleCards(c.style || "", "data-sty") +
        '<p class="help sin">Changes defaults only. Your quests and history stay as they are.</p>',
    );
    var rsT = easeInfo().setup ? T : add(T, 1),
      nsR = (c.noStreak || []).filter(function (r) {
        return r.from <= rsT && (!r.to || rsT < r.to);
      })[0];
    h += sgroup(
      "Mode",
      srow(
        "Challenge mode",
        nsR
          ? "Casual since " +
              fmtD(nsR.from) +
              ": XP and levels, no streak, checkpoints, badges or grove. Your streak picks up where it was."
          : noStreakOn(T)
            ? "Challenge again from tomorrow. Your streak picks up where it was."
            : "Streak, checkpoints, badges and grove. Off = Casual: XP and levels only, from today; Challenge again from tomorrow.",
        swc("setStreak", !nsR, "Challenge mode"),
      ),
      "streaks",
    );
    h += sgroup(
      "Rules",
      srow(
        "Daily quest limit",
        lockedC ? "Locked until " + fmtD(lkc) : "Busiest day: " + WDS[bz.w] + " (" + bz.n + ")",
        '<select id="setCap" aria-label="Max quests per day"' +
          (lockedC ? " disabled" : "") +
          ">" +
          opt(
            [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(function (x) {
              return [x, x];
            }),
            capOf(),
          ) +
          "</select>",
      ) +
        srow(
          "Plan counters",
          "A stretch target above the minimum, for gold days",
          swc("setPlan", c.showPlan, "Plan counters"),
        ) +
        srow("Morning promise", vowHint(), swc("setVow", vowSet(), "Morning promise")),
      "changes",
    );
    h += sgroup(
      "Deadlines",
      (c.deadlines || [])
        .slice()
        .sort(function (a, b) {
          return a.date < b.date ? -1 : 1;
        })
        .map(function (d) {
          return (
            '<div class="srow sdl"><input data-dt="' +
            esc(d.id) +
            '" value="' +
            esc(d.title) +
            '" aria-label="Deadline name"><input type="date" data-dd="' +
            esc(d.id) +
            '" value="' +
            esc(d.date) +
            '" aria-label="Deadline date"><button type="button" class="stone mini del" data-dx="' +
            esc(d.id) +
            '" aria-label="Remove deadline">✕</button></div>'
          );
        })
        .join("") +
        '<div class="srow sdl"><input id="dlNewT" placeholder="Thesis draft due" aria-label="New deadline name"><input type="date" id="dlNewD" aria-label="New deadline date"><button type="button" class="stone mini save" id="dlAdd">Add</button></div>',
    );
    if (!packsHidden())
      h += sgroup(
        "Starter packs",
        srow(
          "Add a pack",
          "Adds its quests and a rules section",
          '<select id="packSel" aria-label="Starter pack"><option value="">Choose…</option>' +
            Object.keys(PACKS)
              .map(function (p) {
                return "<option>" + p + "</option>";
              })
              .join("") +
            '</select><button type="button" class="stone mini" id="packAdd">Add</button>',
          "swrap",
        ),
      );
  } else if (G.setTab === "alerts") {
    var nfc = nf(),
      natv = nativeApp();
    h += sgroup(
      "",
      srow(
        "Notifications",
        natv ? "Scheduled on your phone, no server" : "Sent by the Android app. Saved here.",
        swc("nfOn", nfc.on, "Notifications"),
      ) +
        (natv && nfc.on
          ? '<div class="srow sbtns"><button type="button" class="stone mini" id="nfTest">Send a test</button></div>'
          : ""),
      "alerts",
    );
    if (nfc.on) {
      h += sgroup(
        "What to send",
        [
          ["timer", "Timer and sprint", "Goal reached, block and break ends"],
          ["sched", "Schedule starts", "At each planned shot"],
          ["pace", "Pace", "Midday and halfway-checkpoint alerts"],
          ["checkin", "Evening check-in", "Only if quests are still open"],
          ["todos", "Open to-dos", "30 minutes before bed"],
          ["risk", "Streak at risk", "After a missed day"],
          ["dl", "Deadline eve", "The evening before"],
          ["review", "Review topics", "Sundays, for topics left 2+ weeks"],
        ]
          .map(function (o) {
            return srow(o[1], o[2], swc(null, nfc[o[0]], o[1], 'data-nf="' + o[0] + '"'));
          })
          .join("") + srow("Check-in time", "", '<input type="time" id="nfAt" value="' + nfc.checkinAt + '">'),
      );
      h += '<div id="nfExact"></div><div id="nfDiag" class="sdiag"></div>';
    }
  } else if (G.setTab === "look") {
    h += sgroup(
      "Theme",
      srow(
        "Theme",
        "",
        '<select id="setTheme" aria-label="Theme">' +
          opt(
            Object.keys(THEME_NAMES).map(function (k) {
              return [k, THEME_NAMES[k]];
            }),
            c.theme || "",
          ) +
          "</select>",
      ) +
        srow(
          "Reduce animations",
          "",
          '<select id="setCalm" aria-label="Reduce animations">' +
            opt(
              [
                ["auto", "Auto"],
                ["on", "Always"],
                ["off", "Never"],
              ],
              c.calm || "auto",
            ) +
            "</select>",
        ) +
        srow(
          "Grove when idle",
          "Shows your grove after a while",
          '<select id="setIdle" aria-label="Show grove when idle">' +
            opt(
              [
                [0, "Never"],
                [2, "2 min"],
                [3, "3 min"],
                [5, "5 min"],
                [10, "10 min"],
              ],
              c.idleGrove == null ? 3 : +c.idleGrove,
            ) +
            "</select>",
        ),
    );
    h += sgroup(
      "Show on Today",
      hideOpts()
        .map(function (o) {
          var shown = !(c.hide || {})[o[0]];
          return srow(o[1], "", swc(null, shown, o[1], 'data-hide="' + o[0] + '"'));
        })
        .join(""),
    );
  } else if (G.setTab === "sound") {
    h += sgroup(
      "",
      srow("Sound", "Game sounds and chimes", swc("setSfx", G.sfxOn, "Sound")) +
        srow("Tap sounds", "A click with every tap", swc("setTapSnd", c.tapSound !== false, "Tap sounds")) +
        srow("Vibration", "", swc("setHap", c.haptics !== false, "Vibration")) +
        srow(
          "Keep screen on",
          "While a timer or sprint runs",
          swc("setAwake", c.keepAwake !== false, "Keep screen on"),
        ),
    );
  } else if (G.setTab === "extras") {
    h += sgroup(
      "Add-ons",
      srow(
        "Quick-start tools",
        "Pick for me and Batch to-dos in the ⋮ menu",
        swc("setSpark", c.sparkTools, "Quick-start tools"),
      ) +
        srow("Share week", "A summary card to send", swc("setShare", c.addShare, "Share week")) +
        srow("Trends page", "Weekly charts in the nav", swc("setTrends", c.addTrends, "Trends page")) +
        srow(
          "Quick actions",
          "The two buttons above the quest list; the rest sit in \u22ee",
          '<span class="qkpick"><select id="setQk0" aria-label="First quick action">' +
            opt(quickOpts(), quickSlots()[0]) +
            '</select><select id="setQk1" aria-label="Second quick action">' +
            opt(quickOpts(), quickSlots()[1]) +
            "</select></span>",
        ),
    );
  } else if (G.setTab === "account") {
    var ac = cl().account(),
      cs = cl().state;
    var cu = cl().user && cl().user(),
      unv = ac && cu && cu.verified === false;
    if (!ac)
      h += sgroup(
        "Account",
        '<div class="acct"><p class="help">Sign in to keep your quests, days and subjects in sync across devices. Everything keeps working offline; changes merge when you\u2019re back online.</p><div class="edrow end"><button type="button" class="stone" id="acNew">Create account</button><button type="button" class="stone save" id="acOpen">Sign in</button></div></div>',
        "account",
      );
    else
      h +=
        sgroup(
          "Account",
          srow(
            "Signed in as",
            esc(ac.email) + (unv ? ' \u00b7 <span class="bad">not verified</span>' : ""),
            '<button type="button" class="stone mini" id="acOut">' +
              (G.acOutArm && Date.now() - G.acOutArm < 5000 ? "Sign out anyway" : "Sign out") +
              "</button>",
          ) +
            (unv
              ? srow(
                  "Verify your email",
                  "Tap the link we sent, then Done.",
                  '<button type="button" class="stone mini" id="acVer">Resend</button> <button type="button" class="stone mini save" id="acVerOk">Done</button>',
                )
              : "") +
            srow(
              "Sync",
              cs.status === "error"
                ? "Problem: " + esc(cs.err || "unknown")
                : cs.status === "syncing"
                  ? "Syncing\u2026"
                  : cs.status === "on"
                    ? "Up to date" +
                      (cs.last
                        ? " \u00b7 " +
                          new Date(cs.last).toLocaleTimeString("en-CA", { hour: "numeric", minute: "2-digit" })
                        : "")
                    : "Connecting\u2026",
              '<button type="button" class="stone mini" id="acSync">Sync now</button>',
            ) +
            srow(
              "What syncs",
              "Quests, rules, subjects, settings, look and feel, every day\u2019s log and reflections. Not the running timer.",
            ),
          "account",
        ) +
        sgroup(
          "Sign-in and security",
          srow(
            "Password",
            "Change the password you sign in with",
            '<button type="button" class="stone mini" id="acPwB">Change</button>',
          ) +
            srow(
              "Delete account",
              "Removes the account and its synced data",
              '<button type="button" class="stone mini del" id="acDel">Delete\u2026</button>',
            ),
        ) +
        '<p class="help sfoot">You stay signed in until you sign out. Signing out removes this account\u2019s data from this device; it stays in your account.</p>';
  } else if (G.setTab === "data") {
    h +=
      sgroup(
        "Backup",
        srow(
          "Export backup",
          esc(setSummary("data")),
          '<button type="button" class="stone mini save" id="setExp">Export</button>',
        ) +
          srow(
            "Import backup",
            "Merges with what’s here",
            '<button type="button" class="stone mini" id="setImp">Import</button>',
          ) +
          srow(
            "Your data",
            cl().account()
              ? "On this device and in your account; a backup is still a good idea."
              : "Stays on this device. Nothing is sent anywhere unless you sign in; a backup is how it moves.",
          ),
        "data",
      ) +
      sgroup(
        "This device",
        srow(
          "Erase this device",
          cl().account()
            ? "Signs you out and removes all app data here; your account keeps its data"
            : "Removes all app data here; export a backup first to keep a copy",
          '<button type="button" class="stone mini del" id="setErase">' +
            (G.eraseArm && Date.now() - G.eraseArm < 5000
              ? G.eraseForce
                ? "Erase anyway"
                : "Tap again to erase"
              : "Erase\u2026") +
            "</button>",
        ),
      );
    h +=
      '<p class="help sfoot">' +
      (cl().account()
        ? "Stored on this device and in your account."
        : "Everything stays on this device; nothing is sent anywhere unless you sign in.") +
      "</p>";
  }
  el.innerHTML = h;
  bind("setBack", "click", function () {
    G.setTab = null;
    renderSettings();
    window.scrollTo(0, 0);
    if (/^#settings\//.test(location.hash)) pageBack("#settings");
  });
  el.querySelectorAll("[data-help]").forEach(function (b) {
    b.addEventListener("click", function () {
      openHelp(b.getAttribute("data-help"));
    });
  });
  bind("setStart", "change", function () {
    var v2 = this.value,
      T2 = todayKey();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(v2)) return;
    if (v2 > add(T2, 365)) {
      setSync("Pick a start date within the next year.");
      this.value = START_KEY;
      return;
    }
    var iso = parse(v2).toISOString();
    setStart(iso);
    var c2 = clone(cfg());
    c2.start = iso;
    saveCfg(c2);
    elapsed();
    G.qSig = "";
    render();
    setSync("Start date set to " + fmtD(v2));
  });
  (function () {
    function save() {
      var w = document.getElementById("setWake").value,
        bd = document.getElementById("setBed").value,
        er = winErr(w, bd, false);
      if (er) {
        setSync(er);
        renderSettings();
        return;
      }
      var c2 = clone(cfg());
      c2.day = { wake: w, bed: bd };
      S.cfg.day = c2.day;
      if (todayKey() < START_KEY) {
        c2.start = parse(todayKey()).toISOString();
        setStart(c2.start);
        elapsed();
      }
      saveCfg(c2);
      G.lastDay = todayKey();
      lockIn();
      G.nfSig = "";
      G.qSig = "";
      render();
      renderSettings();
      setSync("Your day: " + w + " to " + bd);
    }
    ["setWake", "setBed"].forEach(function (id) {
      bind(id, "change", save);
    });
  })();
  bind("setTheme", "change", function () {
    var c2 = clone(cfg());
    if (this.value) c2.theme = this.value;
    else delete c2.theme;
    saveCfg(c2);
    applyTheme(true);
  });
  (function () {
    function setNF(p) {
      var c2 = clone(cfg());
      c2.nf = Object.assign({}, nf(), p);
      saveCfg(c2);
      G.nfSig = "";
      notifSync();
      renderSettings();
    }
    bind("nfOn", "click", function () {
      var want = !nf().on;
      notifEnable(want, function (err) {
        if (err === "denied") {
          setSync("Notification permission was denied. Allow it in Android settings.");
          return;
        }
        setNF({ on: want });
        if (err === "app") setSync("Saved. Notifications are sent by the Android app build.");
      });
    });
    var tb = document.getElementById("nfTest");
    if (tb) tb.addEventListener("click", notifTest);
    notifDiag(document.getElementById("nfDiag"));
    var ex = document.getElementById("nfExact"),
      ln0 = LN();
    if (ex && ln0 && ln0.checkExactNotificationSetting)
      ln0
        .checkExactNotificationSetting()
        .then(function (r) {
          if (r && r.exact_alarm === "granted") return;
          ex.innerHTML =
            '<p class="help warnc">Alerts may arrive late: Android hasn\u2019t allowed exact timing for this app.</p><div class="edrow"><button type="button" class="stone mini save" id="nfExactBtn">Allow exact timing</button></div>';
          ex.querySelector("#nfExactBtn").addEventListener("click", function () {
            ln0
              .changeExactNotificationSetting()
              .then(function () {
                G.nfSig = "";
                notifSync();
                renderSettings();
              })
              .catch(function () {});
          });
        })
        .catch(function () {});
    el.querySelectorAll("[data-nf]").forEach(function (x) {
      x.addEventListener("click", function () {
        var k = x.getAttribute("data-nf"),
          p = {};
        p[k] = !nf()[k];
        setNF(p);
      });
    });
    var at = document.getElementById("nfAt");
    if (at)
      at.addEventListener("change", function () {
        if (/^\d{2}:\d{2}$/.test(this.value)) setNF({ checkinAt: this.value });
      });
  })();
  function startVac(from) {
    var n = +document.getElementById("vacLen").value,
      c2 = clone(cfg());
    c2.vacs = (c2.vacs || []).concat([{ from: from, to: add(from, n) }]);
    saveCfg(c2);
    var T2 = todayKey();
    if (from === T2 && S.days[T2]) {
      S.days[T2] = Object.assign({}, S.days[T2], { q: activeDefs(T2) });
      dirty[T2] = true;
      cache();
      clearTimeout(G.timer);
      G.timer = setTimeout(flush, 300);
    }
    G.qSig = "";
    render();
    renderSettings();
  }
  var a = document.getElementById("vacToday");
  if (a) {
    a.addEventListener("click", function () {
      startVac(todayKey());
    });
    bind("vacTom", "click", function () {
      startVac(add(todayKey(), 1));
    });
  }
  var ve = document.getElementById("vacEnd");
  if (ve)
    ve.addEventListener("click", function () {
      var T2 = todayKey(),
        c2 = clone(cfg());
      c2.vacs = (c2.vacs || [])
        .map(function (x) {
          return x.to > T2 ? (x.from > T2 ? null : { from: x.from, to: T2 }) : x;
        })
        .filter(function (x) {
          return x && x.to > x.from;
        });
      saveCfg(c2);
      if (S.days[T2]) {
        S.days[T2] = Object.assign({}, S.days[T2], { q: activeDefs(T2) });
        dirty[T2] = true;
        cache();
      }
      G.qSig = "";
      render();
      renderSettings();
    });
  bind("setBusy", "click", function () {
    openBusy();
  });
  bind("setWkS", "change", function () {
    var c2 = clone(cfg());
    if (+this.value === 0) c2.weekStart = 0;
    else delete c2.weekStart;
    saveCfg(c2);
    G.qSig = "";
    G.nfSig = "";
    render();
    renderSettings();
    setSync("Weeks now start on " + DAYF[wkS()]);
  });
  bind("packAdd", "click", function () {
    var p = document.getElementById("packSel").value;
    if (p) {
      applyPack(p);
      renderSettings();
    }
  });
  bind("setTapSnd", "click", function () {
    var c2 = clone(cfg());
    c2.tapSound = c2.tapSound === false;
    saveCfg(c2);
    haptic("medium");
    renderSettings();
  });
  bind("setHap", "click", function () {
    var c2 = clone(cfg());
    c2.haptics = c2.haptics === false;
    saveCfg(c2);
    haptic("medium");
    renderSettings();
  });
  el.querySelectorAll("[data-hide]").forEach(function (x) {
    x.addEventListener("click", function () {
      var c2 = clone(cfg()),
        k = x.getAttribute("data-hide");
      c2.hide = Object.assign({}, c2.hide || {});
      c2.hide[k] = !c2.hide[k];
      saveCfg(c2);
      applyHide();
      renderSettings();
    });
  });
  bind("setCalm", "change", function () {
    var c2 = clone(cfg());
    c2.calm = this.value;
    saveCfg(c2);
    calmSync();
  });
  bind("setAwake", "click", function () {
    var c2 = clone(cfg());
    c2.keepAwake = c2.keepAwake === false;
    saveCfg(c2);
    focusSync();
    renderSettings();
  });
  bind("setIdle", "change", function () {
    var c2 = clone(cfg());
    c2.idleGrove = +this.value;
    saveCfg(c2);
    if (typeof idleReset === "function") idleReset();
  });
  el.querySelectorAll("[data-sty]").forEach(function (x) {
    x.addEventListener("click", function () {
      applyStyle(x.getAttribute("data-sty"));
      renderSettings();
    });
  });
  [0, 1].forEach(function (i) {
    bind("setQk" + i, "change", function () {
      var q = quickSlots().slice(),
        v = this.value;
      if (q[1 - i] === v) q[1 - i] = q[i];
      q[i] = v;
      var c2 = clone(cfg());
      c2.quick = q;
      saveCfg(c2);
      render();
      renderSettings();
    });
  });
  [
    ["setSpark", "sparkTools"],
    ["setShare", "addShare"],
    ["setTrends", "addTrends"],
  ].forEach(function (p) {
    bind(p[0], "click", function () {
      var c2 = clone(cfg());
      c2[p[1]] = !c2[p[1]];
      saveCfg(c2);
      render();
      renderSettings();
    });
  });
  var sc = document.getElementById("setCap");
  if (sc)
    sc.addEventListener("change", function () {
      var v = +this.value;
      function apply() {
        var c2 = clone(cfg());
        c2.cap = v;
        saveCfg(c2);
        G.qSig = "";
        render();
        renderSettings();
        setSync("Daily limit set to " + v + " quests");
      }
      var ov = overDays(cfg().quests, v);
      if (ov.length) {
        openG("Too many quests on some days", function (b) {
          b.innerHTML =
            '<p class="mhead">A limit of ' +
            v +
            ' doesn\u2019t fit yet.</p><div class="dtl">' +
            ov
              .map(function (o) {
                return '<div class="dt-r"><span>' + WDN[o.w] + "</span><b>" + o.n + " quests</b></div>";
              })
              .join("") +
            '</div><p class="help">Lighten those days first: untick them on some quests, make some optional, or pause or complete one. Then set the limit again.</p><div class="edrow end"><button type="button" class="stone" id="capNo">Cancel</button><button type="button" class="stone save" id="capEdit">Edit quests</button></div>';
          b.querySelector("#capNo").addEventListener("click", function () {
            closeG();
            renderSettings();
          });
          b.querySelector("#capEdit").addEventListener("click", function () {
            closeG();
            go("today");
            setTimeout(openMgr, 50);
          });
        });
        return;
      }
      apply();
    });
  bind("setStreak", "click", function () {
    setStreaks(noStreakOn(easeInfo().setup ? todayKey() : add(todayKey(), 1)));
  });
  bind("setVow", "click", function () {
    if (vowSet()) {
      setVow(false);
      renderSettings();
      setSync(vowOn(todayKey()) ? "Morning promise ends after today." : "Morning promise is off.");
      return;
    }
    var T = todayKey(),
      tm = add(T, 1);
    openG("Morning promise", function (b) {
      b.innerHTML =
        '<p class="help">Each morning, tick your first ' +
        vowMax() +
        ' rules before the day\u2019s quests show. Pick the first day.</p><div class="edrow"><label for="vowFrom" class="help">Start on</label><input type="date" id="vowFrom" min="' +
        T +
        '" value="' +
        tm +
        '"></div><div class="edrow end"><button type="button" class="stone" id="vowNo">Cancel</button><button type="button" class="stone save" id="vowGo">Start</button></div>';
      b.querySelector("#vowNo").addEventListener("click", closeG);
      b.querySelector("#vowGo").addEventListener("click", function () {
        var v = b.querySelector("#vowFrom").value;
        if (!/^\d{4}-\d{2}-\d{2}$/.test(v) || v < T) v = tm;
        setVow(true, v);
        closeG();
        render();
        renderSettings();
        setSync("Morning promise starts " + (v === T ? "today" : v === tm ? "tomorrow" : fmtD(v)) + ".");
      });
    });
  });
  bind("setPlan", "click", function () {
    var c2 = clone(cfg());
    c2.showPlan = !c2.showPlan;
    saveCfg(c2);
    renderSettings();
  });
  bind("setSfx", "click", function () {
    document.getElementById("sndBtn").click();
    renderSettings();
  });
  bind("setErase", "click", function () {
    var b = document.getElementById("setErase"),
      armed = G.eraseArm && Date.now() - G.eraseArm < 5000;
    if (!armed) {
      G.eraseArm = Date.now();
      G.eraseForce = false;
      if (b) b.textContent = "Tap again to erase";
      setSync("This erases everything on this device" + (cl().account() ? " and signs you out." : "."));
      return;
    }
    G.eraseArm = 0;
    cl()
      .eraseDevice(G.eraseForce)
      .catch(function (e) {
        var c = e && e.code;
        if (c === "app/timer") setSync("Stop the timer first.");
        else if (c === "app/unsynced") {
          G.eraseArm = Date.now();
          G.eraseForce = true;
          b = document.getElementById("setErase");
          if (b) b.textContent = "Erase anyway";
          setSync("Some changes haven\u2019t synced yet. Erasing now loses them.");
        } else setSync(String((e && e.message) || e));
      });
  });
  bind("acOpen", "click", function () {
    openAuth("login");
  });
  bind("acNew", "click", function () {
    openAuth("signup");
  });
  bind("acOut", "click", function () {
    var b = document.getElementById("acOut"),
      force = G.acOutArm && Date.now() - G.acOutArm < 5000;
    G.acOutArm = 0;
    cl()
      .signOut(force)
      .catch(function (e) {
        var c = e && e.code;
        if (c === "app/timer") setSync("Stop the timer first.");
        else if (c === "app/unsynced") {
          G.acOutArm = Date.now();
          b = document.getElementById("acOut");
          if (b) b.textContent = "Sign out anyway";
          setSync("Some changes haven\u2019t synced yet. Signing out now loses them.");
        } else setSync(authErr(e));
      });
  });
  bind("acSync", "click", function () {
    var p = cl().syncNow();
    if (p) p.then(renderSettings, renderSettings);
  });
  bind("acPwB", "click", function () {
    openAuth("change");
  });
  bind("acDel", "click", function () {
    openAuth("delete");
  });
  bind("acVer", "click", function () {
    cl()
      .verify()
      .then(
        function () {
          setSync("Verification email sent.");
        },
        function (e) {
          setSync(authErr(e));
        },
      );
  });
  bind("acVerOk", "click", function () {
    cl()
      .refresh()
      .then(
        function (u) {
          renderSettings();
          setSync(u && u.verified ? "Email verified." : "Not verified yet. Tap the link in the email first.");
        },
        function (e) {
          setSync(authErr(e));
        },
      );
  });
  bind("setExp", "click", function () {
    document.getElementById("expBtn").click();
  });
  bind("setImp", "click", function () {
    document.getElementById("impBtn").click();
  });
  function upDl(fn2) {
    var c2 = clone(cfg());
    c2.deadlines = c2.deadlines || [];
    fn2(c2.deadlines);
    saveCfg(c2);
    render();
  }
  el.querySelectorAll("[data-dt]").forEach(function (x) {
    x.addEventListener("change", function () {
      upDl(function (L) {
        L.forEach(function (d) {
          if (d.id === x.getAttribute("data-dt")) d.title = x.value.trim() || d.title;
        });
      });
    });
  });
  el.querySelectorAll("[data-dd]").forEach(function (x) {
    x.addEventListener("change", function () {
      if (!x.value) return;
      upDl(function (L) {
        L.forEach(function (d) {
          if (d.id === x.getAttribute("data-dd")) d.date = x.value;
        });
      });
    });
  });
  el.querySelectorAll("[data-dx]").forEach(function (x) {
    x.addEventListener("click", function () {
      upDl(function (L) {
        var i = L.findIndex(function (d) {
          return d.id === x.getAttribute("data-dx");
        });
        if (i >= 0) L.splice(i, 1);
      });
      renderSettings();
    });
  });
  bind("dlAdd", "click", function () {
    var t = document.getElementById("dlNewT").value.trim(),
      d = document.getElementById("dlNewD").value;
    if (!t || !d) {
      setSync("Add a name and a date for the deadline.");
      return;
    }
    upDl(function (L) {
      L.push({ id: "d" + Date.now().toString(36), title: t, date: d });
    });
    renderSettings();
  });
  function upTerm() {
    var n = document.getElementById("tmName").value.trim(),
      a = document.getElementById("tmStart").value,
      b = document.getElementById("tmEnd").value;
    if (a && b && a > b) {
      setSync("Term end must be after its start.");
      return;
    }
    var c2 = clone(cfg());
    if (!a && !b && !n) delete c2.term;
    else c2.term = { name: n, start: a, end: b };
    saveCfg(c2);
    render();
  }
  ["tmName", "tmStart", "tmEnd"].forEach(function (id) {
    bind(id, "change", upTerm);
  });
  var tc = document.getElementById("tmClear");
  if (tc)
    tc.addEventListener("click", function () {
      var c2 = clone(cfg());
      delete c2.term;
      saveCfg(c2);
      render();
      renderSettings();
    });
  bind("brAdd", "click", function () {
    var a = document.getElementById("brFrom").value,
      b = document.getElementById("brTo").value;
    if (!a || !b || a > b) {
      setSync("Pick a break start and end date.");
      return;
    }
    var c2 = clone(cfg());
    c2.vacs = (c2.vacs || []).concat([{ from: a, to: add(b, 1) }]);
    saveCfg(c2);
    var T2 = todayKey();
    if (a <= T2 && T2 <= b && S.days[T2]) {
      S.days[T2] = Object.assign({}, S.days[T2], { q: activeDefs(T2) });
      dirty[T2] = true;
      cache();
    }
    G.qSig = "";
    render();
    renderSettings();
    setSync("Break added: " + fmtD(a) + " to " + fmtD(b));
  });
}

/* Runs once at startup, in file-number order (main.js). */
export function init() {
  /* Settings: a home list of categories, each opening its own page of rows (srow: title + one-line hint + control).
     Toggles use the same .sw switch as Today. Longer explanations live in How it works; group headers link there with "?". */
  G.setTab = null;
  SET_CATS = [
    ["day", "Your day", "sprout"],
    ["quests", "Quests & rules", "dumbbell"],
    ["alerts", "Notifications", "flame"],
    ["look", "Look", "star"],
    ["sound", "Sound & touch", "note"],
    ["extras", "Extras", "trophy"],
    ["account", "Account", "star"],
    ["data", "Your data", "metronome"],
  ];
  THEME_NAMES = {
    "": "Auto",
    cycle: "Every hour",
    grass: "Grass",
    day: "Day",
    night: "Night",
    snow: "Snow",
    ocean: "Ocean",
    lava: "Lava",
    ember: "Ember",
    city: "City skyline",
    mountains: "Mountains",
    village: "Village",
  };
}
