/* ---- help + onboarding ---- */
import { cfg } from "../core/config.js";
import { cloudAccount } from "../core/storage.js";
import { svg } from "../core/util.js";
import { applyPack } from "../quests/07c-starter-packs.js";
import { maybeReviewTodos } from "../quests/50b-todo-review.js";
import { applyStyle, styleCards } from "../settings/27-work-styles.js";
import { cloud } from "../sync/54-account.js";
import { authOpen } from "../sync/55-auth-pages.js";
import { closeG, gTitle, openG } from "./18-modal.js";
import { pageBack, pageNav, viewHash } from "./routes.js";

export var HELP, hpPg;

export function hpOpen() {
  return !!hpPg && !hpPg.hidden;
}
export function openHelp(topic) {
  if (!hpPg) {
    hpPg = document.createElement("div");
    hpPg.id = "helpPage";
    hpPg.className = "hppage";
    hpPg.setAttribute("role", "dialog");
    hpPg.setAttribute("aria-modal", "true");
    hpPg.setAttribute("aria-labelledby", "hpTitle");
    hpPg.innerHTML =
      '<div class="hp-hd"><h2 id="hpTitle">How it works</h2><button type="button" class="stone save" id="hlpClose">Done</button></div><div class="hp-scroll" id="hpScroll"><p class="hp-intro">Build habits like a game: do your quests, clear the day, keep the streak.</p>' +
      HELP.map(function (g) {
        return (
          '<section class="hp-g"><h3 class="hp-gh">' +
          g[0] +
          '</h3><div class="hp-list">' +
          g[1]
            .map(function (t) {
              return (
                '<div class="hp-item" data-hp="' +
                t[0] +
                '"><button type="button" class="hp-t" aria-expanded="false"><span class="slot">' +
                svg(t[1]) +
                "</span><span><b>" +
                t[2] +
                "</b><small>" +
                t[3] +
                '</small></span><i class="schev" aria-hidden="true"></i></button><div class="hp-b"><ul>' +
                t[4]
                  .map(function (x) {
                    return "<li>" + x + "</li>";
                  })
                  .join("") +
                "</ul></div></div>"
              );
            })
            .join("") +
          "</div></section>"
        );
      }).join("") +
      "</div>";
    document.body.appendChild(hpPg);
    hpPg.querySelector("#hlpClose").addEventListener("click", closeHelp);
    hpPg.querySelectorAll(".hp-t").forEach(function (b) {
      b.addEventListener("click", function () {
        var it = b.parentNode,
          on = !it.classList.contains("open");
        it.classList.toggle("open", on);
        b.setAttribute("aria-expanded", on);
      });
    });
  }
  hpPg.hidden = false;
  document.body.classList.add("hp-open");
  hpPg.querySelectorAll(".hp-item").forEach(function (it) {
    var on = it.getAttribute("data-hp") === topic;
    it.classList.toggle("open", on);
    it.querySelector(".hp-t").setAttribute("aria-expanded", on);
  });
  var sc = hpPg.querySelector("#hpScroll");
  sc.scrollTop = 0;
  if (topic) {
    var it = hpPg.querySelector('[data-hp="' + topic + '"]');
    if (it) {
      setTimeout(function () {
        sc.scrollTop = Math.max(0, it.offsetTop - sc.offsetTop - 12);
        it.classList.add("flash");
        setTimeout(function () {
          it.classList.remove("flash");
        }, 1300);
      }, 0);
    }
  }
  var d = hpPg.querySelector("#hlpClose");
  if (d) d.focus();
  pageNav(topic ? "#help/" + topic : "#help");
}
export function closeHelp() {
  if (!hpPg) return;
  hpPg.hidden = true;
  document.body.classList.remove("hp-open");
  maybeReviewTodos();
  if (/^#help/.test(location.hash)) pageBack(viewHash());
}
export function openWelcome() {
  var pick = null,
    style = null;
  function steps() {
    return [
      {
        t: "How do you work?",
        h:
          '<p class="mhead">Pick the style that sounds most like you.</p><p class="help">It sets sensible defaults. You can change it any time in Settings.</p>' +
          styleCards(style, "data-ws"),
      },
      {
        t: "Welcome",
        h:
          '<p class="mhead">Build habits like a game.</p><p class="help">Pick a starter pack to begin, or start empty and add your own quests.</p><div class="packs wel" role="radiogroup" aria-label="Starter pack">' +
          ["Student", "Fitness", "Creative", "Wellness", "Deep Work", ""]
            .map(function (p) {
              var on = pick === p;
              return (
                '<button type="button" class="stone' +
                (on ? " on" : "") +
                '" role="radio" aria-checked="' +
                on +
                '" data-wp="' +
                p +
                '">' +
                (p || "Start empty") +
                "</button>"
              );
            })
            .join("") +
          "</div>",
      },
      {
        t: "How a day works",
        h: '<p class="mhead">Do your quests, clear the day.</p><p class="help">Each quest shows what counts as done. When every required quest is done (and no limit is broken), the day is cleared.</p><p class="help">Use <b>+ New quest</b> to add more. Each day locks by itself at midnight (or your bedtime); tap a past day in the strip for its wrap-up.</p>',
      },
      {
        t: "Challenge and Casual",
        h: '<p class="mhead">Two ways to play.</p><p class="help"><b>Challenge</b>: cleared days in a row build your streak, badges and grove; one missed day is forgiven, two in a row resets the streak; period totals have checkpoints; changes that make a quest easier start tomorrow.</p><p class="help"><b>Casual</b>: XP and levels only. No streak, checkpoints, badges or grove, and changes apply at once. Switch in Settings; your streak waits where it was.</p><p class="help">Tap <b>?</b> any time for the full guide.</p>',
      },
    ];
  }
  openG(
    "",
    function (b) {
      function draw(step) {
        var s = steps()[step],
          last = step === 3,
          need = (step === 0 && style === null) || (step === 1 && pick === null);
        gTitle.textContent = s.t + " (" + (step + 1) + "/4)";
        b.innerHTML =
          s.h +
          '<div class="edrow end">' +
          (step > 0
            ? '<button type="button" class="stone" id="wBack">Back</button>'
            : '<button type="button" class="stone" id="wSkip">Skip</button>') +
          (last
            ? '<button type="button" class="stone save" id="wDone">Let\u2019s go</button>'
            : '<button type="button" class="stone save" id="wNext"' + (need ? " disabled" : "") + ">Next</button>") +
          "</div>";
        b.querySelectorAll("[data-ws]").forEach(function (x) {
          x.addEventListener("click", function () {
            style = x.getAttribute("data-ws");
            draw(0);
          });
        });
        b.querySelectorAll("[data-wp]").forEach(function (x) {
          x.addEventListener("click", function () {
            pick = x.getAttribute("data-wp");
            draw(1);
          });
        });
        var n = b.querySelector("#wNext");
        if (n)
          n.addEventListener("click", function () {
            draw(step + 1);
          });
        var bk = b.querySelector("#wBack");
        if (bk)
          bk.addEventListener("click", function () {
            draw(step - 1);
          });
        var sk = b.querySelector("#wSkip");
        if (sk)
          sk.addEventListener("click", function () {
            pick = null;
            style = null;
            closeG();
          });
        var d = b.querySelector("#wDone");
        if (d) d.addEventListener("click", closeG);
      }
      draw(0);
    },
    function () {
      try {
        localStorage.setItem("pc-welcomed", "1");
      } catch (x) {}
      if (style) applyStyle(style, true);
      if (pick && !(cfg().quests || []).length) applyPack(pick);
    },
  );
}
/* First run: the welcome waits while the account gate (sync/55-auth-pages.js) is up; closing the gate calls this again. */
export function welcomeCheck(ms) {
  try {
    if (cloudAccount() && !(typeof cloud !== "undefined" && cloud.state.status === "on")) return;
    if (!localStorage.getItem("pc-welcomed") && !(cfg().quests || []).length)
      setTimeout(function () {
        if (!(typeof authOpen === "function" && authOpen()) && !(cfg().quests || []).length) openWelcome();
      }, ms);
  } catch (x) {}
}

/* Runs once at startup, in file-number order (main.js). */
export function init() {
  /* How it works: a full-screen page of topics in groups. Each topic is one line until opened; openHelp(id) jumps to one. */
  HELP = [
    [
      "The basics",
      [
        [
          "quests",
          "dumbbell",
          "Quests",
          "The things you do each day.",
          [
            "Time, target, limit, check, clock time, rating, weekly and to-do.",
            "Most are required. Optional quests, weekly goals and to-dos never fail a day.",
            "A time quest with a minimum of 0 just logs time: it shows what you’ve done today and is never required.",
            "Tap ⋯ on a quest for details, pausing or Just 5.",
          ],
        ],
        [
          "clear",
          "star",
          "Clearing a day",
          "Every required quest done, no limit broken.",
          [
            "That clears the day. Hit the plan on every time quest too and it’s a gold day.",
            "A day with nothing required, or a vacation day, never breaks a streak.",
          ],
        ],
        [
          "streak",
          "flame",
          "Challenge and Casual",
          "Challenge keeps a streak; Casual keeps score.",
          [
            "Challenge: your streak is cleared days in a row. One missed day is a grace day; two in a row reset it. A freeze saves you from a reset: you earn one every 14 clean days and hold up to 3.",
            "Casual (Settings › Quests & rules › Mode): XP and levels only. No streak, checkpoints, badges or grove, and changes to quests apply at once.",
            "Switching to Casual starts today; switching back starts tomorrow, so it can never rescue a failing day. Your streak waits where it was.",
          ],
        ],
        [
          "rewards",
          "trophy",
          "XP, levels and badges",
          "Minutes and finished quests earn XP.",
          [
            "Minutes, finished quests and cleared days earn XP. Your level never goes down.",
            "Ranks follow your streak. Badges (20, in Badges) cover streaks, focus, topics and planning; once earned they stay earned.",
            "Start a timer within 2 minutes of a reminder you tapped: +10 XP, up to 5 a day.",
          ],
        ],
      ],
    ],
    [
      "Planning",
      [
        [
          "day",
          "sprout",
          "Your day",
          "Wake-up and bedtime shape everything.",
          [
            "Set them in Settings › Your day.",
            "The day locks at midnight, or at bedtime if that’s after midnight (up to 5 am), so late work still counts for its day.",
            "Quests added after the middle of your day count from tomorrow.",
            "Woke up late? Adjust today’s hours in Schedule.",
          ],
        ],
        [
          "weekly",
          "metronome",
          "Weekly totals",
          "Judged once, at the end of the week.",
          [
            "A total quest runs over a week (Monday to Sunday, or Sunday to Saturday if you change it in Settings › Your day), every 2 weeks, or a calendar month.",
            "Day to day only daily quests count. Each total is checked twice: by its middle work day you need a third (miss it and the days so far are lost, streak reset), and on the last day you need all of it (miss it and the whole period is lost).",
            "Its pace is a guide: fall behind and the gap is spread over the work days left. On days you didn’t tick it sits under Off today, and extra time still counts.",
          ],
        ],
        [
          "schedule",
          "note",
          "Schedule",
          "Plan when your time quests happen.",
          [
            "Tap Schedule, tap a free time and pick a quest, or Auto-plan the rest. The ‹ › arrows plan up to 13 days ahead; those blocks remind on their day.",
            "Hold and drag to move a block; hold it near the top or bottom and the day scrolls with you. Tap a block, then drag its yellow corner tab to resize. Split it for several shots.",
            "A range’s reminder starts the timer; a 5-min start’s reminder starts Just 5.",
            "Busy times (Settings › Your day, or the Busy times button) is a weekday timeline for lectures, meetings and work. Blocks repeat every week on their days from the day you add them; the schedule and Auto-plan go around them. Quests you already placed on top stay for that day.",
            "Tap a quest block › Repeat to repeat it on chosen weekdays for up to 26 weeks. Moving one repeat changes today only, with Every week to change them all.",
            "It’s planning only and never affects clearing a day.",
          ],
        ],
        [
          "changes",
          "star",
          "Changing quests",
          "Making things easier starts tomorrow.",
          [
            "Lowering a goal, pausing, deleting, making optional or removing days takes effect tomorrow.",
            "Pausing a quest lasts until the end of the current week, never into the next one.",
            "New quests can start today, tomorrow or next week. Weekly totals added after midday on the 4th day of the week start next week.",
            "The daily quest limit counts required quests on each weekday.",
            "In Casual mode every change applies right away.",
          ],
        ],
      ],
    ],
    [
      "Focus and tools",
      [
        [
          "focus",
          "flame",
          "Timers, Just 5 and sprints",
          "Start small, keep going.",
          [
            "▶ on a time quest starts a timer, and Today shows just that quest until you stop.",
            "Just 5 starts five minutes on the next unfinished time quest. Stop at the chime or keep going.",
            "Sprint (in the ⋮ menu) runs focus blocks with 15-minute breaks and logs the minutes.",
            "The timer notification grows a sapling toward your goal.",
          ],
        ],
        [
          "pomodoro",
          "clock",
          "Pomodoro",
          "25 on, 5 off, long break after 4.",
          [
            "Pomodoro (in the ⋮ menu) is its own page: pick a time quest, start, and the tomato fills as the 25 minutes run. Then a 5-minute break, and a 15-minute one after every fourth.",
            "A finished pomodoro logs its minutes to the quest like a timer, and is drawn onto today’s schedule afterwards, so the plan shows what really happened.",
            "All or nothing: stop early and nothing is logged to the quest — finishing is the point. Set up is on the page: any focus length from 15 to 90 minutes, short breaks 5 to 30, long breaks 10 to 60, how often the long break comes (− / +, from never to every 12), and auto-start, which starts the next pomodoro when a short break ends (a new set always starts by hand).",
            "Save up to four presets of lengths and long break (Set up › Save as preset) and switch between them with one tap; Edit on a preset changes its name and values or deletes it. Like the lengths, a preset waits until the set under way is done.",
            "Trends › Pomodoro counts the week, days in a row, your best day, the longest chain and the harvest. No XP: the quest minutes are the reward.",
            "Signed in, a pomodoro moves between your devices: open the app on the other one and tap Continue here on the “Pomodoro running on your phone” card. The countdown carries on where it was, and the device you left stops it (a phone you left in your pocket stops when you next open it). Each pomodoro is logged once, by the device running it when it finishes. Only one runs at a time: starting one while another device runs one asks whether to continue that one here or end it and start new.",
          ],
        ],
        [
          "notes",
          "note",
          "Notes",
          "Jot it down; it clears itself.",
          [
            "Turn on the Notes page in Settings › Add-ons and it joins the title bar. Take a note, give it a colour, pin the ones you keep coming back to, search the rest.",
            "Nothing here is for keeps: a note clears itself 30 days after you last edited it, and the card says how long it has left. Edit it to keep it another 30.",
            "Signed in, notes sync with everything else.",
          ],
        ],
        [
          "alerts",
          "note",
          "Reminders",
          "Only the ones you pick.",
          [
            "Turn them on in Settings › Notifications and choose which to get.",
            "Tapping one opens what it’s about: your timer, open quests, the schedule or a deadline.",
          ],
        ],
        [
          "subjects",
          "sprout",
          "Subjects",
          "Track what you’re learning.",
          [
            "Add subjects and topics, and rate each topic from 1 to 5 by what you can do now: 1 know the terms, 2 follow a worked example, 3 solve standard problems without notes, 4 apply it to new problems or explain it, 5 teach it. Time spent never changes a rating.",
            "A topic with 5h+ in 4 weeks but no level change is flagged: either the rating is behind, or the time wasn’t really on that topic.",
            "Pick the topics a quest feeds when you edit it. Its subjects follow.",
            "Every timer lands on one of those topics: one due for review first, then the one furthest below its goal, then the last one you used. Tap another topic on the running timer to switch; the time is split.",
            "Each week, your top 3 topics from last week (an hour or more each) get a quick rerate.",
            "Topics untouched for two weeks are marked for review.",
          ],
        ],
        [
          "account",
          "star",
          "Account and sync",
          "Your data belongs to your account; offline still works.",
          [
            "When you\u2019re signed out the app opens on Sign in: sign in, create an account, reset a forgotten password, or tap Use without account for this time (you\u2019re asked again each time you open the app; Settings \u203a Account signs in any time). Once signed in you stay signed in until you sign out \u2014 there\u2019s no time-out.",
            "Data is linked to accounts. Signing in shows that account\u2019s data; signing out removes it from this device (it stays in your account and comes back when you sign in). If some changes haven\u2019t synced yet, Sign out asks first. Data you made without an account moves into a new account when you create one, or into an account that has nothing in it yet.",
            "A new account gets an email to verify your address; Settings \u203a Account shows it until you tap the link (Resend, then Done). Change password and Delete account are there too. Deleting removes the account and all its data, here and everywhere \u2014 export a backup first if you want a copy. Settings \u203a Your data \u203a Erase this device removes all app data from this device (and signs you out); accounts keep theirs in the cloud.",
            "Your quests, rules, subjects, settings, days and reflections sync, and so do your look-and-feel choices (theme, sound, Minimal view, which groups are open); the running timer doesn\u2019t. Everything keeps working offline; changes made on two devices merge by time: the newer change to each day or setting wins.",
          ],
        ],
        [
          "data",
          "metronome",
          "Your data",
          "Yours, on this device; in your account only if you sign in.",
          [
            "Everything is stored on this device. Nothing is sent anywhere unless you sign in under Settings › Account, and then only to your own account.",
            "Export a backup now and then in Settings › Your data. Import merges it back in.",
          ],
        ],
      ],
    ],
  ];
  hpPg = null;
  document.getElementById("helpBtn").addEventListener("click", function () {
    openHelp();
  });
}
