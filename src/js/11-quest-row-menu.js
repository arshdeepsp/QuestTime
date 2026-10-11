/* ---- quest row menu ---- */
var qmenu = null;
function closeQMenu() {
  if (qmenu) {
    qmenu.remove();
    qmenu = null;
  }
}
document.addEventListener("click", function (e) {
  if (qmenu && !qmenu.contains(e.target)) closeQMenu();
});
document.addEventListener("keydown", function (e) {
  if (e.key === "Escape") closeQMenu();
});
function pauseQuest(q) {
  var T = todayKey(),
    c6 = clone(cfg()),
    oldQ = clone(c6.quests),
    qs = c6.quests,
    t = qs.filter(function (x) {
      return x.id === q.id;
    })[0];
  if (!t) return;
  var inf0 = easeInfo();
  t.pausedFrom = inf0.setup || rewardsOff() ? T : add(T, 1);
  t.pausedUntil = nextMonday(T);
  if (t.pausedFrom >= t.pausedUntil) {
    setSync("Pausing starts tomorrow, which is already next week. Nothing left to pause this week.");
    return;
  }
  var g = guardEasing(c6, oldQ, [q.id]);
  if (!g.ok) {
    setSync(g.msg);
    return;
  }
  saveCfg(c6);
  if (g.eased) {
    qSig = "";
    render();
    setSync(q.label + " will be paused from tomorrow through " + DAYF[wkEndDay()] + ".");
    return;
  }
  if (S.days[T]) {
    S.days[T] = Object.assign({}, S.days[T], { q: activeDefs(T) });
    dirty[T] = true;
    cache();
    clearTimeout(timer);
    timer = setTimeout(flush, 300);
  }
  qSig = "";
  render();
  setSync(
    q.label +
      " paused through " +
      DAYF[wkEndDay()] +
      ", " +
      fmtD(add(t.pausedUntil, -1)) +
      ". It's back on " +
      DAYF[wkS()] +
      ".",
  );
}
function deleteTodo(q) {
  var c = clone(cfg());
  c.quests = c.quests.filter(function (x) {
    return x.id !== q.id;
  });
  saveCfg(c);
  var T = todayKey();
  if (S.days[T]) {
    var e = Object.assign({}, S.days[T]);
    delete e[q.id];
    e.q = activeDefs(T);
    S.days[T] = e;
    dirty[T] = true;
    cache();
    clearTimeout(timer);
    timer = setTimeout(flush, 300);
  }
  qSig = "";
  render();
  setSync("To-do deleted");
}
function openQMenu(q, btn) {
  closeQMenu();
  if (locked()) return;
  var items =
    q.type === "todo"
      ? [
          [
            "View details",
            function () {
              openDetails(q);
            },
          ],
          [
            "Delete to-do",
            function () {
              deleteTodo(q);
            },
          ],
        ]
      : [
          [
            "Edit quests",
            function () {
              openMgr();
            },
          ],
        ];
  var sun = parse(todayKey()).getDay() === wkEndDay();
  if (q.type !== "todo" && (!sun || easeInfo().setup))
    items.unshift([
      sun ? "Pause for today" : "Pause until " + DAYF[wkEndDay()],
      function () {
        pauseQuest(q);
      },
    ]);
  if (q.type === "time" && !(S.timer && S.timer.id === q.id))
    items.unshift([
      "Just 5 minutes on this",
      function () {
        start5(q);
      },
    ]);
  if (q.type !== "todo")
    items.unshift([
      "View details",
      function () {
        openDetails(q);
      },
    ]);
  if (rewardsOff()) {
    var ig0 = ignoredOn(q.id, todayKey());
    items.unshift([
      ig0 ? "Add back to the list" : "Ignore",
      function () {
        setIgnore(q.id, !ig0);
      },
    ]);
  }
  if (q.type !== "todo") {
    var cq0 = cfg().quests.filter(function (z) {
      return z.id === q.id;
    })[0];
    if (cq0 && !cq0.completed)
      items.splice(items.length, 0, [
        "Mark complete",
        function () {
          markCompleteManual(q);
        },
      ]);
  }
  popMenu(btn, items);
}
/* popMenu(btn, items): items are [label(html), fn] or [label, fn, {arm:"Confirm label"}]; an armed item changes to its arm label on the first tap and only runs on the second (the menu's Cancel or a tap outside drops it). */
function popMenu(btn, items) {
  closeQMenu();
  items = items.concat([["Cancel", function () {}]]);
  var m = document.createElement("div");
  m.className = "qmenu";
  m.setAttribute("role", "menu");
  m.innerHTML = items
    .map(function (it, i) {
      return '<button type="button" role="menuitem" data-mi="' + i + '">' + it[0] + "</button>";
    })
    .join("");
  document.body.appendChild(m);
  var r = btn.getBoundingClientRect();
  m.style.top = window.scrollY + r.bottom + 6 + "px";
  m.style.left =
    Math.max(
      8,
      Math.min(window.scrollX + r.left, window.scrollX + document.documentElement.clientWidth - m.offsetWidth - 8),
    ) + "px";
  m.querySelectorAll("[data-mi]").forEach(function (b) {
    b.addEventListener("click", function (e) {
      e.stopPropagation();
      var it = items[+b.getAttribute("data-mi")],
        o = it[2];
      if (o && o.arm && !b.classList.contains("armed")) {
        b.classList.add("armed");
        b.textContent = o.arm;
        haptic("light");
        return;
      }
      closeQMenu();
      it[1]();
    });
  });
  qmenu = m;
  m.querySelector("button").focus();
}
