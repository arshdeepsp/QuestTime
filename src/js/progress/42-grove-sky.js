/* ---- grove sky: sun, moon, day/night ---- */
function skyState(now) {
  var h = window.__gHour != null ? window.__gHour : now.getHours() + now.getMinutes() / 60 + now.getSeconds() / 3600;
  var start = new Date(now.getFullYear(), 0, 0),
    doy = Math.floor((now - start) / 864e5),
    dayLen = 12 + 3.2 * Math.sin((2 * Math.PI * (doy - 80)) / 365),
    jo = new Date(now.getFullYear(), 0, 1).getTimezoneOffset(),
    dst = now.getTimezoneOffset() < jo,
    noon = 12.2 + (dst ? 1 : 0),
    rise = noon - dayLen / 2,
    set = noon + dayLen / 2,
    alt,
    sunP = null;
  if (h >= rise && h <= set) {
    sunP = (h - rise) / dayLen;
    alt = Math.sin(Math.PI * sunP);
  } else {
    var nl = 24 - dayLen,
      since = h > set ? h - set : h + 24 - set;
    alt = -Math.sin(Math.PI * Math.min(1, since / nl));
  }
  var age = ((now.getTime() - Date.UTC(2000, 0, 6, 18, 14)) / 864e5) % 29.530588;
  if (age < 0) age += 29.530588;
  if (window.__gMoon != null) age = window.__gMoon;
  var mrise = (rise + (age / 29.530588) * 24.8) % 24,
    since2 = (h - mrise + 24) % 24,
    moonP = since2 <= 12.4 ? since2 / 12.4 : null;
  var illum = (1 - Math.cos((2 * Math.PI * age) / 29.530588)) / 2,
    waxing = age < 14.765;
  var label =
    alt >= 0.25
      ? "Day"
      : alt >= 0
        ? h < noon
          ? "Sunrise"
          : "Sunset"
        : alt >= -0.2
          ? h < noon
            ? "Dawn"
            : "Dusk"
          : "Night";
  var names = [
      "New moon",
      "Waxing crescent",
      "First quarter",
      "Waxing gibbous",
      "Full moon",
      "Waning gibbous",
      "Last quarter",
      "Waning crescent",
    ],
    mn = names[Math.floor((age / 29.530588) * 8 + 0.5) % 8];
  return {
    h: h,
    alt: alt,
    sunP: sunP,
    moonP: moonP,
    illum: illum,
    waxing: waxing,
    label: label,
    moonName: mn,
    rise: rise,
    set: set,
    mrise: mrise,
  };
}
function mixC(a, b, k) {
  k = Math.max(0, Math.min(1, k));
  var pa = [parseInt(a.slice(1, 3), 16), parseInt(a.slice(3, 5), 16), parseInt(a.slice(5, 7), 16)],
    pb = [parseInt(b.slice(1, 3), 16), parseInt(b.slice(3, 5), 16), parseInt(b.slice(5, 7), 16)];
  return (
    "rgb(" +
    pa
      .map(function (v, i) {
        return Math.round(v + (pb[i] - v) * k);
      })
      .join(",") +
    ")"
  );
}
function skyColors(alt) {
  var DAY = ["#5DB3EC", "#BFE6FA"],
    GOLD = ["#3F6FB0", "#FFB070"],
    TWI = ["#1B2350", "#9A5A7A"],
    NIGHT = ["#050818", "#16204A"];
  if (alt >= 0.25) return DAY;
  if (alt >= 0) {
    var k = alt / 0.25;
    return [mixC(GOLD[0], DAY[0], k), mixC(GOLD[1], DAY[1], k)];
  }
  if (alt >= -0.2) {
    var k2 = (alt + 0.2) / 0.2;
    return [mixC(TWI[0], GOLD[0], k2), mixC(TWI[1], GOLD[1], k2)];
  }
  var k3 = (alt + 0.45) / 0.25;
  return [mixC(NIGHT[0], TWI[0], k3), mixC(NIGHT[1], TWI[1], k3)];
}
function hhmm(x) {
  x = (x + 24) % 24;
  var hh = Math.floor(x),
    mm = Math.round((x - hh) * 60);
  if (mm === 60) {
    hh = (hh + 1) % 24;
    mm = 0;
  }
  var ap = hh < 12 ? "am" : "pm",
    h12 = hh % 12 || 12;
  return h12 + ":" + String(mm).padStart(2, "0") + " " + ap;
}
function groveFrame(t) {
  if (!groveOpen) return;
  var g = groveGeo,
    c = gctx,
    P = g.P,
    W = gcv.width,
    hzP = g.hz * P;
  var reduce =
      (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) ||
      document.body.classList.contains("calm"),
    sky = skyState(new Date()),
    cols = skyColors(sky.alt);
  var gr = c.createLinearGradient(0, 0, 0, hzP);
  gr.addColorStop(0, cols[0]);
  gr.addColorStop(1, cols[1]);
  c.fillStyle = gr;
  c.fillRect(0, 0, W, hzP + P);
  var sa = Math.max(0, Math.min(1, (-sky.alt - 0.05) / 0.25));
  if (sa > 0)
    g.stars.forEach(function (s, i) {
      var tw = reduce ? 1 : 0.55 + 0.45 * Math.sin(t / 700 + i * 1.7);
      c.globalAlpha = sa * tw;
      c.fillStyle = s.c;
      var ss = Math.max(2, Math.round(P * s.s * 0.5));
      c.fillRect(s.x * P, s.y * P, ss, ss);
    });
  c.globalAlpha = 1;
  function arc(p, r) {
    return { x: Math.round(g.cw * (0.08 + 0.84 * p)), y: Math.round(g.hz + r - (g.hz - 6) * Math.sin(Math.PI * p)) };
  }
  function disc(cx, cy, r, col, cut) {
    for (var dy = -r; dy <= r; dy++)
      for (var dx = -r; dx <= r; dx++) {
        if (dx * dx + dy * dy > r * r + r * 0.6) continue;
        if (cut && cut(dx, dy)) continue;
        c.fillStyle = col;
        c.fillRect((cx + dx) * P, (cy + dy) * P, P, P);
      }
  }
  if (sky.moonP != null && sky.illum > 0.03) {
    var mp = arc(sky.moonP, 4),
      mr = 4,
      off = Math.round((1 - 2 * sky.illum) * mr * 2) * (sky.waxing ? -1 : 1);
    c.globalAlpha = sky.alt > 0.1 ? 0.55 : 1;
    disc(mp.x, mp.y, mr, "#F3EFD2", function (dx, dy) {
      if (sky.illum > 0.97) return false;
      var sx = dx - off;
      return sky.illum < 0.5 ? sx * sx + dy * dy <= mr * mr + mr * 0.6 : false;
    });
    if (sky.illum >= 0.5 && sky.illum < 0.97) {
      var sh = 2 * sky.illum - 1,
        edge = Math.round(mr * (1 - sh));
      for (var dy2 = -mr; dy2 <= mr; dy2++)
        for (var dx2 = -mr; dx2 <= mr; dx2++) {
          if (dx2 * dx2 + dy2 * dy2 > mr * mr + mr * 0.6) continue;
          var side = sky.waxing ? -dx2 : dx2;
          if (side > mr - edge * 1) {
            c.fillStyle = "rgba(20,24,60,.75)";
            c.fillRect((mp.x + dx2) * P, (mp.y + dy2) * P, P, P);
          }
        }
    }
    c.globalAlpha = 1;
  }
  if (sky.sunP != null) {
    var sp = arc(sky.sunP, 5),
      low = sky.alt < 0.3,
      sr = 5;
    disc(sp.x, sp.y, sr + 2, low ? "rgba(255,150,80,.35)" : "rgba(255,240,170,.35)");
    disc(sp.x, sp.y, sr, low ? "#FF9A4A" : "#FFE066");
    disc(sp.x - 1, sp.y - 1, 2, low ? "#FFC07A" : "#FFF6C2");
  }
  var cc = sky.alt >= 0.25 ? "#FFFFFF" : sky.alt >= 0 ? "#FFD9B8" : sky.alt >= -0.2 ? "#C9A0B8" : "#4A5478",
    cc2 = sky.alt >= 0.25 ? "#E4F2FA" : sky.alt >= 0 ? "#F5BE98" : sky.alt >= -0.2 ? "#A88098" : "#3A4466";
  g.clouds.forEach(function (cl) {
    var x = reduce ? cl.x : ((cl.x + (t / 1000) * cl.v) % (g.cw + cl.w + 10)) - cl.w;
    c.fillStyle = cc;
    c.fillRect(Math.round(x) * P, Math.round(cl.y) * P, cl.w * P, 3 * P);
    c.fillRect(Math.round(x + 3) * P, Math.round(cl.y - 2) * P, (cl.w - 6) * P, 2 * P);
    c.fillStyle = cc2;
    c.fillRect(Math.round(x + 1) * P, Math.round(cl.y + 3) * P, (cl.w - 2) * P, P);
  });
  c.drawImage(groveBase, 0, 0);
  var tint =
    sky.alt >= 0.25
      ? 0
      : sky.alt >= 0
        ? ((0.25 - sky.alt) / 0.25) * 0.12
        : sky.alt >= -0.2
          ? 0.12 + (-sky.alt / 0.2) * 0.28
          : 0.4 + Math.min(0.18, -sky.alt - 0.2);
  if (tint > 0) {
    c.fillStyle = sky.alt >= 0 ? "rgba(255,120,50," + tint * 0.6 + ")" : "rgba(8,12,40," + tint + ")";
    c.fillRect(0, hzP, W, gcv.height - hzP);
  }
  var tl = document.getElementById("gTime");
  if (tl)
    tl.textContent =
      sky.label +
      " \u00b7 sunrise " +
      hhmm(sky.rise) +
      " \u00b7 sunset " +
      hhmm(sky.set) +
      " \u00b7 " +
      sky.moonName +
      (sky.moonP != null ? " (up)" : "");
  if (!reduce)
    groveRAF = setTimeout(function () {
      requestAnimationFrame(groveFrame);
    }, 66);
  else
    groveRAF = setTimeout(function () {
      requestAnimationFrame(groveFrame);
    }, 30000);
}
function openGrove(idle) {
  if (groveOpen) {
    groveIdleMode = groveIdleMode && idle;
    return;
  }
  groveOpen = true;
  groveIdleMode = !!idle;
  closeQMenu && closeQMenu();
  groveEl.hidden = false;
  document.body.classList.add("grove-on");
  document.getElementById("groveHint").hidden = !idle;
  buildGrove();
  requestAnimationFrame(groveFrame);
  if (!idle) document.getElementById("groveBack").focus();
}
function closeGrove() {
  if (!groveOpen) return;
  groveOpen = false;
  clearTimeout(groveRAF);
  groveEl.hidden = true;
  document.body.classList.remove("grove-on");
  idleReset();
}
document.getElementById("groveBtn").addEventListener("click", function () {
  openGrove(false);
});
document.getElementById("groveBack").addEventListener("click", closeGrove);
function groveInfoSync() {
  var tg = document.getElementById("groveInfoTg"),
    on = uiGet("groveInfo", true) !== false;
  groveEl.classList.toggle("info-off", !on);
  tg.textContent = on ? "Hide info" : "Show info";
  tg.setAttribute("aria-expanded", on);
}
groveInfoSync();
document.getElementById("groveInfoTg").addEventListener("click", function (e) {
  e.stopPropagation();
  uiSet("groveInfo", !(uiGet("groveInfo", true) !== false));
  groveInfoSync();
});
groveEl.addEventListener("click", function (e) {
  if (
    groveIdleMode &&
    e.target !== document.getElementById("groveBack") &&
    e.target !== document.getElementById("groveInfoTg")
  )
    closeGrove();
});
document.addEventListener("keydown", function (e) {
  if (groveOpen && (e.key === "Escape" || groveIdleMode)) closeGrove();
});
window.addEventListener("resize", function () {
  if (groveOpen) buildGrove();
});
var idleT = 0;
function idleMins() {
  var v = cfg().idleGrove;
  return v == null ? 3 : +v;
}
function idleReset() {
  clearTimeout(idleT);
  var m = idleMins();
  if (!m) return;
  idleT = setTimeout(function () {
    var anyModal =
      !document.getElementById("gModal").hidden ||
      !document.getElementById("nqModal").hidden ||
      !document.getElementById("setDrawer").hidden;
    if (
      document.visibilityState === "visible" &&
      !anyModal &&
      !groveOpen &&
      !rewardsOff() &&
      !(S.sprint && !spMin) &&
      !document.querySelector("#quests input:focus,#tdNew:focus,.t3i:focus")
    )
      openGrove(true);
    else idleReset();
  }, m * 60000);
}
["pointerdown", "keydown", "scroll", "touchstart"].forEach(function (ev) {
  window.addEventListener(
    ev,
    function () {
      if (!groveOpen) idleReset();
    },
    { passive: true },
  );
});
idleReset();
