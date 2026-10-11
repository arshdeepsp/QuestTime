/* ---- themes ---- */
var THEMES = {
  grass: {
    d: ["#79553A", "#8B6243", "#6A4A31", "#976D4C", "#5C3F2A"],
    g: ["#5E9E3A", "#6FB444", "#4F8A30", "#7CC24E"],
    bg: "#79553A",
    tc: "#5E9E3A",
  },
  night: {
    d: ["#4A3322", "#553B27", "#3F2B1C", "#5E432D", "#35251A"],
    g: ["#2F5A22", "#3A6B2A", "#264C1C", "#447A31"],
    bg: "#4A3322",
    tc: "#2F5A22",
  },
  nether: {
    d: ["#6B2222", "#702424", "#661F1F", "#772828", "#5F1D1D"],
    g: ["#9B2F4E", "#A8365A", "#8C2946", "#B24163"],
    bg: "#6B2222",
    tc: "#9B2F4E",
    w: [0.5, 0.2, 0.15, 0.1, 0.05],
  },
  snow: {
    d: ["#5E7289", "#62768D", "#5A6E84", "#667B92", "#57697F"],
    g: ["#F4F8FB", "#FFFFFF", "#EEF4F9", "#F8FBFD"],
    bg: "#5E7289",
    tc: "#F4F8FB",
    w: [0.55, 0.2, 0.13, 0.08, 0.04],
  },
  ocean: {
    d: ["#1F4E79", "#22527E", "#1D4A74", "#255782", "#1B476F"],
    g: ["#E3D39A", "#E8D9A2", "#DDCD92", "#EDDFAA"],
    bg: "#1F4E79",
    tc: "#E3D39A",
    w: [0.55, 0.2, 0.13, 0.08, 0.04],
  },
  lava: {
    d: ["#2B2026", "#352830", "#231A1F", "#3E2F38", "#1C1519"],
    g: ["#E0561B", "#F07A1F", "#C9401A", "#FFA53A"],
    bg: "#2B2026",
    tc: "#E0561B",
  },
};
function tile(pal, top, seed, ww) {
  var h = seed,
    r = function () {
      h = (h * 1103515245 + 12345) & 0x7fffffff;
      return h / 0x7fffffff;
    },
    w = ww || [0.34, 0.28, 0.2, 0.12, 0.06],
    o = "",
    drip = [];
  for (var x = 0; x < 16; x++) drip.push(4 + Math.floor(r() * 4));
  for (var y = 0; y < 16; y++)
    for (x = 0; x < 16; x++) {
      var c;
      if (top && y < drip[x]) c = top[Math.floor(r() * top.length)];
      else {
        var t = r(),
          a = 0,
          ix = 0;
        for (; ix < w.length; ix++) {
          a += w[ix];
          if (t < a) break;
        }
        c = pal[Math.min(ix, pal.length - 1)];
      }
      o += '<rect x="' + x + '" y="' + y + '" width="1" height="1" fill="' + c + '"/>';
    }
  return (
    'url("data:image/svg+xml,' +
    encodeURIComponent(
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" shape-rendering="crispEdges">' + o + "</svg>",
    ) +
    '")'
  );
}
function svgUri(w, h, body) {
  return (
    'url("data:image/svg+xml,' +
    encodeURIComponent(
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' +
        w +
        " " +
        h +
        '" width="' +
        w +
        '" height="' +
        h +
        '" shape-rendering="crispEdges">' +
        body +
        "</svg>",
    ) +
    '")'
  );
}
function scatter(w, h, n, seed, draw) {
  var s = seed,
    r = function () {
      s = (s * 1103515245 + 12345) & 0x7fffffff;
      return s / 0x7fffffff;
    },
    o = "";
  for (var i = 0; i < n; i++) o += draw(Math.floor(r() * w), Math.floor(r() * h), r);
  return o;
}
var FX = null;
function fxPatterns() {
  if (FX) return FX;
  var px = function (x, y, s, c, op) {
    return (
      '<rect x="' +
      x +
      '" y="' +
      y +
      '" width="' +
      s +
      '" height="' +
      s +
      '" fill="' +
      c +
      '"' +
      (op ? ' fill-opacity="' + op + '"' : "") +
      "/>"
    );
  };
  FX = {
    snowA: svgUri(
      128,
      128,
      scatter(126, 126, 9, 3, function (x, y) {
        return px(x, y, 3, "#FFFFFF", 0.95);
      }),
    ),
    snowB: svgUri(
      112,
      112,
      scatter(110, 110, 12, 9, function (x, y) {
        return px(x, y, 2, "#FFFFFF", 0.75);
      }),
    ),
    waves: svgUri(
      96,
      48,
      scatter(88, 46, 7, 5, function (x, y) {
        return '<rect x="' + x + '" y="' + y + '" width="8" height="1" fill="#CFEFFF" fill-opacity=".22"/>';
      }),
    ),
    bubbles: svgUri(
      80,
      80,
      scatter(76, 76, 5, 13, function (x, y, r) {
        var s = r() > 0.5 ? 3 : 2;
        return (
          '<rect x="' +
          x +
          '" y="' +
          y +
          '" width="' +
          s +
          '" height="' +
          s +
          '" fill="none" stroke="#CFF4FF" stroke-opacity=".5" stroke-width="1"/>'
        );
      }),
    ),
    starsA: svgUri(
      200,
      200,
      scatter(196, 196, 16, 21, function (x, y, r) {
        return r() > 0.8
          ? px(x + 1, y, 1, "#FFF8D6") +
              px(x, y + 1, 3, "#FFF8D6", 0.0) +
              '<rect x="' +
              x +
              '" y="' +
              (y + 1) +
              '" width="3" height="1" fill="#FFF8D6"/>' +
              px(x + 1, y + 2, 1, "#FFF8D6")
          : px(x, y, 1, "#FFFFFF", 0.9);
      }),
    ),
    starsB: svgUri(
      260,
      260,
      scatter(256, 256, 14, 33, function (x, y) {
        return px(x, y, 2, "#DDE6FF", 0.9);
      }),
    ),
    starsC: svgUri(
      180,
      180,
      scatter(176, 176, 10, 57, function (x, y, r) {
        return r() > 0.6
          ? '<rect x="' +
              (x + 1) +
              '" y="' +
              y +
              '" width="1" height="3" fill="#FFFFFF"/><rect x="' +
              x +
              '" y="' +
              (y + 1) +
              '" width="3" height="1" fill="#FFFFFF"/>'
          : px(x, y, 1, "#FFF3C4");
      }),
    ),
    clouds: svgUri(
      256,
      64,
      (function () {
        var o = "",
          W = "#FFFFFF",
          G = "#E4F2FA";
        function cl(x, y, w) {
          o +=
            '<rect x="' +
            (x + 4) +
            '" y="' +
            y +
            '" width="' +
            (w - 8) +
            '" height="4" fill="' +
            W +
            '"/><rect x="' +
            x +
            '" y="' +
            (y + 4) +
            '" width="' +
            w +
            '" height="6" fill="' +
            W +
            '"/><rect x="' +
            (x + 2) +
            '" y="' +
            (y + 10) +
            '" width="' +
            (w - 4) +
            '" height="2" fill="' +
            G +
            '"/><rect x="' +
            (x + 10) +
            '" y="' +
            (y - 4) +
            '" width="' +
            Math.max(8, w - 26) +
            '" height="4" fill="' +
            W +
            '"/>';
        }
        cl(12, 22, 48);
        cl(150, 38, 34);
        return o;
      })(),
    ),
    clouds2: svgUri(
      200,
      50,
      (function () {
        var o = "",
          W = "#FFFFFF";
        o +=
          '<rect x="30" y="18" width="30" height="4" fill="' +
          W +
          '"/><rect x="24" y="22" width="44" height="6" fill="' +
          W +
          '"/><rect x="120" y="30" width="22" height="3" fill="' +
          W +
          '"/><rect x="114" y="33" width="34" height="5" fill="' +
          W +
          '"/>';
        return o;
      })(),
    ),
    embersA: svgUri(
      120,
      120,
      scatter(116, 116, 9, 71, function (x, y, r) {
        return px(x, y, r() > 0.5 ? 2 : 1, r() > 0.5 ? "#FFB347" : "#FF6A1A", 0.95);
      }),
    ),
    embersB: svgUri(
      150,
      150,
      scatter(146, 146, 7, 83, function (x, y) {
        return px(x, y, 1, "#FFE08A", 0.9);
      }),
    ),
    snowClouds: svgUri(
      256,
      56,
      (function () {
        var o = "",
          A = "#AEB9C4",
          B = "#C3CCD5",
          Cc = "#97A3AF";
        function cl(x, y, w) {
          o +=
            '<rect x="' +
            (x + 6) +
            '" y="' +
            y +
            '" width="' +
            (w - 12) +
            '" height="6" fill="' +
            B +
            '"/><rect x="' +
            x +
            '" y="' +
            (y + 6) +
            '" width="' +
            w +
            '" height="10" fill="' +
            A +
            '"/><rect x="' +
            (x + 4) +
            '" y="' +
            (y + 16) +
            '" width="' +
            (w - 8) +
            '" height="4" fill="' +
            Cc +
            '"/><rect x="' +
            (x + 14) +
            '" y="' +
            (y - 5) +
            '" width="' +
            Math.max(10, w - 34) +
            '" height="5" fill="' +
            B +
            '"/>';
        }
        cl(0, 14, 70);
        cl(62, 20, 60);
        cl(118, 12, 78);
        cl(190, 18, 66);
        return o;
      })(),
    ),
    crests: svgUri(
      160,
      80,
      scatter(150, 74, 7, 117, function (x, y) {
        return (
          '<rect x="' +
          x +
          '" y="' +
          (y + 1) +
          '" width="2" height="1" fill="#CFEFFF" fill-opacity=".35"/><rect x="' +
          (x + 2) +
          '" y="' +
          y +
          '" width="4" height="1" fill="#E6F7FF" fill-opacity=".45"/><rect x="' +
          (x + 6) +
          '" y="' +
          (y + 1) +
          '" width="2" height="1" fill="#CFEFFF" fill-opacity=".35"/>'
        );
      }),
    ),
    shimmer: svgUri(
      40,
      40,
      scatter(36, 38, 6, 91, function (x, y) {
        return (
          '<rect x="' +
          x +
          '" y="' +
          y +
          '" width="' +
          (6 + (x % 3) * 2) +
          '" height="1" fill="#FFD08A" fill-opacity=".85"/>'
        );
      }),
    ),
    lavaB: svgUri(
      140,
      140,
      scatter(132, 132, 8, 101, function (x, y, r) {
        var s = r() > 0.5 ? 3 : 2;
        return (
          '<rect x="' +
          x +
          '" y="' +
          y +
          '" width="' +
          s +
          '" height="' +
          s +
          '" fill="#FF8A1F"/><rect x="' +
          x +
          '" y="' +
          y +
          '" width="1" height="1" fill="#FFE08A"/>'
        );
      }),
    ),
    cityBack: svgUri(
      240,
      160,
      (function () {
        var r = grng("cityB"),
          o = "",
          x = 0;
        while (x < 240) {
          var w = 10 + Math.floor(r() * 18),
            h = 40 + Math.floor(r() * 80);
          o += '<rect x="' + x + '" y="' + (160 - h) + '" width="' + w + '" height="' + h + '" fill="#2B3060"/>';
          if (r() < 0.3)
            o +=
              '<rect x="' +
              (x + Math.floor(w / 2) - 1) +
              '" y="' +
              (160 - h - 6) +
              '" width="2" height="6" fill="#2B3060"/>';
          x += w + (r() < 0.3 ? 2 : 0);
        }
        return o;
      })(),
    ),
    cityFront: svgUri(
      240,
      160,
      (function () {
        var r = grng("cityF"),
          o = "",
          x = 0,
          W = "#171A36",
          L = "#FFD27A",
          U = "#262B52";
        function bld(x, w, h) {
          o += '<rect x="' + x + '" y="' + (160 - h) + '" width="' + w + '" height="' + h + '" fill="' + W + '"/>';
          for (var yy = 160 - h + 4; yy < 156; yy += 5)
            for (var xx = x + 2; xx < x + w - 2; xx += 4)
              o += '<rect x="' + xx + '" y="' + yy + '" width="2" height="2" fill="' + (r() < 0.28 ? L : U) + '"/>';
        }
        while (x < 240) {
          if (x > 100 && x < 126) {
            bld(104, 22, 100);
            o +=
              '<rect x="107" y="44" width="16" height="16" fill="' +
              W +
              '"/><rect x="110" y="30" width="10" height="14" fill="' +
              W +
              '"/><rect x="113" y="18" width="4" height="12" fill="' +
              W +
              '"/><rect x="114" y="4" width="2" height="14" fill="' +
              W +
              '"/>';
            x = 128;
            continue;
          }
          var w = 10 + Math.floor(r() * 16),
            h = 24 + Math.floor(r() * 56);
          bld(x, w, h);
          x += w + (r() < 0.25 ? 3 : 1);
        }
        return o;
      })(),
    ),
    cityWin: svgUri(
      240,
      160,
      (function () {
        var r = grng("cityW"),
          o = "";
        for (var i = 0; i < 70; i++) {
          var x = 2 + Math.floor(r() * 118) * 2,
            y = 60 + Math.floor(r() * 19) * 5;
          o += '<rect x="' + x + '" y="' + y + '" width="2" height="2" fill="#FFE9A8"/>';
        }
        return o;
      })(),
    ),
    cityBlink: svgUri(
      240,
      160,
      '<rect x="114" y="3" width="2" height="2" fill="#FF3B30"/><rect x="40" y="70" width="1" height="1" fill="#FF3B30"/><rect x="200" y="62" width="1" height="1" fill="#FF3B30"/>',
    ),
    mtFar: svgUri(
      320,
      160,
      (function () {
        var o = "",
          y,
          r = grng("mf");
        for (var x = 0; x < 320; x += 2) {
          y = Math.round(70 + 28 * Math.sin(x / 37) + 16 * Math.sin(x / 13 + 1) + r() * 3);
          o += '<rect x="' + x + '" y="' + y + '" width="2" height="' + (160 - y) + '" fill="#8FA9C7"/>';
          if (y < 62)
            o +=
              '<rect x="' + x + '" y="' + y + '" width="2" height="' + Math.min(6, 62 - y + 2) + '" fill="#E8F1F8"/>';
        }
        return o;
      })(),
    ),
    mtMid: svgUri(
      320,
      160,
      (function () {
        var o = "",
          y,
          r = grng("mm");
        for (var x = 0; x < 320; x += 2) {
          y = Math.round(92 + 24 * Math.sin(x / 29 + 2) + 12 * Math.sin(x / 9) + r() * 3);
          o += '<rect x="' + x + '" y="' + y + '" width="2" height="' + (160 - y) + '" fill="#5F7C8E"/>';
          if (y < 84)
            o +=
              '<rect x="' + x + '" y="' + y + '" width="2" height="' + Math.min(8, 84 - y + 3) + '" fill="#F4F8FB"/>';
          else o += '<rect x="' + x + '" y="' + y + '" width="2" height="2" fill="#6E8C9E"/>';
        }
        return o;
      })(),
    ),
    mtNear: svgUri(
      320,
      160,
      (function () {
        var o = "",
          y,
          r = grng("mn");
        for (var x = 0; x < 320; x += 2) {
          y = Math.round(122 + 10 * Math.sin(x / 23) + 6 * Math.sin(x / 7 + 3) + r() * 2);
          o +=
            '<rect x="' +
            x +
            '" y="' +
            y +
            '" width="2" height="' +
            (160 - y) +
            '" fill="#3E7A3A"/><rect x="' +
            x +
            '" y="' +
            y +
            '" width="2" height="2" fill="#5E9E3A"/>';
          if (r() < 0.12)
            o +=
              '<rect x="' +
              x +
              '" y="' +
              (y - 5) +
              '" width="2" height="5" fill="#2E5E2C"/><rect x="' +
              (x - 1) +
              '" y="' +
              (y - 3) +
              '" width="4" height="2" fill="#2E5E2C"/>';
        }
        return o;
      })(),
    ),
    birds: svgUri(
      200,
      80,
      (function () {
        var o = "",
          r = grng("bd");
        for (var i = 0; i < 4; i++) {
          var x = Math.floor(r() * 180),
            y = Math.floor(r() * 60);
          o +=
            '<rect x="' +
            x +
            '" y="' +
            y +
            '" width="2" height="1" fill="#2B2B2B"/><rect x="' +
            (x + 2) +
            '" y="' +
            (y + 1) +
            '" width="1" height="1" fill="#2B2B2B"/><rect x="' +
            (x + 3) +
            '" y="' +
            y +
            '" width="2" height="1" fill="#2B2B2B"/>';
        }
        return o;
      })(),
    ),
    vilHills: svgUri(
      320,
      160,
      (function () {
        var o = "",
          y;
        for (var x = 0; x < 320; x += 2) {
          y = Math.round(104 + 10 * Math.sin((x * Math.PI * 2) / 160) + 6 * Math.sin((x * Math.PI * 2) / 64 + 1));
          o +=
            '<rect x="' +
            x +
            '" y="' +
            y +
            '" width="2" height="' +
            (160 - y) +
            '" fill="#7FA35A"/><rect x="' +
            x +
            '" y="' +
            y +
            '" width="2" height="2" fill="#93B86A"/>';
        }
        return o;
      })(),
    ),
    village: svgUri(
      240,
      160,
      (function () {
        var o = "",
          r = grng("vil");
        function R(x, y, w, h, c) {
          o += '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" fill="' + c + '"/>';
        }
        R(0, 134, 240, 26, "#5E9E3A");
        for (var gx = 0; gx < 240; gx += 4) R(gx, 134, 2, 2, "#6FB444");
        R(0, 146, 240, 5, "#B89A6A");
        for (var px = 0; px < 240; px += 6) R(px, 147, 3, 1, "#A58757");
        function house(x, w, h, roof, chim) {
          var by = 134;
          R(x, by - h, w, h, "#D9C4A0");
          R(x, by - h, w, 2, "#6B4423");
          R(x, by - h, 2, h, "#6B4423");
          R(x + w - 2, by - h, 2, h, "#6B4423");
          R(x + Math.floor(w / 2) - 1, by - h, 2, h, "#6B4423");
          for (var i = 0; i <= Math.ceil(w / 2) + 2; i++) R(x - 2 + i, by - h - i, w + 4 - 2 * i, 1, roof);
          R(x + 3, by - 7, 4, 7, "#5A3417");
          R(x + w - 8, by - h + 4, 4, 4, "#3A2A1A");
          R(x + w - 8, by - h + 4, 4, 1, "#6B4423");
          if (chim) R(x + w - 6, by - h - Math.ceil(w / 2) + 1, 3, 6, "#7A7A7A");
        }
        house(14, 22, 14, "#B5893A", true);
        house(44, 18, 12, "#9E3B2B", false);
        R(70, 92, 14, 42, "#9A9A9A");
        for (var ty = 94; ty < 134; ty += 4) R(70 + (ty % 8 ? 0 : 7), ty, 7, 1, "#858585");
        R(68, 90, 18, 3, "#858585");
        for (var cx = 68; cx < 86; cx += 4) R(cx, 87, 2, 3, "#858585");
        R(76, 76, 2, 11, "#5A3417");
        R(78, 76, 6, 4, "#B23A3A");
        R(74, 120, 6, 14, "#3A2A1A");
        house(96, 24, 15, "#B5893A", true);
        R(128, 128, 8, 6, "#8A8A8A");
        R(127, 126, 10, 2, "#6E6E6E");
        R(128, 118, 1, 8, "#5A3417");
        R(135, 118, 1, 8, "#5A3417");
        R(127, 117, 10, 2, "#9E3B2B");
        house(148, 20, 13, "#9E3B2B", true);
        house(178, 26, 16, "#B5893A", false);
        for (var fx = 206; fx < 240; fx += 5) {
          R(fx, 128, 1, 6, "#8B6243");
        }
        R(206, 129, 34, 1, "#8B6243");
        R(206, 132, 34, 1, "#8B6243");
        [
          [8, 128],
          [90, 126],
          [140, 124],
          [226, 122],
        ].forEach(function (t) {
          R(t[0] + 2, t[1], 2, 8, "#5A3417");
          R(t[0], t[1] - 8, 6, 8, "#3E8A2C");
          R(t[0] + 1, t[1] - 10, 4, 2, "#56A63A");
        });
        return o;
      })(),
    ),
    smoke: svgUri(
      240,
      160,
      (function () {
        var o = "";
        [
          [31, 104],
          [117, 100],
          [165, 107],
        ].forEach(function (c) {
          o +=
            '<rect x="' +
            c[0] +
            '" y="' +
            c[1] +
            '" width="3" height="3" fill="#D6D6D6" fill-opacity=".85"/><rect x="' +
            (c[0] + 2) +
            '" y="' +
            (c[1] - 5) +
            '" width="3" height="3" fill="#E4E4E4" fill-opacity=".7"/><rect x="' +
            (c[0] + 4) +
            '" y="' +
            (c[1] - 10) +
            '" width="2" height="2" fill="#EEEEEE" fill-opacity=".5"/>';
        });
        return o;
      })(),
    ),
    walkA: svgUri(
      480,
      160,
      '<rect x="20" y="141" width="2" height="2" fill="#F0C8A0"/><rect x="20" y="143" width="2" height="3" fill="#3E6BA8"/><rect x="20" y="146" width="1" height="2" fill="#3A2A1A"/><rect x="21" y="146" width="1" height="2" fill="#3A2A1A"/>',
    ),
    walkB: svgUri(
      480,
      160,
      '<rect x="300" y="141" width="2" height="2" fill="#E8B88A"/><rect x="300" y="143" width="2" height="3" fill="#8A3E3E"/><rect x="300" y="146" width="1" height="2" fill="#3A2A1A"/><rect x="301" y="146" width="1" height="2" fill="#3A2A1A"/><rect x="298" y="143" width="2" height="2" fill="#B5893A"/><rect x="90" y="142" width="2" height="2" fill="#F0C8A0"/><rect x="90" y="144" width="2" height="3" fill="#5E8A3A"/><rect x="90" y="147" width="1" height="1" fill="#3A2A1A"/><rect x="91" y="147" width="1" height="1" fill="#3A2A1A"/><rect x="93" y="145" width="3" height="2" fill="#EDEDED"/><rect x="93" y="144" width="1" height="1" fill="#EDEDED"/><rect x="93" y="147" width="1" height="1" fill="#3A2A1A"/><rect x="95" y="147" width="1" height="1" fill="#3A2A1A"/>',
    ),
    millTower: svgUri(
      24,
      40,
      '<rect x="7" y="8" width="10" height="32" fill="#C9B48E"/><rect x="6" y="14" width="12" height="26" fill="#BCA680"/><rect x="5" y="22" width="14" height="18" fill="#B09A74"/><rect x="6" y="4" width="12" height="5" fill="#8B5A2B"/><rect x="8" y="2" width="8" height="2" fill="#8B5A2B"/><rect x="10" y="32" width="4" height="8" fill="#5A3417"/><rect x="10" y="18" width="3" height="3" fill="#3A2A1A"/>',
    ),
    millBlades: svgUri(
      32,
      32,
      '<rect x="15" y="1" width="2" height="30" fill="#6B4423"/><rect x="1" y="15" width="30" height="2" fill="#6B4423"/><rect x="17" y="2" width="5" height="12" fill="#EDE3CF"/><rect x="10" y="18" width="5" height="12" fill="#EDE3CF"/><rect x="2" y="10" width="12" height="5" fill="#EDE3CF"/><rect x="18" y="17" width="12" height="5" fill="#EDE3CF"/><rect x="14" y="14" width="4" height="4" fill="#5A3417"/>',
    ),
    sun: svgUri(
      20,
      20,
      (function () {
        var o = "",
          Y = "#FFE066",
          O = "#FFC21A";
        for (var y = 0; y < 20; y++)
          for (var x = 0; x < 20; x++) {
            var dx = x - 9.5,
              dy = y - 9.5,
              dd = dx * dx + dy * dy;
            if (dd <= 30) o += px(x, y, 1, dd <= 12 ? "#FFF3A8" : Y);
            else if (dd <= 42 && (x === 9 || x === 10 || y === 9 || y === 10)) o += px(x, y, 1, O);
          }
        [
          [9, 0],
          [10, 0],
          [9, 19],
          [10, 19],
          [0, 9],
          [0, 10],
          [19, 9],
          [19, 10],
          [3, 3],
          [16, 3],
          [3, 16],
          [16, 16],
        ].forEach(function (p) {
          o += px(p[0], p[1], 1, O);
        });
        return o;
      })(),
    ),
    moon: svgUri(
      16,
      16,
      (function () {
        var o = "",
          c = "#F3EFD2",
          sh = "#D9D3A8";
        for (var y = 0; y < 16; y++)
          for (var x = 0; x < 16; x++) {
            var dx = x - 7.5,
              dy = y - 7.5,
              in1 = dx * dx + dy * dy <= 49,
              in2 = (x - 11.5) * (x - 11.5) + (y - 4.5) * (y - 4.5) <= 25;
            if (in1 && !in2) o += px(x, y, 1, (x + y) % 5 === 0 ? sh : c);
          }
        return o;
      })(),
    ),
  };
  return FX;
}
var mqDark = window.matchMedia ? window.matchMedia("(prefers-color-scheme: dark)") : null;
var CYCLE = ["grass", "day", "mountains", "village", "city", "night", "snow", "ocean", "lava", "nether"],
  lastEff = null;
function effTheme() {
  var t = cfg().theme;
  if (t === "stone") t = "";
  if (!t) {
    var sk = skyState(new Date());
    return sk.alt >= 0 ? "day" : "night";
  }
  if (t === "cycle") {
    var n = new Date();
    return CYCLE[Math.floor(n.getTime() / 36e5) % CYCLE.length];
  }
  return t;
}
function applyTheme(force) {
  var st = document.documentElement.style,
    fx = document.getElementById("fx"),
    eff = effTheme();
  if (!force && eff === lastEff) return;
  lastEff = eff;
  ["--dirt", "--grass", "--bg"].forEach(function (p) {
    st.removeProperty(p);
  });
  if (
    eff === "night" ||
    eff === "day" ||
    eff === "ocean" ||
    eff === "city" ||
    eff === "mountains" ||
    eff === "village"
  ) {
    st.setProperty("--dirt", "none");
    st.setProperty("--grass", "none");
    st.setProperty(
      "--bg",
      eff === "day" || eff === "mountains" || eff === "village"
        ? "#7EC8F2"
        : eff === "ocean"
          ? "#0B2A4A"
          : eff === "city"
            ? "#171A36"
            : "#0B1026",
    );
  } else if (THEMES[eff]) {
    var p = THEMES[eff];
    st.setProperty("--dirt", tile(p.d, null, 7, p.w));
    st.setProperty("--grass", eff === "snow" ? tile(p.d, null, 7, p.w) : tile(p.d, p.g, 11, p.w));
    st.setProperty("--bg", p.bg);
  }
  if (fx) {
    fx.className =
      ["snow", "ocean", "night", "day", "nether", "lava", "city", "mountains", "village"].indexOf(eff) >= 0 ? eff : "";
    if (fx.className) {
      var P = fxPatterns();
      Object.keys(P).forEach(function (k) {
        fx.style.setProperty("--" + k, P[k]);
      });
    }
  }
  updateSky();
}
setInterval(function () {
  applyTheme();
  updateSky();
}, 60000);
window.addEventListener("resize", function () {
  updateSky();
});
document.addEventListener("visibilitychange", function () {
  if (document.visibilityState === "visible") applyTheme();
});
