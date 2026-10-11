/* ---- share week ---- */
function shareWeek(btn) {
  var T = todayKey(),
    from = add(T, -6),
    days = [],
    c = document.createElement("canvas"),
    W = 1080,
    H = 1350;
  c.width = W;
  c.height = H;
  var g = c.getContext("2d"),
    PX = '"Press Start 2P", monospace',
    VT = "VT323, monospace";
  for (var d = from; d <= T; d = add(d, 1)) days.push(d);
  var st = lastSt || compute(),
    cleared = days.filter(function (d) {
      return st.marks[d] === "ok";
    }).length,
    mins = {},
    labels = {};
  days.forEach(function (d) {
    var e = S.days[d];
    if (!e) return;
    defsOf(e).forEach(function (q) {
      if (q.type === "time") {
        mins[q.id] = (mins[q.id] || 0) + (e[q.id] | 0);
        labels[q.id] = q.label;
      }
    });
  });
  var tot = Object.keys(mins).reduce(function (a, k) {
      return a + mins[k];
    }, 0),
    ids = Object.keys(mins)
      .sort(function (a, b) {
        return mins[b] - mins[a];
      })
      .slice(0, 6),
    mx = Math.max(
      60,
      ...ids.map(function (k) {
        return mins[k];
      }),
    );
  g.fillStyle = "#18202E";
  g.fillRect(0, 0, W, H);
  for (var y = 0; y < H; y += 40)
    for (var x = 0; x < W; x += 40)
      if (((x + y) / 40) % 2 === 0) {
        g.fillStyle = "#1C2536";
        g.fillRect(x, y, 40, 40);
      }
  function panel(x, y, w, h) {
    g.fillStyle = "#000";
    g.fillRect(x - 8, y - 8, w + 16, h + 16);
    g.fillStyle = "#555";
    g.fillRect(x - 4, y - 4, w + 8, h + 8);
    g.fillStyle = "#212121";
    g.fillRect(x, y, w, h);
  }
  g.textAlign = "left";
  g.fillStyle = "#FFFFFF";
  g.font = "40px " + PX;
  g.fillText("ProductivityCraft", 70, 120);
  g.fillStyle = "#FFFF55";
  g.font = "26px " + PX;
  g.fillText("My week", 70, 175);
  g.fillStyle = "#C3CBD6";
  g.font = "40px " + VT;
  g.fillText(fmtD(from) + " \u2013 " + fmtD(T), 70, 225);
  var off = rewardsOff();
  panel(70, 270, W - 140, 250);
  (off
    ? [
        [
          "Days logged",
          days.filter(function (d) {
            return hasEntry(S.days[d]);
          }).length + "/7",
        ],
        [
          "Sessions",
          days.reduce(function (a, d) {
            return a + ((S.days[d] || {}).sess || []).length;
          }, 0),
        ],
        ["Focus", hm(tot)],
      ]
    : [
        ["Days cleared", cleared + "/7"],
        ["Streak", st.streak + "d"],
        ["Focus", hm(tot)],
      ]
  ).forEach(function (s, i) {
    var cx = 110 + i * ((W - 220) / 3);
    g.fillStyle = "#BDBDBD";
    g.font = "20px " + PX;
    g.fillText(s[0], cx, 340);
    g.fillStyle = i === 0 ? "#7FE05A" : "#FFFFFF";
    g.font = "58px " + PX;
    g.fillText(s[1], cx, 440);
  });
  var sq = (W - 140 - 6 * 14) / 7;
  days.forEach(function (d, i) {
    var m = st.marks[d],
      col =
        d < START_KEY
          ? "#2A2A2A"
          : m === "ok"
            ? gold(S.days[d])
              ? "#C99A1E"
              : "#3C8527"
            : m === "grace"
              ? "#B57A12"
              : m === "rest"
                ? "#2C3E66"
                : m === "pause"
                  ? "#4E5560"
                  : m === "frozen"
                    ? "#6FC3E8"
                    : d === T
                      ? "#555"
                      : "#9E2A1F";
    g.fillStyle = col;
    g.fillRect(70 + i * (sq + 14), 570, sq, 70);
  });
  panel(70, 700, W - 140, ids.length ? 100 + ids.length * 85 : 160);
  g.fillStyle = "#FFFF55";
  g.font = "22px " + PX;
  g.fillText("Time by quest", 110, 760);
  if (!ids.length) {
    g.fillStyle = "#BDBDBD";
    g.font = "36px " + VT;
    g.fillText("No timed work logged this week.", 110, 830);
  }
  ids.forEach(function (k, i) {
    var y = 820 + i * 85;
    g.fillStyle = "#FFFFFF";
    g.font = "34px " + VT;
    g.fillText(labels[k].slice(0, 26), 110, y);
    g.textAlign = "right";
    g.fillText(hm(mins[k]), W - 110, y);
    g.textAlign = "left";
    g.fillStyle = "#1E1E1E";
    g.fillRect(110, y + 14, W - 220, 20);
    g.fillStyle = "#7FE05A";
    g.fillRect(110, y + 14, Math.round(((W - 220) * mins[k]) / mx), 20);
  });
  g.textAlign = "center";
  g.fillStyle = "#9AA2B1";
  g.font = "20px " + PX;
  if (!off)
    g.fillText(
      "Rank: " +
        (RANKS.filter(function (r) {
          return st.streak >= r[0];
        }).pop() || RANKS[0])[1],
      W / 2,
      H - 110,
    );
  g.fillText("Made with ProductivityCraft", W / 2, H - 60);
  btn.disabled = true;
  c.toBlob(function (blob) {
    btn.disabled = false;
    var name = "my-week-" + T + ".png";
    try {
      var f = new File([blob], name, { type: "image/png" });
      if (navigator.canShare && navigator.canShare({ files: [f] })) {
        navigator.share({ files: [f], title: "My week" }).catch(function () {});
        return;
      }
    } catch (x) {}
    if (dl) {
      dl.save({ filename: name, data: blob }).then(
        function () {
          setSync("Week card saved");
        },
        function () {},
      );
      return;
    }
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
    setSync("Week card saved");
  }, "image/png");
}
