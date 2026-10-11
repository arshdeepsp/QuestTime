/* ---- generic drag-to-reorder ---- */
import { START_AT } from "../core/00-state.js";
import { cfg, saveCfg } from "../core/config.js";
import { clone, esc } from "../core/util.js";
import { reorder, sortable } from "../ui/07-drag.js";
import { closeG, openG } from "../ui/18-modal.js";
import { swipeMenu } from "../ui/45-gestures.js";
import { setSync } from "../ui/feedback.js";

export var DEFAULT_RULES, rulesEl, openSec, editSec, LT, LF;

export function reviewDate() {
  var R = new Date(START_AT),
    n0 = new Date();
  do {
    R.setDate(R.getDate() + 90);
  } while (R <= n0);
  return R.toLocaleDateString("en-CA", { month: "long", day: "numeric", year: "numeric" });
}
export function fmtBlock(t) {
  var lines = String(t || "")
      .replace(/\{review\}/g, reviewDate())
      .split("\n"),
    out = "",
    grp = null,
    items = [],
    yes = [],
    no = [],
    wide = false;
  function flush_() {
    if (!grp) return;
    if (grp === "card") {
      out +=
        '<div class="lanes">' +
        items
          .map(function (p) {
            return (
              '<div class="lane"><h4>' +
              esc(p[0]) +
              "</h4><p>" +
              esc(p[1] || "") +
              "</p>" +
              (p[2] ? '<p class="no"><b>Excludes:</b> ' + esc(p[2]) + "</p>" : "") +
              "</div>"
            );
          })
          .join("") +
        "</div>";
      wide = true;
    } else if (grp === "fact")
      out +=
        '<div class="facts">' +
        items
          .map(function (p) {
            return "<div>" + esc(p[0]) + (p[1] ? "<small>" + esc(p[1]) + "</small>" : "") + "</div>";
          })
          .join("") +
        "</div>";
    else if (grp === "ol")
      out +=
        '<ol class="qs">' +
        items
          .map(function (x) {
            return "<li>" + esc(x) + "</li>";
          })
          .join("") +
        "</ol>";
    else if (grp === "ul")
      out +=
        '<ul class="ul">' +
        items
          .map(function (x) {
            return "<li>" + esc(x) + "</li>";
          })
          .join("") +
        "</ul>";
    grp = null;
    items = [];
  }
  lines.forEach(function (raw) {
    var l = raw.trim(),
      m;
    if (!l) {
      flush_();
      return;
    }
    if ((m = l.match(/^card:\s*(.*)$/i))) {
      if (grp !== "card") flush_();
      grp = "card";
      items.push(
        m[1].split("|").map(function (x) {
          return x.trim();
        }),
      );
      return;
    }
    if ((m = l.match(/^fact:\s*(.*)$/i))) {
      if (grp !== "fact") flush_();
      grp = "fact";
      items.push(
        m[1].split("|").map(function (x) {
          return x.trim();
        }),
      );
      return;
    }
    if ((m = l.match(/^chips?:\s*(.*)$/i))) {
      flush_();
      out +=
        '<ul class="places">' +
        m[1]
          .split(",")
          .map(function (x) {
            return "<li>" + esc(x.trim()) + "</li>";
          })
          .join("") +
        "</ul>";
      return;
    }
    if ((m = l.match(/^\+\s+(.*)$/))) {
      flush_();
      yes.push(m[1]);
      return;
    }
    if ((m = l.match(/^x\s+(.*)$/i))) {
      flush_();
      no.push(m[1]);
      return;
    }
    if ((m = l.match(/^\d+[.)]\s+(.*)$/))) {
      if (grp !== "ol") flush_();
      grp = "ol";
      items.push(m[1]);
      return;
    }
    if ((m = l.match(/^[-*]\s+(.*)$/))) {
      if (grp !== "ul") flush_();
      grp = "ul";
      items.push(m[1]);
      return;
    }
    flush_();
    if ((m = l.match(/^>\s*(.*)$/))) {
      out += '<p class="lead">' + esc(m[1]) + "</p>";
      return;
    }
    out += "<p>" + esc(l) + "</p>";
  });
  flush_();
  if (yes.length || no.length) {
    wide = true;
    out =
      '<div class="lanes yn">' +
      (yes.length
        ? '<div class="lane ok"><h4>Allowed</h4><ul>' +
          yes
            .map(function (x) {
              return "<li>" + esc(x) + "</li>";
            })
            .join("") +
          "</ul></div>"
        : "") +
      (no.length
        ? '<div class="lane nope"><h4>Not allowed</h4><ul>' +
          no
            .map(function (x) {
              return "<li>" + esc(x) + "</li>";
            })
            .join("") +
          "</ul></div>"
        : "") +
      "</div>" +
      out;
  }
  return { html: out, wide: wide };
}
export function rulesData() {
  return clone(cfg().rules || DEFAULT_RULES);
}
export function renderRules() {
  if (editSec >= 0) return;
  var R = rulesData(),
    h = "";
  R.forEach(function (sec, i) {
    h +=
      '<details class="part rules" data-i="' +
      i +
      '"' +
      (openSec[i] ? " open" : "") +
      '><summary><button type="button" class="dragh sdrag" aria-label="Drag to reorder this section" title="Drag to reorder (or use arrow keys)"><i></i></button><h2>' +
      esc(sec.title) +
      '</h2><span class="chev" aria-hidden="true"></span></summary><div class="rules-body">' +
      (sec.motto ? '<p class="motto">' + esc(sec.motto) + "</p>" : "");
    (sec.blocks || []).forEach(function (b) {
      var f = fmtBlock(b.t);
      h +=
        '<div class="block' +
        (f.wide ? " wide" : "") +
        '"><h3>' +
        esc(b.h) +
        '</h3><div class="body">' +
        f.html +
        "</div></div>";
    });
    h +=
      '<div class="sec-tools"><button type="button" class="stone" data-edit="' +
      i +
      '">Edit section</button></div></div></details>';
  });
  if (!R.length) h += '<p class="rules-empty">No rules yet. Add a section to write your own.</p>';
  h +=
    '<div class="rules-tools"><button type="button" class="stone" id="addSec">+ Add section</button>' +
    (R.length ? '<button type="button" class="stone" id="resetRules">Clear all rules</button>' : "") +
    "</div>";
  rulesEl.innerHTML = h;
  if (R.length > 1)
    sortable(
      rulesEl,
      "details.rules",
      ".sdrag",
      function (order, fi) {
        var R2 = reorder(rulesData(), order),
          os = {};
        order.forEach(function (k, ni) {
          if (openSec[k]) os[ni] = true;
        });
        openSec = os;
        saveCfg(Object.assign(clone(cfg()), { rules: R2 }));
        renderRules();
        var g = rulesEl.querySelectorAll(".sdrag")[fi];
        if (g) g.focus();
        setSync("Sections reordered");
      },
      ".rules-body,button,input,textarea,select,a",
    );
  else {
    var sg = rulesEl.querySelector(".sdrag");
    if (sg) sg.hidden = true;
  }
  rulesEl.querySelectorAll("details").forEach(function (d) {
    d.addEventListener("toggle", function () {
      openSec[d.getAttribute("data-i")] = d.open;
    });
  });
  rulesEl.querySelectorAll("[data-edit]").forEach(function (b) {
    b.addEventListener("click", function () {
      editSection(+b.getAttribute("data-edit"));
    });
  });
  rulesEl.querySelectorAll("details.rules > summary").forEach(function (sm) {
    var i = +sm.parentNode.getAttribute("data-i");
    swipeMenu(sm, function () {
      return [
        [
          "Edit section",
          function () {
            editSection(i);
          },
        ],
        [
          "Delete section",
          function () {
            deleteSection(i);
          },
          { arm: "Delete section?" },
        ],
      ];
    });
  });
  document.getElementById("addSec").addEventListener("click", function () {
    var R = rulesData();
    R.push({ title: "New section", motto: "", blocks: [{ h: "", t: "" }] });
    saveCfg(Object.assign(clone(cfg()), { rules: R }));
    openSec[R.length - 1] = true;
    editSection(R.length - 1);
  });
  var rr = document.getElementById("resetRules"),
    arm = null;
  if (rr)
    rr.addEventListener("click", function () {
      if (!arm) {
        rr.textContent = "Confirm reset";
        arm = setTimeout(function () {
          arm = null;
          rr.textContent = "Clear all rules";
        }, 4000);
        return;
      }
      clearTimeout(arm);
      saveCfg(Object.assign(clone(cfg()), { rules: [] }));
      openSec = {};
      renderRules();
    });
}
export function parseLines(t) {
  var out = [];
  String(t || "")
    .split("\n")
    .forEach(function (raw) {
      var l = raw.trim(),
        m;
      if (!l) return;
      if ((m = l.match(/^card:\s*(.*)$/i))) {
        var p = m[1].split("|").map(function (x) {
          return x.trim();
        });
        out.push({ k: "card", v: [p[0] || "", p[1] || "", p[2] || ""] });
        return;
      }
      if ((m = l.match(/^fact:\s*(.*)$/i))) {
        var f = m[1].split("|").map(function (x) {
          return x.trim();
        });
        out.push({ k: "fact", v: [f[0] || "", f[1] || ""] });
        return;
      }
      if ((m = l.match(/^chips?:\s*(.*)$/i))) {
        out.push({ k: "chips", v: [m[1]] });
        return;
      }
      if ((m = l.match(/^\+\s+(.*)$/))) {
        out.push({ k: "yes", v: [m[1]] });
        return;
      }
      if ((m = l.match(/^x\s+(.*)$/i))) {
        out.push({ k: "no", v: [m[1]] });
        return;
      }
      if ((m = l.match(/^\d+[.)]\s+(.*)$/))) {
        out.push({ k: "ol", v: [m[1]] });
        return;
      }
      if ((m = l.match(/^[-*]\s+(.*)$/))) {
        out.push({ k: "ul", v: [m[1]] });
        return;
      }
      if ((m = l.match(/^>\s*(.*)$/))) {
        out.push({ k: "lead", v: [m[1]] });
        return;
      }
      out.push({ k: "p", v: [l] });
    });
  return out;
}
export function serLines(items) {
  var n = 0,
    out = [];
  items.forEach(function (it) {
    var v = it.v.map(function (x) {
      return String(x || "")
        .replace(/[\r\n|]+/g, " ")
        .trim();
    });
    if (it.k === "p" || it.k === "lead")
      v = [
        String(it.v[0] || "")
          .replace(/[\r\n]+/g, " ")
          .trim(),
      ];
    if (!v.join("")) return;
    if (it.k !== "ol") n = 0;
    if (it.k === "p") out.push(v[0]);
    else if (it.k === "ul") out.push("- " + v[0]);
    else if (it.k === "ol") {
      n++;
      out.push(n + ". " + v[0]);
    } else if (it.k === "yes") out.push("+ " + v[0]);
    else if (it.k === "no") out.push("x " + v[0]);
    else if (it.k === "lead") out.push("> " + v[0]);
    else if (it.k === "card") out.push("card: " + v[0] + " | " + v[1] + (v[2] ? " | " + v[2] : ""));
    else if (it.k === "fact") out.push("fact: " + v[0] + (v[1] ? " | " + v[1] : ""));
    else if (it.k === "chips") out.push("chips: " + v[0]);
  });
  return out.join("\n");
}
export function deleteSection(i) {
  var R2 = rulesData();
  if (!R2[i]) return;
  R2.splice(i, 1);
  saveCfg(Object.assign(clone(cfg()), { rules: R2 }));
  openSec = {};
  closeG();
  renderRules();
  setSync("Section deleted");
}
export function editSection(i) {
  var R = rulesData(),
    sec = R[i],
    body = null,
    draft = clone(sec);
  openSec[i] = true;
  draft.blocks.forEach(function (b) {
    b.items = parseLines(b.t);
    if (!b.items.length) b.items = [{ k: "p", v: [""] }];
  });
  function draw() {
    var h =
      '<div class="ed"><label>Section title<input data-f="title" value="' +
      esc(draft.title) +
      '"></label><label>Motto<input data-f="motto" value="' +
      esc(draft.motto || "") +
      '"></label>';
    draft.blocks.forEach(function (b, j) {
      h +=
        '<div class="edb"><div class="edrow"><button type="button" class="dragh bdrag" aria-label="Drag to reorder this rule" title="Drag to reorder (or use arrow keys)"><i></i></button><input data-bh="' +
        j +
        '" value="' +
        esc(b.h) +
        '" placeholder="Rule heading"><button type="button" class="stone del" data-rm="' +
        j +
        '">Remove rule</button></div><div class="lines" data-lines="' +
        j +
        '">';
      b.items.forEach(function (it, n) {
        var flds = LF[it.k] || [""],
          inp = flds
            .map(function (ph, x) {
              var val = esc(it.v[x] || "");
              return it.k === "p"
                ? '<textarea rows="2" data-lv="' + j + "," + n + "," + x + '" placeholder="Text">' + val + "</textarea>"
                : '<input data-lv="' +
                    j +
                    "," +
                    n +
                    "," +
                    x +
                    '" value="' +
                    val +
                    '" placeholder="' +
                    esc(ph || LT[it.k]) +
                    '">';
            })
            .join("");
        h +=
          '<div class="ln ln-' +
          it.k +
          '"><span class="lt">' +
          LT[it.k] +
          '</span><div class="lin">' +
          inp +
          '</div><div class="lbtn"><button type="button" class="dragh ldrag mini" aria-label="Drag to reorder this line" title="Drag to reorder (or use arrow keys)"><i></i></button><button type="button" class="stone mini del" data-lx="' +
          j +
          "," +
          n +
          '" aria-label="Remove line">x</button></div></div>';
      });
      if (!b.items.length) h += '<p class="help">Empty. Add a line below.</p>';
      h +=
        '</div><div class="addbar"><span class="lt">Add</span>' +
        Object.keys(LT)
          .map(function (k) {
            return '<button type="button" class="stone mini" data-add-l="' + j + "," + k + '">' + LT[k] + "</button>";
          })
          .join("") +
        '<button type="button" class="stone mini" data-add-l="' +
        j +
        ',review">Review date</button></div></div>';
    });
    h +=
      '<div class="edrow"><button type="button" class="stone" data-add>+ Add rule</button></div><div class="edrow end"><button type="button" class="stone del" data-delsec>Delete section</button><button type="button" class="stone" data-cancel>Cancel</button><button type="button" class="stone save" data-save>Save</button></div></div>';
    body.innerHTML = h;
    function pr(x, a) {
      return x.getAttribute(a).split(",");
    }
    body.querySelectorAll("[data-f]").forEach(function (x) {
      x.addEventListener("input", function () {
        draft[x.getAttribute("data-f")] = x.value;
      });
    });
    body.querySelectorAll("[data-bh]").forEach(function (x) {
      x.addEventListener("input", function () {
        draft.blocks[+x.getAttribute("data-bh")].h = x.value;
      });
    });
    body.querySelectorAll("[data-lv]").forEach(function (x) {
      x.addEventListener("input", function () {
        var a = pr(x, "data-lv");
        draft.blocks[+a[0]].items[+a[1]].v[+a[2]] = x.value;
      });
    });
    body.querySelectorAll("[data-lx]").forEach(function (x) {
      x.addEventListener("click", function () {
        var a = pr(x, "data-lx");
        draft.blocks[+a[0]].items.splice(+a[1], 1);
        draw();
      });
    });
    body.querySelectorAll("[data-add-l]").forEach(function (x) {
      x.addEventListener("click", function () {
        var a = pr(x, "data-add-l"),
          it = draft.blocks[+a[0]].items;
        if (a[1] === "review") it.push({ k: "p", v: ["Next review: {review}."] });
        else
          it.push({
            k: a[1],
            v: (LF[a[1]] || [""]).map(function () {
              return "";
            }),
          });
        draw();
        var ins = body.querySelectorAll('[data-lv^="' + a[0] + "," + (it.length - 1) + ',"]');
        if (ins[0]) ins[0].focus();
      });
    });
    var edRoot = body.querySelector(".ed");
    sortable(edRoot, ".edb", ".bdrag", function (order, fi) {
      draft.blocks = reorder(draft.blocks, order);
      draw();
      var g = body.querySelectorAll(".bdrag")[fi];
      if (g) g.focus();
    });
    body.querySelectorAll("[data-lines]").forEach(function (lc) {
      var j = +lc.getAttribute("data-lines");
      sortable(lc, ".ln", ".ldrag", function (order, fi) {
        draft.blocks[j].items = reorder(draft.blocks[j].items, order);
        draw();
        var g = body.querySelectorAll('[data-lines="' + j + '"] .ldrag')[fi];
        if (g) g.focus();
      });
    });
    body.querySelectorAll("[data-rm]").forEach(function (x) {
      var arm = null;
      x.addEventListener("click", function () {
        if (!arm) {
          x.textContent = "Confirm";
          arm = setTimeout(function () {
            arm = null;
            x.textContent = "Remove rule";
          }, 4000);
          return;
        }
        draft.blocks.splice(+x.getAttribute("data-rm"), 1);
        draw();
      });
    });
    body.querySelector("[data-add]").addEventListener("click", function () {
      draft.blocks.push({ h: "", t: "", items: [{ k: "p", v: [""] }] });
      draw();
    });
    body.querySelector("[data-cancel]").addEventListener("click", function () {
      closeG();
    });
    var ds = body.querySelector("[data-delsec]"),
      arm = null;
    ds.addEventListener("click", function () {
      if (!arm) {
        ds.textContent = "Confirm delete";
        arm = setTimeout(function () {
          arm = null;
          ds.textContent = "Delete section";
        }, 4000);
        return;
      }
      deleteSection(i);
    });
    body.querySelector("[data-save]").addEventListener("click", function () {
      var out = {
        title: (draft.title || "").trim() || "Untitled",
        motto: (draft.motto || "").trim(),
        blocks: draft.blocks
          .map(function (b) {
            return { h: (b.h || "").trim(), t: serLines(b.items) };
          })
          .filter(function (b) {
            return b.h || b.t;
          }),
      };
      var R2 = rulesData();
      R2[i] = out;
      saveCfg(Object.assign(clone(cfg()), { rules: R2 }));
      closeG();
      renderRules();
    });
  }
  openG("Edit section", function (b) {
    body = b;
    draw();
  });
}

/* Runs once at startup, in file-number order (main.js). */
export function init() {
  DEFAULT_RULES = [];
  rulesEl = document.getElementById("rules");
  openSec = {};
  editSec = -1;
  LT = {
    p: "Text",
    ul: "Bullet",
    ol: "Step",
    yes: "Allowed",
    no: "Not allowed",
    lead: "Highlight",
    card: "Card",
    fact: "Fact",
    chips: "Chips",
  };
  LF = {
    card: ["Title", "Description", "Excludes (optional)"],
    fact: ["Value", "Label"],
    chips: ["Item, item, item"],
  };
}
