/* ---- sync merge (pure helpers for sync/54-account.js) ----
     Which copy wins is decided by content, not by device clocks. The account sync keeps, per synced doc, a hash of the version both
     sides last agreed on (S.meta.h[id]; for cfg also the version itself, S.meta.cb). On a pull: only the remote changed
     → take it; only this device changed → push ours; both changed → merge3. cfg merges three-way against its base, so
     two devices editing different quests (or subjects, busy times, repeats, settings) both keep their edits, and an item
     removed on one side stays removed unless the other side edited it. Days and reflections merge two-way (union of
     fields). Where both sides changed the same field, `pref` decides ("l" = this device, "r" = remote). */
function canon(o) {
  if (o === undefined) return "~";
  if (o === null || typeof o !== "object") return JSON.stringify(o);
  if (Array.isArray(o)) return "[" + o.map(canon).join(",") + "]";
  return (
    "{" +
    Object.keys(o)
      .filter(function (k) {
        return o[k] !== undefined;
      })
      .sort()
      .map(function (k) {
        return JSON.stringify(k) + ":" + canon(o[k]);
      })
      .join(",") +
    "}"
  );
}
/* cyrb53: a 53-bit string hash; plenty to tell versions of one document apart. */
function hashOf(o) {
  var s = canon(o),
    h1 = 0xdeadbeef,
    h2 = 0x41c6ce57;
  for (var i = 0, c; i < s.length; i++) {
    c = s.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 2654435761);
    h2 = Math.imul(h2 ^ c, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
}
function mgSame(a, b) {
  return canon(a) === canon(b);
}
function mgObj(x) {
  return !!x && typeof x === "object" && !Array.isArray(x);
}
function mgIds(a) {
  return (
    Array.isArray(a) &&
    a.every(function (x) {
      return mgObj(x) && x.id != null;
    })
  );
}
function mgFlat(a) {
  return (
    Array.isArray(a) &&
    a.every(function (x) {
      return typeof x === "string" || typeof x === "number";
    })
  );
}
function merge3(b, l, r, pref) {
  if (mgSame(l, r)) return l;
  if (mgSame(l, b)) return r;
  if (mgSame(r, b)) return l;
  if (mgObj(l) && mgObj(r)) {
    var bb = mgObj(b) ? b : {},
      o = {},
      ks = Object.keys(l).concat(
        Object.keys(r).filter(function (k) {
          return !(k in l);
        }),
        Object.keys(bb).filter(function (k) {
          return !(k in l) && !(k in r);
        }),
      );
    ks.forEach(function (k) {
      var v = merge3(bb[k], l[k], r[k], pref);
      if (v !== undefined) o[k] = v;
    });
    return o;
  }
  if (Array.isArray(l) && Array.isArray(r)) {
    var ba = Array.isArray(b) ? b : [];
    if (mgIds(l) && mgIds(r) && mgIds(ba)) return mergeIds(ba, l, r, pref);
    if (mgFlat(l) && mgFlat(r) && mgFlat(ba)) return mergeSet(ba, l, r);
  }
  return pref === "l" ? l : r;
}
/* Lists of {id,…} (quests, subjects, busy times, repeats…): each item merges on its own; an item added on either side is
     kept; one removed on a side stays removed unless the other side changed it. Order: this device's if it was
     reordered here, else the remote's; items only the other side has go after their neighbour there. */
function mergeIds(b, l, r, pref) {
  var bm = {},
    lm = {},
    rm = {};
  b.forEach(function (x) {
    bm[x.id] = x;
  });
  l.forEach(function (x) {
    lm[x.id] = x;
  });
  r.forEach(function (x) {
    rm[x.id] = x;
  });
  function pick(id) {
    var iB = id in bm,
      iL = id in lm,
      iR = id in rm;
    if (iL && iR) return merge3(bm[id], lm[id], rm[id], pref);
    if (iL) return !iB || !mgSame(lm[id], bm[id]) ? lm[id] : undefined;
    if (iR) return !iB || !mgSame(rm[id], bm[id]) ? rm[id] : undefined;
  }
  function seq(a, keep) {
    return a
      .map(function (x) {
        return x.id;
      })
      .filter(function (id) {
        return id in keep;
      });
  }
  var movedHere =
      canon(
        seq(l, bm).filter(function (id) {
          return id in lm;
        }),
      ) !== canon(seq(b, lm)),
    first = movedHere ? l : r,
    second = movedHere ? r : l,
    ids = first
      .map(function (x) {
        return x.id;
      })
      .filter(function (id, i, a) {
        return a.indexOf(id) === i;
      });
  second.forEach(function (x, i) {
    if (ids.indexOf(x.id) >= 0) return;
    var at = 0;
    for (var j = i - 1; j >= 0; j--) {
      var p = ids.indexOf(second[j].id);
      if (p >= 0) {
        at = p + 1;
        break;
      }
    }
    ids.splice(at, 0, x.id);
  });
  var out = [];
  ids.forEach(function (id) {
    var v = pick(id);
    if (v !== undefined) out.push(v);
  });
  return out;
}
/* Lists of plain ids/values (ignore list…): union, minus what either side removed. */
function mergeSet(b, l, r) {
  var gone = b.filter(function (x) {
      return l.indexOf(x) < 0 || r.indexOf(x) < 0;
    }),
    out = [];
  l.concat(r).forEach(function (x) {
    if (gone.indexOf(x) < 0 && out.indexOf(x) < 0) out.push(x);
  });
  return out;
}
