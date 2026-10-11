/* ---- starter packs: ready-made sets of quests ---- */
var PACKS = {
  Student: {
    q: [
      { type: "time", label: "Study", min: 90 },
      { type: "time", label: "Read", min: 20 },
      { type: "check", label: "Plan tomorrow" },
      { type: "wake", label: "In bed on time", from: "22:00", to: "23:59", note: "log it when you get into bed" },
      { type: "limit", label: "Social media", max: 30, unit: "min" },
      { type: "weekly", label: "Exercise", min: 3 },
    ],
    r: {
      title: "Study",
      motto: "Show up, then go deep.",
      blocks: [
        { h: "Focus", t: "- Phone in another room while studying\n- One task at a time" },
        { h: "Review", t: "Recap what you learned before bed." },
      ],
    },
  },
  Fitness: {
    q: [
      { type: "weekly", label: "Workout", min: 4 },
      { type: "target", label: "Steps", min: 8000, ul: "steps", step: 500 },
      { type: "target", label: "Drink water", min: 8, ul: "glasses", step: 1 },
      { type: "time", label: "Stretch", min: 10 },
      { type: "check", label: "No alcohol" },
      { type: "scale", label: "Energy", scale: 5, min: 3, opt: true },
    ],
    r: {
      title: "Training",
      motto: "Consistency beats intensity.",
      blocks: [{ h: "Recovery", t: "- Sleep first\n- Rest days are part of the plan" }],
    },
  },
  Creative: {
    q: [
      { type: "time", label: "Create", min: 60 },
      { type: "time", label: "Practice", min: 30 },
      { type: "target", label: "Ideas captured", min: 3, ul: "ideas", step: 1 },
      { type: "weekly", label: "Share your work", min: 1 },
      { type: "limit", label: "Screen time", max: 120, unit: "min" },
    ],
    r: {
      title: "Craft",
      motto: "Make things, then make them better.",
      blocks: [{ h: "Output", t: "- Ship small and often\n- Finish before you polish" }],
    },
  },
  Wellness: {
    q: [
      { type: "time", label: "Meditate", min: 10 },
      { type: "target", label: "Walk", min: 6000, ul: "steps", step: 500 },
      { type: "check", label: "Journal" },
      { type: "target", label: "Drink water", min: 8, ul: "glasses", step: 1 },
      { type: "limit", label: "Screen time", max: 120, unit: "min" },
      { type: "scale", label: "Mood", scale: 5, min: 3, opt: true },
    ],
    r: {
      title: "Wellbeing",
      motto: "Look after the basics.",
      blocks: [{ h: "Evenings", t: "- Screens off an hour before bed\n- Write down one good thing" }],
    },
  },
  "Deep Work": {
    q: [
      { type: "time", label: "Deep work", min: 120 },
      { type: "check", label: "Plan tomorrow" },
      { type: "check", label: "Inbox zero", opt: true },
      { type: "limit", label: "Social media", max: 15, unit: "min" },
      { type: "scale", label: "Focus", scale: 10, min: 6 },
    ],
    r: {
      title: "Focus",
      motto: "Protect the hours that matter.",
      blocks: [{ h: "Blocks", t: "- Notifications off during deep work\n- Hardest task first" }],
    },
  },
};
function packsHidden() {
  var c = cfg();
  return (
    !!c.packChosen ||
    (c.quests || []).some(function (q) {
      return q.type !== "todo";
    })
  );
}
function applyPack(name) {
  var p = PACKS[name];
  if (!p) return;
  var c = clone(cfg()),
    T = todayKey();
  c.packChosen = name;
  var skipped = 0;
  p.q.forEach(function (q, i) {
    var n = stampAdded(clone(q));
    n.id = "q" + Date.now().toString(36) + i + Math.floor(Math.random() * 1e3);
    if (countsOnDay(n) && overDays(c.quests.concat([n])).length) {
      skipped++;
      return;
    }
    c.quests.push(n);
  });
  if (skipped)
    setTimeout(function () {
      setSync(
        skipped + " pack quest" + (skipped === 1 ? "" : "s") + " skipped: the daily limit is " + capOf() + " quests.",
      );
    }, 50);
  var R = clone(c.rules || DEFAULT_RULES);
  R.push(clone(p.r));
  c.rules = R;
  saveCfg(c);
  if (S.days[T]) {
    S.days[T] = Object.assign({}, S.days[T], { q: activeDefs(T) });
    dirty[T] = true;
    cache();
    clearTimeout(timer);
    timer = setTimeout(flush, 300);
  }
  qSig = "";
  render();
  renderRules();
  setSync(name + " pack added");
}
