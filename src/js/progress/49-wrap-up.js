/* ---- daily wrap-up (share card / PDF of the day) ---- */
var wrapBtn = document.getElementById("wrapBtn");
function wrapDay() {
  var T = todayKey(),
    k = ro() ? viewKey : add(T, -1);
  return k >= START_KEY && k < T ? k : null;
}
function wrapLabel() {
  var k = wrapDay();
  wrapBtn.disabled = !k;
  wrapBtn.textContent = k ? "Wrap-up: " + fmtD(k) : "Wrap-up unlocks at midnight";
}
var jspdfP = null;
function loadPDF() {
  if (window.jspdf && window.jspdf.jsPDF) return Promise.resolve(window.jspdf.jsPDF);
  if (!jspdfP)
    jspdfP = new Promise(function (res, rej) {
      var sc = document.createElement("script");
      sc.src = "vendor/jspdf.umd.min.js";
      sc.onload = function () {
        window.jspdf && window.jspdf.jsPDF ? res(window.jspdf.jsPDF) : rej();
      };
      sc.onerror = function () {
        jspdfP = null;
        rej();
      };
      document.head.appendChild(sc);
    });
  return jspdfP;
}
function rng(seed) {
  var h = 2166136261;
  for (var i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return function () {
    h += 0x6d2b79f5;
    var t = h;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function pick(r, a) {
  return a[Math.floor(r() * a.length)];
}
function note(k, e, st) {
  var r = rng("note" + k),
    defs = defsOf(e),
    rows = defs
      .filter(function (q) {
        return q.type === "time";
      })
      .map(function (q) {
        var p = planOf(q, e),
          d = e[q.id] | 0;
        return { k: q.id, n: q.label, min: q.min, p: p, d: d, gap: d - p };
      });
  var tp = rows.reduce(function (a, x) {
      return a + x.p;
    }, 0),
    td = rows.reduce(function (a, x) {
      return a + x.d;
    }, 0),
    pct = tp ? Math.round((td / tp) * 100) : 0;
  var cleared = ok(e),
    lim = limBroken(e),
    blank = !hasEntry(e),
    brk = defs.filter(function (q) {
      return overQ(q, e);
    })[0];
  var under = rows
      .filter(function (x) {
        return x.d < x.p;
      })
      .sort(function (a, b) {
        return a.gap - b.gap;
      }),
    over = rows
      .filter(function (x) {
        return x.d >= x.p * 1.25 && x.d > 0;
      })
      .sort(function (a, b) {
        return b.gap - a.gap;
      });
  var miss = rows.filter(function (x) {
    return x.d < x.min;
  });
  var head, body;
  if (blank) {
    head = pick(r, ["Blank page", "Quiet day", "Off the map"]);
    body = pick(r, [
      "Nothing was logged. One day is a blip, two is a pattern. Open tomorrow with the easiest quest and log it the moment it's done.",
      "An empty log. Missing a day costs less than missing the next one. Start tomorrow with a 10-minute version of any quest.",
      "No entries today. Log as you go tomorrow instead of at night; it's easier to keep a day you can see.",
    ]);
  } else if (lim) {
    var sl = brk.unit === "min",
      bv = e[brk.id] | 0;
    head = pick(r, ["Leak detected", "Limit broken", "Over the line"]);
    body =
      (sl ? bv + " minutes on " + brk.label : brk.label + " hit " + bv + " (max " + brk.max + ")") +
      ". " +
      pick(r, [
        "The work that did happen still counts. Change the environment before the first block tomorrow.",
        sl
          ? "Find the first slip of the day; it usually sets the rest. Remove that trigger tomorrow."
          : "Avoid the trigger rather than resisting it. Out of sight is easier than willpower.",
        "One broken limit ends the day, not the week. Reset tonight.",
      ]);
  } else if (cleared && !under.length) {
    head = pick(r, ["Plan met", "Clean sweep", "On the grid", "Full marks"]);
    body =
      "Every quest met its plan: " +
      hm(td) +
      " done against " +
      hm(tp) +
      " planned (" +
      pct +
      "%). " +
      (over.length
        ? over[0].n +
          " ran " +
          hm(over[0].gap) +
          " over plan; " +
          pick(r, [
            "if that keeps happening, plan it higher.",
            "your plan may be too safe.",
            "consider giving that time to a quieter lane.",
          ])
        : pick(r, [
            "Next step: raise one plan by 10 minutes.",
            "Keep the plans honest and do it again.",
            "Repeat tomorrow; consistency beats intensity.",
          ]));
  } else if (cleared) {
    var u = under[0];
    head = pick(r, ["Cleared, with slack", "Cleared, not quite to plan", "Day cleared"]);
    body =
      "Minimums held, but " +
      u.n +
      " came in " +
      hm(-u.gap) +
      " under plan. " +
      pick(r, [
        "Either the plan is too ambitious or it started too late. Try it earlier tomorrow.",
        "Schedule it before anything else tomorrow.",
        "If this repeats, lower the plan to what you actually do, then build up.",
      ]);
  } else {
    var m = miss.slice().sort(function (a, b) {
      return b.d - b.min - (a.d - a.min);
    })[0];
    head = pick(r, ["So close", "Not this time", "Near miss"]);
    body =
      (m
        ? "Closest miss: " + m.n + ", " + hm(m.min - m.d) + " short of the minimum."
        : (function () {
            var f = defs.filter(function (q) {
              return q.type !== "time" && !metQ(q, e);
            })[0];
            return f
              ? f.type === "wake"
                ? "The wake-up time fell outside the window."
                : f.label + " was not met."
              : "Not every base was met.";
          })()) +
      " " +
      pct +
      "% of the plan got done. " +
      pick(r, [
        "Tomorrow, lead with whatever fell short.",
        "Put the missed quest first on tomorrow's schedule.",
        "A short session still counts; don't skip it because it can't be long.",
      ]);
  }
  var best = rows.slice().sort(function (a, b) {
      return b.d - a.d;
    })[0],
    fun = "";
  var fr = pick(r, [0, 1, 2, 3]);
  if (best && best.d) {
    if (fr === 0)
      fun = "At this pace, " + best.n + " adds up to about " + Math.round((best.d * 365) / 60) + " hours a year.";
    else if (fr === 1)
      fun = "Total focus today: " + hm(td) + ". That's roughly " + Math.max(1, Math.round(td / 25)) + " Pomodoros.";
    else if (fr === 2 && st.streak && !noStreakOn(k))
      fun =
        "Streak after today: " + st.streak + " day" + (st.streak === 1 ? "" : "s") + ". Best so far: " + st.best + ".";
    else fun = "Biggest block: " + best.n + " at " + hm(best.d) + ".";
  }
  return {
    rows: rows,
    tp: tp,
    td: td,
    pct: pct,
    cleared: cleared,
    lim: lim,
    head: head,
    body: body,
    fun: fun,
    icon: pick(r, Object.keys(D.icons)),
  };
}
function wrapCanvas(k) {
  var e = S.days[k] || {},
    st = compute(k),
    n = note(k, e, st),
    W = 1275,
    H = 1650,
    c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  var g = c.getContext("2d"),
    PX = '"Press Start 2P", monospace',
    VT = "VT323, monospace";
  g.imageSmoothingEnabled = false;
  g.fillStyle = "#18202E";
  g.fillRect(0, 0, W, H);
  for (var y = 0; y < H; y += 48)
    for (var x = 0; x < W; x += 48)
      if (((x + y) / 48) % 2 === 0) {
        g.fillStyle = "#1C2536";
        g.fillRect(x, y, 48, 48);
      }
  function panel(x, y, w, h, fill) {
    g.fillStyle = "#000";
    g.fillRect(x - 6, y - 6, w + 12, h + 12);
    g.fillStyle = "#555";
    g.fillRect(x, y, w, h);
    g.fillStyle = fill || "#212121";
    g.fillRect(x + 6, y + 6, w - 12, h - 12);
  }
  function txt(t, x, y, font, col, al) {
    g.font = font;
    g.fillStyle = col;
    g.textAlign = al || "left";
    g.textBaseline = "alphabetic";
    g.fillText(t, x, y);
  }
  function wrap(t, x, y, w, lh, font, col) {
    g.font = font;
    var words = t.split(" "),
      line = "";
    words.forEach(function (wd) {
      var tst = line ? line + " " + wd : wd;
      if (g.measureText(tst).width > w && line) {
        txt(line, x, y, font, col);
        y += lh;
        line = wd;
      } else line = tst;
    });
    if (line) {
      txt(line, x, y, font, col);
      y += lh;
    }
    return y;
  }
  function icon(name, x, y, sz) {
    var ic = D.icons[name],
      p = sz / 16;
    ic.rows.forEach(function (row, ry) {
      for (var rx = 0; rx < 16; rx++) {
        var ch = row[rx];
        if (ch !== ".") {
          g.fillStyle = ic.pal[ch];
          g.fillRect(Math.round(x + rx * p), Math.round(y + ry * p), Math.ceil(p), Math.ceil(p));
        }
      }
    });
  }
  txt("ProductivityCraft", 90, 130, "28px " + PX, "#FFFFFF");
  txt("Daily wrap-up", 90, 185, "22px " + PX, "#FFFF55");
  txt(
    parse(k).toLocaleDateString("en-CA", { weekday: "long", month: "long", day: "numeric", year: "numeric" }),
    90,
    235,
    "40px " + VT,
    "#C3CBD6",
  );
  var np = noStreakOn(k),
    defs = defsOf(e),
    badge = np
      ? ["CASUAL", "#4E5560"]
      : n.cleared
        ? gold(e)
          ? ["GOLD DAY", "#B8860B"]
          : ["DAY CLEARED", "#3C8527"]
        : n.lim
          ? ["LIMIT BROKEN", "#9E2A1F"]
          : ["NOT CLEARED", "#9E2A1F"];
  g.font = "20px " + PX;
  var bw = g.measureText(badge[0]).width + 48;
  g.fillStyle = "#000";
  g.fillRect(W - 90 - bw - 4, 96, bw + 8, 70);
  g.fillStyle = badge[1];
  g.fillRect(W - 90 - bw, 100, bw, 62);
  txt(badge[0], W - 90 - bw / 2, 142, "20px " + PX, "#FFFFFF", "center");
  txt(
    bases(e) +
      "/" +
      reqOf(defs).length +
      " done  \u00b7  " +
      (np ? "casual  \u00b7  +" + dayXP(e) + " XP" : "streak " + st.streak + "  \u00b7  +" + dayXP(e) + " XP"),
    W - 90,
    215,
    "36px " + VT,
    "#C3CBD6",
    "right",
  );
  var px = 90,
    py = 280,
    pw = W - 180,
    ph = 520;
  panel(px, py, pw, ph, "#C6C6C6");
  txt("Plan vs done", px + 36, py + 62, "20px " + PX, "#3F3F3F");
  var maxv = Math.max(
      60,
      ...n.rows.map(function (r) {
        return Math.max(r.p, r.d);
      }),
    ),
    bx = px + 330,
    bwid = pw - 330 - 290,
    ry = py + 110,
    rs = Math.min(90, Math.floor((ph - 170) / Math.max(1, n.rows.length)));
  if (!n.rows.length) txt("No time quests on this day.", px + 36, py + 140, "32px " + VT, "#5A5A5A");
  n.rows.slice(0, 6).forEach(function (r) {
    txt(r.n.length > 18 ? r.n.slice(0, 17) + "\u2026" : r.n, px + 36, ry + 30, "32px " + VT, "#1E1E1E");
    g.fillStyle = "#8B8B8B";
    g.fillRect(bx, ry, bwid, 20);
    g.fillStyle = "#5B6CF0";
    g.fillRect(bx, ry, Math.round((bwid * r.p) / maxv), 20);
    g.fillStyle = "#373737";
    g.fillRect(bx, ry + 26, bwid, 20);
    g.fillStyle = r.d >= r.p ? "#50D65A" : r.d >= r.min ? "#E8B923" : "#E0453A";
    g.fillRect(bx, ry + 26, Math.round((bwid * r.d) / maxv), 20);
    txt(hm(r.d) + " / " + hm(r.p), px + pw - 36, ry + 30, "32px " + VT, "#1E1E1E", "right");
    txt(
      (r.gap >= 0 ? "+" : "-") + hm(Math.abs(r.gap)),
      px + pw - 36,
      ry + 62,
      "28px " + VT,
      r.gap >= 0 ? "#2E6B24" : "#9E2A1F",
      "right",
    );
    ry += rs;
  });
  txt(
    "Total " + hm(n.td) + " of " + hm(n.tp) + " planned (" + n.pct + "%)",
    px + 36,
    py + ph - 40,
    "34px " + VT,
    "#1E1E1E",
  );
  g.fillStyle = "#5B6CF0";
  g.fillRect(px + pw - 420, py + ph - 62, 24, 20);
  txt("plan", px + pw - 386, py + ph - 44, "28px " + VT, "#1E1E1E");
  g.fillStyle = "#50D65A";
  g.fillRect(px + pw - 280, py + ph - 62, 24, 20);
  txt("done", px + pw - 246, py + ph - 44, "28px " + VT, "#1E1E1E");
  var qy = py + ph + 40,
    qh = 180;
  panel(px, qy, pw, qh, "#C6C6C6");
  var oth = defs
    .filter(function (q) {
      return q.type !== "time" && q.type !== "todo";
    })
    .slice(0, 4);
  if (!oth.length) txt("No other quests on this day.", px + 36, qy + 110, "32px " + VT, "#5A5A5A");
  oth.forEach(function (q, i) {
    var v = e[q.id],
      val =
        q.type === "weekly"
          ? weekCount(q.id, k, true) + "/" + q.min + " wk"
          : q.type === "wake"
            ? v || "--:--"
            : q.type === "check"
              ? v
                ? "Done"
                : "Not done"
              : q.type === "scale"
                ? (v | 0) + "/" + (q.scale || 5)
                : q.type === "target"
                  ? String(num(v))
                  : q.unit === "min"
                    ? hm(v)
                    : String(v | 0),
      sub =
        q.type === "wake"
          ? "ok " + q.from + "-" + q.to
          : q.type === "limit"
            ? "max " + (q.unit === "min" ? q.max + "m" : q.max)
            : q.type === "target"
              ? "goal " + num(q.min) + (q.ul ? " " + q.ul : "")
              : q.type === "scale"
                ? "pass at " + q.min + "+"
                : "",
      lb = q.label.length > 16 ? q.label.slice(0, 15) + "\u2026" : q.label;
    var cx = px + 36 + i * ((pw - 72) / oth.length);
    txt(lb, cx, qy + 62, "14px " + PX, "#3F3F3F");
    txt(val, cx, qy + 120, "48px " + VT, metQ(q, e) ? "#2E6B24" : "#9E2A1F");
    txt(sub, cx, qy + 160, "28px " + VT, "#5A5A5A");
  });
  var ny = qy + qh + 40,
    nh = H - ny - 110;
  panel(px, ny, pw, nh);
  g.fillStyle = "#C6C6C6";
  g.fillRect(px + 36, ny + 36, 168, 168);
  g.fillStyle = "#8B8B8B";
  g.fillRect(px + 42, ny + 42, 156, 156);
  g.fillStyle = "#C6C6C6";
  g.fillRect(px + 48, ny + 48, 144, 144);
  icon(n.icon, px + 56, ny + 56, 128);
  var tx = px + 240;
  txt("Surprise note", tx, ny + 72, "16px " + PX, "#FFFF55");
  txt(n.head, tx, ny + 122, "24px " + PX, "#FFFFFF");
  var yy = wrap(n.body, tx, ny + 180, pw - 240 - 40, 40, "34px " + VT, "#E6E6E6");
  if (n.fun) wrap(n.fun, tx, yy + 14, pw - 240 - 40, 40, "34px " + VT, "#9AA6FF");
  txt(
    "Page 1 of 2  \u00b7  locked " + fmtD(add(k, 1)) + ", " + (dayEnd() ? dayEnd() + ":00 am" : "12:00 am"),
    W / 2,
    H - 40,
    "28px " + VT,
    "#9AA2B1",
    "center",
  );
  return c;
}
function wrapCanvas2(k) {
  var W = 1275,
    H = 1650,
    c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  var g = c.getContext("2d"),
    PX = '"Press Start 2P", monospace',
    VT = "VT323, monospace";
  g.fillStyle = "#18202E";
  g.fillRect(0, 0, W, H);
  for (var y = 0; y < H; y += 48)
    for (var x = 0; x < W; x += 48)
      if (((x + y) / 48) % 2 === 0) {
        g.fillStyle = "#1C2536";
        g.fillRect(x, y, 48, 48);
      }
  function panel(x, y, w, h, fill) {
    g.fillStyle = "#000";
    g.fillRect(x - 6, y - 6, w + 12, h + 12);
    g.fillStyle = "#555";
    g.fillRect(x, y, w, h);
    g.fillStyle = fill || "#C6C6C6";
    g.fillRect(x + 6, y + 6, w - 12, h - 12);
  }
  function txt(t, x, y, font, col, al) {
    g.font = font;
    g.fillStyle = col;
    g.textAlign = al || "left";
    g.fillText(t, x, y);
  }
  function wrap(t, x, y, w, lh, font, col) {
    g.font = font;
    var ws = t.split(" "),
      line = "";
    ws.forEach(function (wd) {
      var ts = line ? line + " " + wd : wd;
      if (g.measureText(ts).width > w && line) {
        txt(line, x, y, font, col);
        y += lh;
        line = wd;
      } else line = ts;
    });
    if (line) {
      txt(line, x, y, font, col);
      y += lh;
    }
    return y;
  }
  var r = rng("ins" + k),
    e = S.days[k] || {},
    st = compute(k),
    week = [];
  for (var i = 6; i >= 0; i--) week.push(add(k, -i));
  var inW = week.filter(function (d) {
    return d >= START_KEY;
  });
  var qm = {};
  inW.concat([k]).forEach(function (d) {
    defsOf(S.days[d]).forEach(function (q) {
      if (q.type === "time") qm[q.id] = q;
    });
  });
  defsOf(e).forEach(function (q) {
    if (q.type === "time") qm[q.id] = q;
  });
  var Q = Object.keys(qm)
    .map(function (id) {
      return qm[id];
    })
    .slice(0, 6);
  function pl(d, q) {
    var x = S.days[d] || {},
      dq = defsOf(x).filter(function (z) {
        return z.id === q.id;
      })[0];
    return dq ? planOf(dq, x) : 0;
  }
  function dn(d, q) {
    return (S.days[d] || {})[q.id] | 0;
  }
  var rows = Q.map(function (q) {
    var wd = 0,
      wp = 0,
      prev = 0,
      pn = 0;
    inW.forEach(function (d) {
      wd += dn(d, q);
      wp += pl(d, q);
      if (d !== k) {
        prev += dn(d, q);
        pn++;
      }
    });
    return { q: q, wd: wd, wp: wp, today: dn(k, q), avg: pn ? prev / pn : null };
  });
  var cl = inW.filter(function (d) {
      return ok(S.days[d]);
    }).length,
    gd = inW.filter(function (d) {
      return gold(S.days[d] || {});
    }).length;
  txt("ProductivityCraft", 90, 120, "24px " + PX, "#FFFFFF");
  txt("Insights", 90, 172, "22px " + PX, "#FFFF55");
  txt(
    parse(k).toLocaleDateString("en-CA", { weekday: "long", month: "long", day: "numeric", year: "numeric" }),
    W - 90,
    172,
    "36px " + VT,
    "#C3CBD6",
    "right",
  );
  /* week strip */
  var px = 90,
    pw = W - 180,
    py = 200,
    ph = 230;
  panel(px, py, pw, ph);
  txt("Last 7 days", px + 36, py + 58, "18px " + PX, "#3F3F3F");
  txt(
    "Cleared " + cl + "/" + inW.length + "  \u00b7  gold " + gd,
    px + pw - 36,
    py + 58,
    "32px " + VT,
    "#1E1E1E",
    "right",
  );
  var sq = 110,
    gap = (pw - 72 - sq * 7) / 6;
  week.forEach(function (d, i) {
    var x = px + 36 + i * (sq + gap),
      y = py + 86,
      dd = S.days[d] || {},
      col = d < START_KEY ? "#8B8B8B" : gold(dd) ? "#C99A1E" : ok(dd) ? "#3C8527" : "#9E2A1F";
    g.fillStyle = "#000";
    g.fillRect(x - 3, y - 3, sq + 6, 76 + 6);
    g.fillStyle = col;
    g.fillRect(x, y, sq, 76);
    if (d === k) {
      g.strokeStyle = "#FFFF55";
      g.lineWidth = 5;
      g.strokeRect(x - 6, y - 6, sq + 12, 88);
    }
    txt(
      d < START_KEY ? "-" : bases(dd) + "/" + reqOf(defsOf(dd)).length,
      x + sq / 2,
      y + 50,
      "30px " + VT,
      "#FFFFFF",
      "center",
    );
    txt(
      parse(d).toLocaleDateString("en-CA", { weekday: "short" }),
      x + sq / 2,
      y + 112,
      "26px " + VT,
      "#3F3F3F",
      "center",
    );
  });
  /* table */
  var ty = py + ph + 30,
    th = 130 + 46 * Math.max(1, Q.length);
  panel(px, ty, pw, th);
  var cols = [px + 36, px + 380, px + 560, px + 740, px + pw - 36];
  txt("Quest", cols[0], ty + 56, "14px " + PX, "#3F3F3F");
  txt("Week", cols[1], ty + 56, "14px " + PX, "#3F3F3F");
  txt("Plan", cols[2], ty + 56, "14px " + PX, "#3F3F3F");
  txt("vs plan", cols[3], ty + 56, "14px " + PX, "#3F3F3F");
  txt("Today vs avg", cols[4], ty + 56, "14px " + PX, "#3F3F3F", "right");
  rows.forEach(function (rw, i) {
    var y = ty + 104 + i * 46,
      p = rw.wp ? Math.round((rw.wd / rw.wp) * 100) : 0;
    txt(rw.q.label.length > 20 ? rw.q.label.slice(0, 19) + "\u2026" : rw.q.label, cols[0], y, "32px " + VT, "#1E1E1E");
    txt(hm(rw.wd), cols[1], y, "32px " + VT, "#1E1E1E");
    txt(hm(rw.wp), cols[2], y, "32px " + VT, "#1E1E1E");
    txt(p + "%", cols[3], y, "32px " + VT, p >= 100 ? "#2E6B24" : "#9E2A1F");
    var dlt = rw.avg == null ? null : Math.round(rw.today - rw.avg);
    txt(
      dlt == null ? "first day" : (dlt >= 0 ? "+" : "-") + hm(Math.abs(dlt)),
      cols[4],
      y,
      "32px " + VT,
      dlt == null ? "#5A5A5A" : dlt >= 0 ? "#2E6B24" : "#9E2A1F",
      "right",
    );
  });
  /* XP + progress */
  var by = ty + th + 30,
    bh = 240,
    bw = (pw - 40) / 2;
  panel(px, by, bw, bh);
  panel(px + bw + 40, by, bw, bh);
  var mins_ = 0,
    pb = 0;
  Q.forEach(function (q) {
    var d = Math.min(240, e[q.id] | 0);
    mins_ += d;
    if (d > 0 && d >= pl(k, q)) pb += 30;
  });
  var lv = level(xpNet(k));
  {
    txt("XP earned", px + 36, by + 56, "16px " + PX, "#3F3F3F");
    [
      ["Minutes", mins_],
      ["Plan bonuses", pb],
      ["Cleared", ok(e) ? 50 : 0],
      ["Gold", gold(e) ? 100 : 0],
    ].forEach(function (a, i) {
      txt(a[0], px + 36, by + 96 + i * 30, "30px " + VT, "#1E1E1E");
      txt("+" + a[1], px + bw - 36, by + 96 + i * 30, "30px " + VT, "#1E1E1E", "right");
    });
    txt("Level " + lv.l + "  \u00b7  " + lv.cur + "/" + lv.need, px + 36, by + bh - 20, "30px " + VT, "#2E6B24");
  }
  var qx = px + bw + 40,
    nx = null;
  RANKS.forEach(function (x) {
    if (!nx && x[0] > st.streak) nx = x;
  });
  var na = nextBadge(badgeStats(st));
  txt(np ? "Last 7 days" : "Progress", qx + 36, by + 56, "16px " + PX, "#3F3F3F");
  var pr = np
    ? [
        "Focus: " +
          hm(
            rows.reduce(function (a, x) {
              return a + x.wd;
            }, 0),
          ),
        "Days logged: " +
          inW.filter(function (d) {
            return hasEntry(S.days[d]);
          }).length,
      ]
    : [
        "Streak: " + st.streak + " (best " + st.best + ")",
        st.rebase
          ? "Rank: Rebasing"
          : "Rank: " +
            (RANKS.filter(function (x) {
              return st.streak >= x[0];
            }).pop() || RANKS[0])[1],
        nx ? "Next rank: " + nx[1] + " in " + (nx[0] - st.streak) : "Top rank reached",
        na ? "Next badge: " + na.a.title + " (" + na.p.txt + ")" : "All badges earned",
      ];
  pr.forEach(function (t, i) {
    txt(t, qx + 36, by + 96 + i * 30, "30px " + VT, "#1E1E1E");
  });
  /* observations */
  var oy = by + bh + 30,
    sh0 = 210,
    oh = H - 80 - sh0 - 30 - oy;
  panel(px, oy, pw, oh, "#212121");
  txt("Observations", px + 36, oy + 58, "16px " + PX, "#FFFF55");
  var obs = [],
    tot = rows.reduce(function (a, x) {
      return a + x.today;
    }, 0);
  rows.forEach(function (rw) {
    if (tot >= 60 && rw.today / tot > 0.55)
      obs.push([3, rw.q.label + " took " + Math.round((rw.today / tot) * 100) + "% of today's focused time."]);
  });
  rows.forEach(function (rw) {
    if (inW.length >= 3 && rw.wp) {
      var p = rw.wd / rw.wp;
      if (p >= 1.2)
        obs.push([
          4,
          "You beat your " + rw.q.label + " plan by " + Math.round((p - 1) * 100) + "% this week. Raise it.",
        ]);
      else if (p < 0.85)
        obs.push([
          4,
          rw.q.label +
            " is running " +
            Math.round((1 - p) * 100) +
            "% under plan this week. Plan closer to reality or start it earlier.",
        ]);
    }
  });
  var wq = defsOf(e).filter(function (q) {
    return q.type === "wake";
  })[0];
  if (wq) {
    var wks = inW
      .filter(function (d) {
        return d !== k && (S.days[d] || {})[wq.id];
      })
      .map(function (d) {
        return mins(S.days[d][wq.id]);
      });
    if (e[wq.id] && wks.length) {
      var av =
          wks.reduce(function (a, b) {
            return a + b;
          }, 0) / wks.length,
        df = Math.round(mins(e[wq.id]) - av);
      if (Math.abs(df) >= 10)
        obs.push([
          2,
          "Up at " +
            e[wq.id] +
            ", " +
            Math.abs(df) +
            " minutes " +
            (df < 0 ? "earlier" : "later") +
            " than your 7-day average.",
        ]);
    }
  }
  var lb = inW.filter(function (d) {
    return limBroken(S.days[d]);
  }).length;
  if (
    defsOf(e).some(function (q) {
      return q.type === "limit";
    })
  )
    obs.push([
      lb ? 2 : 1,
      lb ? "Limits broken on " + lb + " day" + (lb === 1 ? "" : "s") + " this week." : "No limits broken this week.",
    ]);
  var prevK = add(k, -1);
  if (!np && (st.marks[prevK] === "miss" || st.marks[prevK] === "grace") && ok(e))
    obs.push([5, "Bounce-back day: cleared right after a miss."]);
  Q.forEach(function (q) {
    var prevMax = 0;
    Object.keys(S.days).forEach(function (d) {
      if (d >= START_KEY && d < k) prevMax = Math.max(prevMax, S.days[d][q.id] | 0);
    });
    if (prevMax && (e[q.id] | 0) > prevMax)
      obs.push([6, "New personal record: " + q.label + " at " + hm(e[q.id]) + "."]);
  });
  if (!np && na && STREAKY[na.a.id] && na.p.need - na.p.have <= 3)
    obs.push([
      5,
      na.p.need -
        na.p.have +
        " more clean day" +
        (na.p.need - na.p.have === 1 ? "" : "s") +
        " to unlock " +
        na.a.title +
        ".",
    ]);
  if (!np && lv.need - lv.cur <= 150) obs.push([3, lv.need - lv.cur + " XP to level " + (lv.l + 1) + "."]);
  if (
    Q.every(function (q) {
      return Math.abs((e[q.id] | 0) - pl(k, q)) <= 10;
    }) &&
    tot
  )
    obs.push([4, "Within 10 minutes of plan on every quest. Accurate planning."]);
  var wd = parse(k).getDay();
  obs.push([
    1,
    pick(
      r,
      wd === 1
        ? ["Monday set the tone for the week."]
        : wd === 5 || wd === 6
          ? ["Weekend: keep the routine intact."]
          : wd === 0
            ? ["Sunday: a good day to look at the week as a whole."]
            : ["Midweek. Protect the routine."],
    ),
  ]);
  var tds = defsOf(e).filter(function (q) {
    return q.type === "todo" && e[q.id] === true;
  }).length;
  if (tds) obs.push([4, tds + " to-do" + (tds === 1 ? "" : "s") + " checked off."]);
  var nd = (cfg().deadlines || [])
    .filter(function (d) {
      return d.date > k;
    })
    .sort(function (a, b) {
      return a.date < b.date ? -1 : 1;
    })[0];
  if (nd) {
    var ndn = daysBetween(k, nd.date);
    obs.push([ndn <= 7 ? 5 : 2, "Next deadline: " + nd.title + " in " + ndn + " day" + (ndn === 1 ? "" : "s") + "."]);
  }
  defsOf(e).forEach(function (q) {
    if (q.total && (q.type === "time" || q.type === "target")) {
      var ps = projSum(q.id, k);
      obs.push([3, q.label + " project: " + Math.min(100, Math.round((ps / q.total) * 100)) + "% of the total."]);
    }
  });
  var tmc = cfg().term;
  if (tmc && tmc.start && tmc.end && k >= tmc.start && k <= tmc.end)
    obs.push([
      1,
      (tmc.name ? tmc.name + ", w" : "W") +
        "eek " +
        (Math.floor(daysBetween(tmc.start, k) / 7) + 1) +
        " of " +
        Math.ceil((daysBetween(tmc.start, tmc.end) + 1) / 7) +
        ".",
    ]);
  obs.forEach(function (o) {
    o[2] = r();
  });
  obs.sort(function (a, b) {
    return b[0] - a[0] || a[2] - b[2];
  });
  var yy = oy + 106,
    nob = Math.max(1, Math.min(4, Math.floor((oh - 90) / 46)));
  obs.slice(0, nob).forEach(function (o) {
    g.fillStyle = "#7FE05A";
    g.fillRect(px + 40, yy - 18, 12, 12);
    yy = wrap(o[1], px + 70, yy, pw - 110, 38, "32px " + VT, "#E6E6E6") + 10;
  });
  /* suggested plan */
  var sy = oy + oh + 30,
    sh = sh0;
  panel(px, sy, pw, sh);
  txt(
    "Suggested plan for " + parse(add(k, 1)).toLocaleDateString("en-CA", { weekday: "long" }),
    px + 36,
    sy + 58,
    "16px " + PX,
    "#3F3F3F",
  );
  var TQ2 = activeDefs(add(k, 1))
      .filter(function (q) {
        return q.type === "time";
      })
      .slice(0, 6),
    nc = Math.max(1, TQ2.length),
    cw = (pw - 72 - (nc - 1) * 20) / nc;
  if (!TQ2.length) txt("No time quests planned.", px + 36, sy + 140, "32px " + VT, "#5A5A5A");
  TQ2.forEach(function (q, i) {
    var lg = inW
        .filter(function (d) {
          return (S.days[d] || {})[q.id];
        })
        .map(function (d) {
          return S.days[d][q.id] | 0;
        }),
      av = lg.length
        ? lg.reduce(function (a, b) {
            return a + b;
          }, 0) / lg.length
        : q.min,
      sug = Math.max(q.min, Math.round(av / 10) * 10);
    var hit = inW.filter(function (d) {
      return dn(d, q) >= pl(d, q);
    }).length;
    if (hit >= 5) sug += 10;
    var x = px + 36 + i * (cw + 20),
      y = sy + 80,
      ch = sh - 110;
    g.fillStyle = "#8B8B8B";
    g.fillRect(x, y, cw, ch);
    txt(q.label.split(/[ \/]/)[0].slice(0, 9), x + 18, y + 36, "13px " + PX, "#FFFFFF");
    txt(hm(sug), x + 18, y + ch - 18, "44px " + VT, "#FFFF55");
  });
  txt("Page 2 of 2", W / 2, H - 40, "28px " + VT, "#9AA2B1", "center");
  return c;
}
wrapBtn.addEventListener("click", function () {
  var k = wrapDay();
  if (k) doWrap(k, wrapBtn);
});
function doWrap(k, btnEl) {
  btnEl.disabled = true;
  setSync("Building wrap-up\u2026");
  Promise.all([
    loadPDF(),
    document.fonts && document.fonts.load
      ? Promise.all([document.fonts.load('20px "Press Start 2P"'), document.fonts.load("34px VT323")]).catch(
          function () {},
        )
      : null,
  ])
    .then(function (r) {
      var J = r[0],
        c = wrapCanvas(k),
        pdf = new J({ orientation: "portrait", unit: "pt", format: "letter" });
      pdf.setProperties({ title: "ProductivityCraft wrap-up " + k, author: "ProductivityCraft" });
      pdf.addImage(c.toDataURL("image/png"), "PNG", 0, 0, 612, 792, undefined, "FAST");
      pdf.addPage("letter", "portrait");
      pdf.addImage(wrapCanvas2(k).toDataURL("image/png"), "PNG", 0, 0, 612, 792, undefined, "FAST");
      var blob = pdf.output("blob"),
        name = "productivitycraft-wrapup-" + k + ".pdf";
      if (dl)
        return dl.save({ filename: name, data: blob }).then(
          function () {
            setSync("Wrap-up saved");
          },
          function (e) {
            setSync(e && e.code === "declined" ? "Wrap-up cancelled" : "Wrap-up couldn't be saved here");
          },
        );
      var u = URL.createObjectURL(blob),
        a = document.createElement("a");
      a.href = u;
      a.download = name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(function () {
        URL.revokeObjectURL(u);
      }, 4000);
      setSync("Wrap-up saved");
    })
    .catch(function () {
      setSync("PDF engine didn't load. Check your connection.");
    })
    .finally(function () {
      btnEl.disabled = false;
      wrapLabel();
    });
}
