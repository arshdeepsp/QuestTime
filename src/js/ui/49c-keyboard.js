/* ---- keep the field being typed just above the on-screen keyboard (phones) ---- */

/* Runs once at startup, in file-number order (main.js). */
export function init() {
  (function () {
    function isField(el) {
      return (
        el &&
        (el.tagName === "TEXTAREA" ||
          (el.tagName === "INPUT" &&
            !/^(checkbox|radio|button|submit|range|color|file|date|time|datetime-local|month|week)$/.test(el.type)) ||
          el.isContentEditable)
      );
    }
    function phone() {
      return window.innerWidth <= 720;
    }
    var active = null,
      vv = window.visualViewport;
    function settle() {
      if (!active || !phone()) return;
      try {
        active.scrollIntoView({ block: "end", inline: "nearest", behavior: "smooth" });
      } catch (x) {
        active.scrollIntoView(false);
      }
      if (vv) {
        var r = active.getBoundingClientRect(),
          bottom = vv.offsetTop + vv.height;
        if (r.bottom > bottom - 12) window.scrollBy(0, r.bottom - bottom + 24);
      }
    }
    /* The keyboard can close without the field losing focus (Android back, or a list re-rendering under it), which used
       to leave the tab bar hidden. Track the viewport: once the keyboard has been seen and the viewport is back to full
       height, typing is over. */
    var full = vv ? vv.height : window.innerHeight,
      kbd = false;
    function done() {
      var a = active;
      active = null;
      kbd = false;
      document.body.classList.remove("typing");
      if (a && a.blur && document.activeElement === a) a.blur();
    }
    document.addEventListener("focusin", function (e) {
      if (!isField(e.target) || !phone()) return;
      active = e.target;
      document.body.classList.add("typing");
      setTimeout(settle, 120);
      setTimeout(settle, 400);
    });
    document.addEventListener("focusout", function (e) {
      if (e.target !== active) return;
      active = null;
      setTimeout(function () {
        if (!isField(document.activeElement)) {
          kbd = false;
          document.body.classList.remove("typing");
        } else active = document.activeElement;
      }, 80);
    });
    if (vv)
      vv.addEventListener("resize", function () {
        var h = vv.height;
        if (!document.body.classList.contains("typing")) {
          full = h;
          kbd = false;
          return;
        }
        if (h < full - 150) kbd = true;
        else if (kbd && h >= full - 60) {
          done();
          return;
        }
        if (active && !document.contains(active))
          active = isField(document.activeElement) ? document.activeElement : null;
        if (!active && !isField(document.activeElement)) {
          done();
          return;
        }
        if (active) settle();
      });
  })();
}
