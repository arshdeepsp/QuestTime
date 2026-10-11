/* ---- grove (progress forest) ---- */
var groveEl = document.getElementById("grove"),
  gcv = document.getElementById("groveCanvas"),
  gctx = gcv.getContext("2d"),
  groveOpen = false,
  groveIdleMode = false,
  groveRAF = 0,
  groveBase = null,
  groveGeo = null;
function grng(seed) {
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
function groveStats() {
  var st = window.__gT != null ? { total: window.__gT, streak: 0 } : lastSt || compute();
  var g =
    window.__gG != null
      ? window.__gG
      : Object.keys(S.days).filter(function (k) {
          return k >= START_KEY && !noStreakOn(k) && gold(S.days[k]);
        }).length;
  return { total: st.total | 0, gold: g | 0 };
}
function stageOf(age, center) {
  var th = center ? [0, 1, 2, 4, 10, 21, 60] : [0, 1, 3, 6, 12, 25, 50],
    s = -1;
  for (var i = 0; i < th.length; i++) if (age >= th[i]) s = i;
  return s;
}
var SPAWN0 = 10,
  SPAWNEVERY = 4;
function drawPlant(c, P, x, y, stage, rnd, hueShift) {
  function px(cx, cy, col) {
    c.fillStyle = col;
    c.fillRect(Math.round((x + cx) * P), Math.round((y + cy) * P), P, P);
  }
  function rect(cx, cy, w, h, col) {
    c.fillStyle = col;
    c.fillRect(Math.round((x + cx) * P), Math.round((y + cy) * P), w * P, h * P);
  }
  var G = ["#2F6B22", "#3E8A2C", "#56A63A", "#7CC24E", "#A6DB72"];
  if (hueShift === 1) G = ["#6B4A1E", "#9A6A22", "#C98E2B", "#E3B044", "#F5D36B"];
  if (hueShift === 2) G = ["#245A3A", "#2F7A4C", "#3E9A5E", "#5DB87A", "#8ED6A2"];
  var TR = "#5A3417",
    TR2 = "#7A4A24";
  if (stage < 0) return;
  if (stage === 0) {
    rect(-1, 0, 3, 1, "#6A4A31");
    px(0, -1, "#8B6243");
    return;
  }
  if (stage === 1) {
    rect(-2, 0, 5, 1, "#6A4A31");
    rect(0, -3, 1, 3, G[1]);
    px(-1, -3, G[3]);
    px(1, -4, G[3]);
    px(-1, -4, G[2]);
    return;
  }
  if (stage === 2) {
    rect(0, -6, 1, 6, G[1]);
    [
      [-2, -4],
      [-1, -5],
      [1, -5],
      [2, -6],
      [-1, -7],
      [0, -8],
      [1, -7],
      [-2, -6],
    ].forEach(function (p, i) {
      px(p[0], p[1], G[2 + (i % 3)]);
    });
    return;
  }
  var spec = [
    null,
    null,
    null,
    { tw: 1, th: 7, r: 3 },
    { tw: 2, th: 9, r: 5 },
    { tw: 2, th: 12, r: 7 },
    { tw: 3, th: 15, r: 10 },
  ][stage];
  c.fillStyle = "rgba(0,0,0,.18)";
  c.fillRect(Math.round((x - spec.r) * P), Math.round(y * P), (spec.r * 2 + 1) * P, P);
  rect(-Math.floor(spec.tw / 2), -spec.th, spec.tw, spec.th, TR);
  rect(-Math.floor(spec.tw / 2), -spec.th, 1, spec.th, TR2);
  var cy = -spec.th - spec.r + 2,
    r = spec.r;
  for (var dy = -r; dy <= r; dy++)
    for (var dx = -r; dx <= r; dx++) {
      var d = dx * dx + dy * dy * 1.1,
        edge = r * r + (rnd() - 0.5) * r * 1.6;
      if (d > edge) continue;
      var l = (-dx - dy) / (r * 1.4) + (rnd() - 0.5) * 0.5,
        ci = l > 0.55 ? 4 : l > 0.15 ? 3 : l > -0.3 ? 2 : l > -0.7 ? 1 : 0;
      px(dx, cy + dy, G[ci]);
    }
  if (stage >= 5)
    for (var k = 0; k < 3; k++) {
      var fx = Math.round((rnd() - 0.5) * r),
        fy = Math.round(cy + (rnd() - 0.5) * r);
      px(fx, fy, "#F2D16B");
    }
}
function buildGrove() {
  var dpr = Math.min(2, window.devicePixelRatio || 1),
    W = window.innerWidth,
    H = window.innerHeight;
  gcv.width = Math.round(W * dpr);
  gcv.height = Math.round(H * dpr);
  gcv.style.width = W + "px";
  gcv.style.height = H + "px";
  var P = Math.max(3, Math.round(Math.min(W, H) / 150)) * dpr,
    cw = Math.ceil(gcv.width / P),
    ch = Math.ceil(gcv.height / P),
    hz = Math.round(ch * 0.32);
  var off = document.createElement("canvas");
  off.width = gcv.width;
  off.height = gcv.height;
  var c = off.getContext("2d");
  var r0 = grng("ground" + START_KEY),
    GC = ["#5E9E3A", "#649F3C", "#58953A", "#6AA642", "#53903A"];
  for (var y = hz; y < ch; y++)
    for (var x = 0; x < cw; x++) {
      var t = r0();
      c.fillStyle = t < 0.62 ? GC[0] : t < 0.78 ? GC[1] : t < 0.9 ? GC[2] : t < 0.97 ? GC[3] : GC[4];
      c.fillRect(x * P, y * P, P, P);
    }
  c.fillStyle = "#7DBB55";
  c.fillRect(0, hz * P, off.width, P);
  var gs = groveStats(),
    tot = gs.total,
    cx = Math.round(cw / 2),
    cyy = Math.round(hz + (ch - hz) * 0.55);
  if (tot < 10) {
    var pr = grng("plot" + START_KEY);
    for (var yy = -3; yy <= 3; yy++)
      for (var xx = -7; xx <= 7; xx++) {
        if ((xx * xx) / 49 + (yy * yy) / 9 > 1) continue;
        c.fillStyle = pr() < 0.5 ? "#79553A" : "#8B6243";
        c.fillRect((cx + xx) * P, (cyy + yy) * P, P, P);
      }
  }
  var rs = grng("slots" + START_KEY),
    slots = [],
    maxR = Math.min(cw * 0.48, (ch - hz) * 1.4);
  for (var i = 0; i < 400 && slots.length < 70; i++) {
    var a = rs() * Math.PI * 2,
      rd = Math.sqrt(rs()) * maxR,
      sx = Math.round(cx + Math.cos(a) * rd),
      sy = Math.round(cyy + Math.sin(a) * rd * 0.45);
    if (sy < hz + 18 || sy > ch - 2 || sx < 4 || sx > cw - 4) continue;
    if (Math.abs(sx - cx) < 9 && Math.abs(sy - cyy) < 5) continue;
    if (
      slots.some(function (s) {
        return Math.abs(s.x - sx) < 7 && Math.abs(s.y - sy) < 4;
      })
    )
      continue;
    slots.push({ x: sx, y: sy, d: Math.hypot(sx - cx, (sy - cyy) * 2.2) });
  }
  slots.sort(function (a, b) {
    return a.d - b.d;
  });
  var plants = [{ x: cx, y: cyy, age: tot, center: true, seed: "c" }],
    spawned = 0;
  slots.forEach(function (s, k) {
    var sd = SPAWN0 + k * SPAWNEVERY;
    if (tot >= sd) {
      plants.push({ x: s.x, y: s.y, age: tot - sd, center: false, seed: "p" + k });
      spawned++;
    }
  });
  var fr = grng("flowers" + START_KEY),
    FC = ["#F7E26B", "#F28AB0", "#FFFFFF", "#B48CF2", "#FF9E4A"];
  for (var f = 0; f < Math.min(150, gs.gold * 3); f++) {
    var fx = Math.round(cx + (fr() - 0.5) * cw * 0.9),
      fy = Math.round(hz + 4 + fr() * (ch - hz - 6));
    c.fillStyle = FC[Math.floor(fr() * FC.length)];
    c.fillRect(fx * P, fy * P, P, P);
    c.fillStyle = "#3E8A2C";
    c.fillRect(fx * P, (fy + 1) * P, P, P);
  }
  plants
    .sort(function (a, b) {
      return a.y - b.y;
    })
    .forEach(function (pl) {
      var r = grng(pl.seed + START_KEY);
      var hs = pl.center ? 0 : r() < 0.12 ? 1 : r() < 0.3 ? 2 : 0;
      drawPlant(c, P, pl.x, pl.y, stageOf(pl.age, pl.center), r, hs);
    });
  groveBase = off;
  var trees = plants.filter(function (pl) {
      return stageOf(pl.age, pl.center) >= 4;
    }).length,
    sprouts = plants.length - trees;
  var nextSp = tot < SPAWN0 ? SPAWN0 - tot : SPAWNEVERY - ((tot - SPAWN0) % SPAWNEVERY);
  var rst = grng("stars" + START_KEY),
    stars = [];
  for (var si = 0; si < 70; si++)
    stars.push({
      x: Math.floor(rst() * cw),
      y: Math.floor(rst() * (hz - 3)),
      s: rst() < 0.15 ? 2 : 1,
      c: rst() < 0.2 ? "#FFF3C4" : "#FFFFFF",
    });
  groveGeo = {
    P: P,
    cw: cw,
    hz: hz,
    stars: stars,
    clouds: [0, 1, 2, 3].map(function (i) {
      var rr = grng("cl" + i);
      return { x: rr() * cw, y: 2 + rr() * (hz - 12), w: 10 + Math.floor(rr() * 14), v: 0.4 + rr() * 0.6 };
    }),
  };
  var stg = ["a seed", "a sprout", "a seedling", "a sapling", "a young tree", "a tree", "a great tree"][
    Math.max(0, stageOf(tot, true))
  ];
  document.getElementById("groveInfo").innerHTML =
    '<div class="gtitle">Your grove</div><div class="gline">' +
    tot +
    " cleared day" +
    (tot === 1 ? "" : "s") +
    " \u00b7 " +
    plants.length +
    " plant" +
    (plants.length === 1 ? "" : "s") +
    (trees ? " \u00b7 " + trees + " tree" + (trees === 1 ? "" : "s") : "") +
    (gs.gold ? " \u00b7 " + Math.min(150, gs.gold * 3) + " flowers" : "") +
    '</div><div class="gline">The first plant is ' +
    stg +
    ". " +
    (tot < 365
      ? "New seedling in " + nextSp + " cleared day" + (nextSp === 1 ? "" : "s") + "."
      : "A full forest. Well done.") +
    '</div><div class="gbar"><i style="width:' +
    Math.min(100, Math.round((tot / 365) * 100)) +
    '%"></i></div><div class="gline small">' +
    Math.min(tot, 365) +
    ' of 365 days toward a forest \u00b7 gold days grow flowers</div><div class="gline small" id="gTime"></div>';
}
