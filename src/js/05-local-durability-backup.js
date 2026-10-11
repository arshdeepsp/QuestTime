/* ---- local durability + backup ---- */
try {
  if (navigator.storage && navigator.storage.persist) {
    navigator.storage
      .persisted()
      .then(function (p) {
        if (!p) navigator.storage.persist();
      })
      .catch(function () {});
  }
} catch (e) {}
function stamp() {
  var d = new Date();
  return key(d);
}
document.getElementById("expBtn").addEventListener("click", function () {
  try {
    localStorage.setItem("pc-lastExport", String(Date.now()));
  } catch (x) {}
  var data = JSON.stringify(
    {
      app: "personal-operating-playbook",
      version: 2,
      schema: SCHEMA,
      exported: new Date().toISOString(),
      days: S.days,
      refl: S.refl,
      cfg: S.cfg,
    },
    null,
    1,
  );
  var name = "playbook-backup-" + stamp() + ".json",
    btn = this;
  if (dl) {
    btn.disabled = true;
    dl.save({ filename: name, data: data })
      .then(
        function () {
          setSync("Backup saved");
        },
        function (e) {
          setSync(e && e.code === "declined" ? "Backup cancelled" : "Backup couldn't be saved here");
        },
      )
      .finally(function () {
        btn.disabled = false;
      });
    return;
  }
  try {
    var u = URL.createObjectURL(new Blob([data], { type: "application/json" })),
      a = document.createElement("a");
    a.href = u;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () {
      URL.revokeObjectURL(u);
    }, 4000);
    setSync("Backup saved");
  } catch (e) {
    setSync("Backup couldn't be saved here");
  }
});
var impFile = document.getElementById("impFile");
document.getElementById("impBtn").addEventListener("click", function () {
  impFile.value = "";
  impFile.click();
});
impFile.addEventListener("change", function () {
  var file = impFile.files && impFile.files[0];
  if (!file) return;
  file
    .text()
    .then(function (t) {
      var j;
      try {
        j = JSON.parse(t);
      } catch (x) {
        setSync("That file isn't valid JSON. Pick the .json file from Export backup.");
        throw 0;
      }
      if (!j || j.app !== "personal-operating-playbook" || typeof j.days !== "object") {
        setSync("That file isn't a ProductivityCraft backup.");
        throw 0;
      }
      if ((j.schema || 2) > SCHEMA) {
        setSync("That backup is from a newer version of the app. Update first, then import.");
        throw 0;
      }
      j = migrate(j);
      cacheBlock = "";
      var MIG = [
          { id: "wakeAt", type: "wake", label: "Wake-up time", from: "04:00", to: "06:00" },
          { id: "grad", type: "time", label: "CS/Technical work", min: 60 },
          { id: "music", type: "time", label: "Music Practice", min: 60 },
          { id: "french", type: "time", label: "French Learning", min: 30 },
          { id: "exercise", type: "time", label: "Exercise", min: 30, note: "walks count" },
          { id: "mirror", type: "limit", label: "Mirror checks", max: 3 },
          {
            id: "slipmin",
            type: "limit",
            label: "Digital slips",
            max: 30,
            unit: "min",
            note: "feeds, 2 screens, prompt & bolt",
          },
        ],
        migIds = MIG.map(function (q) {
          return q.id;
        }),
        earliest = null,
        usedMig = false;
      var n = 0;
      Object.keys(j.days).forEach(function (k) {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(k)) return;
        var a = S.days[k] || {},
          b = Object.assign({}, j.days[k] || {}),
          m = Object.assign({}, a);
        if (
          !b.q &&
          Object.keys(b).some(function (f) {
            return migIds.indexOf(f) >= 0;
          })
        ) {
          b.q = MIG;
          usedMig = true;
        }
        if (hasEntry(b) && (!earliest || k < earliest)) earliest = k;
        Object.keys(b).forEach(function (f) {
          var v = b[f];
          if (Array.isArray(v)) {
            if (!a[f]) m[f] = v;
          } else if (typeof v === "string" && /^\d{2}:\d{2}$/.test(v)) {
            if (!a[f]) m[f] = v;
          } else if (typeof v === "boolean") m[f] = !!(a[f] || v);
          else if (typeof v === "number" && isFinite(v))
            m[f] = Math.max(a[f] | 0, Math.max(0, Math.min(9999, Math.round(v))));
        });
        if (!hasEntry(a)) {
          if (b.q) m.q = b.q;
          if (b.ck) m.ck = b.ck;
        }
        if (JSON.stringify(m) !== JSON.stringify(a)) {
          S.days[k] = m;
          dirty[k] = true;
          n++;
        }
      });
      var r = 0;
      if (j.refl && typeof j.refl === "object") {
        S.refl = Object.assign({}, S.refl);
        Object.keys(j.refl).forEach(function (k) {
          if (!S.refl[k] && j.refl[k]) {
            S.refl[k] = j.refl[k];
            r++;
          }
        });
      }
      var cu = false;
      if (j.cfg && j.cfg.quests && (!S.cfg || (j.cfg.updated || "") > (S.cfg.updated || ""))) {
        saveCfg(clone(j.cfg));
        S.cfg = Object.assign({}, S.cfg, { updated: j.cfg.updated || S.cfg.updated });
        if (j.cfg.start) setStart(j.cfg.start);
        elapsed();
        cu = true;
        qSig = "";
        renderRules();
      }
      if (!cu && usedMig && !(cfg().quests || []).length) {
        var c4 = clone(cfg());
        c4.quests = clone(MIG);
        saveCfg(c4);
        cu = true;
        qSig = "";
      }
      if (earliest && typeof setStart === "function" && earliest < START_KEY) {
        setStart(parse(earliest).toISOString());
        var c3 = clone(cfg());
        c3.start = START_AT.toISOString();
        saveCfg(c3);
        elapsed();
      }
      lockReset();
      cache();
      /* Reload so every screen and cache starts from the imported data (and, signed in, the first sync pushes it). */
      appRefresh(
        "Imported " +
          n +
          " day" +
          (n === 1 ? "" : "s") +
          (r ? " and " + r + " reflection" + (r === 1 ? "" : "s") : "") +
          (cu ? " and your quests/rules" : ""),
      );
    })
    .catch(function (x) {
      if (x !== 0) setSync("Import failed. Try exporting a fresh backup.");
    })
    .finally(function () {
      impFile.value = "";
    });
});
