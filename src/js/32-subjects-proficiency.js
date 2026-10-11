/* ---- subjects + proficiency ---- */
var SUBJ_PRESETS = [
  "Mathematics",
  "Computer Science",
  "Biology",
  "Chemistry",
  "Physics",
  "Statistics",
  "Engineering",
  "Economics",
  "Psychology",
  "History",
  "Literature",
  "Philosophy",
  "Languages",
  "Music",
  "Art",
];
var PROF = ["Not started", "Novice", "Beginner", "Intermediate", "Advanced", "Expert"];
/* What each level means, so a rating is a check ("can I do this now?") rather than a feeling. Time never changes it. */
var PROF_DO = [
  "Not rated yet",
  "I know the terms",
  "I can follow a worked example",
  "I can solve standard problems without notes",
  "I can apply it to new problems or explain it",
  "I could teach it or build something new with it",
];
function subjList() {
  return cfg().subjects || [];
}
function saveSubj(fn2) {
  var c = clone(cfg());
  c.subjects = c.subjects || [];
  fn2(c.subjects);
  saveCfg(c);
  renderSubjects();
}
function setRating(t, v) {
  t.p = v;
  var TT = todayKey();
  t.hist = (t.hist || []).filter(function (hh) {
    return hh.d !== TT;
  });
  t.hist.push({ d: TT, p: v });
  if (t.hist.length > 60) t.hist = t.hist.slice(-60);
}
function rateTopic(tid, v) {
  saveSubj(function (Ls) {
    Ls.forEach(function (s) {
      (s.topics || []).forEach(function (t) {
        if (t.id === tid) setRating(t, v);
      });
    });
  });
}
function avgProf(s) {
  var t = s.topics || [];
  if (!t.length) return 0;
  return (
    t.reduce(function (a, x) {
      return a + (x.p || 0);
    }, 0) / t.length
  );
}
function pips(p, attr) {
  var h = '<span class="pips5" role="radiogroup">';
  for (var i = 1; i <= 5; i++)
    h +=
      '<button type="button" class="pp' +
      (i <= p ? " on" : "") +
      '" ' +
      attr +
      ' data-pv="' +
      i +
      '" aria-label="' +
      PROF[i] +
      ": " +
      PROF_DO[i] +
      '" title="' +
      PROF[i] +
      ": " +
      PROF_DO[i] +
      '"></button>';
  return h + "</span>";
}
function openSubjAdd() {
  var have = subjList().map(function (s) {
    return s.name;
  });
  openG("Add a subject", function (b) {
    b.innerHTML =
      '<div class="ed"><p class="help">Pick a subject, or name your own.</p><div class="subjpick">' +
      SUBJ_PRESETS.filter(function (n) {
        return have.indexOf(n) < 0;
      })
        .map(function (n) {
          return '<button type="button" class="stone mini" data-sp="' + esc(n) + '">' + esc(n) + "</button>";
        })
        .join("") +
      '</div><div class="edrow"><input id="sjCustom" maxlength="40" placeholder="Or type a subject name"><button type="button" class="stone save" id="sjAdd">Add</button></div><p class="cmsg2" id="sjMsg"></p></div>';
    function add_(n) {
      n = (n || "").trim();
      if (!n) {
        b.querySelector("#sjMsg").textContent = "Give the subject a name.";
        return;
      }
      if (
        subjList().some(function (s) {
          return s.name.toLowerCase() === n.toLowerCase();
        })
      ) {
        b.querySelector("#sjMsg").textContent = "You already have that subject.";
        return;
      }
      saveSubj(function (L) {
        L.push({ id: "s" + Date.now().toString(36), name: n.slice(0, 40), topics: [] });
      });
      closeG();
      setSync(n + " added");
    }
    b.querySelectorAll("[data-sp]").forEach(function (x) {
      x.addEventListener("click", function () {
        add_(x.getAttribute("data-sp"));
      });
    });
    b.querySelector("#sjAdd").addEventListener("click", function () {
      add_(b.querySelector("#sjCustom").value);
    });
    b.querySelector("#sjCustom").addEventListener("keydown", function (e) {
      if (e.key === "Enter") add_(this.value);
    });
  });
}
function renameSubj(sid) {
  var sj = subjById(sid);
  if (!sj) return;
  openG("Rename subject", function (b) {
    b.innerHTML =
      '<div class="ed"><div class="edrow"><input id="sjRen" maxlength="40" value="' +
      esc(sj.name) +
      '"><button type="button" class="stone save" id="sjRenGo">Save</button></div><p class="cmsg2" id="sjRenMsg"></p></div>';
    function go_() {
      var n = b.querySelector("#sjRen").value.trim().slice(0, 40);
      if (!n) {
        b.querySelector("#sjRenMsg").textContent = "Give the subject a name.";
        return;
      }
      if (
        subjList().some(function (s) {
          return s.id !== sid && s.name.toLowerCase() === n.toLowerCase();
        })
      ) {
        b.querySelector("#sjRenMsg").textContent = "You already have that subject.";
        return;
      }
      saveSubj(function (L) {
        var s = L.filter(function (z) {
          return z.id === sid;
        })[0];
        if (s) s.name = n;
      });
      closeG();
      qSig = "";
      render();
      setSync("Renamed to " + n);
    }
    b.querySelector("#sjRenGo").addEventListener("click", go_);
    b.querySelector("#sjRen").addEventListener("keydown", function (e) {
      if (e.key === "Enter") go_();
    });
  });
}
var openTopic = null;
function sjFolded() {
  var L = uiGet("sjfold", []);
  return Array.isArray(L) ? L.slice() : [];
}
function sjFold(sid) {
  var L = sjFolded(),
    i = L.indexOf(sid);
  if (i >= 0) L.splice(i, 1);
  else L.push(sid);
  uiSet("sjfold", L);
  var el = document.querySelector('.sjsec[data-sid="' + sid + '"]');
  if (el) {
    el.classList.toggle("fold", i < 0);
    el.querySelector(".sjsec-tg").setAttribute("aria-expanded", i >= 0);
  }
}
function renderSubjects() {
  var el = document.getElementById("subjBody");
  if (!el) return;
  var L = subjList(),
    T = todayKey();
  if (!L.length) {
    el.innerHTML =
      '<div class="subj-empty"><p class="help">Track the subjects you\u2019re learning and how confident you feel in each topic. Ratings are your own perception, and you can update them any time.</p><button type="button" class="stone save" id="sjFirst">+ Add a subject</button></div>';
    el.querySelector("#sjFirst").addEventListener("click", openSubjAdd);
    return;
  }
  var nT = 0,
    nDue = 0;
  L.forEach(function (s) {
    (s.topics || []).forEach(function (t) {
      nT++;
      if (topicStats(t).due) nDue++;
    });
  });
  var h =
    rerateCard() +
    '<div class="subj-tools"><span class="tl-sum">' +
    nT +
    " topic" +
    (nT === 1 ? "" : "s") +
    (nDue ? " · <b>" + nDue + " due for review</b>" : "") +
    '</span><button type="button" class="stone save" id="sjNew">+ Add subject</button></div><div class="tlist">';
  L.forEach(function (s) {
    var T = s.topics || [],
      sm = subjMinutes(s.id),
      lq = cfg()
        .quests.filter(function (q) {
          return qSubjs(q).indexOf(s.id) >= 0 && !q.completed;
        })
        .map(function (q) {
          return q.label;
        });
    var fold = sjFolded().indexOf(s.id) >= 0,
      nd = T.filter(function (t) {
        return topicStats(t).due;
      }).length;
    h +=
      '<section class="sjsec' +
      (fold ? " fold" : "") +
      '" data-sid="' +
      s.id +
      '"><div class="sjsec-h"><button type="button" class="sjsec-tg" data-sfold="' +
      s.id +
      '" aria-expanded="' +
      !fold +
      '"><b>' +
      esc(s.name) +
      '</b><span class="sjsec-m">' +
      (T.length
        ? T.length +
          " topic" +
          (T.length === 1 ? "" : "s") +
          " · avg " +
          PROF[Math.round(avgProf(s))] +
          (nd ? " · <em>" + nd + " due</em>" : "")
        : "No topics yet") +
      '</span></button><button type="button" class="stone mini del" data-sdel="' +
      s.id +
      '" aria-label="Delete subject">x</button>' +
      (sm || lq.length
        ? '<div class="sj-link">' +
          (lq.length ? "Fed by: " + lq.map(esc).join(", ") : "") +
          (sm ? (lq.length ? " · " : "") + hm(sm) + " logged" : "") +
          "</div>"
        : "") +
      "</div>";
    h += '<div class="sjsec-b">';
    T.forEach(function (t) {
      var hist = t.hist || [],
        first = hist.length ? hist[0].p : t.p,
        chg =
          hist.length > 1 && hist[0].d !== hist[hist.length - 1].d
            ? t.p > first
              ? '<em class="up">▲ from ' + PROF[first] + "</em>"
              : t.p < first
                ? '<em class="dn">▼ from ' + PROF[first] + "</em>"
                : ""
            : "";
      var ts = topicStats(t),
        p = t.p || 0,
        fl = topicFlat(t),
        ed = openTopic === t.id,
        goal = t.target
          ? t.target > p
            ? '<span class="tr-g">→ ' + PROF[t.target] + "</span>"
            : '<span class="tr-g ok">✔ Goal</span>'
          : "";
      h +=
        '<div class="tr' +
        (ts.due ? " due" : "") +
        (fl ? " flat" : "") +
        '" data-tid="' +
        t.id +
        '"><div class="tr-top"><span class="tr-n">' +
        esc(t.name) +
        "</span>" +
        (ts.due ? '<i class="rv">Review</i>' : "") +
        '<span class="tr-mo">' +
        (ts.mo ? hm(ts.mo) : "—") +
        "<small>30 days</small></span></div>" +
        '<div class="tr-lv">' +
        pips(p, 'data-tp="' + s.id + "," + t.id + '"') +
        '<span class="tr-l">' +
        PROF[p] +
        "</span>" +
        goal +
        chg +
        '</div><div class="tr-do">' +
        PROF_DO[p] +
        "</div>" +
        (fl
          ? '<div class="tr-flat">' + hm(fl.m) + " in 4 weeks, level unchanged. Does the rating still fit?</div>"
          : "") +
        '<div class="tr-meta"><span>' +
        (ts.tot ? hm(ts.tot) + " total" : "No time logged") +
        (ts.last ? " · last " + fmtD(ts.last) : "") +
        '</span><span class="sj-act"><button type="button" class="stone mini' +
        (ed ? " on" : "") +
        '" data-tedit="' +
        t.id +
        '" aria-label="Edit name, goal and next step">Edit</button><button type="button" class="stone mini del" data-tdel="' +
        s.id +
        "," +
        t.id +
        '" aria-label="Remove topic">x</button></span></div>' +
        (t.next
          ? '<div class="sj-next">Next: ' +
            esc(t.next) +
            ' <button type="button" class="lnk" data-tnext="' +
            s.id +
            "," +
            t.id +
            '">→ to-do</button></div>'
          : "") +
        (ed
          ? '<div class="sj-ed"><label class="grow">Name<input data-tname="' +
            s.id +
            "," +
            t.id +
            '" maxlength="60" value="' +
            esc(t.name) +
            '"></label><label>Target level<select data-ttarget="' +
            s.id +
            "," +
            t.id +
            '"><option value="">None</option>' +
            [1, 2, 3, 4, 5]
              .map(function (v) {
                return '<option value="' + v + '"' + (t.target === v ? " selected" : "") + ">" + PROF[v] + "</option>";
              })
              .join("") +
            '</select></label><label class="grow">Next step<input data-tnextin="' +
            s.id +
            "," +
            t.id +
            '" maxlength="80" value="' +
            esc(t.next || "") +
            '" placeholder="e.g. do Ch. 3 problems"></label></div>'
          : "") +
        "</div>";
    });
    h +=
      '<div class="edrow sj-add"><input data-tadd="' +
      s.id +
      '" maxlength="60" placeholder="Add a topic to ' +
      esc(s.name) +
      '"><button type="button" class="stone" data-tbtn="' +
      s.id +
      '">Add</button></div></div></section>';
  });
  el.innerHTML = h + "</div>";
  wireRerate(el);
  el.querySelector("#sjNew").addEventListener("click", openSubjAdd);
  el.querySelectorAll("[data-sfold]").forEach(function (x) {
    x.addEventListener("click", function () {
      haptic("light");
      sjFold(x.getAttribute("data-sfold"));
    });
  });
  el.querySelectorAll("[data-pv]").forEach(function (x) {
    x.addEventListener("click", function () {
      var a = x.getAttribute("data-tp").split(","),
        v = +x.getAttribute("data-pv");
      var cur = (topicById(a[1]) || { t: {} }).t.p;
      rateTopic(a[1], cur === v ? v - 1 : v);
    });
  });
  function addTopic(sid, inp) {
    var n = inp.value.trim();
    if (!n) return;
    saveSubj(function (Ls) {
      var s = Ls.filter(function (z) {
        return z.id === sid;
      })[0];
      if (!s) return;
      s.topics = s.topics || [];
      s.topics.push({ id: "t" + Date.now().toString(36), name: n.slice(0, 60), p: 0, hist: [], created: todayKey() });
    });
    var ni = document.querySelector('[data-tadd="' + sid + '"]');
    if (ni) ni.focus();
  }
  el.querySelectorAll("[data-tbtn]").forEach(function (x) {
    x.addEventListener("click", function () {
      var sid = x.getAttribute("data-tbtn");
      addTopic(sid, el.querySelector('[data-tadd="' + sid + '"]'));
    });
  });
  el.querySelectorAll("[data-tadd]").forEach(function (x) {
    x.addEventListener("keydown", function (e) {
      if (e.key === "Enter") addTopic(x.getAttribute("data-tadd"), x);
    });
  });
  el.querySelectorAll("[data-tdel]").forEach(function (x) {
    var arm = null;
    x.addEventListener("click", function () {
      if (!arm) {
        x.textContent = "?";
        arm = setTimeout(function () {
          arm = null;
          x.textContent = "x";
        }, 3000);
        return;
      }
      var a = x.getAttribute("data-tdel").split(",");
      saveSubj(function (Ls) {
        var s = Ls.filter(function (z) {
          return z.id === a[0];
        })[0];
        if (s)
          s.topics = (s.topics || []).filter(function (t) {
            return t.id !== a[1];
          });
      });
    });
  });
  el.querySelectorAll("[data-tedit]").forEach(function (x) {
    x.addEventListener("click", function () {
      openTopic = openTopic === x.getAttribute("data-tedit") ? null : x.getAttribute("data-tedit");
      renderSubjects();
    });
  });
  function upT(a, fn3) {
    saveSubj(function (Ls) {
      var s = Ls.filter(function (z) {
        return z.id === a[0];
      })[0];
      if (!s) return;
      var t = (s.topics || []).filter(function (z) {
        return z.id === a[1];
      })[0];
      if (t) fn3(t);
    });
  }
  el.querySelectorAll("[data-ttarget]").forEach(function (x) {
    x.addEventListener("change", function () {
      var v = +x.value;
      upT(x.getAttribute("data-ttarget").split(","), function (t) {
        if (v) t.target = v;
        else delete t.target;
      });
    });
  });
  el.querySelectorAll("[data-tname]").forEach(function (x) {
    x.addEventListener("change", function () {
      var v = x.value.trim().slice(0, 60);
      if (!v) {
        x.value = topicName(x.getAttribute("data-tname").split(",")[1]);
        return;
      }
      upT(x.getAttribute("data-tname").split(","), function (t) {
        t.name = v;
      });
    });
  });
  el.querySelectorAll("[data-tnextin]").forEach(function (x) {
    x.addEventListener("change", function () {
      var v = x.value.trim();
      upT(x.getAttribute("data-tnextin").split(","), function (t) {
        if (v) t.next = v.slice(0, 80);
        else delete t.next;
      });
    });
  });
  el.querySelectorAll("[data-tnext]").forEach(function (x) {
    x.addEventListener("click", function () {
      if (locked()) return;
      var a = x.getAttribute("data-tnext").split(","),
        txt = "";
      upT(a, function (t) {
        txt = t.next;
        delete t.next;
      });
      if (!txt) return;
      var c = clone(cfg());
      c.quests.push({
        id: "td" + Date.now().toString(36),
        type: "todo",
        label: (topicName(a[1]) + ": " + txt).slice(0, 60),
      });
      saveCfg(c);
      var T2 = todayKey();
      if (S.days[T2]) {
        S.days[T2] = Object.assign({}, S.days[T2], { q: activeDefs(T2) });
        dirty[T2] = true;
        cache();
      }
      qSig = "";
      render();
      renderSubjects();
      setSync("Added to to-dos");
    });
  });
  el.querySelectorAll(".sjsec").forEach(function (sec) {
    var sid = sec.getAttribute("data-sid"),
      hd = sec.querySelector(".sjsec-h");
    swipeMenu(hd, function () {
      var fd = sjFolded().indexOf(sid) >= 0;
      return [
        [
          "Rename subject",
          function () {
            renameSubj(sid);
          },
        ],
        [
          fd ? "Unfold" : "Fold",
          function () {
            sjFold(sid);
          },
        ],
        [
          "Delete subject",
          function () {
            saveSubj(function (Ls) {
              var i = Ls.findIndex(function (z) {
                return z.id === sid;
              });
              if (i >= 0) Ls.splice(i, 1);
            });
            setSync("Subject deleted");
          },
          { arm: "Delete subject?" },
        ],
      ];
    });
    sec.querySelectorAll(".tr").forEach(function (tr) {
      var tid = tr.getAttribute("data-tid");
      swipeMenu(
        tr,
        function () {
          return [
            [
              openTopic === tid ? "Close editor" : "Edit topic",
              function () {
                openTopic = openTopic === tid ? null : tid;
                renderSubjects();
              },
            ],
            [
              "Delete topic",
              function () {
                saveSubj(function (Ls) {
                  var s2 = Ls.filter(function (z) {
                    return z.id === sid;
                  })[0];
                  if (s2)
                    s2.topics = (s2.topics || []).filter(function (t) {
                      return t.id !== tid;
                    });
                });
                setSync("Topic removed");
              },
              { arm: "Delete topic?" },
            ],
          ];
        },
        ".sj-ed",
      );
    });
  });
  el.querySelectorAll("[data-sdel]").forEach(function (x) {
    var arm = null;
    x.addEventListener("click", function () {
      if (!arm) {
        x.textContent = "Delete?";
        arm = setTimeout(function () {
          arm = null;
          x.textContent = "x";
        }, 3000);
        return;
      }
      saveSubj(function (Ls) {
        var i = Ls.findIndex(function (s) {
          return s.id === x.getAttribute("data-sdel");
        });
        if (i >= 0) Ls.splice(i, 1);
      });
    });
  });
}
