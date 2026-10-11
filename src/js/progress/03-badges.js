/* ---- badges (achievements) ----
     D.ach = 20 badges in D.groups. badgeStats() reads the whole history once; BADGE_RULE maps each badge to
     [have, need, unit]. Earned badges are stored in cfg.badges = {id: "YYYY-MM-DD"} and stay earned, even if a
     streak breaks or a rating drops later. Certificates are drawn on demand (certPDF), nothing is embedded. */
import { G } from "../core/g.js";
import { D, S, START_KEY } from "../core/00-state.js";
import { cfg, saveCfg } from "../core/config.js";
import { add, parse, todayKey, weekStart } from "../core/days.js";
import { locked } from "../core/entries.js";
import { clone, esc, fmtD, hm, svg } from "../core/util.js";
import { loadPDF } from "./49-wrap-up.js";
import { perStart, periodList } from "../rules/26-periods.js";
import { compute } from "../rules/compute.js";
import { gold, metQ } from "../rules/day-rules.js";
import { noStreakOn, rewardsOff } from "../rules/modes.js";
import { defsOf } from "../rules/quests-on-day.js";
import { schAll } from "../schedule/model.js";
import { subjList } from "../subjects/32-subjects.js";
import { go } from "../ui/44-navigation.js";
import { setSync, showToast } from "../ui/feedback.js";

export var grid, toast, cards, badgeSig, BADGE_RULE, STREAKY, TOAST_HOLD, bootAt, userActed;

export function badgeStats(st) {
  var T = todayKey(),
    o = {
      best: st.best || 0,
      total: st.total || 0,
      streak: st.streak || 0,
      resets: (st.resets || []).length,
      gold: 0,
      focus: 0,
      sess: 0,
      week: 0,
      calls: 0,
      plan: 0,
      topics: 0,
      levelup: 0,
      goal: 0,
      maxp: 0,
      maxtt: 0,
      finished: 0,
    },
    wk = {},
    tt = {};
  Object.keys(S.days).forEach(function (k) {
    if (k < START_KEY || k > T || noStreakOn(k)) return;
    var e = S.days[k];
    if (!e) return;
    if (gold(e)) o.gold++;
    var f = 0,
      D2 = defsOf(e);
    D2.forEach(function (q) {
      if (q.type === "time") f += e[q.id] | 0;
    });
    o.focus += f;
    var ws = weekStart(k);
    wk[ws] = (wk[ws] || 0) + f;
    (e.sess || []).forEach(function (z) {
      if (z.m > o.sess) o.sess = z.m;
    });
    o.calls += e.calls | 0;
    Object.keys(e.tt || {}).forEach(function (id) {
      tt[id] = (tt[id] || 0) + (e.tt[id] | 0);
    });
    if (e.sched || cfg().rep) {
      var bl = schAll(k).filter(function (b) {
          return b.q;
        }),
        qs = bl
          .map(function (b) {
            return b.q;
          })
          .filter(function (x, i, a) {
            return a.indexOf(x) === i;
          });
      if (
        bl.length >= 2 &&
        qs.every(function (id) {
          var q = D2.filter(function (x) {
            return x.id === id;
          })[0];
          return q && metQ(q, e);
        })
      )
        o.plan++;
    }
  });
  Object.keys(wk).forEach(function (w) {
    if (wk[w] > o.week) o.week = wk[w];
  });
  Object.keys(tt).forEach(function (id) {
    if (tt[id] > o.maxtt) o.maxtt = tt[id];
  });
  subjList().forEach(function (s) {
    (s.topics || []).forEach(function (t) {
      var p = t.p || 0,
        h = t.hist || [];
      o.topics++;
      if (p > o.maxp) o.maxp = p;
      if (h.length && h[0].p < p) o.levelup = 1;
      if (t.target && p >= t.target) o.goal = 1;
    });
  });
  o.finished = cfg().quests.filter(function (q) {
    return q.completed && q.completed.how !== "archived" && !noStreakOn(q.completed.on);
  }).length;
  return o;
}
export function badgeStreak(st) {
  return { best: st.best || 0, total: st.total || 0, streak: st.streak || 0, resets: (st.resets || []).length };
}
export function badgeProg(a, o) {
  var r = BADGE_RULE[a.id](o),
    h = Math.min(r[0], r[1]);
  return {
    have: h,
    need: r[1],
    pc: Math.floor((h / r[1]) * 100),
    txt:
      r[2] === "m"
        ? hm(h) + " of " + hm(r[1])
        : r[2] === "d"
          ? h + " of " + r[1] + " days"
          : r[2] === "p"
            ? h + " of " + r[1]
            : h + " of " + r[1],
  };
}
export function badgesEarned() {
  return cfg().badges || {};
}
export function nextBadge(o) {
  var E = badgesEarned(),
    best = null;
  D.ach.forEach(function (a) {
    if (E[a.id]) return;
    var p = badgeProg(a, o);
    if (!best || p.pc > best.p.pc) best = { a: a, p: p };
  });
  return best;
}
export function settledAsOf() {
  var T = todayKey(),
    a = add(T, -1);
  periodList(T).forEach(function (q) {
    var p = add(perStart(q, T), -1);
    if (p < a) a = p;
  });
  return a;
}
export function renderBadges(st) {
  var o = badgeStats(st),
    E = badgesEarned(),
    T = todayKey(),
    fresh = [],
    so = null,
    wait = {};
  D.ach.forEach(function (a) {
    var r = BADGE_RULE[a.id];
    if (E[a.id] || r(o)[0] < r(o)[1]) return;
    if (STREAKY[a.id]) {
      if (!so) {
        var sa0 = settledAsOf();
        so = sa0 < START_KEY ? badgeStreak({}) : badgeStreak(compute(sa0));
      }
      if (!(r(Object.assign({}, o, so))[0] >= r(o)[1])) {
        wait[a.id] = 1;
        return;
      }
    }
    fresh.push(a);
  });
  if (fresh.length && !locked() && !rewardsOff()) {
    var c2 = clone(cfg());
    c2.badges = Object.assign({}, c2.badges || {});
    fresh.forEach(function (a) {
      c2.badges[a.id] = T;
    });
    saveCfg(c2);
    E = c2.badges;
    var a0 = fresh[fresh.length - 1];
    showToast(
      fresh.length > 1
        ? {
            icon: a0.icon,
            title: fresh.length + " badges",
            desc: fresh
              .map(function (a) {
                return a.title;
              })
              .join(", "),
          }
        : a0,
    );
  }
  var n = 0;
  D.ach.forEach(function (a) {
    var el = cards[a.id],
      u = !!E[a.id],
      p = badgeProg(a, o);
    if (u) n++;
    el.classList.toggle("locked", !u);
    el.querySelector(".abar").hidden = u;
    el.querySelector(".abar i").style.width = p.pc + "%";
    el.querySelector(".st").textContent = u
      ? "Earned " + fmtD(E[a.id])
      : wait[a.id]
        ? "Earned once this period's totals are in"
        : p.txt;
    el.querySelector("button").hidden = !(u && (G.dl || G.dlChecked));
  });
  D.groups.forEach(function (g) {
    var L = D.ach.filter(function (a) {
        return a.group === g.id;
      }),
      k = L.filter(function (a) {
        return E[a.id];
      }).length;
    grid.querySelector('[data-bg="' + g.id + '"] small').textContent = k + "/" + L.length;
  });
  var sumEl = document.getElementById("achSum");
  if (sumEl) sumEl.textContent = n + " of " + D.ach.length + " earned";
  var sa = document.getElementById("sideAch");
  if (sa) {
    var nb = nextBadge(o),
      a = nb ? nb.a : D.ach[D.ach.length - 1];
    sa.className = "sideach px" + (nb ? " locked" : "");
    sa.innerHTML =
      '<div class="slot">' +
      svg(a.icon) +
      '</div><div><div class="k">' +
      (nb ? "Next badge" : "All badges earned") +
      '</div><div class="n"></div><div class="p">' +
      (nb ? esc(nb.p.txt) : n + " of " + D.ach.length) +
      '</div><div class="bar"><i style="width:' +
      (nb ? nb.p.pc : 100) +
      '%"></i></div></div><button type="button" class="lnk">See all badges</button>';
    sa.querySelector(".n").textContent = nb ? a.title : "Every badge";
    sa.querySelector(".lnk").addEventListener("click", function () {
      go("achievements");
    });
  }
  return o;
}
export function certPDF(a, btn) {
  var on = badgesEarned()[a.id] || todayKey();
  btn.disabled = true;
  setSync("Building certificate…");
  Promise.all([
    loadPDF(),
    document.fonts && document.fonts.load
      ? Promise.all([document.fonts.load('20px "Press Start 2P"')]).catch(function () {})
      : null,
  ])
    .then(function (r) {
      var J = r[0],
        W = 1650,
        H = 1275,
        c = document.createElement("canvas");
      c.width = W;
      c.height = H;
      var g = c.getContext("2d"),
        PX = '"Press Start 2P", monospace';
      g.fillStyle = "#18202E";
      g.fillRect(0, 0, W, H);
      for (var y = 0; y < H; y += 50)
        for (var x = 0; x < W; x += 50)
          if (((x + y) / 50) % 2 === 0) {
            g.fillStyle = "#1C2536";
            g.fillRect(x, y, 50, 50);
          }
      var tw = 1170,
        th = 355,
        tx = (W - tw) / 2,
        ty = H / 2 - 360,
        gg = 12;
      function pr(x, y, w, h, col) {
        g.fillStyle = col;
        g.fillRect(x + gg, y, w - 2 * gg, h);
        g.fillRect(x, y + gg, w, h - 2 * gg);
      }
      pr(tx - gg, ty - gg, tw + 2 * gg, th + 2 * gg, "#000");
      pr(tx, ty, tw, th, "#60554A");
      pr(tx + gg, ty + gg, tw - 2 * gg, th - 2 * gg, "#24211E");
      var s = 230,
        sx = tx + 62,
        sy = ty + (th - s) / 2;
      g.fillStyle = "#9D8B79";
      g.fillRect(sx - 16, sy - 16, s + 32, s + 32);
      g.fillStyle = "#CCC6C0";
      g.fillRect(sx - 8, sy - 8, s + 16, s + 16);
      var ic = D.icons[a.icon] || D.icons.star,
        p = s / 16;
      ic.rows.forEach(function (row, ry) {
        for (var rx = 0; rx < 16; rx++) {
          var ch = row[rx];
          if (ch !== ".") {
            g.fillStyle = ic.pal[ch];
            g.fillRect(Math.round(sx + rx * p), Math.round(sy + ry * p), Math.ceil(p), Math.ceil(p));
          }
        }
      });
      var X = sx + s + 70;
      g.textAlign = "left";
      g.font = "31px " + PX;
      g.fillStyle = "#FFFF55";
      g.fillText("Badge earned", X, ty + 120);
      var fs = 42,
        t = a.title,
        avail = tw - (X - tx) - 40;
      g.fillStyle = "#fff";
      g.font = fs + "px " + PX;
      while (g.measureText(t).width > avail && fs > 22) {
        fs -= 2;
        g.font = fs + "px " + PX;
      }
      g.fillText(t, X, ty + 205);
      var d0 = a.desc || "",
        dfs = 20;
      g.font = dfs + "px " + PX;
      while (g.measureText(d0).width > avail && dfs > 12) {
        dfs--;
        g.font = dfs + "px " + PX;
      }
      g.fillStyle = "#C5BDB5";
      g.fillText(d0, X, ty + 270);
      g.textAlign = "center";
      g.font = "22px " + PX;
      g.fillStyle = "#9AA2B1";
      g.fillText(
        "Earned " + parse(on).toLocaleDateString("en-CA", { month: "long", day: "numeric", year: "numeric" }),
        W / 2,
        ty + th + 170,
      );
      g.fillText("QuestTime", W / 2, H - 100);
      var pdf = new J({ orientation: "landscape", unit: "pt", format: "letter" });
      pdf.setProperties({ title: "Badge: " + a.title });
      pdf.addImage(c.toDataURL("image/png"), "PNG", 0, 0, 792, 612, undefined, "FAST");
      var blob = pdf.output("blob"),
        name = "badge-" + a.id + ".pdf";
      if (G.dl)
        return G.dl.save({ filename: name, data: blob }).then(
          function () {
            setSync("Certificate saved");
          },
          function () {
            setSync("Certificate couldn't be saved here");
          },
        );
      var u = URL.createObjectURL(blob),
        an = document.createElement("a");
      an.href = u;
      an.download = name;
      document.body.appendChild(an);
      an.click();
      an.remove();
      setTimeout(function () {
        URL.revokeObjectURL(u);
      }, 4000);
      setSync("Certificate saved");
    })
    .catch(function () {
      setSync("PDF engine didn't load. Check your connection.");
    })
    .finally(function () {
      btn.disabled = false;
    });
}

/* Runs once at startup, in file-number order (main.js). */
export function init() {
  grid = document.getElementById("achGrid");
  toast = document.getElementById("toast");
  cards = {};
  badgeSig = "";
  (function () {
    var h = "";
    D.groups.forEach(function (g) {
      h +=
        '<h3 class="ach-sub" data-bg="' +
        g.id +
        '">' +
        esc(g.name) +
        ' <small></small></h3><div class="ach-grid" data-bgrid="' +
        g.id +
        '"></div>';
    });
    grid.innerHTML = h;
    D.ach.forEach(function (a) {
      var el = document.createElement("div");
      el.className = "ach px locked";
      el.setAttribute("data-bid", a.id);
      el.innerHTML =
        '<div class="slot">' +
        svg(a.icon) +
        '</div><div class="ab"><div class="t2"></div><div class="t3"></div><div class="abar"><i></i></div><div class="st"></div><button type="button" hidden>Certificate</button></div>';
      el.querySelector(".t2").textContent = a.title;
      el.querySelector(".t3").textContent = a.desc;
      var b = el.querySelector("button");
      b.addEventListener("click", function () {
        certPDF(a, b);
      });
      grid.querySelector('[data-bgrid="' + a.group + '"]').appendChild(el);
      cards[a.id] = el;
    });
  })();
  BADGE_RULE = {
    week: function (o) {
      return [o.best, 7, "d"];
    },
    "3weeks": function (o) {
      return [o.best, 21, "d"];
    },
    "3months": function (o) {
      return [o.best, 90, "d"];
    },
    "1year": function (o) {
      return [o.best, 365, "d"];
    },
    comeback: function (o) {
      return [o.resets ? o.streak : 0, 7, "d"];
    },
    clear50: function (o) {
      return [o.total, 50, "d"];
    },
    gold10: function (o) {
      return [o.gold, 10, "n"];
    },
    finisher: function (o) {
      return [o.finished, 1, "n"];
    },
    focus10: function (o) {
      return [o.focus, 600, "m"];
    },
    focus100: function (o) {
      return [o.focus, 6000, "m"];
    },
    deep: function (o) {
      return [o.sess, 90, "m"];
    },
    bigweek: function (o) {
      return [o.week, 900, "m"];
    },
    topics5: function (o) {
      return [o.topics, 5, "n"];
    },
    levelup: function (o) {
      return [o.levelup, 1, "n"];
    },
    goal: function (o) {
      return [o.goal, 1, "n"];
    },
    expert: function (o) {
      return [o.maxp, 5, "p"];
    },
    special: function (o) {
      return [o.maxtt, 1200, "m"];
    },
    plankept: function (o) {
      return [o.plan, 1, "n"];
    },
    architect: function (o) {
      return [o.plan, 10, "n"];
    },
    oncall: function (o) {
      return [o.calls, 10, "n"];
    },
  };
  /* Streak badges are only awarded from settled days: up to yesterday and before any total's period still running,
     since a missed checkpoint can still take those days back. */
  STREAKY = { week: 1, "3weeks": 1, "3months": 1, "1year": 1, comeback: 1, clear50: 1 };
  /* A toast raised in the first TOAST_HOLD ms after launch, before the person has touched anything (badges earned retroactively on open, say), waits for the first tap or key, so it never covers the header on launch. */
  TOAST_HOLD = 3000;
  bootAt = Date.now();
  G.toastQ = null;
  userActed = false;
  ["pointerdown", "keydown"].forEach(function (ev) {
    document.addEventListener(
      ev,
      function () {
        userActed = true;
        if (G.toastQ) {
          var a = G.toastQ;
          G.toastQ = null;
          showToast(a);
        }
      },
      { capture: true, passive: true },
    );
  });
}
